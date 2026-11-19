// Reads a PUBLIC Instagram profile without logging in.
// Profiles that require login (age-restricted, alcohol, etc.) are not readable.
// Reels are ignored: only feed posts (/p/...) are collected.

/** Full-size image of a post: the biggest <img> on the page (og:image is a center-cropped thumbnail). */
async function fullImage(page) {
  const imgs = await page.$$eval('img', (list) =>
    list
      .map((i) => ({ w: i.naturalWidth, h: i.naturalHeight, src: i.currentSrc || i.src }))
      .filter((i) => i.w >= 600 && /cdninstagram|fbcdn/.test(i.src)),
  );
  imgs.sort((a, b) => b.w * b.h - a.w * a.h);
  if (imgs[0]) return imgs[0].src;
  return page.$eval('meta[property="og:image"]', (m) => m.content).catch(() => null);
}

export async function readInstagramPost(context, url, source) {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3500);
    const image = await fullImage(page);
    if (!image) return null;
    const date = await page.$eval('time', (t) => t.getAttribute('datetime')).catch(() => '');
    const text = await page.$eval('meta[property="og:description"]', (m) => m.content).catch(() => '');
    const code = url.match(/\/p\/([^/]+)/)[1];
    return { id: `${source.id}:${code}`, sourceId: source.id, code, source: source.name, channel: 'Instagram', url, image, date, text };
  } finally {
    await page.close();
  }
}

export async function readInstagram(context, source, limit = 4) {
  const page = await context.newPage();
  try {
    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4500);
    const links = await page.$$eval('a[href*="/p/"]', (anchors) => [...new Set(anchors.map((a) => a.href))]);
    const items = [];
    for (const url of links.slice(0, limit)) {
      const item = await readInstagramPost(context, url, source);
      if (item) items.push(item);
    }
    return items;
  } finally {
    await page.close();
  }
}
