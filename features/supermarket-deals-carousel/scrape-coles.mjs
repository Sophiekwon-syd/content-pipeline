#!/usr/bin/env node
// Scrape the REAL Coles weekly catalogue (product-level specials, WITH category)
// via the SaleFinder "catalogue2" viewer that coles.com.au embeds.
//
// How it works (reverse-engineered 2026-07):
//   1. Open the catalogue viewer in a persistent-profile browser (a fresh
//      cookieless context is stopped by Coles' bot manager; the profile carries
//      a normal session through). HTTP cache is disabled via CDP so every
//      request is a real network response we can intercept.
//   2. Intercept /catalogue/svgData/<saleId>/ → page count + sale name + this
//      week's start/end dates.
//   3. Read the viewer's category nav from the page DOM → a list of
//      { name, categoryId-list } (e.g. Pantry → "533,534,…"). "Half Price
//      Specials" is a cross-cutting filter, so it's skipped (those products are
//      also listed under their real department).
//   4. For each category, step through the category view page by page
//      (#view=category&…&categoryId=<ids>&page=N, query cache-buster forces a
//      reload; the viewer fetches that page via /productlist/category/<saleId>/
//      whose product HTML lives in the JSON `content` field). Intercept every
//      response; stop a category when a page returns no products. Each product
//      is tagged with the category it was found in. (SaleFinder uses JSONP, so
//      we intercept the viewer's own requests rather than fetch directly.)
//   5. Parse all captured HTML in-browser (DOMParser) → structured, categorised
//      deals (name, image, was→now price, half-price flag, unit, category).
//
// Usage: node features/supermarket-deals-carousel/scrape-coles.mjs [--out <file>]
//
// ToS note: low-volume read of the public weekly catalogue for a small info
// page — about the same traffic as a person flipping through it category by
// category. Best-effort: SaleFinder/Coles can change this at any time; manual
// entry stays the fallback. Run once per week, not more.

import fs from 'node:fs/promises';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const OUT = arg('--out', path.resolve('features/supermarket-deals-carousel/data/coles-latest.json'));

const STORE = 'coles';
const SALE_ID = arg('--sale', '66622');        // pass --sale <id> for the current week (default = last-known); the /deals-carousel skill discovers it
const AREA = 'c-nsw-met';
const OPEN_URL = `https://www.coles.com.au/catalogues/view#view=catalogue2&saleId=${SALE_ID}&areaName=${AREA}&page=1`;
const PROF = path.resolve(`.${STORE}-scrape-profile`);

const stripJsonp = (t) => { const m = t.match(/^[^(]*\(([\s\S]*)\)\s*;?\s*$/); return m ? m[1] : t; };
const catUrl = (ids, pg, tag) => `https://www.coles.com.au/catalogues/view?rb=${tag}#view=category&saleId=${SALE_ID}&categoryId=${encodeURIComponent(ids)}&areaName=${AREA}&page=${pg}`;

const { chromium } = await import('playwright');
const ctx = await chromium.launchPersistentContext(PROF, { headless: false, viewport: { width: 1500, height: 1000 }, args: ['--disable-blink-features=AutomationControlled'] });
const page = await ctx.newPage();
await ctx.newCDPSession(page).then((c) => c.send('Network.setCacheDisabled', { cacheDisabled: true })).catch(() => {});

let svgMeta = null;
let currentCat = null;
let captureSalepage = false;   // only during the flyer page-pass (pass 2)
const caps = [];   // { category, html }  (category null for flyer-page captures)
page.on('response', async (resp) => {
  try {
    const u = resp.url();
    if (u.includes('/catalogue/svgData/')) {
      const t = (await resp.body().catch(() => null))?.toString('utf8'); if (!t) return;
      const j = JSON.parse(stripJsonp(t));
      svgMeta = { pageCount: (j.catalogue || []).length, saleName: j.saleName, areaName: j.areaName, startDate: j.startDate, endDate: j.endDate, publishDate: j.publishDate };
      return;
    }
    if (!u.includes('/productlist/')) return;
    const isCat = u.includes('/productlist/category/');
    if (isCat && !currentCat) return;          // category response outside the category pass
    if (!isCat && !captureSalepage) return;    // flyer response outside the flyer pass
    const t = (await resp.body().catch(() => null))?.toString('utf8'); if (!t) return;
    const j = JSON.parse(stripJsonp(t));
    const html = j.content || Object.values(j.products || {}).join('\n');
    if (html) caps.push({ category: isCat ? currentCat : null, html });
  } catch {}
});

console.log('opening Coles catalogue viewer…');
await page.goto(OPEN_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(9000);
await page.mouse.click(750, 520).catch(() => {});   // open the cover
for (let i = 0; i < 40 && !svgMeta; i++) await page.waitForTimeout(500);
if (!svgMeta) { console.error('FAILED: viewer never served svgData (likely bot-blocked). Try again later.'); await ctx.close(); process.exit(1); }
console.log(`catalogue: "${svgMeta.saleName}" — ${svgMeta.pageCount} pages, ${svgMeta.startDate} → ${svgMeta.endDate}`);

// Category map from the page DOM (skip the cross-cutting "Half Price Specials").
const catMap = await page.evaluate(() => [...document.querySelectorAll('a[data-categoryid]')]
  .map((a) => ({ name: (a.getAttribute('title') || a.textContent || '').replace(/\s*\d+\s*$/, '').trim(), ids: a.getAttribute('data-categoryid') }))
  .filter((c) => c.name && c.ids && !/half price/i.test(c.name)));
console.log(`categories: ${catMap.map((c) => c.name).join(', ')}`);

// Step through each category, page by page, until a page yields no products.
const countItems = (html) => page.evaluate((h) => new DOMParser().parseFromString(h, 'text/html').querySelectorAll('a.sf-item').length, html);
for (let ci = 0; ci < catMap.length; ci++) {
  const cat = catMap[ci];
  let got = 0;
  for (let pg = 1; pg <= 12; pg++) {
    const before = caps.length;
    currentCat = cat.name;
    await page.goto(catUrl(cat.ids, pg, `c${ci}p${pg}`), { waitUntil: 'domcontentloaded' }).catch(() => {});
    for (let w = 0; w < 18 && caps.length === before; w++) await page.waitForTimeout(400);
    if (caps.length === before) break;             // no response → end of category
    const n = await countItems(caps[caps.length - 1].html);
    got += n;
    if (n === 0) break;                            // empty page → end of category
    await page.waitForTimeout(600);
  }
  currentCat = null;
  console.log(`  [${cat.name}] ${got} products`);
}

// Pass 2: the full flyer, page by page, to also capture products that aren't
// filed under any department (front-page / feature tiles) — these keep
// category = null (the category pass, which sits earlier in `caps`, wins the
// tag for anything that appears in both).
captureSalepage = true;
const flyerUrl = (p) => `https://www.coles.com.au/catalogues/view?rb=p${p}#view=catalogue2&saleId=${SALE_ID}&areaName=${AREA}&page=${p}`;
for (let p = 1; p <= svgMeta.pageCount; p++) {
  const before = caps.length;
  await page.goto(flyerUrl(p), { waitUntil: 'domcontentloaded' }).catch(() => {});
  for (let w = 0; w < 14 && caps.length === before; w++) await page.waitForTimeout(400);
  if (p % 10 === 0 || p === svgMeta.pageCount) console.log(`  flyer ${p}/${svgMeta.pageCount} — total caps ${caps.length}`);
}

// Parse every captured page's HTML in-browser; tag with category; dedupe by itemId.
const products = await page.evaluate((caps) => {
  const parse = (html) => [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('a.sf-item')].map((a) => {
    const name = (a.getAttribute('title') || a.querySelector('.sf-item-heading')?.textContent || '').trim();
    const img = a.querySelector('img')?.getAttribute('src') || '';
    const half = a.classList.contains('sf-halfspecial');
    const txt = a.textContent.replace(/\s+/g, ' ').trim();
    const itemId = a.getAttribute('data-itemid') || '';
    // Family id = the SaleFinder product-stamp stockcode that groups variants
    // (one stamp, many itemIds). Present on the shelf stamp; read it from the
    // anchor or nearest ancestor if this fragment carries it. Empty otherwise
    // (then the renderer falls back to the name heuristic).
    const familyId = a.getAttribute('data-stockcode') || a.closest('[data-stockcode]')?.getAttribute('data-stockcode') || '';
    return { name, img, half, txt, itemId, familyId };
  }).filter((x) => x.name);
  const seen = new Map();
  for (const { category, html } of caps) for (const pr of parse(html)) {
    const k = pr.itemId || pr.name;
    if (seen.has(k)) continue;
    const money = (re) => { const m = pr.txt.match(re); return m ? m[1] : null; };
    seen.set(k, { name: pr.name, img: pr.img, half: pr.half, was: money(/Was\s*\$([\d.,]+)/i), now: money(/\$([\d.,]+)\s*each/i) || money(/\$([\d.,]+)/), unit: (pr.txt.match(/each|per \d+\s*\w+|\d+\s*pk/i) || [])[0] || '', itemId: pr.itemId, familyId: pr.familyId, category });
  }
  return [...seen.values()];
}, caps);

await ctx.close();

const clean = products.map((p) => {
  const was = p.was ? Number(String(p.was).replace(/,/g, '')) : null;
  const now = p.now ? Number(String(p.now).replace(/,/g, '')) : null;
  return { store: STORE, category: p.category || null, name: p.name, was, now, halfPrice: !!p.half, unit: p.unit || '', image: p.img || '', itemId: p.itemId || '', familyId: p.familyId || '', save: was && now ? `$${(was - now).toFixed(2)}` : null };
});
const perCat = catMap.map((c) => ({ category: c.name, count: clean.filter((i) => i.category === c.name).length }));
const out = { store: STORE, sale_name: svgMeta.saleName, area: svgMeta.areaName, week_start: svgMeta.startDate, week_end: svgMeta.endDate, published: svgMeta.publishDate, pages: svgMeta.pageCount, categories: perCat, scraped_at: new Date().toISOString(), count: clean.length, items: clean };
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(out, null, 2));
const uncat = clean.filter((i) => !i.category).length;
console.log(`\n${clean.length} Coles deals → ${OUT}  (uncategorised: ${uncat})`);
