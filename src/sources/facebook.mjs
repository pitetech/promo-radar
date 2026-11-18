// Reads a PUBLIC Facebook page without logging in.

/**
 * Lists the most recent photos of a page. A Facebook post can have several
 * photos; each photo becomes one item, and items of the same post share `url`
 * (the post permalink).
 */
export async function readFacebook(context, source, limit = 6) {
  const page = await context.newPage();
  try {
    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000);
    const codes = await page.$$eval('a[href*="fbid="]', (anchors) => {
      const out = [];
      for (const a of anchors) {
        const m = a.href.match(/fbid=(\d+)/);
        if (m && !out.includes(m[1])) out.push(m[1]);
      }
      return out;
    });
    const items = [];
    for (const code of codes.slice(0, limit)) {
      const photo = await readPhoto(context, code, source.url.replace(/\/$/, ''));
      if (photo) {
        items.push({ id: `${source.id}:${code}`, sourceId: source.id, code, source: source.name, channel: 'Facebook', ...photo });
      }
    }
    return items;
  } finally {
    await page.close();
  }
}

async function readPhoto(context, fbid, pageUrl) {
  const page = await context.newPage();
  try {
    const photoUrl = `https://www.facebook.com/photo/?fbid=${fbid}`;
    await page.goto(photoUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3500);
    const images = await page.$$eval('img', (imgs) =>
      imgs
        .filter((i) => i.src.includes('scontent') && i.naturalWidth > 400)
        .map((i) => ({ src: i.src, area: i.naturalWidth * i.naturalHeight })),
    );
    if (!images.length) return null;
    images.sort((a, b) => b.area - a.area);
    const text = await page.evaluate(() => document.body.innerText);
    const date = (text.match(/(\w+, \d{1,2} de \w+ de \d{4} às \d{2}:\d{2})/) || [])[1] || '';
    // The photo page HTML embeds the id of the parent post. A one-photo post
    // has no separate id, so the post is the photo itself.
    const html = await page.content();
    const ids = [...new Set([...html.matchAll(/"post_id":"(\d{10,})/g)].map((m) => m[1]))];
    const postId = ids.find((x) => x !== fbid) || fbid;
    const url = postId === fbid ? photoUrl : `${pageUrl}/posts/${postId}`;
    return { url, image: images[0].src, date };
  } finally {
    await page.close();
  }
}
