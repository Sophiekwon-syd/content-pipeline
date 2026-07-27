#!/usr/bin/env node
// Scrape REAL Woolworths weekly specials (was→now, half-price, product image)
// via Woolworths' own browse API, from inside a persistent-profile Playwright
// session (bare fetch is 403'd; a fresh context is more likely to be challenged).
//
// Flow (reverse-engineered 2026-07): establish a session on /shop/browse/specials
// → GET /apis/ui/PiesCategoriesWithSpecials for the specials category tree → for
// each deals-page category, match the REAL top-level category node by name (the
// earlier scraper only looked at leaf nodes, whose names never matched, so it
// returned almost nothing) → POST /apis/ui/browse/category per category (paginated)
// → keep items where WasPrice > Price → map to the deals schema.
//
// Why not the SaleFinder catalogue viewer? Woolworths' viewer embeds only the
// product name + the single advertised price + a hotspot box in svgData — no
// structured was-price and no per-product image — so it can't feed the deal cards.
// This browse-specials endpoint returns the full was/now/half/image, which is the
// same set of weekly deals the catalogue advertises.
//
// Usage: node features/supermarket-deals-carousel/scrape-woolworths.mjs [--top 16] [--out <file>]
//
// ToS note: low-volume read of public weekly specials for a small info page.
// Best-effort — Woolworths can change the API at any time; manual entry stays
// the fallback. Run once per week, not more.

import fs from 'node:fs/promises';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const TOP = Number(arg('--top', 16));          // top N deals per category (by $ saved)
const OUT = arg('--out', path.resolve('features/supermarket-deals-carousel/data/woolworths-latest.json'));
const PROF = path.resolve('.woolies-scrape-profile');

// handle -> regex against the REAL Woolworths specials top-level department
// names. We scrape every department that maps to a canonical bucket (see
// categories.json); the matched node's own name is stored as the native
// `category`, and categories.json later maps native name -> shared bucket.
// Matched at any depth; shallowest match wins.
const TARGETS = [
  ['dairy',        /dairy, eggs/i],
  ['snacks',       /snacks & confectionery/i],
  ['frozen',       /freezer|frozen/i],
  ['pantry',       /^pantry$/i],
  ['drinks',       /^drinks$/i],
  ['household',    /cleaning & maintenance/i],
  ['meat',         /poultry, meat & seafood/i],
  ['deli',         /^deli$/i],
  ['bakery',       /^bakery$/i],
  ['fruitveg',     /fruit|veg/i],
  ['baby',         /^baby$/i],
  ['pet',          /^pet$/i],
  ['beauty',       /^beauty$/i],
  ['personalcare', /personal care/i],
  ['health',       /health & wellness/i],
];

const { chromium } = await import('playwright');
const ctx = await chromium.launchPersistentContext(PROF, { headless: false, viewport: { width: 1360, height: 950 }, args: ['--disable-blink-features=AutomationControlled'] });
const page = await ctx.newPage();
console.log('establishing Woolworths session…');
await page.goto('https://www.woolworths.com.au/shop/browse/specials', { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(7000);

// 1) full category tree (every node, with depth)
const tree = await page.evaluate(async () => {
  const cats = await (await fetch('/apis/ui/PiesCategoriesWithSpecials', { credentials: 'include', headers: { accept: 'application/json' } })).json();
  const out = [];
  const walk = (n, d) => { out.push({ id: n.NodeId, name: n.Description, depth: d }); (n.Children || []).forEach((c) => walk(c, d + 1)); };
  (cats.Categories || []).forEach((n) => walk(n, 0));
  return out;
});

const result = [];
const used = new Set();
for (const [label, rx] of TARGETS) {
  // shallowest matching node not already used → broadest category browse
  const node = tree.filter((n) => rx.test(n.name) && !used.has(n.id)).sort((a, b) => a.depth - b.depth)[0];
  if (!node) { console.warn(`  [${label}] no matching category`); continue; }
  used.add(node.id);

  // 2) browse this category's specials, paginated
  const products = [];
  for (let pn = 1; pn <= 3; pn++) {
    const batch = await page.evaluate(async ({ categoryId, pn }) => {
      const body = { categoryId, pageNumber: pn, pageSize: 36, sortType: 'TraderRelevance',
        url: '/shop/browse/specials', location: '/shop/browse/specials', formatObject: '{"name":"Specials"}',
        isSpecial: true, isBundle: false, isMobile: false, filters: [], token: '', gpBoost: 0,
        isHideUnavailableProducts: true, enableAdReRanking: false, groupEdmVariants: true, categoryVersion: 'v2' };
      const j = await (await fetch('/apis/ui/browse/category', { method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) })).json();
      const arr = []; (j.Bundles || []).forEach((b) => (b.Products || []).forEach((p) => arr.push(p)));
      return arr.map((p) => ({ name: p.DisplayName, price: p.Price, was: p.WasPrice, savings: p.SavingsAmount, half: p.IsHalfPrice, onSpecial: p.IsOnSpecial, cup: p.CupString, img: p.LargeImageFile }));
    }, { categoryId: node.id, pn }).catch(() => []);
    if (!batch.length) break;
    products.push(...batch);
    await page.waitForTimeout(900 + Math.random() * 900);
  }

  const deals = products
    .filter((p) => p.onSpecial && p.was && p.price < p.was)
    .sort((a, b) => (b.savings || (b.was - b.price)) - (a.savings || (a.was - a.price)))
    .slice(0, TOP)
    .map((p) => ({
      store: 'woolworths', category: node.name, name: p.name,
      price: Number(Number(p.price).toFixed(2)), was: Number(Number(p.was).toFixed(2)),
      save: `$${Number(p.savings || p.was - p.price).toFixed(2)}`,
      halfPrice: !!p.half, unit: p.cup || '', image: p.img || '',
    }));
  console.log(`  [${label}] "${node.name}" (depth ${node.depth}) → ${deals.length} top deals`);
  result.push(...deals);
  await page.waitForTimeout(1000 + Math.random() * 1000);
}
await ctx.close();

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify({ store: 'woolworths', source: 'woolworths browse specials API', scraped_at: new Date().toISOString(), count: result.length, items: result }, null, 2));
console.log(`\n${result.length} Woolworths deals → ${OUT}`);
console.log('sample:', JSON.stringify(result[0], null, 1));
