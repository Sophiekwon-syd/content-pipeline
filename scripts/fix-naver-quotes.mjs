#!/usr/bin/env node
// Fix quote placements in the LIVE Naver post:
//  A. Insert a plain caption line "벌크빌링 vs 프라이빗 빌링 비교" right above
//     the comparison table (the quote title was consumed by the earlier fix).
//  B. Convert the "방문 전 확인 사항" quotation (checklist in a quote box,
//     stacked directly under the "7. …체크리스트" heading quote) into plain
//     "• …" bullet text lines.
//
// Usage: node scripts/fix-naver-quotes.mjs <logNo> [--draft]
import { chromium } from 'playwright';

const PROFILE_DIR = new URL('../.naver-profile/', import.meta.url).pathname;
const LOGNO = process.argv[2];
const BLOG = 'ai-in-syd';
const DRAFT = process.argv.includes('--draft');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!LOGNO) { console.error('usage: node scripts/fix-naver-quotes.mjs <logNo> [--draft]'); process.exit(1); }

const BULLET_LINES = [
  '• healthdirect.gov.au에서 bulk billing only 필터로 1차 검색',
  '• hotdoc 또는 healthengine에서 예약 가능 여부 확인',
  '• 전화로 재확인: "Do you bulk bill new patients? Any gaps?"',
  '• 평균 갭비 $40~$60 미리 생각하고 가기',
  '• 어린이 Blue Book 소지자는 거의 모든 병원 벌크빌링 가능',
  '• specialist는 대부분 private ($150~$300)',
];

// ---- helpers ---------------------------------------------------------------
async function rangeDeleteQuote(page, quote) {
  const firstPara = quote.locator('.se-text-paragraph').first();
  // last VISIBLE paragraph (skip empty trailing paragraphs)
  const paras = quote.locator('.se-text-paragraph');
  const n = await paras.count();
  let lastPara = null;
  for (let k = n - 1; k >= 0; k--) {
    const txt = await paras.nth(k).innerText().catch(() => '');
    if (txt.trim()) { lastPara = paras.nth(k); break; }
  }
  if (!lastPara) return false;
  await firstPara.click();
  await sleep(300);
  await page.keyboard.press('Home');
  await sleep(300);
  const pos = await lastPara.evaluate((p) => {
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let last = null;
    while (walker.nextNode()) last = walker.currentNode;
    if (!last) return null;
    const r = document.createRange();
    r.selectNodeContents(last);
    r.collapse(false);
    const rect = r.getBoundingClientRect();
    return { x: rect.right + 2, y: rect.top + rect.height / 2 };
  });
  if (!pos) return false;
  await page.mouse.move(pos.x, pos.y);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await sleep(800);
  await page.keyboard.press('Delete');
  await sleep(1200);
  return true;
}

async function dragDeleteEmptyShell(page) {
  const shell = page.locator('.se-component.se-quotation', { hasText: '내용을 입력하세요' }).first();
  const cnt = await shell.count();
  if (!cnt) return false;
  await shell.scrollIntoViewIfNeeded();
  await sleep(500);
  const r1 = await shell.evaluate((el) => {
    const module = el.querySelector('.se-quote') || el;
    const r = module.getBoundingClientRect();
    return { x: r.left - 4, y: r.top + Math.min(r.height / 2, 20) };
  });
  const r2 = await shell.evaluate((el) => {
    const cite = el.querySelector('.se-cite') || el;
    const r = cite.getBoundingClientRect();
    return { x: r.right + 4, y: r.top + Math.min(r.height / 2, 20) };
  });
  await page.mouse.move(r1.x, r1.y);
  await page.mouse.down();
  await sleep(200);
  await page.mouse.move(r2.x, r2.y, { steps: 8 });
  await sleep(300);
  await page.mouse.up();
  await sleep(600);
  await page.keyboard.press('Delete');
  await sleep(1000);
  return (await page.locator('.se-component.se-quotation', { hasText: '내용을 입력하세요' }).count()) === 0;
}

async function dumpTopLevel(page, label) {
  const rows = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.se-component')].filter((c) => !c.parentElement.closest('.se-component'));
    return all.map((c, i) => {
      const kind = [...c.classList].find((x) => x.startsWith('se-') && x !== 'se-component') || '?';
      const cells = [...c.querySelectorAll('td,th')].length;
      const paras = [...c.querySelectorAll('.se-text-paragraph')]
        .map((p) => (p.textContent || '').replace(/\u200b/g, '').trim())
        .filter(Boolean);
      return { i: i + 1, kind, cells, first: paras[0] ? paras[0].slice(0, 34) : '' };
    });
  });
  console.log(`--- ${label} ---`);
  rows.forEach((r) => console.log(`[${String(r.i).padStart(2)}] ${r.kind.padEnd(14)} cells=${String(r.cells).padStart(2)}  ${r.first}`));
}

// ---- main ------------------------------------------------------------------
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  slowMo: 40,
  args: ['--disable-blink-features=AutomationControlled'],
  permissions: ['clipboard-read', 'clipboard-write'],
});

try {
  const page = await ctx.newPage();
  await page.goto(`https://blog.naver.com/${BLOG}/postwrite?logNo=${LOGNO}`, { waitUntil: 'domcontentloaded' });
  await sleep(9000);
  await page.locator('.se-popup-button-cancel').first().click({ timeout: 3000 }).catch(() => {});
  await sleep(1000);
  await dumpTopLevel(page, 'BEFORE');

  // ---- Change A: caption above the table ----
  const tableCnt = await page.locator('.se-component.se-table').count();
  console.log('tables:', tableCnt);
  if (tableCnt) {
    await page.evaluate(() => {
      const all = [...document.querySelectorAll('.se-component')].filter((c) => !c.parentElement.closest('.se-component'));
      const tIdx = all.findIndex((c) => c.classList.contains('se-table'));
      const prevComp = all[tIdx - 1];
      if (!prevComp) return;
      const paras = prevComp.querySelectorAll('.se-text-paragraph');
      const lastP = paras[paras.length - 1];
      if (!lastP) return;
      lastP.scrollIntoView({ block: 'center' });
      const r = lastP.getBoundingClientRect();
      window.__anchor = { x: r.x + 20, y: r.y + Math.min(r.height / 2, 14) };
    });
    const anchor = await page.evaluate(() => window.__anchor);
    if (anchor) {
      await page.mouse.click(anchor.x, anchor.y);
      await sleep(400);
      await page.keyboard.press('End');
      await sleep(300);
      await page.keyboard.press('Enter');
      await sleep(500);
      await page.keyboard.type('벌크빌링 vs 프라이빗 빌링 비교', { delay: 30 });
      await sleep(400);
      console.log('caption inserted');
    }
  }

  // ---- Change B: checklist quote → bullet lines ----
  const checklist = page.locator('.se-component.se-quotation', { hasText: '방문 전 확인 사항' }).first();
  const checklistCnt = await checklist.count();
  console.log('방문 전 확인 사항 quotes:', checklistCnt);
  if (checklistCnt) {
    await rangeDeleteQuote(page, checklist);
    console.log('after range-delete, empty shells:', await page.locator('.se-component.se-quotation', { hasText: '내용을 입력하세요' }).count());
    await dragDeleteEmptyShell(page);
    console.log('shells after drag-delete:', await page.locator('.se-component.se-quotation', { hasText: '내용을 입력하세요' }).count());
    await dumpTopLevel(page, 'AFTER DELETE QUOTE');

    // type the bullet lines at the caret — ensure a text paragraph exists
    const typed = await page.evaluate(() => {
      const sel = window.getSelection();
      const anchored = sel && sel.rangeCount && sel.getRangeAt(0).startContainer;
      return !!anchored;
    });
    if (!typed) {
      // click the first empty text paragraph after the 7.체크리스트 heading
      await page.evaluate(() => {
        const all = [...document.querySelectorAll('.se-component')].filter((c) => !c.parentElement.closest('.se-component'));
        const hIdx = all.findIndex((c) => (c.textContent || '').includes('7. 벌크빌링 GP 찾기 전 체크리스트'));
        for (let k = hIdx + 1; k < all.length; k++) {
          const p = all[k].querySelector('.se-text-paragraph');
          if (p) {
            p.scrollIntoView({ block: 'center' });
            const r = p.getBoundingClientRect();
            window.__pos = { x: r.x + 20, y: r.y + Math.min(r.height / 2, 14) };
            return;
          }
        }
      });
      const pos = await page.evaluate(() => window.__pos);
      if (pos) { await page.mouse.click(pos.x, pos.y); await sleep(400); }
    }
    for (let k = 0; k < BULLET_LINES.length; k++) {
      await page.keyboard.type(BULLET_LINES[k], { delay: 20 });
      if (k < BULLET_LINES.length - 1) { await page.keyboard.press('Enter'); await sleep(250); }
    }
    await sleep(600);
    console.log('bullet lines typed');
  }

  await dumpTopLevel(page, 'AFTER ALL CHANGES');

  // sanity checks
  const stillBroken = await page.locator('.se-component.se-quotation', { hasText: '| 구분 |' }).count();
  const caption = await page.locator('.se-text-paragraph', { hasText: '벌크빌링 vs 프라이빗 빌링 비교' }).count();
  const bullets = await page.locator('.se-text-paragraph', { hasText: /^•/ }).count();
  console.log('pipe-text quotes:', stillBroken, '| caption paragraphs:', caption, '| bullet paragraphs:', bullets);

  // ---- publish ----
  if (DRAFT) {
    console.log('  [draft] left in editor — save manually (임시저장/발행).');
    await sleep(30000);
  } else {
    await page.getByRole('button', { name: '발행' }).first().click();
    await sleep(2500);
    await page.locator('[data-testid="seOnePublishBtn"], .confirm_btn__, button:has-text("발행")').last().click();
    await page.waitForURL(/blog\.naver\.com\/.+\/\d+/, { timeout: 20000 }).catch(() => {});
    console.log('published:', page.url());
    await sleep(2000);
  }
} finally {
  if (!DRAFT) await ctx.close();
}