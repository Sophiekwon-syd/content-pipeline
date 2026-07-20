#!/usr/bin/env node
// Publish a pipeline post to Google Blogger via Playwright with a persistent
// logged-in profile — the same pattern as post-to-naver.mjs.
//
// WHY: the claude-in-chrome extension bridge only exists in an INTERACTIVE
// Claude session, so the 6am headless scheduled run can never reach it. A
// dedicated Playwright profile signed into Google works headlessly forever.
//
// Usage:
//   node scripts/post-to-blogger.mjs --login
//       Opens a browser. Sign into Google yourself (incl. 2FA). Session is
//       saved to .blogger-profile/ and reused from then on.
//
//   node scripts/post-to-blogger.mjs [--date YYYY-MM-DD] [--slug <slug>] [--draft]
//       Publishes every un-posted topic's blog/blogger.html for that date.
//       --draft saves without publishing.
//
//   node scripts/post-to-blogger.mjs --date <d> --dry-run
//       Prints title + body size without opening a browser.
//
// Body is injected directly into the compose editor's contenteditable iframe.
// NEVER paste raw HTML into compose — Blogger escapes it and publishes literal
// tags.

import fs from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

const LOGIN = flag('--login');
const DRAFT = flag('--draft');
const DRY_RUN = flag('--dry-run');
const ONLY_SLUG = opt('--slug');
const date = opt('--date') || new Date().toISOString().slice(0, 10);

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PROFILE_DIR = path.join(ROOT, '.blogger-profile');
const baseDir = path.join(ROOT, 'outputs', date);

const config = JSON.parse(await fs.readFile(path.join(ROOT, 'config.json'), 'utf8'));
const BLOG_ID = process.env.BLOGGER_BLOG_ID || config.channels?.blogger?.blog_id;
const ACCOUNT = process.env.BLOGGER_ACCOUNT ?? config.channels?.blogger?.account_index ?? 0;
const LABELS = config.channels?.blogger?.labels || '호주육아, 육아정보';
if (!BLOG_ID && !LOGIN && !DRY_RUN) {
  console.error('No blogger blog_id — set config.json → channels.blogger.blog_id');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (a, b) => a + Math.random() * (b - a);

async function launch() {
  const { chromium } = await import('playwright');
  return chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 950 },
    args: ['--disable-blink-features=AutomationControlled'],
  });
}

if (LOGIN) {
  const ctx = await launch();
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto('https://www.blogger.com/');
  console.log('Sign into Google in the opened window (ID/password/2FA yourself —');
  console.log('this script never touches your credentials).');
  console.log('Waiting until the Blogger dashboard loads...');
  let ok = false;
  for (let i = 0; i < 300; i++) { // up to ~10 min
    const url = page.url();
    if (/blogger\.com\/(u\/\d+\/)?(blog|home|dashboard)/.test(url) && !/accounts\.google/.test(url)) { ok = true; break; }
    await sleep(2000);
  }
  await sleep(2000);
  console.log(ok ? 'Login detected. Session saved to .blogger-profile/.' : 'Timed out — re-run --login.');
  await ctx.close();
  process.exit(ok ? 0 : 1);
}

// ---------------------------------------------------------------- topics
let slugs;
try {
  slugs = (await fs.readdir(baseDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory()).map((e) => e.name);
} catch {
  console.log(`No outputs directory for ${date} — nothing to post.`);
  process.exit(0);
}
if (ONLY_SLUG) slugs = slugs.filter((s) => s === ONLY_SLUG);

const logPath = path.join(baseDir, 'blogger-log.json');
let posted = [];
try { posted = JSON.parse(await fs.readFile(logPath, 'utf8')); } catch {}

const todo = [];
for (const slug of slugs) {
  if (posted.some((p) => p.slug === slug)) { console.log(`[skip] ${slug} — already posted`); continue; }
  const htmlPath = path.join(baseDir, slug, 'blog', 'blogger.html');
  let html;
  try { html = await fs.readFile(htmlPath, 'utf8'); }
  catch { console.log(`[skip] ${slug} — no blog/blogger.html (run md-to-blogger.mjs first)`); continue; }
  let title = slug;
  try {
    const md = await fs.readFile(path.join(baseDir, slug, 'blog', 'post.md'), 'utf8');
    const h1 = md.match(/^#\s+(.+)$/m);
    if (h1) title = h1[1].replace(/\s+—\s+/g, ', ').trim();
  } catch {}
  todo.push({ slug, title, html });
}

if (DRY_RUN) {
  for (const t of todo) console.log(`SLUG: ${t.slug}\nTITLE: ${t.title}\nBODY: ${t.html.length} chars\n`);
  process.exit(0);
}
if (!todo.length) { console.log('Nothing to post.'); process.exit(0); }

// ---------------------------------------------------------------- publish
const ctx = await launch();
let failed = 0;
try {
  for (const t of todo) {
    const page = await ctx.newPage();
    await page.goto(`https://www.blogger.com/u/${ACCOUNT}/blog/post/edit/${BLOG_ID}/new`, { waitUntil: 'domcontentloaded' })
      .catch(() => {});
    await sleep(jitter(4000, 6000));
    // fall back to the posts list → NEW POST if the direct /new URL bounced
    if (!/blog\/post\/edit/.test(page.url())) {
      await page.goto(`https://www.blogger.com/u/${ACCOUNT}/blog/posts/${BLOG_ID}`, { waitUntil: 'domcontentloaded' });
      await sleep(4000);
      await page.getByRole('button', { name: /NEW POST/i }).first().click().catch(() => {});
      await sleep(5000);
    }

    // Title
    const title = page.locator('input[aria-label*="Title" i], input[placeholder*="Title" i]').first();
    if (await title.isVisible().catch(() => false)) { await title.click(); await title.fill(t.title); }
    else { await page.mouse.click(600, 289); await page.keyboard.type(t.title); }
    await sleep(800);

    // Body — inject into the compose editor's contenteditable iframe.
    const set = await page.evaluate((html) => {
      const f = [...document.querySelectorAll('iframe')].find((x) => (x.className || '').includes('editable'));
      const body = f && f.contentDocument && f.contentDocument.body;
      if (!body) return false;
      body.innerHTML = html;
      body.dispatchEvent(new Event('input', { bubbles: true }));
      return (body.innerText || '').trim().length > 0;
    }, t.html);
    if (!set) { console.error(`[fail] ${t.slug} — could not inject body into editor`); failed++; await page.close(); continue; }
    await sleep(1500);

    // Labels
    const lab = page.locator('input[aria-label*="labels" i], input[aria-label*="Separate labels" i]').first();
    if (await lab.isVisible().catch(() => false)) { await lab.click(); await page.keyboard.type(LABELS); await sleep(600); }

    if (DRAFT) {
      console.log(`[draft] ${t.slug} — left unpublished in Blogger`);
      await sleep(2000);
      await page.close();
      continue;
    }

    // Publish → CONFIRM
    await page.getByRole('button', { name: /^Publish$/i }).first().click();
    await sleep(2500);
    await page.getByRole('button', { name: /^CONFIRM$/i }).first().click().catch(async () => {
      await page.locator('button:has-text("Confirm")').last().click().catch(() => {});
    });
    await sleep(4000);

    // verify: the posts list should now contain the title
    await page.goto(`https://www.blogger.com/u/${ACCOUNT}/blog/posts/${BLOG_ID}`, { waitUntil: 'domcontentloaded' });
    await sleep(3500);
    const live = await page.evaluate((tt) => document.body.innerText.includes(tt.slice(0, 20)), t.title);
    if (live) {
      console.log(`[posted] ${t.slug} → published to Blogger`);
      posted.push({ slug: t.slug, date: new Date().toISOString(), title: t.title });
      await fs.writeFile(logPath, JSON.stringify(posted, null, 2));
    } else {
      console.error(`[fail] ${t.slug} — publish not confirmed in posts list`);
      failed++;
    }
    await page.close();
    if (todo.length > 1) await sleep(jitter(15000, 30000));
  }
} finally {
  await ctx.close();
}
console.log(`\nDone. Posted ${posted.length} topic(s)${failed ? `, ${failed} failed` : ''}.`);
if (failed > 0) process.exit(1);
