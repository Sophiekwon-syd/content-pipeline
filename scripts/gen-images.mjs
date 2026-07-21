#!/usr/bin/env node
// Generate a post's blog images with Gemini via a persistent logged-in
// Playwright profile — so the headless 6am run can make its own images
// instead of shipping text-only. Same pattern as post-to-naver / post-to-blogger.
//
// Usage:
//   node scripts/gen-images.mjs --login
//       Sign into Google in the opened window; session saved to .gemini-profile/.
//
//   node scripts/gen-images.mjs --date YYYY-MM-DD [--slug <slug>]
//       Reads each `hero:` / `section-N:` line under the post's
//       `## 이미지 프롬프트` heading, generates the image in a FRESH chat,
//       downloads it, crops the bottom 160px (Gemini watermark), and saves to
//       blog/images/{hero,section-N}.png. Skips images that already exist.
//
// After this, re-run scripts/md-to-blogger.mjs so blogger.html references them.

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };

const LOGIN = flag('--login');
const ONLY_SLUG = opt('--slug');
const date = opt('--date') || new Date().toISOString().slice(0, 10);

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PROFILE_DIR = path.join(ROOT, '.gemini-profile');
const DOWNLOADS = path.join(os.homedir(), 'Downloads');
const baseDir = path.join(ROOT, 'outputs', date);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const { chromium } = await import('playwright');
  return chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
    acceptDownloads: true,
  });
}

if (LOGIN) {
  const ctx = await launch();
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto('https://gemini.google.com/app');
  console.log('Sign into Google in the opened window (ID/password/2FA yourself).');
  console.log('Waiting until the Gemini prompt box is available...');
  let ok = false;
  for (let i = 0; i < 300; i++) {
    if (await page.locator('div[contenteditable="true"], textarea').first().isVisible().catch(() => false)
        && !/accounts\.google/.test(page.url())) { ok = true; break; }
    await sleep(2000);
  }
  await sleep(2000);
  console.log(ok ? 'Login detected. Session saved to .gemini-profile/.' : 'Timed out — re-run --login.');
  await ctx.close();
  process.exit(ok ? 0 : 1);
}

// ---- collect prompts across topics
let slugs;
try {
  slugs = (await fs.readdir(baseDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory()).map((e) => e.name);
} catch { console.log(`No outputs for ${date}.`); process.exit(0); }
if (ONLY_SLUG) slugs = slugs.filter((s) => s === ONLY_SLUG);

const jobs = [];
for (const slug of slugs) {
  let md;
  try { md = await fs.readFile(path.join(baseDir, slug, 'blog', 'post.md'), 'utf8'); } catch { continue; }
  const sec = md.split(/^##\s+이미지 프롬프트\s*$/m)[1];
  if (!sec) continue;
  const block = sec.split(/^##\s+/m)[0];
  const imgDir = path.join(baseDir, slug, 'blog', 'images');
  for (const m of block.matchAll(/^\*{0,2}(hero|section-\d+)\*{0,2}\s*[:：]\s*(.+)$/gim)) {
    const name = m[1].toLowerCase();
    const prompt = m[2].trim();
    const out = path.join(imgDir, `${name}.png`);
    try { await fs.access(out); continue; } catch {} // skip existing
    jobs.push({ slug, name, prompt, out, imgDir });
  }
}
if (!jobs.length) { console.log('No missing images to generate.'); process.exit(0); }
console.log(`Generating ${jobs.length} image(s)...`);

const ctx = await launch();
let made = 0, failed = 0;
try {
  for (const job of jobs) {
    await fs.mkdir(job.imgDir, { recursive: true });
    const page = await ctx.newPage();
    try {
      await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });
      await sleep(4000);
      const box = page.locator('div[contenteditable="true"][role="textbox"], textarea').first();
      await box.click();
      await sleep(500);
      await page.keyboard.type(`이미지 생성해줘. ${job.prompt}`); // type, not fill — fill breaks Gemini's editor
      await sleep(800);
      await page.keyboard.press('Enter');

      // wait for a real generated image (blob/googleusercontent, naturalWidth > 400)
      let ready = false;
      for (let i = 0; i < 45; i++) { // up to ~90s
        await sleep(2000);
        const n = await page.evaluate(() =>
          [...document.querySelectorAll('img')].filter((e) => e.naturalWidth > 400
            && (/^blob:|googleusercontent/.test(e.src) || /generated/i.test(e.alt || ''))).length);
        if (n > 0) { ready = true; break; }
      }
      if (!ready) { console.warn(`  [fail] ${job.slug}/${job.name} — no image rendered`); failed++; await page.close(); continue; }
      await sleep(1500);

      // grab the image bytes via canvas — the img is a same-origin blob so it
      // doesn't taint the canvas, and this avoids CSP (fetch is blocked) and
      // the fragile hover/download-button dance.
      const dataUrl = await page.evaluate(() => {
        const el = [...document.querySelectorAll('img')]
          .filter((e) => e.naturalWidth > 400 && (/^blob:|googleusercontent/.test(e.src) || /generated/i.test(e.alt || '')))
          .pop();
        if (!el) return null;
        try {
          const c = document.createElement('canvas');
          c.width = el.naturalWidth; c.height = el.naturalHeight;
          c.getContext('2d').drawImage(el, 0, 0);
          return c.toDataURL('image/png');
        } catch { return null; }
      });
      if (!dataUrl) { console.warn(`  [fail] ${job.slug}/${job.name} — could not read image bytes`); failed++; await page.close(); continue; }

      const raw = path.join(job.imgDir, `.${job.name}.raw.png`);
      await fs.writeFile(raw, Buffer.from(dataUrl.split(',')[1], 'base64'));
      // crop bottom ~12% (Gemini ✦ watermark, bottom-right) — proportional so it
      // works whatever height the canvas captured, without over-letterboxing.
      await exec('ffmpeg', ['-y', '-i', raw, '-vf', 'crop=iw:trunc(ih*0.88):0:0', job.out]);
      await fs.rm(raw).catch(() => {});
      console.log(`  [ok] ${job.slug}/${job.name}`);
      made++;
    } catch (e) {
      console.warn(`  [fail] ${job.slug}/${job.name} — ${e.message.split('\n')[0]}`);
      failed++;
    }
    await page.close();
    await sleep(2000);
  }
} finally { await ctx.close(); }

console.log(`\nDone. ${made} generated, ${failed} failed.`);
process.exit(failed && !made ? 1 : 0);
