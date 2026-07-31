#!/usr/bin/env node
// Post pipeline blog output to Naver Blog via SmartEditor ONE (Playwright).
//
// Naver has no official blog write API, so this drives a real Chromium
// browser with a persistent profile. Log in ONCE manually, then reuse.
//
// Usage:
//   node scripts/post-to-naver.mjs --login
//       Opens a browser window. Log into naver.com manually (incl. 2FA),
//       then close the window. Session is saved to .naver-profile/.
//
//   node scripts/post-to-naver.mjs [--date YYYY-MM-DD] [--draft] [--slug <slug>]
//       Posts every un-posted topic under outputs/<date>/*/blog/post.md.
//       --draft  saves as 임시저장 instead of publishing (recommended first!)
//       --slug   only post one topic
//
//   node scripts/post-to-naver.mjs --dry-run [--date YYYY-MM-DD]
//       Parses post.md and prints title/body/tags without opening a browser.
//
// Setup:  npm install playwright && npx playwright install chromium
// Config: reads channels.blog.category and content.hashtags.blog from config.json
//
// NOTE ON BOT DETECTION: Naver actively detects automation. This script uses
// a real (headed) browser, a persistent logged-in profile, and human-like
// typing delays to stay low-profile, but automated posting is against the
// spirit of Naver's ToS and carries account-restriction risk. Cadence is NOT
// enforced here (this script is per-run); the daily scheduler decides via
// channels.blog.naver_schedule in config.json. Daily Naver posting was chosen
// 2026-07-31 with that risk accepted; prefer --draft + manual final publish
// when debugging.

import fs from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const LOGIN = flag('--login');
const DRAFT = flag('--draft');
const DRY_RUN = flag('--dry-run');
// --manual-save: type + style the post, then leave the browser open so the user
// clicks 저장 themselves. Use when the scripted 저장 click won't land.
const MANUAL_SAVE = flag('--manual-save');
const ONLY_SLUG = opt('--slug');
const date = opt('--date') || new Date().toISOString().slice(0, 10);

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PROFILE_DIR = path.join(ROOT, '.naver-profile');
const baseDir = path.join(ROOT, 'outputs', date);

const config = JSON.parse(await fs.readFile(path.join(ROOT, 'config.json'), 'utf8'));
const CATEGORY = config.channels?.blog?.category || null;
const HASHTAGS = (config.content?.hashtags?.blog || '')
  .split(/\s+/).map((t) => t.replace(/^#/, '')).filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (min, max) => min + Math.random() * (max - min);

// ---------------------------------------------------------------- markdown
// Convert pipeline post.md → { title, body } of plain text suitable for
// pasting into SmartEditor ONE. Drops the workflow-only sections
// (메타 정보, 썸네일 프롬프트, 셀프 리뷰, 네이버 발행 체크리스트).
// Markdown tables become real SmartEditor 표 components. Each table is
// replaced by a marker paragraph in the body; postOne swaps the marker for an
// actual table. `fallback` (labeled per-row blocks) is typed in if the table
// UI fails.
function extractTables(text) {
  const lines = text.split('\n');
  const out = [];
  const tables = [];
  for (let i = 0; i < lines.length; i++) {
    const isHeader = /^\s*\|/.test(lines[i]) && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1] || '');
    if (!isHeader) { out.push(lines[i]); continue; }
    const parseRow = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const header = parseRow(lines[i]);
    const rows = [];
    let j = i + 2;
    while (j < lines.length && /^\s*\|/.test(lines[j])) { rows.push(parseRow(lines[j])); j++; }
    const fallback = rows.map((row) =>
      [`[${row[0]}]`, ...header.slice(1).map((h, k) => row[k + 1] ? `• ${h}: ${row[k + 1]}` : '')].filter(Boolean).join('\n')
    ).join('\n');
    tables.push({ header, rows, fallback });
    out.push(`[[TABLE-${tables.length}]]`);
    i = j - 1;
  }
  return { text: out.join('\n'), tables };
}

// strip inline markdown the same way the body transforms below do, so
// collected heading/quote texts match the final pasted text exactly
const inline = (s) => s
  .replace(/\*\*(.+?)\*\*/g, '$1')
  .replace(/\*(.+?)\*/g, '$1')
  .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')
  .trim();

export function parsePost(md) {
  const lines = md.split('\n');
  let title = '';
  const kept = [];
  let skipSection = false;
  const headings = [];       // h2 section titles (styled larger + bold)
  const faqQuestions = [];   // h3 lines (styled bold)
  const quoteLeads = [];     // first line of each blockquote (wrapped in 인용구)
  let inQuote = false;

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.*)/);
    if (h1 && !title) { title = h1[1].trim(); continue; }

    const h2 = line.match(/^##\s+(.*)/);
    if (h2) {
      const heading = h2[1].trim();
      skipSection = /^(메타 정보|썸네일 이미지 프롬프트|이미지 프롬프트|셀프 리뷰|네이버 발행 체크리스트)/.test(heading);
      if (!skipSection) { kept.push('\n' + heading + '\n'); headings.push(inline(heading)); }
      continue;
    }
    if (skipSection) {
      if (/^\s*---\s*$/.test(line)) { skipSection = false; continue; }
      if (!/^>/.test(line)) continue;
      skipSection = false; // blockquote = content resumed (workflow sections have none)
    }
    const h3 = line.match(/^###\s+(.*)/);
    if (h3) faqQuestions.push(inline(h3[1]));
    const bq = line.match(/^>\s?(.*)/);
    if (bq) {
      if (!inQuote && bq[1].trim()) quoteLeads.push(inline(bq[1]));
      inQuote = true;
    } else if (line.trim()) {
      inQuote = false;
    }
    kept.push(line);
  }

  const { text: keptText, tables } = extractTables(kept.join('\n'));
  let body = keptText;
  body = body
    .replace(/^###\s+/gm, '')            // h3 → plain line
    .replace(/^\s*---\s*$/gm, '')        // hr → blank
    .replace(/^>\s?/gm, '')              // blockquote marker
    .replace(/\*\*(.+?)\*\*/g, '$1')     // bold
    .replace(/\*(.+?)\*/g, '$1')         // italic
    .replace(/^\s*[-*]\s+/gm, '• ')      // list bullets
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)') // links → text (url)
    .replace(/\s+—\s+/g, ', ')           // em-dash reads as AI-generated in Korean
    .replace(/\n{3,}/g, '\n\n')          // collapse blank runs
    .trim();

  if (HASHTAGS.length) body += '\n\n' + HASHTAGS.map((t) => '#' + t).join(' ');
  return { title, body, headings, faqQuestions, quoteLeads, tables };
}

// ---------------------------------------------------------------- topics
async function findTopics() {
  let slugs;
  try {
    slugs = (await fs.readdir(baseDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    console.log(`No outputs directory for ${date} — nothing to post.`);
    return [];
  }
  if (ONLY_SLUG) slugs = slugs.filter((s) => s === ONLY_SLUG);
  return slugs;
}

const logPath = path.join(baseDir, 'naver-log.json');
async function readLog() {
  try { return JSON.parse(await fs.readFile(logPath, 'utf8')); } catch { return []; }
}

// ---------------------------------------------------------------- browser
async function launch() {
  const { chromium } = await import('playwright');
  return chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,           // headed = far less detectable
    viewport: { width: 1280, height: 900 },
    slowMo: 60,
    args: ['--disable-blink-features=AutomationControlled'],
    permissions: ['clipboard-read', 'clipboard-write'],
  });
}

async function doLogin() {
  const ctx = await launch();
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto('https://nid.naver.com/nidlogin.login');
  console.log('Log into Naver in the opened window (ID/password/2FA yourself —');
  console.log('this script never touches your credentials).');
  console.log('IMPORTANT: tick "로그인 상태 유지" before submitting, or the session');
  console.log('will not survive and every post run will ask you to log in again.');
  let closed = false;
  ctx.on('close', () => { closed = true; });
  while (!closed) {
    const cookies = await ctx.cookies('https://www.naver.com').catch(() => []);
    if (cookies.some((c) => c.name === 'NID_AUT')) break;
    await sleep(2000);
  }
  if (closed) {
    console.log('Window closed before a login was detected — session probably NOT saved.');
    return;
  }
  await sleep(2000);
  await ctx.close();
  console.log('Login detected. Session saved to .naver-profile/. You can now post.');
}

async function detectBlogId(ctx) {
  if (process.env.NAVER_BLOG_ID) return process.env.NAVER_BLOG_ID;
  const page = await ctx.newPage();
  await page.goto('https://blog.naver.com/MyBlog.naver', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  const m = page.url().match(/blog\.naver\.com\/([A-Za-z0-9_-]+)/);
  await page.close();
  if (!m || /MyBlog|nidlogin/i.test(m[1])) {
    throw new Error('Could not detect blog ID — are you logged in? Run with --login first, or set NAVER_BLOG_ID env var.');
  }
  return m[1];
}

async function dismissPopups(page) {
  // "작성 중인 글이 있습니다" draft-restore popup → 취소 (start fresh)
  await page.locator('.se-popup-button-cancel').first().click({ timeout: 3000 }).catch(() => {});
  // help panel
  await page.locator('.se-help-panel-close-button').first().click({ timeout: 2000 }).catch(() => {});
}

async function typeHuman(page, text) {
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: jitter(25, 70) });
  }
}

async function pasteBody(page, body) {
  // Paste via clipboard — the only reliable way to get multi-paragraph text
  // into SmartEditor without it mangling structure.
  await page.evaluate(async (t) => { await navigator.clipboard.writeText(t); }, body);
  const paste = process.platform === 'darwin' ? 'Meta+V' : 'Control+V';
  await page.keyboard.press(paste);
}

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

// find a body paragraph by exact text or prefix; returns its index or -1
async function paraIndex(page, text, { prefix = false } = {}) {
  return page.evaluate(([t, pre]) => {
    const ps = [...document.querySelectorAll('.se-component.se-text .se-text-paragraph')];
    return ps.findIndex((p) => {
      const s = (p.textContent || '').replace(/ /g, ' ').trim();
      return pre ? s.startsWith(t) : s === t;
    });
  }, [text, prefix]);
}

async function selectPara(page, idx) {
  // collapse any active selection first — its .se-selection overlay otherwise
  // intercepts pointer events and blocks the click
  await page.keyboard.press('Escape').catch(() => {});
  await page.keyboard.press('ArrowRight').catch(() => {});
  await sleep(150);
  const p = page.locator('.se-component.se-text .se-text-paragraph').nth(idx);
  await p.scrollIntoViewIfNeeded();
  await sleep(300); // let scrolling settle before clicking
  await p.click({ force: true }); // place the caret first (selection is unreliable otherwise)
  await sleep(150);
  await p.click({ clickCount: 3, force: true }); // triple click = select paragraph
  await sleep(300);
}

// select paragraph `text` and cut it, confirming the cut actually reached the
// clipboard — SmartEditor drops the selection sometimes, which would make the
// following paste re-insert stale clipboard content
async function cutParagraph(page, text, { prefix = false } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const idx = await paraIndex(page, text, { prefix });
    if (idx === -1) return false;
    await selectPara(page, idx);
    await page.keyboard.press(`${MOD}+X`);
    await sleep(400);
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    if (clip.replace(/ /g, ' ').trim().startsWith(text.slice(0, 10))) return true;
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(300);
  }
  return false;
}

// wait until a quotation containing `key` exists (paste renders async)
async function quotationHas(page, key) {
  for (let i = 0; i < 8; i++) {
    const ok = await page.evaluate((k) =>
      [...document.querySelectorAll('.se-component.se-quotation')]
        .some((q) => (q.textContent || '').replace(/ /g, ' ').includes(k)), key);
    if (ok) return true;
    await sleep(500);
  }
  return false;
}

// open a property-toolbar dropdown and pick the option with the given text
async function pickOption(page, buttonSel, optionText) {
  await page.locator(buttonSel).first().click();
  await sleep(400);
  await page.locator(`button:has-text("${optionText}")`).last().click();
  await sleep(400);
}

// SmartEditor document-toolbar selectors (verified against the live editor)
const QUOTE_ADD = 'button.se-insert-quotation-default-toolbar-button';
const QUOTE_PICKER = 'button[data-name="quotation"].se-document-toolbar-select-option-button';
const QUOTE_STYLE = (s) => `button.se-toolbar-option-insert-quotation-${s}-button`;
const HR_ADD = 'button.se-insert-horizontal-line-default-toolbar-button';

// insert a quotation component at the cursor. 'default' = ❝ 따옴표 style,
// 'quotation_line' = vertical-bar info box (styles per the picker dropdown)
async function insertQuotation(page, style = 'default') {
  if (style === 'default') {
    await page.locator(QUOTE_ADD).click();
  } else {
    await page.locator(QUOTE_PICKER).click();
    await sleep(500);
    await page.locator(QUOTE_STYLE(style)).click();
  }
  await sleep(600);
}

// click the first text paragraph AFTER the quotation containing `key`,
// so subsequent inserts land below the quote instead of inside it
async function clickAfterQuotation(page, key) {
  const pt = await page.evaluate((k) => {
    const q = [...document.querySelectorAll('.se-component.se-quotation')]
      .find((x) => (x.textContent || '').includes(k));
    if (!q) return null;
    let n = q.nextElementSibling;
    while (n && !n.classList.contains('se-text')) n = n.nextElementSibling;
    const p = n && n.querySelector('.se-text-paragraph');
    if (!p) return null;
    p.scrollIntoView({ block: 'center' });
    const r = p.getBoundingClientRect();
    return { x: r.x + 20, y: r.y + Math.min(r.height / 2, 14) };
  }, key);
  if (pt) {
    await page.mouse.click(pt.x, pt.y);
    await sleep(300);
    // the click lands mid-text — move the caret to the paragraph start so a
    // following insert (구분선/이미지) doesn't split the sentence
    await page.keyboard.press('Home').catch(() => {});
    await page.keyboard.press(`${MOD}+ArrowLeft`).catch(() => {});
    await sleep(150);
    return true;
  }
  return false;
}

// whole-body pass: 마루부리 font + 180% line spacing (left-aligned, like the
// reference posts — no centering)
async function styleGlobal(page) {
  await page.locator('.se-component.se-text .se-text-paragraph').first().click();
  await page.keyboard.press(`${MOD}+A`);
  await sleep(300);
  try { await pickOption(page, 'button[class*="font-family"]', '마루부리'); }
  catch { console.warn('  (font 마루부리 not applied)'); }
  await page.keyboard.press(`${MOD}+A`);
  await sleep(300);
  try { await pickOption(page, 'button[class*="line-height"]', '180%'); }
  catch { console.warn('  (line-height 180% not applied)'); }
  console.log('  global style: 마루부리, 180%, left-aligned');
}

// reference format: each section heading becomes a numbered ❝ quote block
// ("1. 제목", size 19, bold) followed by a 구분선 divider
async function buildHeadingBlocks(page, headings) {
  let built = 0;
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    // heading text is known — type it directly instead of cut/paste
    const idx = await paraIndex(page, h);
    if (idx === -1) { console.warn(`  (heading not found: ${h.slice(0, 24)})`); continue; }
    await selectPara(page, idx);
    await page.keyboard.press('Delete');
    await sleep(300);
    await insertQuotation(page, 'default');
    await page.keyboard.type(`${i + 1}. ${h}`);
    await sleep(400);
    const key = h.slice(0, 16);
    if (!(await quotationHas(page, key))) {
      console.warn(`  (heading block unverified: ${key})`);
      await clickAfterQuotation(page, key).catch(() => {});
      continue;
    }
    // style the heading text inside the quote
    const qp = page.locator('.se-component.se-quotation', { hasText: key }).first()
      .locator('.se-text-paragraph').first();
    await qp.click({ clickCount: 3 });
    await sleep(300);
    try { await pickOption(page, 'button[class*="font-size"]', '19'); } catch { /* keep default */ }
    await page.keyboard.press(`${MOD}+B`);
    await sleep(200);
    // divider below the heading block: collapse the caret to the END of the
    // quote's own text and insert the HR there. It breaks out after the quote
    // without ever touching the body paragraph — positioning into the body
    // split its first word (offset-1) and scrambled the sections.
    await qp.click();
    await sleep(150);
    await page.keyboard.press(`${MOD}+ArrowRight`); // end of the quote text
    await sleep(150);
    await page.locator(HR_ADD).click();
    await sleep(400);
    built++;
  }
  console.log(`  heading blocks: ${built}/${headings.length} (numbered ❝ + divider)`);
}

// bold the FAQ question lines
async function styleFaq(page, faqQuestions) {
  for (const q of faqQuestions) {
    const idx = await paraIndex(page, q);
    if (idx === -1) { console.warn(`  (faq not found: ${q.slice(0, 24)})`); continue; }
    await selectPara(page, idx);
    await page.keyboard.press(`${MOD}+B`);
    await sleep(200);
  }
  console.log(`  FAQ questions bolded: ${faqQuestions.length}`);
}

// wrap each blockquote callout in a vertical-line 인용구 info box
async function wrapQuotes(page, quoteLeads) {
  let wrapped = 0;
  for (const lead of quoteLeads) {
    const key = lead.slice(0, 20);
    if (!(await cutParagraph(page, key, { prefix: true }))) { console.warn(`  (quote cut failed: ${key})`); continue; }
    await insertQuotation(page, 'quotation_line');
    await page.keyboard.press(`${MOD}+V`);
    await sleep(500);
    if (await quotationHas(page, key)) { wrapped++; await clickAfterQuotation(page, key); }
    else console.warn(`  (quote wrap unverified: ${key})`); // paste landed as plain text; content intact
  }
  console.log(`  callout boxes: ${wrapped}/${quoteLeads.length} wrapped`);
}

// swap each [[TABLE-n]] marker for a real SmartEditor 표 component
async function insertTables(page, tables) {
  for (let n = 0; n < tables.length; n++) {
    const { header, rows, fallback } = tables[n];
    const marker = `[[TABLE-${n + 1}]]`;
    const idx = await paraIndex(page, marker);
    if (idx === -1) { console.warn(`  (table marker not found: ${marker})`); continue; }
    await selectPara(page, idx);
    await page.keyboard.press('Delete'); // clear marker text, keep the caret
    await sleep(300);
    const before = await page.locator('.se-component.se-table').count();
    await page.locator('button[data-name="table"]').first().click();
    await sleep(1000);
    if ((await page.locator('.se-component.se-table').count()) <= before) {
      console.warn(`  (table insert failed — typing fallback for ${marker})`);
      await page.keyboard.type(fallback.replace(/\n/g, '\n'));
      continue;
    }
    const table = page.locator('.se-component.se-table').last();
    // grow from the default 3×3 using the edge add-buttons (geometry-mapped:
    // near right edge = add column, near bottom edge = add row)
    const want = { rows: rows.length + 1, cols: header.length };
    for (let g = 0; g < 12; g++) {
      const dims = await table.evaluate((t) => {
        const trs = [...t.querySelectorAll('tr')];
        return { rows: trs.length, cols: trs[0] ? trs[0].querySelectorAll('td,th').length : 0 };
      });
      if (dims.cols >= want.cols && dims.rows >= want.rows) break;
      const addCol = dims.cols < want.cols;
      const btnIdx = await page.evaluate((wantCol) => {
        const t = document.querySelector('.se-component.se-table:last-of-type table')
          || [...document.querySelectorAll('.se-component.se-table')].pop()?.querySelector('table');
        if (!t) return -1;
        const tb = t.getBoundingClientRect();
        const btns = [...document.querySelectorAll('button.se-cell-add-button')];
        return btns.findIndex((b) => {
          const r = b.getBoundingClientRect();
          return wantCol ? (r.x - tb.right > -30) : (r.y - tb.bottom > -30);
        });
      }, addCol);
      if (btnIdx === -1) { console.warn('  (no add-button found — table stays smaller)'); break; }
      await page.locator('button.se-cell-add-button').nth(btnIdx).click();
      await sleep(500);
    }
    // fill cells row-major: header row first, then data rows
    const flat = [header, ...rows];
    const dims = await table.evaluate((t) => {
      const trs = [...t.querySelectorAll('tr')];
      return { rows: trs.length, cols: trs[0].querySelectorAll('td,th').length };
    });
    for (let r = 0; r < Math.min(flat.length, dims.rows); r++) {
      for (let cidx = 0; cidx < Math.min(flat[r].length, dims.cols); cidx++) {
        const val = (flat[r][cidx] || '').replace(/\s+/g, ' ').trim();
        if (!val) continue;
        await table.locator('td, th').nth(r * dims.cols + cidx).click();
        await sleep(120);
        await page.keyboard.type(val);
        await sleep(80);
      }
    }
    await page.keyboard.press('Escape').catch(() => {});
    console.log(`  table ${n + 1}: ${dims.rows}×${dims.cols} filled`);
  }
}

// upload files at the current caret position via the 사진 toolbar button.
// Never throws — an image is not worth losing the whole post over.
async function uploadAtCaret(page, files) {
  // the first 사진 click after page load sometimes swallows the file chooser —
  // retry once before giving up
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const before = await page.locator('.se-component.se-image').count();
      const chooser = page.waitForEvent('filechooser', { timeout: 8000 });
      await page.locator('button.se-insert-image-default-toolbar-button, button.se-image-toolbar-button, button[data-name="image"]').first().click();
      await (await chooser).setFiles(files);
      await sleep(6000); // upload
      return (await page.locator('.se-component.se-image').count()) > before;
    } catch (e) {
      console.warn(`  (image upload attempt ${attempt + 1} failed: ${e.message.split('\n')[0]})`);
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(800);
    }
  }
  return false;
}

// Place the caret at the TRUE start (offset 0) of a target text paragraph so a
// following image inserts as its own block instead of splitting a word.
// A plain click lands mid-word and Home/Arrow nav is unreliable on wrapped
// paragraphs; clicking the FIRST visual line's left edge + line-start nav is
// deterministic. afterKey=null → first body text NOT inside a quotation (hero);
// else → first text paragraph after the quotation containing afterKey.
async function caretAtTextStart(page, afterKey) {
  // 1) locate the target paragraph + its first-line coords, scroll into view
  const pt = await page.evaluate((key) => {
    let target = null;
    if (key) {
      const q = [...document.querySelectorAll('.se-component.se-quotation')]
        .find((x) => (x.textContent || '').includes(key));
      if (!q) return null;
      let n = q.nextElementSibling;
      while (n && !n.classList.contains('se-text')) n = n.nextElementSibling;
      target = n;
    } else {
      target = [...document.querySelectorAll('.se-component.se-text')]
        .find((c) => !c.closest('.se-component.se-quotation'));
    }
    if (!target) return null;
    const p = target.querySelector('.se-text-paragraph');
    if (!p) return null;
    p.scrollIntoView({ block: 'center' });
    window.__seCaretTarget = p; // stash for step 3
    const rects = p.getClientRects();
    const r = rects.length ? rects[0] : p.getBoundingClientRect();
    return { x: Math.round(r.left + 2), y: Math.round(r.top + r.height / 2) };
  }, afterKey);
  if (!pt) return false;
  // 2) click to give the editor focus (position is approximate)
  await page.mouse.click(pt.x, pt.y);
  await sleep(200);
  // 3) FORCE the caret to offset 0 of the paragraph's first text node — a click
  // alone lands ~1 char in on some paragraphs, which splits the first word.
  await page.evaluate(() => {
    const p = window.__seCaretTarget;
    if (!p) return;
    let node = p;
    while (node.firstChild) node = node.firstChild; // deepest first node (text node or leaf)
    const range = document.createRange();
    try { range.setStart(node, 0); } catch { range.setStart(p, 0); }
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await sleep(200);
  return true;
}

// Place the caret at the END of the first body paragraph after the heading
// whose text includes `key`. Caret-at-END can never split a word (nothing sits
// to its right), so the image lands cleanly after that paragraph. Positioning
// at the START proved unreliable — SmartEditor kept inserting at offset 1.
async function caretAfterFirstPara(page, key) {
  const pt = await page.evaluate((k) => {
    const q = [...document.querySelectorAll('.se-component.se-quotation')]
      .find((x) => (x.textContent || '').includes(k));
    if (!q) return null;
    let n = q.nextElementSibling;
    while (n && !n.classList.contains('se-text')) n = n.nextElementSibling;
    if (!n) return null;
    const p = n.querySelector('.se-text-paragraph');
    if (!p) return null;
    p.scrollIntoView({ block: 'center' });
    const rects = p.getClientRects();
    const r = rects.length ? rects[rects.length - 1] : p.getBoundingClientRect(); // LAST visual line
    return { x: Math.round(r.right - 2), y: Math.round(r.top + r.height / 2) };
  }, key);
  if (!pt) return false;
  await page.mouse.click(pt.x, pt.y);
  await sleep(200);
  await page.keyboard.press(`${MOD}+ArrowRight`); // to end of the (last) visual line
  await sleep(200);
  return true;
}

// Naver gets ONLY the hero image (inserted cleanly before the intro). Section
// images kept scrambling the flowing text no matter how the caret was placed —
// SmartEditor inserts blocks at an unpredictable offset. They live in the
// Blogger mirror instead, where they render in their own <div> blocks. Set
// NAVER_SECTION_IMAGES=1 to re-enable the (unreliable) inline section images.
async function insertImages(page, imagePaths, headings = []) {
  if (!imagePaths.length) return;
  const heroes = imagePaths.filter((p) => !/section-\d+\./.test(path.basename(p)));
  const sections = imagePaths.filter((p) => /section-\d+\./.test(path.basename(p)));
  if (heroes.length) {
    if (await caretAtTextStart(page, null)) await uploadAtCaret(page, heroes);
    else console.warn('  (couldn\'t position hero image)');
  }
  if (process.env.NAVER_SECTION_IMAGES === '1') {
    for (const img of sections) {
      const n = Number(path.basename(img).match(/section-(\d+)\./)[1]);
      const h = headings[n - 1];
      if (!h) { console.warn(`  (no heading ${n} for ${path.basename(img)})`); continue; }
      if (await caretAfterFirstPara(page, h.slice(0, 16))) await uploadAtCaret(page, [img]);
      else console.warn(`  (couldn't position for ${path.basename(img)})`);
    }
  } else if (sections.length) {
    console.log(`  (${sections.length} section images skipped for Naver — they render in the Blogger mirror)`);
  }
  const n = await page.locator('.se-component.se-image').count();
  console.log(`  images: ${n} in document (${heroes.length} hero attached)`);
}

// turn on the per-image "AI 활용 설정" toggle for every image in the document.
// One se-set-ai-mark-button-toggle per image; 'se-is-selected' class = ON.
async function enableAiUsage(page) {
  const toggles = page.locator('button.se-set-ai-mark-button-toggle');
  const n = await toggles.count();
  let on = 0;
  for (let i = 0; i < n; i++) {
    const t = toggles.nth(i);
    if (await t.evaluate((b) => b.classList.contains('se-is-selected'))) { on++; continue; }
    await t.scrollIntoViewIfNeeded();
    await sleep(300);
    await t.click({ force: true });
    await sleep(500);
    if (await t.evaluate((b) => b.classList.contains('se-is-selected'))) on++;
  }
  console.log(`  AI 활용 설정: on for ${on}/${n} images`);
}

// Reads the 임시저장 counter next to the top-bar 저장 button. Returns null if
// the element can't be found (layout change) so callers can tell "unknown"
// apart from "zero".
async function draftCount(page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('button, a, span, em')].find(
      (e) => /^\d+$/.test((e.textContent || '').trim())
        && e.getBoundingClientRect().top < 60
        && e.getBoundingClientRect().width > 0,
    );
    return el ? Number(el.textContent.trim()) : null;
  }).catch(() => null);
}

// Reads the draft counter from a FRESH tab, so the value reflects what the
// server actually stored rather than whatever the editing tab shows locally.
// Leaves the caller's tab untouched.
async function verifyDraftCount(ctx, blogId) {
  const probe = await ctx.newPage();
  try {
    await probe.goto(`https://blog.naver.com/${blogId}/postwrite`, { waitUntil: 'domcontentloaded' });
    await sleep(6000);
    await probe.locator('.se-popup-button-cancel').first().click({ timeout: 4000 }).catch(() => {});
    await sleep(1000);
    return await draftCount(probe);
  } catch { return null; } finally { await probe.close().catch(() => {}); }
}

async function postOne(ctx, blogId, slug, { title, body, headings = [], faqQuestions = [], quoteLeads = [], tables = [], images = [] }) {
  const page = await ctx.newPage();
  await page.goto(`https://blog.naver.com/${blogId}/postwrite`, { waitUntil: 'domcontentloaded' });
  await sleep(jitter(3000, 5000));
  await dismissPopups(page);

  // Title
  await page.locator('.se-section-documentTitle').click();
  await sleep(jitter(400, 900));
  await typeHuman(page, title);

  // Body
  await page.locator('.se-component.se-text .se-text-paragraph').first().click();
  await sleep(jitter(400, 900));
  await pasteBody(page, body);
  await sleep(jitter(1500, 2500));

  // design format (reference: navermate-selected posts): global typography →
  // numbered ❝ heading blocks + dividers → callout boxes → FAQ bold → images
  await styleGlobal(page);
  await buildHeadingBlocks(page, headings);
  await wrapQuotes(page, quoteLeads);
  await styleFaq(page, faqQuestions);
  await insertTables(page, tables);
  await insertImages(page, images, headings);
  await enableAiUsage(page);

  if (MANUAL_SAVE) {
    console.log(`\n  [manual] ${slug} — 본문 입력 완료. 브라우저에서 직접 "저장"을 누르세요.`);
    console.log('  (저장이 끝나면 이 터미널에서 Ctrl+C 로 종료하세요. 창은 닫지 마세요.)\n');
    return { mode: 'manual', verified: false, keepOpen: true };
  }

  if (DRAFT) {
    // 임시저장 is an async XHR. Closing this tab (even seconds later) aborts it
    // and the draft silently never appears, while the old code still reported
    // success. So: click, let the network settle, verify from a SEPARATE tab,
    // and only then close this one.
    const before = await draftCount(page);
    await page.getByRole('button', { name: /^저장/ }).first().click();
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await sleep(3000);

    const after = await verifyDraftCount(ctx, blogId);
    const ok = before !== null && after !== null && after > before;
    if (ok) console.log(`  [draft] ${slug} — 임시저장 확인됨 (저장 ${before} → ${after})`);
    else console.warn(`  [draft] ${slug} — 저장 확인 실패 (저장 ${before} → ${after}). 탭을 열어둡니다.`);
    if (ok) await page.close(); // only safe to close once the save is confirmed
    return { mode: 'draft', verified: ok, keepOpen: !ok };
  }

  // Open publish layer
  await page.getByRole('button', { name: '발행' }).first().click();
  await sleep(jitter(1500, 2500));

  // Category (best effort — layer markup changes often; skip on failure)
  if (CATEGORY) {
    try {
      await page.locator('.selectbox_button, [class*="selectbox_button"]').first().click({ timeout: 3000 });
      await sleep(600);
      await page.getByText(CATEGORY, { exact: true }).first().click({ timeout: 3000 });
      await sleep(600);
    } catch {
      console.warn(`  (couldn't select category "${CATEGORY}" — using blog default)`);
    }
  }

  // Tags inside publish layer (best effort)
  try {
    const tagInput = page.locator('#tag-input, [class*="tag_input"], input[placeholder*="태그"]').first();
    for (const t of HASHTAGS.slice(0, 10)) {
      await tagInput.fill(t);
      await page.keyboard.press('Enter');
      await sleep(jitter(200, 500));
    }
  } catch { /* tags already appended in body as hashtags */ }

  // Final 발행 button inside the layer
  await page.locator('[data-testid="seOnePublishBtn"], .confirm_btn__, button:has-text("발행")').last().click();
  await page.waitForURL(/blog\.naver\.com\/.+\/\d+/, { timeout: 20000 }).catch(() => {});
  const url = page.url();
  console.log(`[posted] ${slug} → ${url}`);
  await sleep(2000);
  await page.close();
  return { mode: 'published', url };
}

// ---------------------------------------------------------------- main
if (LOGIN) {
  await doLogin();
  process.exit(0);
}

const slugs = await findTopics();
if (!slugs.length) process.exit(0);

const posted = await readLog();
const todo = [];
for (const slug of slugs) {
  if (posted.some((p) => p.slug === slug)) { console.log(`[skip] ${slug} — already posted`); continue; }
  const mdPath = path.join(baseDir, slug, 'blog', 'post.md');
  let md;
  try { md = await fs.readFile(mdPath, 'utf8'); } catch { console.log(`[skip] ${slug} — no blog/post.md`); continue; }
  const imgDir = path.join(baseDir, slug, 'blog', 'images');
  const images = await fs.readdir(imgDir)
    .then((fl) => fl.filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort().map((f) => path.join(imgDir, f)))
    .catch(() => []);
  todo.push({ slug, images, ...parsePost(md) });
}

if (DRY_RUN) {
  for (const t of todo) {
    console.log('='.repeat(60));
    console.log('SLUG :', t.slug);
    console.log('TITLE:', t.title);
    console.log('BODY :', t.body.length, 'chars');
    console.log('STYLE:', t.headings.length, 'headings |', t.faqQuestions.length, 'FAQ |', t.quoteLeads.length, 'quotes |', t.tables.length, 'tables |', t.images.length, 'images');
    t.quoteLeads.forEach((q) => console.log('  quote:', q.slice(0, 40)));
    console.log('-'.repeat(60));
    console.log(t.body.slice(0, 1500));
    console.log(t.body.length > 1500 ? `\n... (${t.body.length - 1500} more chars)` : '');
  }
  process.exit(0);
}

if (!todo.length) { console.log('Nothing to post.'); process.exit(0); }

const ctx = await launch();
try {
  const blogId = await detectBlogId(ctx);
  console.log(`Blog: ${blogId} | mode: ${DRAFT ? 'draft' : 'publish'} | ${todo.length} post(s)`);
  for (const t of todo) {
    const res = await postOne(ctx, blogId, t.slug, t);
    // don't log an unverified draft — otherwise the next run skips it as
    // "already posted" and the topic silently never gets saved
    if (res.keepOpen) {
      // hold the process (and the browser) open until the user Ctrl+C's
      await new Promise(() => {});
    }
    if (res.mode === 'draft' && res.verified === false) {
      console.warn(`  (not logged — re-run to retry ${t.slug})`);
    } else {
      posted.push({ slug: t.slug, date: new Date().toISOString(), ...res });
      await fs.writeFile(logPath, JSON.stringify(posted, null, 2));
    }
    if (todo.length > 1) await sleep(jitter(30000, 60000)); // space out posts
  }
} finally {
  await ctx.close();
}
