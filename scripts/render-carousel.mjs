#!/usr/bin/env node
// Render an Instagram carousel HTML to PNG cards.
//
// Screenshots every `.card` element (1080x1350) in the given index.html and
// writes them as card-01.png … card-NN.png into a sibling images/ directory.
//
// Usage:
//   node scripts/render-carousel.mjs outputs/<date>/<slug>/carousel/index.html
//
// Uses the content-pipeline's own Playwright (chromium) install — no dependency
// on aussie-umma's puppeteer script (which hardcodes its own output path).

import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const htmlArg = process.argv[2];
if (!htmlArg) {
  console.error('usage: node scripts/render-carousel.mjs <path/to/carousel/index.html>');
  process.exit(1);
}
const htmlPath = path.resolve(htmlArg);
try { await fs.access(htmlPath); }
catch { console.error(`file not found: ${htmlPath}`); process.exit(1); }

const imagesDir = path.join(path.dirname(htmlPath), 'images');
await fs.mkdir(imagesDir, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600); // let web fonts settle

const cards = page.locator('.card');
const n = await cards.count();
if (n === 0) { console.error('no .card elements found'); await browser.close(); process.exit(1); }

// verify every card is exactly 1080x1350 before shooting
const sizes = await cards.evaluateAll((els) =>
  els.map((e) => ({ w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })));
const wrong = sizes.map((s, i) => ({ i: i + 1, ...s })).filter((s) => s.w !== 1080 || s.h !== 1350);
if (wrong.length) console.warn('  (size warnings:', JSON.stringify(wrong), ')');

for (let i = 0; i < n; i++) {
  const out = path.join(imagesDir, `card-${String(i + 1).padStart(2, '0')}.png`);
  await cards.nth(i).screenshot({ path: out });
}
await browser.close();
console.log(`rendered ${n} cards → ${imagesDir}`);
