import { sendImage } from './whatsapp.mjs';
import { formatCaption } from './pipeline.mjs';
import { log } from './log.mjs';

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Sends items to the configured destination. Photos of the same post share one
 * link: only the first one carries the full caption.
 * `onSent(item)` runs after each successful send (used to persist state).
 */
export async function deliver(sock, cfg, items, onSent) {
  const withLink = new Set();
  for (const item of items) {
    const template = withLink.has(item.url) ? cfg.caption.continuation : cfg.caption.first;
    const image = await download(item.image);
    await sendImage(sock, cfg.destination, image, formatCaption(template, item, cfg));
    withLink.add(item.url);
    log('sent', item.id, item.url);
    await onSent?.(item);
  }
}
