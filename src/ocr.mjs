import { createWorker } from 'tesseract.js';
import { rejection } from './promo-filter.mjs';

/**
 * Splits items into {keep, rejected}. Photos of the same post are judged together:
 * the post is kept if any of its photos reads as a promotion.
 * If OCR itself fails, the item is kept (better a notice than a lost promo).
 */
export async function filterPromos(items, cfg = {}) {
  const scopes = new Map((cfg.sources || []).map((s) => [s.id, s.scope || 'local']));
  const needsOcr = items.filter((i) => i.channel !== 'Tiendeo');
  if (!needsOcr.length) return { keep: items, rejected: [] };
  const worker = await createWorker('por');
  const verdict = new Map(); // post url -> reason (null = promo)
  try {
    for (const item of items) {
      if (verdict.get(item.url) === null) continue;
      let reason;
      try {
        const res = await fetch(item.image);
        if (!res.ok) throw new Error(`download ${res.status}`);
        const { data } = await worker.recognize(Buffer.from(await res.arrayBuffer()));
        reason = rejection(item, data.text, { city: cfg.city, scope: scopes.get(item.sourceId) });
      } catch (e) {
        reason = null;
      }
      if (reason === null || !verdict.has(item.url)) verdict.set(item.url, reason);
    }
  } finally {
    await worker.terminate();
  }
  const keep = [];
  const rejected = [];
  for (const item of items) (verdict.get(item.url) === null ? keep : rejected).push({ ...item, reason: verdict.get(item.url) });
  return { keep, rejected };
}
