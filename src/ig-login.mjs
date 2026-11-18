import path from 'node:path';
import { chromium } from 'playwright';
import { log, sleep } from './log.mjs';

/** Profile folder used by the robot for Instagram stories (kept in data/, never committed). */
export function igProfileDir(cfg) {
  return path.resolve(cfg.dataDir, 'ig-profile');
}

/** Opens the robot's own Chrome profile (headed or headless). Same profile = same login. */
export function openIgProfile(cfg, { headless }) {
  return chromium.launchPersistentContext(igProfileDir(cfg), {
    channel: cfg.browser.channel || undefined,
    headless,
    locale: cfg.browser.locale,
    viewport: headless ? { width: 1280, height: 1600 } : null,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled'],
  });
}

export async function hasSession(context) {
  const cookies = await context.cookies('https://www.instagram.com');
  return cookies.some((c) => c.name === 'sessionid' && c.value);
}

/**
 * One-time manual login: opens a visible Chrome window; YOU type the credentials.
 * Resolves when a session cookie shows up (or after the timeout).
 */
export async function igLogin(cfg, minutes = 10) {
  const context = await openIgProfile(cfg, { headless: false });
  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded' });
    log('Chrome window opened. Log in to Instagram there (use the secondary account).');
    const deadline = Date.now() + minutes * 60_000;
    while (Date.now() < deadline) {
      if (await hasSession(context)) {
        log('Session detected. Saving…');
        await sleep(8000); // let Chrome flush cookies to disk before closing
        return true;
      }
      await sleep(2000);
    }
    return false;
  } finally {
    await context.close();
  }
}
