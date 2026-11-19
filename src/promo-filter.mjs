// Decides whether a post is a promotion (prices/offers) or just a notice
// (opening hours, hiring, campaigns...). Pure logic: easy to test.

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Each entry counts once, however many times it appears.
const PROMO = [
  ['price', /r\$\s*\d|\b\d{1,3},\d{2}\b|\b\d{1,3}\s?[º°]{1,2}\b/],
  ['unit', /\b\d*\s?(kg|un|und|pct|lt|ml|g)\b/],
  ['offer', /\bofert/],
  ['promo', /\bpromo[cç]|\bpromocao/],
  ['discount', /desconto|\b\d{1,2}\s?%|\boff\b/],
  ['validity', /valid[ao]s?\b|ate o dia|ate dia|enquanto durarem|so hoje|ate \d{1,2}\/\d{1,2}/],
  ['event', /feirao|black ?friday|esquenta black|saldao|liquida|leve \d|pague \d|a partir de|ambev day|super ?feirao/],
];

// Notices that are not promotions.
const NOTICE = [
  /horario de funcionamento|horario especial|funcionamento/,
  /atencao,? clientes|prezados|comunicado|aviso/,
  /contratando|vagas?\b|curriculo|seja nosso time/,
  /sorteio|ganhador|vencedor|premio|parabens|feliz |dia (do|da|dos|das|de) |consciencia negra|proclamacao|novembro azul|combate ao cancer/,
];

export function classify(...texts) {
  const text = norm(texts.filter(Boolean).join(' \n '));
  const hits = PROMO.filter(([, re]) => re.test(text)).map(([name]) => name);
  const prices = (text.match(/r\$\s*\d/g) || []).length;
  const notice = NOTICE.filter((re) => re.test(text)).length;
  // A notice needs strong proof of prices to count as a promo anyway.
  const needed = notice ? 4 : 2;
  // Words like "ofertas" or "black friday" alone are teasers: need price, validity or discount too.
  const hard = hits.some((h) => ['price', 'validity', 'discount'].includes(h));
  const promo = hard && hits.length >= needed;
  return { promo, hits, notice, score: hits.length };
}

/** Returns the reason string when the post is NOT a promo, otherwise null. */
export function rejection(item, ocrText) {
  if (item.channel === 'Tiendeo') return null; // flyers are promos by definition
  const r = classify(item.text, ocrText);
  return r.promo ? null : `not a promo (signals: ${r.hits.join(',') || 'none'}${r.notice ? '; notice' : ''})`;
}
