import { chromium } from 'playwright';
import { readFacebook } from './sources/facebook.mjs';
import { readInstagram } from './sources/instagram.mjs';
import { readTiendeo } from './sources/tiendeo.mjs';
import { log } from './log.mjs';

const READERS = {
  facebook: (ctx, source, cfg) => readFacebook(ctx, source, cfg.postsPerSource.facebook),
  instagram: (ctx, source, cfg) => readInstagram(ctx, source, cfg.postsPerSource.instagram),
  tiendeo: (ctx, source, cfg) => readTiendeo(ctx, source, cfg.tiendeo),
};

export function launchBrowser(cfg) {
  const options = cfg.browser.channel ? { channel: cfg.browser.channel } : {};
  return chromium.launch(options);
}

/** Reads every configured source. A failing source is logged and skipped, never fatal. */
export async function collect(cfg, sources = cfg.sources) {
  const browser = await launchBrowser(cfg);
  const context = await browser.newContext({ locale: cfg.browser.locale, viewport: { width: 1280, height: 1600 } });
  const items = [];
  try {
    for (const source of sources) {
      try {
        items.push(...(await READERS[source.type](context, source, cfg)));
      } catch (err) {
        log(`ERROR reading source ${source.id}:`, err.message);
      }
    }
  } finally {
    await browser.close();
  }
  return items;
}
