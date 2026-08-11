#!/usr/bin/env node
// Fix the broken comparison table in the LIVE Naver post.
//  1. Open the post in the full SmartEditor (postwrite?logNo)
//  2. Range-delete the broken pipe-text quotation
//  3. Drag-delete the leftover empty quotation shell
//  4. Insert a real 표 component at the caret, grow + fill it
//  5. Verify the table cells, then publish via 발행
//
// Usage: node scripts/fix-naver-table.mjs <logNo> [--draft]
import { chromium } from 'playwright';

const PROFILE_DIR = new URL('../.naver-profile/', import.meta.url).pathname;
const LOGNO = process.argv[2];
const BLOG = 'ai-in-syd';
const DRAFT = process.argv.includes('--draft');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!LOGNO) { console.error('usage: node scripts/fix-naver-table.mjs <logNo> [--draft]'); process.exit(1); }

const TABLE_DATA = {
  header: ['구분', '벌크빌링 (Bulk Billing)', '프라이빗 빌링 (Private Billing)'],
  rows: [
    ['본인 부담금', '$0', '평균 $40~$60 (gap fee)'],
    ['예약 준비', 'Medicare card만 지참', '카드 + 현금/GPay'],
    ['의료비 리베이트', '100% Medicare 보상', 'MBS 리베이트 차감 후 gap fee'],
    ['이용 가능한 환자', '모든 Medicare 가입자 (2025.11 BBPIP 확대)', '제한 없음'],
    ['대표 조회 사이트', 'healthdirect, HotDoc, AskMyGP', 'Google Maps, Healthengine'],
  ],
};

async function dumpAround(page, keyA, keyB, label) {
  const rows = await page.evaluate(([a, b]) => {
    const all = [...document.querySelectorAll('.se-component')].filter((c) => !c.parentElement.closest('.se-component'));
    const start = all.findIndex((c) => (c.textContent || '').includes(a));
    const end = all.findIndex((c) => (c.textContent || '').includes(b));
    if (start === -1 || end === -1) return all.map((c) => {
      const kind = [...c.classList].find((x) => x.startsWith('se-') && x !== 'se-component') || '?';
      const paras = [...c.querySelectorAll('.se-text-paragraph')].map((p) => (p.textContent || '').replace(/\u200b/g, '').trim()).filter(Boolean);
      return { kind, n: paras.length, first: paras[0] ? paras[0].slice(0, 30) : '' };
    });
    return all.slice(start, end + 1).map((c) => {
      const kind = [...c.classList].find((x) => x.startsWith('se-') && x !== 'se-component') || '?';
      const paras = [...c.querySelectorAll('.se-text-paragraph')].map((p) => (p.textContent || '').replace(/\u200b/g, '').trim()).filter(Boolean);
      return { kind, n: paras.length, first: paras[0] ? paras[0].slice(0, 30) : '' };
    });
  }, [keyA, keyB]);
  console.log(`--- ${label} ---`);
  rows.forEach((r) => console.log(`  ${r.kind.padEnd(14)} n=${r.n}  ${r.first}`));
}

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
  await dumpAround(page, 'self-pay', '6. 자주 묻는 질문', 'BEFORE');

  // ---- Step 1: range-delete the broken pipe-text quotation ----
  const broken = page.locator('.se-component.se-quotation', { hasText: '| 구분 |' }).first();
  const brokenCount = await broken.count();
  if (!brokenCount) { console.log('broken quote not found — abort'); process.exit(1); }
  const firstPara = broken.locator('.se-text-paragraph').first();
  const lastPara = broken.locator('.se-text-paragraph', { hasText: '대표 조회 사이트' }).first();
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
  await page.mouse.move(pos.x, pos.y);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await sleep(800);
  await page.keyboard.press('Delete');
  await sleep(1200);

  const shell = page.locator('.se-component.se-quotation', { hasText: '내용을 입력하세요' }).first();
  const shellCount = await shell.count();
  console.log('empty quote shell after range-delete:', shellCount);

  // ---- Step 2: drag-delete the empty quotation shell ----
  if (shellCount) {
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
  }
  console.log('empty quote shells now:', await page.locator('.se-component.se-quotation', { hasText: '내용을 입력하세요' }).count());
  await dumpAround(page, 'self-pay', '6. 자주 묻는 질문', 'AFTER DELETE');

  // ---- Step 3: insert the table at the caret ----
  // The drag-delete consumed the trailing empty text. Deterministic anchor:
  // click the LAST paragraph of whatever component sits right before
  // "6. 자주 묻는 질문", End, Enter → fresh empty paragraph → table goes there.
  const anchor = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.se-component')].filter((c) => !c.parentElement.closest('.se-component'));
    const qIdx = all.findIndex((c) => (c.textContent || '').includes('6. 자주 묻는 질문'));
    const prevComp = all[qIdx - 1];
    if (!prevComp) return null;
    const paras = prevComp.querySelectorAll('.se-text-paragraph');
    const lastP = paras[paras.length - 1];
    if (!lastP) return null;
    lastP.scrollIntoView({ block: 'center' });
    const r = lastP.getBoundingClientRect();
    return { x: r.x + 20, y: r.y + Math.min(r.height / 2, 14) };
  });
  if (!anchor) { console.log('no anchor paragraph — abort'); process.exit(1); }
  await page.mouse.click(anchor.x, anchor.y);
  await sleep(400);
  await page.keyboard.press('End');
  await sleep(300);
  await page.keyboard.press('Enter');
  await sleep(500);

  // ---- Step 4: build the table via the toolbar button ----
  const before = await page.locator('.se-component.se-table').count();
  await page.locator('button[data-name="table"]').first().click();
  let appeared = false;
  for (let w = 0; w < 24 && !appeared; w++) {
    await sleep(500);
    appeared = (await page.locator('.se-component.se-table').count()) > before;
  }
  if (!appeared) throw new Error('table insert failed — aborting');
  const table = page.locator('.se-component.se-table').last();

  const want = { rows: TABLE_DATA.rows.length + 1, cols: TABLE_DATA.header.length };
  for (let g = 0; g < 14; g++) {
    const dims = await table.evaluate((t) => {
      const trs = [...t.querySelectorAll('tr')];
      return { rows: trs.length, cols: trs[0] ? trs[0].querySelectorAll('td,th').length : 0 };
    });
    if (dims.cols >= want.cols && dims.rows >= want.rows) break;
    const addCol = dims.cols < want.cols;
    const btnIdx = await page.evaluate((wantCol) => {
      const t = [...document.querySelectorAll('.se-component.se-table')].pop()?.querySelector('table');
      if (!t) return -1;
      const tb = t.getBoundingClientRect();
      const btns = [...document.querySelectorAll('button.se-cell-add-button')];
      return btns.findIndex((b) => {
        const r = b.getBoundingClientRect();
        return wantCol ? (r.x - tb.right > -30) : (r.y - tb.bottom > -30);
      });
    }, addCol);
    if (btnIdx === -1) { console.warn('(no add-button found — table stays smaller)'); break; }
    await page.locator('button.se-cell-add-button').nth(btnIdx).click();
    await sleep(500);
  }

  const flat = [TABLE_DATA.header, ...TABLE_DATA.rows];
  const dims = await table.evaluate((t) => {
    const trs = [...t.querySelectorAll('tr')];
    return { rows: trs.length, cols: trs[0].querySelectorAll('td,th').length };
  });
  for (let r = 0; r < Math.min(flat.length, dims.rows); r++) {
    for (let c = 0; c < Math.min(flat[r].length, dims.cols); c++) {
      const val = (flat[r][c] || '').replace(/\s+/g, ' ').trim();
      if (!val) continue;
      await table.locator('td, th').nth(r * dims.cols + c).click();
      await sleep(120);
      await page.keyboard.type(val);
      await sleep(80);
    }
  }
  await page.keyboard.press('Escape').catch(() => {});

  const filled = await table.evaluate((t) =>
    [...t.querySelectorAll('td, th')].filter((c) => (c.textContent || '').trim()).length);
  console.log(`table: ${dims.rows}x${dims.cols}, ${filled}/${dims.rows * dims.cols} cells filled`);
  if (!filled) throw new Error('table came out empty — aborting');
  if (filled < want.cols * want.rows) throw new Error(`table lost content — ${filled}/${want.cols * want.rows}`);

  await dumpAround(page, 'self-pay', '6. 자주 묻는 질문', 'AFTER TABLE');

  // full top-level dump to locate the table component
  const full = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.se-component')].filter((c) => !c.parentElement.closest('.se-component'));
    return all.map((c, i) => {
      const kind = [...c.classList].find((x) => x.startsWith('se-') && x !== 'se-component') || '?';
      const cells = [...c.querySelectorAll('td,th')].length;
      const paras = [...c.querySelectorAll('.se-text-paragraph')]
        .map((p) => (p.textContent || '').replace(/\u200b/g, '').trim())
        .filter(Boolean);
      return { i: i + 1, kind, cells, first: paras[0] ? paras[0].slice(0, 36) : '' };
    });
  });
  console.log('--- FULL TOP-LEVEL ---');
  full.forEach((r) => console.log(`[${String(r.i).padStart(2)}] ${r.kind.padEnd(14)} cells=${r.cells}  ${r.first}`));
  console.log('se-table components:', await page.locator('.se-component.se-table').count());
  const tinfo = await page.evaluate(() => {
    const t = document.querySelector('.se-component.se-table');
    if (!t) return 'none';
    const chain = [];
    let el = t.parentElement;
    for (let d = 0; d < 6 && el; d++) { chain.push((el.className || '').toString().slice(0, 80)); el = el.parentElement; }
    return chain;
  });
  console.log('table ancestry:', JSON.stringify(tinfo));
  await page.screenshot({ path: '/tmp/fix-table-state.png', fullPage: false });
  console.log('screenshot saved');

  // ---- Step 5: publish ----
  if (DRAFT) {
    console.log('  [draft] left in editor — save manually (임시저장/발행).');
    await sleep(30000); // keep the window open for manual save
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