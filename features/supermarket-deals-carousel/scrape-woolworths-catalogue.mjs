#!/usr/bin/env node
// Scrape the Woolworths weekly catalogue via its SaleFinder "Product List" feed —
// the ONE view that exposes `data-stockcode` (the product-family id that groups
// variants, e.g. all Peters Drumstick or Huggies sizes). The browse-API scraper
// (scrape-woolworths.mjs) has good categories but no family id; this fills that gap.
//
// METHOD (verified live 2026-07 via the real viewer):
//   1. Open woolworths.com.au/shop/catalogue, set a store by postcode (needed —
//      the catalogue is location-specific; a persistent profile remembers it).
//   2. Open the catalogue → click "Product List" (#view=list). The viewer then
//      calls embed.salefinder.com.au/productlist/view/<saleId>/?locationId=..&token=..
//      &saleGroup=0&rows_per_page=12 and renders `.shelfProductStamp` cards.
//   3. Intercept that request to grab its exact URL (carries the session token +
//      locationId), then re-fetch it with rows_per_page bumped high to get the
//      WHOLE catalogue in one JSONP call (~273 stamps observed).
//   4. Parse each `.shelfProductStamp`: data-stockcode (familyId), inner data-itemid,
//      .sf-item-heading (name), .sf-nowprice .sf-pricedisplay (now), .sf-regprice
//      (save amount), .sf-regoptiondesc ("1/2 Price, Save" / "N% off, Save").
//      Price model: was = now + save (the shelf shows sale price + the saving).
//
// This feed has NO category. Category comes from matching these stockcodes back to
// the browse-API data by name in build-combined.mjs (which keeps the good
// department buckets and just attaches familyId). So run BOTH scrapers weekly.
//
// Usage: node features/supermarket-deals-carousel/scrape-woolworths-catalogue.mjs [--postcode 2000] [--out <file>]
//   Default --out: data/woolworths-catalogue-latest.json (a family-id map; does NOT
//   replace woolworths-latest.json). Sanity-check the first run's count + prices.
//
// ToS note: low-volume weekly read of the public catalogue. Run once per week.

import fs from 'node:fs/promises';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const OUT = arg('--out', path.resolve('features/supermarket-deals-carousel/data/woolworths-catalogue-latest.json'));
const POSTCODE = arg('--postcode', '2000');
const PROF = path.resolve('.woolworths-scrape-profile');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { chromium } = await import('playwright');
const ctx = await chromium.launchPersistentContext(PROF, { headless: false, viewport: { width: 1500, height: 1000 }, args: ['--disable-blink-features=AutomationControlled'] });
const page = await ctx.newPage();

// Capture the productlist request URL the viewer makes (carries token + locationId).
let listReqUrl = null;
page.on('request', (req) => { const u = req.url(); if (/embed\.salefinder\.com\.au\/productlist\/view\//.test(u) && !listReqUrl) listReqUrl = u; });

console.log('opening Woolworths catalogue…');
await page.goto('https://www.woolworths.com.au/shop/catalogue', { waitUntil: 'domcontentloaded' }).catch(() => {});
await sleep(4000);

// Set the store if the catalogue isn't already location-scoped (postcode gate).
const needPostcode = await page.locator('input[placeholder*="postcode" i], input[placeholder*="suburb" i]').first().isVisible().catch(() => false);
if (needPostcode) {
  const inp = page.locator('input[placeholder*="postcode" i], input[placeholder*="suburb" i]').first();
  await inp.click().catch(() => {});
  await inp.type(POSTCODE, { delay: 60 }).catch(() => {});
  await sleep(2500);
  // click the first store suggestion
  await page.locator('text=/\\b' + POSTCODE + '\\b.*Woolworths/i').first().click({ timeout: 5000 }).catch(async () => {
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  });
  await sleep(4000);
}

// Open the catalogue, then switch to the Product List view.
await page.locator('text=/Read Catalogue/i').first().click({ timeout: 8000 }).catch(() => {});
await sleep(6000);
await page.locator('text=/Product List/i').first().click({ timeout: 8000 }).catch(() => {});
await sleep(6000);

if (!listReqUrl) { console.error('FAILED: never saw the productlist request. Is the store set / catalogue open? Try re-running (the profile now remembers the store).'); await ctx.close(); process.exit(1); }

// Re-fetch the same feed with a high row count → whole catalogue in one JSONP call,
// parse the shelf stamps in-page (DOMParser available in the browser context).
const bigUrl = listReqUrl.replace(/rows_per_page=\d+/, 'rows_per_page=5000').replace(/callback=[^&]+/, 'callback=__CB__');
const result = await page.evaluate(async (urlTmpl) => {
  const cb = '__cb' + Date.now();
  const url = urlTmpl.replace('__CB__', cb);
  const data = await new Promise((res, rej) => {
    window[cb] = (d) => res(d);
    const s = document.createElement('script'); s.src = url; s.onerror = () => rej('script error');
    document.body.appendChild(s); setTimeout(() => rej('timeout'), 25000);
  }).catch((e) => ({ __err: String(e) }));
  if (data && data.__err) return { error: data.__err };
  const doc = new DOMParser().parseFromString(data.content || '', 'text/html');
  const num = (s) => { const m = String(s || '').match(/([\d.]+)/); return m ? Number(m[1]) : null; };
  const items = [...doc.querySelectorAll('.shelfProductStamp')].map((el) => {
    const t = (sel) => (el.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim();
    const now = num(el.querySelector('.sf-nowprice .sf-pricedisplay')?.textContent);
    const regdesc = t('.sf-regoptiondesc');
    const save = num(el.querySelector('.sf-regprice')?.textContent);
    const pct = Number((regdesc.match(/(\d+)%\s*off/i) || [])[1]) || null;
    const half = /(1\/2|half)/i.test(regdesc);
    let was = null;
    if (now != null && save != null) was = +(now + save).toFixed(2);
    else if (now != null && pct) was = +(now / (1 - pct / 100)).toFixed(2);
    return {
      familyId: el.getAttribute('data-stockcode') || '',
      itemId: el.querySelector('[data-itemid]')?.getAttribute('data-itemid') || '',
      name: t('.sf-item-heading'),
      now, was, halfPrice: half,
      unit: t('.sf-nowprice .sf-optionsuffix') || (t('.sf-price-options').match(/per [\d.]+\s*\w+|\d+\s*pk|each/i) || [])[0] || '',
      image: el.querySelector('img')?.getAttribute('src') || '',
    };
  }).filter((x) => x.name);
  return { items, meta: { saleName: data.saleName, startDate: data.startDate, endDate: data.endDate, areaName: data.areaName } };
}, bigUrl);

await ctx.close();

if (result.error || !result.items) { console.error('FAILED to parse feed:', result.error || 'no items'); process.exit(1); }
const items = result.items.map((p) => ({ store: 'woolworths', source: 'salefinder_catalogue', category: null, ...p, save: p.was != null && p.now != null ? `$${(p.was - p.now).toFixed(2)}` : null }));
const withFam = items.filter((i) => i.familyId).length;
const out = { store: 'woolworths', source: 'salefinder_catalogue', sale_name: result.meta?.saleName || null, area: result.meta?.areaName || null, week_start: result.meta?.startDate || null, week_end: result.meta?.endDate || null, scraped_at: new Date().toISOString(), count: items.length, items };
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(out, null, 2));
console.log(`\n${items.length} Woolworths catalogue items → ${OUT}`);
console.log(`  with familyId (stockcode): ${withFam}/${items.length}  | with was-price: ${items.filter((i) => i.was != null).length}`);
console.log('  SANITY: spot-check a few names/prices; then build-combined will attach these stockcodes to the browse-API items by name.');
