import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, loadState, saveState, requireDestination } from './config.mjs';
import { collect, launchBrowser } from './collect.mjs';
import { planRun, latestPerSource, formatCaption } from './pipeline.mjs';
import { connect, sendImage } from './whatsapp.mjs';
import { deliver } from './deliver.mjs';
import { filterPromos } from './ocr.mjs';
import { readInstagramPost } from './sources/instagram.mjs';
import { igLogin, igProfileDir } from './ig-login.mjs';
import { log, sleep } from './log.mjs';

const SETTLE_MS = 5000; // let WhatsApp flush pending writes before closing

async function withSocket(cfg, fn) {
  requireDestination(cfg);
  const sock = await connect(cfg);
  try {
    await fn(sock);
    await sleep(SETTLE_MS);
  } finally {
    sock.end();
  }
}

function printItems(items, cfg) {
  for (const item of items) {
    console.log(`- [${item.id}] ${item.channel} ${item.date || ''}\n    ${item.url}\n    ${formatCaption(cfg.caption.first, item, cfg).replace(/\n/g, ' | ')}`);
  }
}

export const commands = {
  /** One-time: opens a visible Chrome so you can log in to Instagram (needed for stories). */
  async 'ig-login'() {
    const cfg = loadConfig();
    const ok = await igLogin(cfg);
    log(ok ? `Instagram session saved in ${igProfileDir(cfg)}` : 'No session detected (timed out).');
    if (!ok) process.exitCode = 1;
  },

  /** Default: send only what is new since the last run. */
  async run({ dryRun }) {
    const cfg = loadConfig();
    const state = loadState(cfg);
    const items = await collect(cfg);
    log('read', items.length, 'posts from', cfg.sources.length, 'sources');
    const plan = planRun(items, state, cfg.sources);
    for (const id of plan.newlyInitialized) log('baseline registered for source', id, '(nothing sent)');

    // Only promotions go to the group: notices (hours, hiring, campaigns) are dropped.
    const { keep, rejected } = await filterPromos(plan.fresh, cfg);
    plan.fresh = keep;
    for (const r of rejected) log('skipped', r.id, r.reason);

    if (dryRun) {
      log('DRY RUN: nothing sent, state untouched.');
      log('would send', plan.fresh.length, 'items');
      printItems(plan.fresh, cfg);
      return;
    }
    state.seen.push(...plan.silentlySeen, ...rejected.map((r) => r.id));
    state.initializedSources.push(...plan.newlyInitialized);
    saveState(cfg, state);

    if (!plan.fresh.length) return log('nothing new');
    await withSocket(cfg, (sock) =>
      deliver(sock, cfg, plan.fresh, (item) => {
        state.seen.push(item.id);
        saveState(cfg, state);
      }),
    );
  },

  /** Read-only: shows what each source returns. No WhatsApp, no state. */
  async collect() {
    const cfg = loadConfig();
    const items = await collect(cfg);
    log('read', items.length, 'posts');
    printItems(items, cfg);
  },

  /** Link a WhatsApp number (QR code, or pairing code if PAIR_PHONE is set). */
  async pair() {
    const cfg = loadConfig();
    const sock = await connect(cfg, { pairing: true });
    log('Paired. Saving session...');
    await sleep(8000); // do not exit before the credentials are written to disk
    sock.end();
    log('Session saved.');
  },

  /** Lists the groups whose name contains <name>; --save stores the id in config.json. */
  async 'find-group'({ args, flags }) {
    const name = args[0];
    if (!name) throw new Error('Usage: find-group <part of the group name> [--save]');
    const cfg = loadConfig();
    const sock = await connect(cfg);
    try {
      const groups = Object.values(await sock.groupFetchAllParticipating());
      const found = groups.filter((g) => g.subject.toLowerCase().includes(name.toLowerCase()));
      for (const g of found) console.log(`${g.subject} | ${g.id} | ${g.participants.length} members`);
      if (!found.length) console.log('No group found.');
      if (flags.save && found.length === 1) {
        const raw = JSON.parse(fs.readFileSync(cfg.configFile, 'utf8'));
        raw.destination = found[0].id;
        fs.writeFileSync(cfg.configFile, JSON.stringify(raw, null, 2));
        console.log('destination saved to', cfg.configFile);
      }
      await sleep(3000);
    } finally {
      sock.end();
    }
  },

  /**
   * Manual: sends the newest post of every source (useful to validate the setup).
   * Optional source ids restrict it, e.g. `send-latest atacadao-td tonin-td`.
   */
  async 'send-latest'({ args, dryRun }) {
    const cfg = loadConfig();
    const state = loadState(cfg);
    const sources = args.length ? cfg.sources.filter((s) => args.includes(s.id)) : cfg.sources;
    if (!sources.length) throw new Error(`No source matches: ${args.join(', ')}`);
    const picked = latestPerSource(await collect(cfg, sources), sources);
    printItems(picked, cfg);
    if (dryRun) return log('DRY RUN: nothing sent.');
    await withSocket(cfg, (sock) =>
      deliver(sock, cfg, picked, (item) => {
        if (!state.seen.includes(item.id)) state.seen.push(item.id);
        saveState(cfg, state);
      }),
    );
  },

  /**
   * Manual: sends local images listed in a JSON manifest: [{ "file": "a.jpg", "caption": "..." }].
   * File paths are relative to the manifest. Handy for stories you collected by hand.
   */
  async 'send-files'({ args, dryRun }) {
    if (!args[0]) throw new Error('Usage: send-files <manifest.json>');
    const cfg = loadConfig();
    const base = path.dirname(path.resolve(args[0]));
    const entries = JSON.parse(fs.readFileSync(args[0], 'utf8'));
    for (const e of entries) if (!fs.existsSync(path.join(base, e.file))) throw new Error(`File not found: ${e.file}`);
    if (dryRun) return log('DRY RUN:', entries.length, 'files would be sent.');
    await withSocket(cfg, async (sock) => {
      for (const e of entries) {
        await sendImage(sock, requireDestination(cfg), fs.readFileSync(path.join(base, e.file)), e.caption || '');
        log('sent', e.file);
      }
    });
  },

  /** Manual: send specific Instagram posts, e.g. `send-post my-source:Df234ARl8m_`. */
  async 'send-post'({ args, dryRun }) {
    if (!args.length) throw new Error('Usage: send-post <sourceId:postCode> ...');
    const cfg = loadConfig();
    const state = loadState(cfg);
    const browser = await launchBrowser(cfg);
    const context = await browser.newContext({ locale: cfg.browser.locale, viewport: { width: 1280, height: 1600 } });
    const items = [];
    try {
      for (const arg of args) {
        const [sourceId, code] = arg.split(':');
        const source = cfg.sources.find((s) => s.id === sourceId);
        if (!source || source.type !== 'instagram') throw new Error(`"${sourceId}" is not an Instagram source in config.`);
        const item = await readInstagramPost(context, `https://www.instagram.com/p/${code}/`, source);
        if (item) items.push(item);
        else log('no image found for', arg);
      }
    } finally {
      await browser.close();
    }
    printItems(items, cfg);
    if (dryRun) return log('DRY RUN: nothing sent.');
    await withSocket(cfg, (sock) =>
      deliver(sock, cfg, items, (item) => {
        if (!state.seen.includes(item.id)) state.seen.push(item.id);
        saveState(cfg, state);
      }),
    );
  },
};
