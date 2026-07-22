#!/usr/bin/env node
// Scrape REAL Woolworths weekly specials via their own browse API, from inside
// an authenticated Playwright session (bare fetch is 403'd).
//
// Flow (reverse-engineered 2026-07): GET /apis/ui/PiesCategoriesWithSpecials for
// the specials category tree → match target food categories by NAME (robust to
// the rotating NodeId hashes) → POST /apis/ui/browse/category per category →
// keep items where WasPrice > Price → map to the deals-page schema.
//
// Usage: node features/supermarket-deals-carousel/scrape-woolworths.mjs [--top 3] [--out <file>]
//
// TOS: low-volume read of public specials for a small info page. Breaches their
// ToS in principle and WILL break when they change the API — best-effort;
// manual entry stays the fallback.

import fs from 'node:fs/promises';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const TOP = Number(arg('--top', 3));               // top N deals per category
const OUT = arg('--out', path.resolve('features/supermarket-deals-carousel/data/woolworths-latest.json'));

// deals-page category label  ->  Woolworths specials category name to match
const TARGETS = [
  ['Dairy & Eggs',     /dairy.*egg/i],
  ['Snacks & Treats',  /snacks?.*conf|confection/i],
  ['Frozen',           /freezer|frozen/i],
  ['Pantry',           /^pantry/i],
  ['Beverages',        /drinks|beverage/i],
  ['Household',        /cleaning|home.*lifestyle/i],
];

const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 } });
const page = await ctx.newPage();
console.log('establishing session…');
await page.goto('https://www.woolworths.com.au/shop/browse/specials', { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(6000);

// 1) category tree → leaf list
const leaves = await page.evaluate(async () => {
  const cats = await (await fetch('/apis/ui/PiesCategoriesWithSpecials', { credentials: 'include', headers: { accept: 'application/json' } })).json();
  const out = [];
  const walk = (n) => { if (!n.Children || !n.Children.length) out.push({ id: n.NodeId, name: n.Description, count: n.ProductCount }); else n.Children.forEach(walk); };
  (cats.Categories || []).forEach(walk);
  return out;
});

const result = [];
for (const [label, rx] of TARGETS) {
  const leaf = leaves.filter((l) => rx.test(l.name)).sort((a, b) => b.count - a.count)[0];
  if (!leaf) { console.warn(`  [${label}] no matching category`); continue; }

  const products = await page.evaluate(async (categoryId) => {
    const body = { categoryId, pageNumber: 1, pageSize: 36, sortType: 'TraderRelevance',
      url: '/shop/browse/specials', location: '/shop/browse/specials', formatObject: '{"name":"Specials"}',
      isSpecial: true, isBundle: false, isMobile: false, filters: [], token: '', gpBoost: 0,
      isHideUnavailableProducts: true, enableAdReRanking: false, groupEdmVariants: true, categoryVersion: 'v2' };
    const j = await (await fetch('/apis/ui/browse/category', { method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) })).json();
    const arr = [];
    (j.Bundles || []).forEach((b) => (b.Products || []).forEach((p) => arr.push(p)));
    return arr.map((p) => ({ name: p.DisplayName, price: p.Price, was: p.WasPrice, savings: p.SavingsAmount,
      half: p.IsHalfPrice, onSpecial: p.IsOnSpecial, cup: p.CupString, img: p.LargeImageFile }));
  }, leaf.id);

  const deals = products
    .filter((p) => p.onSpecial && p.was && p.price < p.was)
    .sort((a, b) => (b.savings || (b.was - b.price)) - (a.savings || (a.was - a.price)))
    .slice(0, TOP)
    .map((p) => ({
      store: 'woolworths', category: label, name: p.name,
      price: Number(p.price.toFixed(2)), was: Number(p.was.toFixed(2)),
      save: `$${Number(p.savings || p.was - p.price).toFixed(2)}`,
      halfPrice: !!p.half, unit: p.cup || '', image: p.img || '',
    }));
  console.log(`  [${label}] ${leaf.name} (${leaf.count}) → ${deals.length} top deals`);
  result.push(...deals);
  await page.waitForTimeout(1200 + Math.random() * 1200);
}
await browser.close();

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify({ store: 'woolworths', scraped_at: new Date().toISOString(), count: result.length, items: result }, null, 2));
console.log(`\n${result.length} Woolworths deals → ${OUT}`);
if (result[0]) console.log('sample:', JSON.stringify(result[0], null, 1));
