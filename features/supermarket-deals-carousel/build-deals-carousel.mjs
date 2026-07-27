#!/usr/bin/env node
// Build the weekly Coles vs Woolworths deals CAROUSEL (Instagram, 1080×1350).
//
// Reads data/combined-latest.json, resolves a curated PICKS list against the
// real catalogue (real prices), and emits a self-contained carousel index.html
// whose `.card` slides render to PNG via scripts/render-carousel.mjs.
//
// Design: light, text-forward (per PLAN.md) — NOT the dark editorial brand.
// Store colours: Coles #E01A22, Woolies #178841. No emojis, @aussie.umma handle
// top-right, no page dots. Prices are REAL (never fabricated); one dark
// statement card carries the week's hero stat.
//
// USE_IMAGES = false by default: retailer pack shots composited into cards carry
// a real IP-takedown risk on Instagram (repeat notices escalate to account
// restrictions), and the layout reads fine without them. Flip to true to bring
// back a product-photo column (images are then downloaded locally).

import fs from "node:fs/promises";
import path from "node:path";

const USE_IMAGES = true;

const DIR = path.resolve("features/supermarket-deals-carousel");
const OUT_DIR = path.resolve("outputs/2026-07-22/deals-coles-woolies/carousel");
const IMG_DIR = path.join(OUT_DIR, "images");

const combined = JSON.parse(
  await fs.readFile(path.join(DIR, "data", "combined-latest.json"), "utf8"),
);

// ── Curated picks: category → [ {store, match, ko, short} ] ───────────────────
// `match` = case-insensitive substring of the real product name; the first
// on-sale item that matches is used. `ko` = per-product slide comment.
// `short` = tight Korean name for the summary card (my voice, not CSS-truncated).
// Order below is the SLIDE order: 육아 leads (nappyprice audience), then the
// engagement/staple categories. Every category holds THREE items so all deal
// cards are a uniform 3-row grid.
const SLIDES = [
  {
    key: "baby", ko: "육아 · 아기용품",
    picks: [
      { store: "woolworths", match: "Huggies Ultra Dry Nappies Boys Size 5", ko: "기저귀 반값, 이번 주가 찬스예요", short: "하기스 5호 32개" },
      { store: "woolworths", match: "QV Baby Moisturising Cream 500", ko: "건조한 겨울 필수템 반값", short: "QV 베이비 크림 500g" },
      { store: "coles", match: "Rascals Premium Wipes 72", ko: "물티슈 80매 3불, 쟁여두기", short: "라스칼 물티슈 80매" },
    ],
  },
  {
    key: "snacks", ko: "과자 · 간식",
    picks: [
      { store: "coles", match: "Cadbury Favourites 264", ko: "손님 올 때 딱, 한 통에 반값", short: "캐드버리 페이버릿" },
      { store: "woolworths", match: "Tim Tam Original", ko: "팀탐 반값은 쟁여두는 거예요", short: "팀탐 오리지널" },
      { store: "woolworths", match: "Grain Waves Sour Cream", ko: "8봉 묶음이라 애들 간식으로", short: "그레인웨이브 8봉" },
    ],
  },
  {
    key: "frozen", ko: "냉동 · 아이스크림",
    picks: [
      { store: "woolworths", match: "Connoisseur Ice Cream Classic Vanilla", ko: "1L 프리미엄이 반값이에요", short: "코노셔 바닐라 1L" },
      { store: "coles", match: "Golden Gaytime Sticks 4", ko: "게이타임 4개들이, 여름 필수", short: "게이타임 4개입" },
      { store: "coles", match: "Destination Italy Gelato", ko: "이탈리안 젤라또 500mL 반값", short: "젤라또 500mL" },
    ],
  },
  {
    key: "dairy_eggs", ko: "유제품 · 계란",
    picks: [
      { store: "woolworths", match: "Farmers Union Greek Style High Protein Yoghurt Vanil", ko: "단백질 요거트, 아침 대용으로", short: "파머스유니온 요거트" },
      { store: "coles", match: "Dairy Farmers Thick & Creamy Yoghurt", ko: "애들 간식 요거트 반값", short: "데어리파머스 요거트" },
      { store: "coles", match: "So Good Almond Milk Original 1", ko: "아몬드유 1L, 커피용으로", short: "소굿 아몬드유 1L" },
    ],
  },
  {
    key: "bakery", ko: "빵 · 베이커리",
    picks: [
      { store: "coles", match: "Tip Top English Muffins 6", ko: "잉글리시 머핀, 아침 5분 완성", short: "팁탑 잉글리시 머핀" },
      { store: "woolworths", match: "Mr Kipling Cake Angel Slices", ko: "티타임 케이크 슬라이스 반값", short: "미스터키플링 케이크" },
      { store: "coles", match: "Golden Crumpet Squares 6", ko: "토스터에 데워 아침으로", short: "골든 크럼펫 6개입" },
    ],
  },
  {
    key: "household", ko: "생활 · 세제",
    picks: [
      { store: "coles", match: "Omo Ultimate 3 in 1 Laundry Capsules 28", ko: "세탁 캡슐 28개 반값", short: "오모 세탁캡슐 28개" },
      { store: "coles", match: "Finish Ultimate Plus Dishwashing Tablets 46", ko: "식기세척기 태블릿 46개", short: "피니시 태블릿 46개" },
      { store: "coles", match: "White King Power Toilet Cleaner 700", ko: "변기세정제 반값, 상비템", short: "화이트킹 변기세정제" },
    ],
  },
];

// ── Resolve picks against the real catalogue ─────────────────────────────────
const norm = (s) => String(s || "").toLowerCase();
function resolve(store, match) {
  const m = norm(match);
  return combined.items.find(
    (it) => it.store === store && it.was && norm(it.name).includes(m),
  );
}

const missing = [];
for (const slide of SLIDES) {
  slide.items = [];
  for (const p of slide.picks) {
    const it = resolve(p.store, p.match);
    if (!it) { missing.push(`${slide.key}/${p.store}/${p.match}`); continue; }
    slide.items.push({ ...it, ko: p.ko, short: p.short });
  }
}
if (missing.length) {
  console.warn("경고 — 매칭 실패(슬라이드에서 제외됨):");
  missing.forEach((m) => console.warn("  ·", m));
}

// ── Optional: download product images locally ────────────────────────────────
if (USE_IMAGES) {
  await fs.mkdir(IMG_DIR, { recursive: true });
  const imgName = (it) => `${it.store}-${it.name.replace(/[^a-z0-9]+/gi, "-").slice(0, 40).toLowerCase()}.jpg`;
  async function grab(url, file) {
    const dest = path.join(IMG_DIR, file);
    try { await fs.access(dest); return true; } catch {}
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await fs.writeFile(dest, Buffer.from(await r.arrayBuffer()));
      return true;
    } catch (e) { console.warn(`  이미지 실패 ${file}: ${e.message}`); return false; }
  }
  for (const slide of SLIDES) for (const it of slide.items) {
    it.localImg = imgName(it);
    if (it.img) await grab(it.img, it.localImg);
  }
} else {
  await fs.mkdir(IMG_DIR, { recursive: true });
}

// ── Real, page-consistent stats (filter liquor + unbucketed stationery, as the
// weekly-deals page does) so the headline number is defensible ───────────────
const pctOf = (it) => it.pctOff || 0;
const DROP = (it) =>
  /^Liquor$/i.test(it.category || "") ||
  (/^Stationery & Media$/i.test(it.category || "") && !it.bucket);
const pageItems = combined.items.filter((it) => !DROP(it));
const HALF = pageItems.filter((it) => pctOf(it) >= 50).length; // 반값 이상 (=halfPrice flag)
const TOTAL = pageItems.length;                                 // 전체 세일 품목

// ── HTML helpers ─────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (n) => Number(n).toFixed(2).split(".");
const storeLabel = (s) => (s === "coles" ? "Coles" : "Woolworths");
const shortName = (n) => esc(String(n).replace(/\s+\d+(\.\d+)?\s?(g|kg|ml|l|pack|pk)\b.*$/i, "").trim() || n);

function priceRow(it) {
  const [d, c] = money(it.price);
  return `<div class="pricerow">
    <span class="now"><i>$</i><b>${d}</b><i>.${c}</i></span>
    <span class="was">$${Number(it.was).toFixed(2)}</span>
    <span class="off">${it.pctOff}%</span>
  </div>`;
}

// text-forward tile (no product photo) — name + price get the room
function prodTile(it) {
  const thumb = USE_IMAGES
    ? `<div class="thumb"><span class="stag">${storeLabel(it.store)}</span><img src="images/${it.localImg}" alt="${esc(it.name)}"></div>`
    : "";
  return `<div class="prod s-${it.store}${USE_IMAGES ? " has-img" : ""}">
    ${thumb}
    <div class="pinfo">
      <span class="stag stag-inline">${storeLabel(it.store)}</span>
      <div class="pname">${shortName(it.name)}</div>
      ${priceRow(it)}
      <div class="cmt">${esc(it.ko)}</div>
    </div>
  </div>`;
}

const handle = `<div class="handle">@aussie.umma</div>`;

function coverCard() {
  return `<section class="card cover">
    ${handle}
    <div class="cv-kick">이번 주 세일</div>
    <h1 class="cv-title">콜스 <span class="vs">vs</span> 울월스<br>이번 주 뭐가 싸요?</h1>
    <div class="cv-range">2026년 7월 22일 – 28일 기준</div>
    <div class="cv-stores">
      <span class="chip s-coles">Coles</span>
      <span class="chip s-woolworths">Woolworths</span>
    </div>
    <div class="cv-foot">가격은 발행일·매장·지역에 따라 달라질 수 있어요</div>
  </section>`;
}

function statementCard() {
  return `<section class="card statement">
    ${handle}
    <div class="st-num">${HALF}<span>개</span></div>
    <div class="st-cap">이번 주 <b>반값 이상</b> 세일 품목</div>
    <div class="st-sub">콜스 · 울월스 카탈로그 기준<br>강한 것만 골라 담았어요</div>
  </section>`;
}

function dealCard(slide) {
  return `<section class="card deal">
    ${handle}
    <div class="dl-head"><span class="dl-ko">${esc(slide.ko)}</span></div>
    <div class="dl-grid">
      ${slide.items.map(prodTile).join("")}
    </div>
  </section>`;
}

function sheetCard() {
  const rows = SLIDES.map((s) => {
    const best = [...s.items].sort((a, b) => (b.pctOff || 0) - (a.pctOff || 0))[0];
    if (!best) return "";
    const [d, c] = money(best.price);
    return `<div class="sh-row">
      <span class="sh-cat">${esc(s.ko)}</span>
      <span class="sh-item">${esc(best.short)}</span>
      <span class="sh-price s-${best.store}">$${d}.${c}</span>
    </div>`;
  }).join("");
  return `<section class="card sheet">
    ${handle}
    <div class="sh-title">한 장에 담은<br>이번 주 베스트</div>
    <div class="sh-legend">
      <span class="lg"><i class="dot s-coles"></i>Coles</span>
      <span class="lg"><i class="dot s-woolworths"></i>Woolworths</span>
    </div>
    <div class="sh-list">${rows}</div>
    <div class="sh-note">저장해두고 장 볼 때 열어보세요</div>
  </section>`;
}

function ctaCard() {
  return `<section class="card cta">
    ${handle}
    <div class="ct-lead">이번 주 세일<br><b>${TOTAL}개</b> 전부는</div>
    <div class="ct-sub">프로필 링크에서 한눈에 보세요</div>
    <div class="ct-btn">nappyprice.com</div>
    <div class="ct-save">마음에 들면 저장하기 →</div>
  </section>`;
}

const CSS = `
:root{
  --coles:#E01A22; --woolies:#178841; --ink:#16191d; --muted:#6b7278;
  --paper:#f3f5ef; --card:#fff; --save:#ffd200; --line:#e5e8e0;
  --fd:"Bricolage Grotesque","Pretendard","Noto Sans KR",system-ui,sans-serif;
  --fb:"Pretendard","Noto Sans KR",system-ui,-apple-system,sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--fb);color:var(--ink);background:#d9ddd4;-webkit-font-smoothing:antialiased}
.deck{display:flex;flex-direction:column;align-items:center;gap:26px;padding:26px}
.card{width:1080px;height:1350px;position:relative;overflow:hidden;
  background:var(--paper);background-image:radial-gradient(rgba(20,25,22,.04) 1.1px,transparent 1.4px);
  background-size:26px 26px;padding:74px 72px}
.handle{position:absolute;top:52px;right:72px;font-weight:800;font-size:24px;letter-spacing:-.01em;color:var(--ink);z-index:5}

/* cover */
.cover{display:flex;flex-direction:column;justify-content:center}
.cv-kick{font-family:var(--fd);font-weight:800;font-size:30px;letter-spacing:.16em;color:var(--coles);text-transform:uppercase;margin-bottom:26px}
.cv-title{font-family:var(--fd);font-weight:800;font-size:104px;line-height:1.04;letter-spacing:-.03em}
.cv-title .vs{color:var(--woolies)}
.cv-range{margin-top:34px;font-size:34px;font-weight:700;color:var(--muted)}
.cv-stores{display:flex;gap:16px;margin-top:44px}
.chip{font-family:var(--fd);font-weight:800;font-size:34px;color:#fff;padding:14px 34px;border-radius:100px}
.chip.s-coles{background:var(--coles)}.chip.s-woolworths{background:var(--woolies)}
.cv-foot{position:absolute;left:72px;bottom:70px;font-size:23px;color:var(--muted)}

/* statement (dark rhythm card) */
.statement{background:#15181c;background-image:none;color:#fff;display:flex;flex-direction:column;justify-content:center;text-align:center}
.statement .handle{color:#fff}
.st-num{font-family:var(--fd);font-weight:800;font-size:340px;line-height:.9;color:var(--save);letter-spacing:-.04em}
.st-num span{font-size:120px;color:#fff;margin-left:10px}
.st-cap{font-size:52px;font-weight:700;margin-top:24px}
.st-cap b{color:var(--save)}
.st-sub{font-size:32px;color:rgba(255,255,255,.62);margin-top:30px;line-height:1.5}

/* deal slide — FIXED row height; short categories end early, never stretch */
.deal{display:flex;flex-direction:column}
.dl-head{margin:14px 0 30px}
.dl-ko{font-family:var(--fd);font-weight:800;font-size:60px;letter-spacing:-.02em;border-bottom:6px solid var(--save);padding-bottom:8px}
.dl-grid{display:grid;grid-auto-rows:340px;gap:24px;align-content:start}
.prod{background:var(--card);border-radius:26px;border:1px solid var(--line);
  overflow:hidden;box-shadow:0 6px 20px rgba(20,25,22,.05);height:340px}
.prod.has-img{display:grid;grid-template-columns:270px 1fr}
.prod .thumb{position:relative;background:#f7f8f4;display:flex;align-items:center;justify-content:center}
.prod .thumb img{width:100%;height:100%;object-fit:contain;padding:20px}
.stag{font-weight:800;font-size:21px;color:#fff;padding:5px 15px;border-radius:100px;display:inline-block}
.prod.has-img .stag{position:absolute;top:16px;left:16px}
.prod.has-img .stag-inline{display:none}
.s-coles .stag{background:var(--coles)}.s-woolworths .stag{background:var(--woolies)}
.pinfo{padding:32px 46px;display:flex;flex-direction:column;justify-content:center;gap:14px}
.stag-inline{align-self:flex-start}
.pname{font-family:var(--fd);font-weight:800;font-size:40px;line-height:1.16;letter-spacing:-.02em;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pricerow{display:flex;align-items:baseline;gap:16px}
.now{font-family:var(--fd);font-weight:800;color:var(--ink);letter-spacing:-.02em}
.now i{font-size:27px;font-style:normal;vertical-align:baseline}.now b{font-size:58px}
.was{font-size:30px;font-weight:600;color:#a2a89b;text-decoration:line-through}
.off{background:var(--save);color:#1c1c1c;font-weight:800;font-size:25px;padding:5px 13px;border-radius:9px}
.cmt{font-size:28px;color:var(--muted);line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* sheet */
.sheet{display:flex;flex-direction:column}
.sh-title{font-family:var(--fd);font-weight:800;font-size:74px;line-height:1.08;letter-spacing:-.03em;margin:10px 0 22px}
.sh-legend{display:flex;gap:26px;margin-bottom:18px}
.sh-legend .lg{display:flex;align-items:center;gap:10px;font-size:26px;font-weight:600;color:var(--muted)}
.sh-legend .dot{width:20px;height:20px;border-radius:50%;display:inline-block}
.dot.s-coles{background:var(--coles)}.dot.s-woolworths{background:var(--woolies)}
.sh-list{flex:1;display:flex;flex-direction:column}
.sh-row{display:grid;grid-template-columns:290px 1fr auto;align-items:center;gap:22px;
  padding:30px 4px;border-bottom:1px solid var(--line)}
.sh-cat{font-family:var(--fd);font-weight:800;font-size:34px}
.sh-item{font-size:34px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sh-price{font-family:var(--fd);font-weight:800;font-size:44px;padding:5px 18px;border-radius:10px;color:#fff}
.sh-price.s-coles{background:var(--coles)}.sh-price.s-woolworths{background:var(--woolies)}
.sh-note{font-size:30px;color:var(--muted);margin-top:30px;text-align:center}

/* cta */
.cta{display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
.ct-lead{font-family:var(--fd);font-weight:800;font-size:82px;line-height:1.12;letter-spacing:-.03em}
.ct-lead b{color:var(--coles)}
.ct-sub{font-size:38px;font-weight:700;color:var(--muted);margin-top:30px}
.ct-btn{margin-top:44px;background:var(--ink);color:#fff;font-family:var(--fd);font-weight:800;
  font-size:48px;padding:28px 60px;border-radius:100px;letter-spacing:-.01em}
.ct-save{margin-top:40px;font-size:32px;color:var(--muted)}
`;

const cards = [
  coverCard(),
  statementCard(),
  ...SLIDES.filter((s) => s.items.length).map(dealCard),
  sheetCard(),
  ctaCard(),
];

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>이번 주 콜스·울월스 세일 캐러셀</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&display=swap" rel="stylesheet">
<style>${CSS}</style></head>
<body><div class="deck">${cards.join("\n")}</div></body></html>`;

await fs.writeFile(path.join(OUT_DIR, "index.html"), html);
console.log(`카드 ${cards.length}장 → ${path.join(OUT_DIR, "index.html")}`);
console.log(`  이미지: ${USE_IMAGES ? "제품 사진 포함" : "텍스트 전용 (IP 리스크 회피)"}`);
console.log(`  반값 이상 ${HALF}개 / 전체 세일 ${TOTAL}개 (liquor 제외, 페이지 기준)`);
console.log(`  슬라이드: 표지 · 스테이트먼트 · 딜 ${SLIDES.filter((s) => s.items.length).length}(육아 선두) · 시트 · CTA`);
