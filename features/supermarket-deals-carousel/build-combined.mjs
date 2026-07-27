#!/usr/bin/env node
// Merge the two real per-store scrapes into one combined, normalised file whose
// per-item shape matches deals-page.html's WEEK.items (so it can be dropped in
// and sliced/curated by the renderer), while keeping the FULL archive + metadata.
//
// Usage: node features/supermarket-deals-carousel/build-combined.mjs [--out <file>]
import fs from 'node:fs/promises';
import path from 'node:path';
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const DIR = path.resolve('features/supermarket-deals-carousel/data');
const OUT = arg('--out', path.join(DIR, 'combined-latest.json'));
const coles = JSON.parse(await fs.readFile(path.join(DIR, 'coles-latest.json'), 'utf8'));
const wow = JSON.parse(await fs.readFile(path.join(DIR, 'woolworths-latest.json'), 'utf8'));
const CATS = JSON.parse(await fs.readFile(path.resolve('features/supermarket-deals-carousel/categories.json'), 'utf8'));

// Best-effort: enrich browse-API Woolworths items with the SaleFinder catalogue's
// `familyId` (stockcode) so variants group like the catalogue. Match by a normalised
// product name. Purely additive — an unmatched item just keeps familyId null and
// falls back to the renderer's name heuristic. Produced by scrape-woolworths-catalogue.mjs.
const normName = (s) => String(s || '').toLowerCase()
  .replace(/[’'".,()†®™]/g, '')
  .replace(/\b\d+(\.\d+)?\s?-?\s?(\d+(\.\d+)?)?\s?(g|kg|ml|l|litre|pk|pack|each|ea|cm|mm)\b/g, ' ')
  .replace(/\bx\s?\d+\b/g, ' ')
  .replace(/\b(or|and)\b.*$/, ' ')   // drop "... or <alternative>" tail
  .replace(/\s+/g, ' ').trim();
let wowFamMap = new Map();
try {
  const cat = JSON.parse(await fs.readFile(path.join(DIR, 'woolworths-catalogue-latest.json'), 'utf8'));
  for (const it of cat.items || []) { const k = normName(it.name); if (it.familyId && k && !wowFamMap.has(k)) wowFamMap.set(k, it.familyId); }
  console.log(`woolworths catalogue family-map: ${wowFamMap.size} stockcodes loaded`);
} catch { /* no catalogue file yet — Woolworths stays on the name heuristic */ }

// Map a (store, native category, product name) -> canonical bucket. Layer 3
// keyword lift (per-store or '*') wins when present; otherwise the store's
// native-name matchers decide; else null. categories.json is the single source
// of truth, so both stores line up by construction (no fuzzy matching).
const LIFT = CATS.liftKeywords || {};
const BUCKET_RX = CATS.buckets.map((b) => ({
  key: b.key, ko: b.ko,
  coles: (b.coles || []).map((r) => new RegExp(r, 'i')),
  woolworths: (b.woolworths || []).map((r) => new RegExp(r, 'i')),
}));
function bucketFor(store, native, name) {
  for (const [key, rule] of Object.entries(LIFT)) {
    const stores = rule.stores || ['*']; const kws = (rule.keywords || []).map((k) => new RegExp(k, 'i'));
    if ((stores.includes(store) || stores.includes('*')) && kws.some((rx) => rx.test(name || ''))) {
      const b = CATS.buckets.find((x) => x.key === key); return { key, ko: b?.ko || null };
    }
  }
  for (const b of BUCKET_RX) { if (native && b[store].some((rx) => rx.test(native))) return { key: b.key, ko: b.ko }; }
  return { key: null, ko: null };
}

const fmtRange = (s, e) => {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const a = s.split(/[\s\/-]/), b = e.split(/[\s\/-]/);
  const [ay, am, ad] = [a[0], a[1], a[2]], [by, bm, bd] = [b[0], b[1], b[2]];
  return `${Number(ad)} – ${Number(bd)} ${M[Number(bm) - 1]} ${by}`;
};
const pctOff = (was, now) => (was && now && was > now) ? Math.round((was - now) / was * 100) : null;
const isNew = (name) => /(^|[\s(])NEW([\s)]|$)/i.test(name || '');

const norm = (it, store, source) => {
  const b = bucketFor(store, it.category || '', it.name || '');
  return {
  store,
  source,
  category: it.category || null,
  bucket: b.key,
  bucket_ko: b.ko,
  name: it.name,
  size: it.size || '',
  price: it.now ?? it.price,
  was: it.was ?? null,
  unit: it.unit || '',
  save: it.save || (it.was && (it.now ?? it.price) ? `$${(it.was - (it.now ?? it.price)).toFixed(2)}` : ''),
  pctOff: pctOff(it.was, it.now ?? it.price),
  halfPrice: !!it.halfPrice,
  newVariety: isNew(it.name),
  img: it.image || it.img || null,
  page: it.page ?? null,
  itemId: it.itemId || null,
  familyId: it.familyId || (store === 'woolworths' ? wowFamMap.get(normName(it.name)) : null) || null,   // SaleFinder stamp stockcode — groups variants
  };
};

const rawItems = [
  ...coles.items.map((it) => norm(it, 'coles', 'coles_catalogue')),
  ...wow.items.map((it) => norm(it, 'woolworths', 'woolworths_specials')),
];

// Dedupe: the Woolworths scrape hits multiple category endpoints, so the same
// product surfaces under overlapping departments (bacon in Meat AND Deli, coffee
// in Pantry AND Drinks, etc.) — identical price, would render as duplicate cards.
// Collapse by store + normalised name; keep the best row (bucketed, then priced).
const keyOf = (it) => `${it.store}|${(it.name || '').trim().toLowerCase().replace(/\s+/g, ' ')}`;
const better = (a, b) => {
  if (!!a.bucket !== !!b.bucket) return a.bucket ? a : b;   // prefer a categorised row
  if ((a.was != null) !== (b.was != null)) return a.was != null ? a : b; // prefer a priced row
  return a; // else keep first seen (preserves scrape order)
};
const dedup = new Map();
for (const it of rawItems) { const k = keyOf(it); dedup.set(k, dedup.has(k) ? better(dedup.get(k), it) : it); }
const items = [...dedup.values()];
const removedDupes = rawItems.length - items.length;

const out = {
  range: fmtRange(coles.week_start, coles.week_end),
  week_start: coles.week_start.slice(0, 10),
  week_end: coles.week_end.slice(0, 10),
  scraped_at: [coles.scraped_at, wow.scraped_at].filter(Boolean).sort().at(-1),
  source_note: `Coles "${coles.sale_name}" catalogue (SaleFinder, ${coles.pages_captured}/${coles.pages} pages, ${coles.area}) + Woolworths weekly online specials (browse API${wow.area ? ', ' + wow.area : ''}). Prices real at scrape time; vary by store/region.`,
  stores: {
    coles: { sale_name: coles.sale_name, area: coles.area, pages: coles.pages, pages_captured: coles.pages_captured, count: coles.count },
    woolworths: { sale_name: wow.sale_name || null, area: wow.area || null, categories: [...new Set(wow.items.map((i) => i.category))], count: wow.count },
  },
  counts: { coles: coles.count, woolworths: wow.count, total: items.length },
  buckets: CATS.buckets.map((b) => ({ key: b.key, ko: b.ko, coles: items.filter((i) => i.store === 'coles' && i.bucket === b.key).length, woolworths: items.filter((i) => i.store === 'woolworths' && i.bucket === b.key).length })),
  items,
};

await fs.writeFile(OUT, JSON.stringify(out, null, 2));
console.log(`combined → ${OUT}`);
console.log(`range: ${out.range} | coles ${coles.count} + woolworths ${wow.count} = ${items.length} items (deduped ${removedDupes} overlapping rows)`);
console.log('with was-price:', items.filter((i) => i.was != null).length, '| with img:', items.filter((i) => i.img).length, '| halfPrice:', items.filter((i) => i.halfPrice).length);
console.log('\nbucket coverage (coles / woolworths):');
for (const b of out.buckets) console.log(`  ${String(b.coles).padStart(3)} / ${String(b.woolworths).padStart(3)}   ${b.ko}  (${b.key})`);
const nullColes = items.filter((i) => i.store === 'coles' && !i.bucket).length, nullWow = items.filter((i) => i.store === 'woolworths' && !i.bucket).length;
console.log(`  ${String(nullColes).padStart(3)} / ${String(nullWow).padStart(3)}   (no bucket)`);
