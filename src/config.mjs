import fs from 'node:fs';
import path from 'node:path';

/** Defaults: every key can be overridden in config.json. */
export const DEFAULTS = {
  // WhatsApp target: a phone number with country code (e.g. "5511999999999")
  // or a group id ("1203...@g.us", see `npm run find-group`).
  destination: null,
  timezone: 'America/Sao_Paulo',
  // Only promotions for this city are sent. Sources with scope "chain" must name the city in the post.
  city: 'Araraquara',
  // channel "chrome" uses the Google Chrome installed on the machine.
  // Use null to use the Chromium downloaded by `npx playwright install chromium`.
  browser: { channel: 'chrome', locale: 'pt-BR' },
  // How many of the most recent posts to read per source type, on every run.
  postsPerSource: { facebook: 6, instagram: 4 },
  // Tiendeo flyers: newest flyers read per retailer, and how many pages of each are sent.
  tiendeo: { maxFlyers: 2, pagesPerFlyer: 3 },
  // Placeholders: {source} {channel} {date} {url}
  caption: {
    first: '🛒 {source} · {channel}\n{date}\n{url}',
    continuation: '🛒 {source} (continuação)',
  },
  dataDir: 'data',
  sources: [],
};

const SOURCE_TYPES = ['facebook', 'instagram', 'tiendeo'];

export function loadConfig(file = process.env.PROMO_CONFIG || 'config.json') {
  if (!fs.existsSync(file)) {
    throw new Error(`Config file not found: ${file}. Copy config.example.json to config.json and edit it.`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cfg = {
    ...DEFAULTS,
    ...raw,
    browser: { ...DEFAULTS.browser, ...raw.browser },
    postsPerSource: { ...DEFAULTS.postsPerSource, ...raw.postsPerSource },
    tiendeo: { ...DEFAULTS.tiendeo, ...raw.tiendeo },
    caption: { ...DEFAULTS.caption, ...raw.caption },
  };
  cfg.configFile = file;
  validate(cfg);
  return cfg;
}

export function validate(cfg) {
  if (!Array.isArray(cfg.sources) || cfg.sources.length === 0) {
    throw new Error('config.sources must be a non-empty array.');
  }
  const ids = new Set();
  for (const s of cfg.sources) {
    if (!s.id || !/^[a-z0-9_-]+$/i.test(s.id)) throw new Error(`Invalid source id "${s.id}" (use letters, digits, - or _).`);
    if (ids.has(s.id)) throw new Error(`Duplicate source id "${s.id}".`);
    ids.add(s.id);
    if (!SOURCE_TYPES.includes(s.type)) throw new Error(`Source "${s.id}": type must be one of ${SOURCE_TYPES.join(', ')}.`);
    if (!/^https:\/\//.test(s.url || '')) throw new Error(`Source "${s.id}": url must start with https://`);
    if (s.scope && !['local', 'chain'].includes(s.scope)) throw new Error(`Source "${s.id}": scope must be local or chain.`);
    if (!s.name) s.name = s.id;
  }
}

export function requireDestination(cfg) {
  if (!cfg.destination) throw new Error('config.destination is not set (phone number or group id).');
  return cfg.destination;
}

/** Persistent state: ids already delivered + sources whose history was already registered. */
export function loadState(cfg) {
  const file = path.join(cfg.dataDir, 'state.json');
  if (!fs.existsSync(file)) return { seen: [], initializedSources: [] };
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { seen: s.seen || [], initializedSources: s.initializedSources || [] };
}

export function saveState(cfg, state) {
  fs.mkdirSync(cfg.dataDir, { recursive: true });
  fs.writeFileSync(path.join(cfg.dataDir, 'state.json'), JSON.stringify(state, null, 1));
}
