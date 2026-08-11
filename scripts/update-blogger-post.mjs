#!/usr/bin/env node
// Update an EXISTING Blogger post's body with the freshly generated
// blog/blogger.html (same iframe-injection approach as post-to-blogger.mjs).
//
// Usage:
//   node scripts/update-blogger-post.mjs --post <postId> --date YYYY-MM-DD --slug <slug> [--draft]
import fs from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

const POST_ID = opt('--post');
const DRAFT = flag('--draft');
const date = opt('--date');
const slug = opt('--slug');
if (!POST_ID || !date || !slug) {
  console.error('usage: node scripts/update-blogger-post.mjs --post <postId> --date YYYY-MM-DD --slug <slug> [--draft]');
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PROFILE_DIR = path.join(ROOT, '.blogger-profile');
const config = JSON.parse(await fs.readFile(path.join(ROOT, 'config.json'), 'utf8'));
const BLOG_ID = config.channels?.blogger?.blog_id;
const ACCOUNT = config.channels?.blogger?.account_index ?? 0;
if (!BLOG_ID) { console.error('No blog_id in config.json'); process.exit(1); }

const htmlPath = path.join(ROOT, 'outputs', date, slug, 'blog', 'blogger.html');
let html;
try { html = await fs.readFile(htmlPath, 'utf8'); }
catch { console.error(`no ${htmlPath} — run md-to-blogger.mjs first`); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (a, b) => a + Math.random() * (b - a);

const { chromium } = await import('playwright');
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1280, height: 950 },
  args: ['--disable-blink-features=AutomationControlled'],
});

try {
  const page = await ctx.newPage();
  const editUrl = `https://www.blogger.com/u/${ACCOUNT}/blog/post/edit/${BLOG_ID}/${POST_ID}`;
  console.log('opening edit page:', editUrl);
  await page.goto(editUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(jitter(5000, 7000));
  console.log('url after load:', page.url());

  // title should already be there — grab it for verification
  const titleVal = await page.locator('input[aria-label*="Title" i], input[placeholder*="Title" i]')
    .first().inputValue().catch(() => '(none)');
  console.log('title field:', titleVal.slice(0, 60));

  // Body — inject the new HTML into the compose editor's contenteditable iframe
  const set = await page.evaluate((h) => {
    const f = [...document.querySelectorAll('iframe')].find((x) => (x.className || '').includes('editable'));
    const body = f && f.contentDocument && f.contentDocument.body;
    if (!body) return false;
    body.innerHTML = h;
    body.dispatchEvent(new Event('input', { bubbles: true }));
    return (body.innerText || '').trim().length > 0;
  }, html);
  if (!set) { console.error('[fail] could not inject body into editor'); process.exit(1); }
  console.log('body injected, chars:', html.length);
  await sleep(1500);

  if (DRAFT) {
    await page.getByRole('button', { name: /^Save$/i }).first().click()
      .catch(() => page.locator('button:has-text("Save")').first().click().catch(() => {}));
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await sleep(3000);
    console.log('[draft] saved — verify in posts list, then Publish manually.');
    await sleep(20000);
  } else {
    // Existing post → the top bar shows "Update" (new posts show "Publish").
    // Click it, then handle any confirm dialog (Update/Publish/CONFIRM).
    await page.getByRole('button', { name: /^(Update|Publish)$/i }).first().click().catch(async () => {
      await page.locator('button:has-text("Update"), button:has-text("Publish")').first().click().catch(() => {});
    });
    await sleep(3000);
    await page.getByRole('button', { name: /^(Update|Publish|CONFIRM)$/i }).last().click().catch(async () => {
      await page.locator('button:has-text("Confirm")').last().click().catch(() => {});
    });
    await sleep(5000);

    // verify via the posts list
    await page.goto(`https://www.blogger.com/u/${ACCOUNT}/blog/posts/${BLOG_ID}`, { waitUntil: 'domcontentloaded' });
    await sleep(3500);
    const title = titleVal.slice(0, 20);
    const live = await page.evaluate((t) => document.body.innerText.includes(t), title);
    console.log(live ? '[posted] update confirmed in posts list' : '[warn] not confirmed in posts list');
  }
} finally {
  await ctx.close();
}