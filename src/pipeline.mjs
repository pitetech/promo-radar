// Pure logic (no I/O): easy to test.

/**
 * Decides what to send on a normal run.
 * - Items already seen are ignored.
 * - The first time a source is read, its existing posts are only registered
 *   (baseline) so the group does not receive old posts.
 */
export function planRun(items, state, sources) {
  const seen = new Set(state.seen);
  const initialized = new Set(state.initializedSources);
  const fresh = [];
  const silentlySeen = [];
  const newlyInitialized = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    if (!initialized.has(item.sourceId)) silentlySeen.push(item.id);
    else fresh.push(item);
  }
  for (const s of sources) {
    if (!initialized.has(s.id) && items.some((i) => i.sourceId === s.id)) newlyInitialized.push(s.id);
  }
  // Feeds list newest first; deliver oldest first so the chat reads in order.
  return { fresh: [...fresh].reverse(), silentlySeen, newlyInitialized };
}

/** Most recent post of each source (all photos of that post for Facebook). */
export function latestPerSource(items, sources) {
  const picked = [];
  for (const s of sources) {
    const own = items.filter((i) => i.sourceId === s.id);
    if (!own.length) continue;
    if (s.type === 'facebook') {
      // Facebook photo ids grow over time: the biggest one is the newest.
      const newest = [...own].sort((a, b) => (BigInt(b.code) > BigInt(a.code) ? 1 : -1))[0];
      picked.push(...own.filter((i) => i.url === newest.url));
    } else {
      const newest = [...own].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      picked.push(newest);
    }
  }
  return picked;
}

export function formatDate(value, cfg) {
  if (/^\d{4}-\d{2}-\d{2}T/.test(value || '')) {
    return new Date(value).toLocaleString(cfg.browser.locale, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: cfg.timezone,
    });
  }
  return value || '';
}

export function formatCaption(template, item, cfg) {
  const values = { source: item.source, channel: item.channel, date: formatDate(item.date, cfg), url: item.url };
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}
