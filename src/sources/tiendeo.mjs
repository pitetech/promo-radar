import { log } from '../log.mjs';

const API = 'https://shopfully-publication-api.global.ssl.fastly.net/publication_pages/pt_br';

/**
 * Reads the current flyers of one retailer from Tiendeo (a public flyer aggregator).
 * `source.url` is the retailer page for your city, e.g.
 *   https://www.tiendeo.com.br/araraquara/atacadao
 *
 * Tiendeo blocks plain HTTP clients, so the retailer page is opened in the browser.
 * The flyer pages themselves come from a public image API (no browser needed).
 *
 * Returns one item per flyer page, newest flyer first; inside a flyer the pages are
 * listed last → first so that, after the pipeline reverses the list, the chat reads
 * flyer by flyer, page 1 first.
 */
export async function readTiendeo(context, source, { maxFlyers = 2, pagesPerFlyer = 3 } = {}) {
  const page = await context.newPage();
  try {
    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const info = await page.evaluate(() => {
      const raw = document.getElementById('__NEXT_DATA__')?.textContent;
      if (!raw) return null;
      const pp = JSON.parse(raw).props.pageProps;
      const retailerId = pp.pageInfo?.retailer?.id;
      const flyers = new Map();
      (function walk(o) {
        if (!o || typeof o !== 'object') return;
        if (o.id && o.title && o.end_date && o.retailer_id) flyers.set(o.id, o);
        for (const k in o) walk(o[k]);
      })(pp);
      return { retailerId, flyers: [...flyers.values()].map((f) => ({
        id: f.id, retailerId: f.retailer_id, title: f.title, start: f.start_date, end: f.end_date,
        publicationUrl: f.publication_url,
      })) };
    });
    if (!info?.retailerId) throw new Error('retailer page not recognised (wrong url, or the retailer is not in this city)');

    const today = new Date().toISOString().slice(0, 10);
    const own = info.flyers
      .filter((f) => String(f.retailerId) === String(info.retailerId) && String(f.end).slice(0, 10) >= today)
      .sort((a, b) => Number(b.id) - Number(a.id))
      .slice(0, maxFlyers);

    const items = [];
    for (const f of own) {
      const pub = f.publicationUrl?.match(/pt_br_(\d+)/)?.[1];
      if (!pub) continue;
      const images = (await fetchPages(pub)).slice(0, pagesPerFlyer);
      const valid = `válido até ${formatDay(f.end)}`;
      images
        .map((image, i) => ({ image, n: i + 1 }))
        .filter((p) => p.image)
        .reverse()
        .forEach(({ image, n }) =>
          items.push({
            id: `tiendeo:${f.id}:${n}`,
            sourceId: source.id,
            code: String(f.id),
            source: source.name,
            channel: 'Tiendeo',
            url: `https://www.tiendeo.com.br/Catalogos/${f.id}`,
            image,
            date: valid,
          }),
        );
    }
    return items;
  } finally {
    await page.close();
  }
}

/** Biggest JPEG of every page of a flyer. One request returns all the pages. */
async function fetchPages(pub) {
  const res = await fetch(`${API}/${pub}/1?format=all`);
  if (!res.ok) {
    log(`tiendeo: publication ${pub} unavailable (${res.status})`);
    return [];
  }
  const json = await res.json();
  const total = json.publicationDescriptor?.numberOfPages || 1;
  const images = [];
  for (let n = 1; n <= total; n++) {
    const best = (json[n]?.pageRepresentationDescriptors || [])
      .filter((d) => d.type === 'image' && /\.jpe?g$/i.test(d.pageRepresentation.resourcePath))
      .sort((a, b) => b.width - a.width)[0];
    images.push(best ? `https://${best.pageRepresentation.resourcePath}` : null);
  }
  return images;
}

function formatDay(iso) {
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}`;
}
