import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";

const HTML = "file://" + path.resolve("weekly-deals.html");
const OUT = path.resolve("category-shots");
await fs.mkdir(OUT, { recursive: true });

const BUCKETS = ["dairy_eggs","meat_seafood","fruit_veg","bakery","pantry","snacks",
  "frozen","drinks","household","baby","health_beauty","pet"];

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1240, height: 2000 }, deviceScaleFactor: 2,
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
});

// Woolworths CDN 403s without a Referer AND the browser blocks the cross-origin
// response with ORB. Intercept, fetch server-side (Node, no ORB) with a Referer,
// and hand the bytes back as image/jpeg so the <img> renders.
await ctx.route(/woolworths\.media/, async (route) => {
  try {
    const resp = await ctx.request.get(route.request().url(), {
      headers: { referer: "https://www.woolworths.com.au/", "user-agent": "Mozilla/5.0" },
    });
    await route.fulfill({ status: 200, contentType: "image/jpeg", body: await resp.body() });
  } catch { route.abort(); }
});

const page = await ctx.newPage();
await page.goto(HTML, { waitUntil: "domcontentloaded" });
await page.addStyleTag({ content: `.nav,#progress-bar,.ticker,.pick{display:none!important}` });

const expanded = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("[data-stk]")];
  btns.forEach((btn) => { const s = document.getElementById(btn.getAttribute("data-stk")); if (s) s.classList.add("expanded"); btn.textContent = "접기"; });
  return btns.length;
});
console.log(`전체 보기 ON: ${expanded}개 스택 펼침`);

await page.evaluate(async () => {
  document.querySelectorAll("img").forEach((i) => { i.loading = "eager"; });
  const H = document.body.scrollHeight;
  for (let y = 0; y <= H; y += 1000) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); }
  window.scrollTo(0, 0);
});
await page.evaluate(() => {
  const imgs = [...document.querySelectorAll("img")].filter((i) => !(i.complete && i.naturalWidth > 0));
  return Promise.race([
    Promise.all(imgs.map((i) => new Promise((res) => { i.addEventListener("load", res, { once: true }); i.addEventListener("error", res, { once: true }); }))),
    new Promise((res) => setTimeout(res, 60000)),
  ]);
});
const broken = await page.evaluate(() => [...document.querySelectorAll("img")].filter((i) => !i.complete || i.naturalWidth === 0).length);
console.log(`깨진 이미지: ${broken}개`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

let n = 0;
for (const id of BUCKETS) {
  const el = page.locator(`section.bucket#${id}`);
  if (await el.count() === 0) { console.warn(`  (없음: ${id})`); continue; }
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const idx = String(++n).padStart(2, "0");
  await el.screenshot({ path: path.join(OUT, `${idx}-${id}.png`) });
  console.log(`  ${idx}-${id}.png`);
}
await b.close();
console.log(`\n완료: ${n}개 파일 → ${OUT}`);
