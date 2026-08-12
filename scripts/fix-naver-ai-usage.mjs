#!/usr/bin/env node
// Repair the per-image "AI 활용 설정" toggle on an already-published Naver post.
// Opens the edit page (same logNo — no duplicate), clicks each image to reveal
// its toolbar, turns on the AI-usage toggle, then re-publishes (Update).
// Usage: node scripts/fix-naver-ai-usage.mjs <logNo>
import { chromium } from 'playwright';

const PROFILE_DIR = new URL('../.naver-profile/', import.meta.url).pathname;
const LOGNO = process.argv[2];
const BLOG = 'ai-in-syd';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!LOGNO) { console.error('usage: node scripts/fix-naver-ai-usage.mjs <logNo>'); process.exit(1); }

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false, viewport: { width: 1280, height: 900 }, slowMo: 40,
  args: ['--disable-blink-features=AutomationControlled'],
  permissions: ['clipboard-read', 'clipboard-write'],
});

try {
  const page = await ctx.newPage();
  await page.goto(`https://blog.naver.com/${BLOG}/postwrite?logNo=${LOGNO}`, { waitUntil: 'domcontentloaded' });
  await sleep(9000);
  await page.locator('.se-popup-button-cancel').first().click({ timeout: 3000 }).catch(() => {});
  await sleep(1000);

  const images = page.locator('.se-component.se-image');
  const n = await images.count();
  console.log('images:', n);
  let on = 0;
  for (let i = 0; i < n; i++) {
    const img = images.nth(i);
    await img.scrollIntoViewIfNeeded();
    await sleep(400);
    await img.click({ force: true });
    await sleep(700);
    const toggle = page.locator('button.se-set-ai-mark-button-toggle').first();
    if (!(await toggle.count())) { console.log(`  image ${i + 1}: no AI toggle found`); continue; }
    const already = await toggle.evaluate((b) => b.classList.contains('se-is-selected'));
    if (already) { on++; console.log(`  image ${i + 1}: already on`); continue; }
    await toggle.click({ force: true });
    await sleep(500);
    if (await toggle.evaluate((b) => b.classList.contains('se-is-selected'))) { on++; console.log(`  image ${i + 1}: turned on`); }
    else console.log(`  image ${i + 1}: toggle failed`);
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(300);
  }
  console.log(`AI 활용 설정: on for ${on}/${n} images`);

  // re-publish (Update) the same logNo
  await page.getByRole('button', { name: '발행' }).first().click();
  await sleep(2500);
  await page.locator('[data-testid="seOnePublishBtn"], .confirm_btn__, button:has-text("발행")').last().click();
  await page.waitForURL(/blog\.naver\.com\/.+\/\d+/, { timeout: 20000 }).catch(() => {});
  console.log('republished:', page.url());
  await sleep(2000);
} finally {
  await ctx.close();
}