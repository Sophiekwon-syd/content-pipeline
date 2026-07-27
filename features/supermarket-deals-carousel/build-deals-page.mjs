#!/usr/bin/env node
// Build weekly-deals.html — self-contained viewable catalog.
import fs from "node:fs/promises";
import path from "node:path";
const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : d;
};
const DIR = path.resolve("features/supermarket-deals-carousel");
const SAMPLE = process.argv.includes("--sample");
const SAMPLE_KEYS = ["frozen", "snacks", "baby"];
const OUT = arg(
  "--out",
  path.join(DIR, SAMPLE ? "sample-deals.html" : "weekly-deals.html"),
);
const combined = JSON.parse(
  await fs.readFile(path.join(DIR, "data", "combined-latest.json"), "utf8"),
);
const CATS = JSON.parse(
  await fs.readFile(path.join(DIR, "categories.json"), "utf8"),
);

// Filter liquor & unbucketed stationery
const DROP = (it) =>
  /^Liquor$/i.test(it.category || "") ||
  (/^Stationery & Media$/i.test(it.category || "") && !it.bucket);
combined.items = combined.items.filter((it) => !DROP(it));

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const escA = (s) => esc(s).replace(/"/g, "&quot;");
const money = (n) => {
  const [d, c] = Number(n).toFixed(2).split(".");
  return { d, c };
};
const showUnit = (u) =>
  /[\/\s]\d|100\s?g|100\s?ml|per\s|\bkg\b|\bl\b/i.test(u || "") ? u : "";

// Group into buckets
const groups = {};
CATS.buckets.forEach((b) => (groups[b.key] = { coles: [], woolworths: [] }));
const noBucket = [];
for (const it of combined.items) {
  if (it.bucket && groups[it.bucket])
    groups[it.bucket][it.store === "coles" ? "coles" : "woolworths"].push(it);
  else noBucket.push(it);
}

const rank = (a, b) => {
  const sa = a.was != null ? a.was - a.price : -1,
    sb = b.was != null ? b.was - b.price : -1;
  if (sa >= 0 !== sb >= 0) return sb >= 0 ? 1 : -1;
  if (sa >= 0 && sb >= 0 && sa !== sb) return sb - sa;
  return a.price - b.price;
};

// Family grouping
const FILLER =
  /^(new|woolworths|coles|australian|fresh|organic|finest|by|the|natural|premium|free|range|no|added|hormones|made|easy|simply|value|pure)$/;
function familyKey(name) {
  const o = [];
  for (const raw of String(name || "").split(/\s+/)) {
    const w = raw.toLowerCase().replace(/[^a-z0-9'&]/g, "");
    if (!w) continue;
    if (o.length === 0 && FILLER.test(w)) continue;
    if (/^\d/.test(w) || /^(size|x\d+|\d+(g|kg|ml|l|pk|pack))$/.test(w)) break;
    o.push(w);
    if (o.length >= 2) break;
  }
  return o.join("") || String(name || "").toLowerCase();
}
const saving = (it) => (it.was != null ? it.was - it.price : -1);
const groupKey = (it) =>
  it.familyId ? "id:" + it.familyId : familyKey(it.name);
function familyGroup(items) {
  const m = new Map();
  for (const it of items) {
    const k = groupKey(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  const arr = [...m.values()];
  arr.forEach((g) => g.sort(rank));
  arr.sort((a, b) => Math.max(...b.map(saving)) - Math.max(...a.map(saving)));
  return arr.flat();
}
Object.keys(groups).forEach((k) => {
  groups[k].coles = familyGroup(groups[k].coles);
  groups[k].woolworths = familyGroup(groups[k].woolworths);
});
noBucket.sort((a, b) => (b.was ?? b.price) - (a.was ?? a.price));

const stats = {
  total: combined.items.length,
  twoSided: CATS.buckets.filter(
    (b) => groups[b.key].coles.length && groups[b.key].woolworths.length,
  ).length,
  buckets: CATS.buckets.length,
  half: combined.items.filter((i) => i.halfPrice).length,
  maxSave: Math.max(
    0,
    ...combined.items.filter((i) => i.was != null).map((i) => i.was - i.price),
  ),
};
const VIS = 6,
  VIS_NB = 8;
const badge = (it) =>
  it.newVariety
    ? '<span class="bdg bdg-new">NEW</span>'
    : it.halfPrice
      ? '<span class="bdg bdg-half">1/2</span>'
      : it.pctOff
        ? `<span class="bdg bdg-off">${it.pctOff}<small>%</small></span>`
        : "";

/* Card templates */
function cardHTML(it, idx) {
  const { d, c } = money(it.price),
    u = showUnit(it.unit);
  const sp = it.save ? `<span class="save">${esc(it.save)}</span>` : "";
  const wa =
    it.was != null
      ? `<span class="was">$${Number(it.was).toFixed(2)}</span>`
      : "";
  const ex = idx >= VIS ? " xtra" : "";
  return `<article class="card s-${it.store}${ex}" style="--st:${Math.min(idx, 15) * 40}ms">
    <div class="thumb"><span class="stag s-${it.store}">${it.store === "coles" ? "Coles" : "Woolworths"}</span>${badge(it)}<img src="${escA(it.img)}" alt="${escA(it.name)}" loading="lazy"></div>
    <div class="body">
      <h3 class="nm">${esc(it.name)}</h3>
      <div class="pricerow"><span class="now"><b>$${d}</b><i>.${c}</i></span>${wa}${sp}</div>
      ${u ? `<div class="unit">${esc(u)}</div>` : ""}
    </div>
  </article>`;
}
function mergedCard(fam, idx) {
  const rep = fam[0],
    { d, c } = money(rep.price),
    u = showUnit(rep.unit);
  const wa =
    rep.was != null
      ? `<span class="was">$${Number(rep.was).toFixed(2)}</span>`
      : "";
  const sp = rep.save ? `<span class="save">${esc(rep.save)}</span>` : "";
  const names = fam.map((x) => x.name);
  const pre = commonPrefix(names)
    .replace(/[^\s]*$/, "")
    .trim();
  const label = (pre.split(/\s+/).length >= 2 ? pre : rep.name)
    .replace(/\s+(size|pack|pk)$/i, "")
    .trim();
  const tails = fam.map((x) => variantTail(x.name, pre));
  const ct = tails.filter(
    (t) => /[a-z]/i.test(t) && t.replace(/[^a-z]/gi, "").length >= 2,
  );
  const va =
    pre.split(/\s+/).length >= 2 && ct.length === fam.length
      ? ct.slice(0, 6).join(" · ")
      : "";
  const ex = idx >= VIS ? " xtra" : "";
  return `<article class="card s-${rep.store}${ex}" style="--st:${Math.min(idx, 15) * 40}ms">
    <div class="thumb"><span class="stag s-${rep.store}">${rep.store === "coles" ? "Coles" : "Woolworths"}</span>${badge(rep)}<img src="${escA(rep.img)}" alt="${escA(label)}" loading="lazy"></div>
    <div class="body">
      <h3 class="nm">${esc(label)} <span class="vtag">${fam.length}종</span></h3>
      ${va ? `<div class="variants">${esc(va)}</div>` : ""}
      <div class="pricerow"><span class="now"><b>$${d}</b><i>.${c}</i></span>${wa}${sp}</div>
      ${u ? `<div class="unit">${esc(u)}</div>` : ""}
    </div>
  </article>`;
}
const commonPrefix = (arr) => {
  if (!arr.length) return "";
  let p = arr[0];
  for (const s of arr) {
    let i = 0;
    while (
      i < p.length &&
      i < s.length &&
      p[i].toLowerCase() === s[i].toLowerCase()
    )
      i++;
    p = p.slice(0, i);
  }
  return p;
};
const variantTail = (name, pre) => {
  let t =
    pre && name.toLowerCase().startsWith(pre.toLowerCase())
      ? name.slice(pre.length)
      : name;
  t = t
    .replace(/\(.*?\)/g, " ")
    .replace(/\b\d[\d.\-]*\s?(g|kg|ml|l|litre|pk|pack|pieces?|each)\b/gi, " ")
    .replace(/\b(chocolate\s+)?(block|tub|bars?)\b/gi, " ")
    .replace(/[,\-–|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.split(/\s+/).slice(0, 3).join(" ");
};

/* Column builder — unique ID per column via seq counter */
let colSeq = 0;
function buildColumn(store, label, items) {
  const rendered = [],
    ri = 0;
  const fams = [...items]; // already family-grouped
  for (let i = 0; i < fams.length; i++) {
    const fam = fams[i];
    const flat =
      fam.length > 1 &&
      fam.every((x) => x.price === fam[0].price && x.was === fam[0].was);
    if (flat) rendered.push(mergedCard(fam, i));
    else rendered.push(cardHTML(fam, i));
  }
  const needMore = rendered.length > VIS;
  const uid = "col-" + store + "-" + colSeq++; // e.g. "col-coles-0", "col-woolworths-1" — unique
  const cnt = items.length;
  const stkId = "s-" + uid; // prepend "s-" to avoid potential conflicts
  return `<div class="col col-${store}">
    <div class="colhead"><span class="dot"></span><span class="cname">${label}</span><span class="ccnt">${cnt}</span></div>
    <div class="stack" id="${stkId}">${rendered.length ? rendered.join("") : '<p class="empty">이번 주 해당 카테고리 세일 없음</p>'}</div>
    ${needMore ? `<button class="more" type="button" data-stk="${stkId}" data-orig="${cnt}">전체 보기 · ${cnt}개</button>` : ""}
  </div>`;
}

function pickBanner(item) {
  const { d, c } = money(item.price),
    u = showUnit(item.unit);
  return `<div class="pick s-${item.store}">
    <span class="pick-tag">이번 주 최고 할인 · TOP SAVE</span>
    <span class="pick-thumb"><img src="${escA(item.img)}" alt="${escA(item.name)}" loading="lazy"></span>
    <span class="pick-body"><span class="pick-nm">${esc(item.name)}</span>
      <span class="pick-price"><span class="now"><b>$${d}</b><i>.${c}</i></span><span class="was">$${Number(item.was).toFixed(2)}</span><span class="save">${esc(item.save)}</span></span>
      ${u ? `<span class="unit">${esc(u)}</span>` : ""}</span>
    <span class="pick-store">${item.store === "coles" ? "Coles" : "Woolworths"}</span>
  </div>`;
}

function section(bucket, idx) {
  const g = groups[bucket.key],
    num = String(idx + 1).padStart(2, "0");
  const scored = [...g.coles, ...g.woolworths].filter((x) => x.was != null);
  scored.sort((a, b) => b.was - b.price - (a.was - a.price));
  const top = scored.length ? pickBanner(scored[0]) : "";
  const cols = [
    buildColumn("coles", "Coles", g.coles),
    buildColumn("woolworths", "Woolworths", g.woolworths),
  ];
  return `<section class="bucket reveal" id="${bucket.key}">
    <header class="bk-hd">
      <span class="bk-idx">${num}</span>
      <div class="bk-titles"><span class="bk-ko">${esc(bucket.ko)}</span><span class="bk-en">${bucket.key.replace(/_/g, " ")}</span></div>
      <span class="bk-chip"><i class="c">C ${g.coles.length}</i><i class="w">W ${g.woolworths.length}</i></span>
    </header>
    ${top}
    <div class="cols">${cols.map((c) => c).join("")}</div>
  </section>`;
}

function otherSection() {
  if (!noBucket.length) return "";
  const cards = noBucket
    .map((it, i) => {
      const { d, c } = money(it.price),
        u = showUnit(it.unit);
      const sp = it.save ? `<span class="save">${esc(it.save)}</span>` : "";
      const wa =
        it.was != null
          ? `<span class="was">$${Number(it.was).toFixed(2)}</span>`
          : "";
      const ex = i >= VIS_NB ? " xtra" : "";
      return `<article class="card s-${it.store}${ex}" style="--st:${Math.min(i, 15) * 30}ms">
      <div class="thumb"><span class="stag s-${it.store}">${it.store === "coles" ? "Coles" : "Woolworths"}</span>${badge(it)}<img src="${escA(it.img)}" alt="${escA(it.name)}" loading="lazy"></div>
      <div class="body"><h3 class="nm">${esc(it.name)}</h3>
        <div class="pricerow"><span class="now"><b>$${d}</b><i>.${c}</i></span>${wa}${sp}</div>
        ${u ? `<div class="unit">${esc(u)}</div>` : ""}</div></article>`;
    })
    .join("");
  return `<section class="bucket reveal" id="other-section">
    <header class="bk-hd">
      <span class="bk-idx">·</span>
      <div class="bk-titles"><span class="bk-ko">카테고리 미지정</span><span class="bk-en">Flyer extras</span></div>
      <span class="bk-chip"><i class="c">C ${noBucket.length}</i></span>
    </header>
    <div class="grid-stack" id="stk-other-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:13px;">${cards}</div>
    ${noBucket.length > VIS_NB ? `<button class="more" type="button" data-stk="stk-other-grid" data-orig="${noBucket.length}">전체 보기 · ${noBucket.length}개</button>` : ""}
  </section>`;
}

const navItems =
  CATS.buckets
    .map(
      (b) =>
        `<a href="#${b.key}" data-nav="${b.key}">${esc(b.ko)}<em>${groups[b.key].coles.length + groups[b.key].woolworths.length}</em></a>`,
    )
    .join("") +
  (!noBucket.length
    ? `<a href="#other-section" data-nav="other-section">기타<em>${noBucket.length}</em></a>`
    : "");

const statsHTML = `<div class="stat"><div class="n" data-count="${stats.total}">0</div><div class="l">이번 주 전체 딜</div></div>
  <div class="stat"><div class="n" data-count="${stats.twoSided}">0</div><div class="l">두 매장 공통 카테고리</div></div>
  <div class="stat"><div class="n" data-count="${stats.half}">0</div><div class="l">반값 (1/2 Price)</div></div>
  <div class="stat s-coles"><div class="n"><small>$</small><span data-count="${stats.maxSave.toFixed(1)}" data-dec="1">0</span></div><div class="l">최대 절약액</div></div>`;

const topSaves = combined.items
  .filter((x) => x.was != null)
  .sort((a, z) => z.was - z.price - (a.was - a.price))
  .slice(0, 18);
const tickerChips = topSaves
  .map((it) => {
    const { d, c } = money(it.price);
    return `<span class="tk s-${it.store}"><span class="dot"></span><span class="nm">${esc(it.name)}</span><s>$${Number(it.was).toFixed(2)}</s><span class="now"><b>$${d}</b><i>.${c}</i></span><span class="sv">${esc(it.save)}</span></span>`;
  })
  .join("");

const css = `
:root{--coles:#E01A22;--woolies:#178841;--ink:#16191d;--muted:#6b7278;--line:#e3e7e0;--paper:#ecefe9;--card:#fff;--save:#ffd200;--new:#e0348b;
  --fd:"Bricolage Grotesque","Pretendard","Noto Sans KR",system-ui,sans-serif;
  --fb:"Pretendard","Noto Sans KR",system-ui,-apple-system,"Segoe UI",sans-serif;}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:74px}
body{font-family:var(--fb);color:var(--ink);background:var(--paper);background-image:radial-gradient(rgba(20,25,22,.035) 1px,transparent 1.4px);background-size:24px 24px;-webkit-font-smoothing:antialiased;line-height:1.4}
.wrap{max-width:1240px;margin:0 auto;padding:0 22px}

#progress-bar{position:fixed;top:0;left:0;height:3px;z-index:999;background:linear-gradient(90deg,var(--coles),#d9a800 45%,var(--woolies));transform-origin:left;transform:scaleX(0);will-change:transform}

.ticker{position:relative;overflow:hidden;background:#15181c;color:#fff;border-bottom:1px solid rgba(255,255,255,.06);height:44px;display:flex;align-items:center}
.ticker-track{display:inline-flex;white-space:nowrap;animation:tMove 45s linear infinite}
.ticker:hover .ticker-track{animation-play-state:paused}
@keyframes tMove{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.tk{display:inline-flex;align-items:center;gap:7px;padding:0 20px;font-size:12px;font-weight:600;border-right:1px solid rgba(255,255,255,.08);flex-shrink:0}
.tk .dot{width:7px;height:7px;border-radius:50%;flex:0 0 auto}
.tk.s-coles .dot{background:var(--coles)}.tk.s-woolworths .dot{background:var(--woolies)}
.tk .nm{max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tk s{color:rgba(255,255,255,.35);font-weight:500}.tk .now{color:#fff;font-family:var(--fd);font-weight:800}.tk .now b{font-size:13px}
.tk .now i{font-size:10px;vertical-align:baseline}
.tk .sv{background:var(--save);color:#15181c;font-weight:900;border-radius:5px;padding:1px 6px;font-size:10.5px}

.mast{padding:42px 0 28px;border-bottom:1px solid var(--line)}
.topbar{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:28px}
.handle{color:var(--ink)}.tag{display:inline-flex;align-items:center;gap:6px;background:var(--ink);color:#fff;padding:5px 11px;border-radius:100px;font-size:11px}
.tag-dot{width:6px;height:6px;border-radius:50%;background:var(--save);animation:pulse 1.6s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.6)}}
.overline{font-family:var(--fd);font-weight:700;font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.ov-x{color:var(--coles)}.ov-o{color:var(--woolies)}
.mast h1{font-family:var(--fd);font-weight:800;font-size:clamp(36px,7vw,78px);line-height:.92;letter-spacing:-.03em}
.stamp{display:inline-flex;align-items:center;gap:8px;margin-top:16px;background:#fff;border:2px solid var(--ink);border-radius:12px;padding:8px 14px;font-family:var(--fd);font-weight:800;font-size:16px;box-shadow:4px 4px 0 var(--ink)}
.stamp svg{width:18px;height:18px}
.mast-sub{margin-top:14px;color:#3a4046;font-size:15px;max-width:600px}
.stats{display:flex;flex-wrap:wrap;gap:12px;margin-top:22px}
.stat{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 18px;min-width:120px;box-shadow:0 1px 0 rgba(20,25,22,.03);transition:transform .2s,box-shadow .2s}
.stat:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(20,25,22,.07)}
.stat .n{font-family:var(--fd);font-weight:800;font-size:34px;line-height:1;letter-spacing:-.02em}
.stat .n small{font-size:16px;font-weight:700;color:var(--muted)}
.stat .l{margin-top:5px;font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.03em}

.nav{position:sticky;top:3px;z-index:50;background:rgba(236,239,233,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.nav-inner{display:flex;gap:8px;overflow-x:auto;padding:10px 22px;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,#000 95%,transparent)}
.nav-inner::-webkit-scrollbar{display:none}
.nav-inner a{text-decoration:none;color:var(--ink);font-weight:800;font-size:13px;padding:7px 12px;border:1.5px solid var(--line);border-radius:100px;background:#fff;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;transition:all .15s;flex-shrink:0}
.nav-inner a em{font-style:normal;font-size:11px;font-weight:700;color:var(--muted);background:var(--paper);border-radius:100px;padding:1px 6px}
.nav-inner a:hover{border-color:#c3cabf;transform:translateY(-1px)}
.nav-inner a.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.nav-inner a.active em{background:rgba(255,255,255,.15);color:#fff}

main{padding:12px 0 40px}
.bucket{padding:36px 0 32px;border-bottom:1px dashed var(--line)}
.bucket:first-of-type{border-top:none}
.bk-hd{display:flex;align-items:center;gap:20px;margin-bottom:20px}
.bk-idx{font-family:var(--fd);font-weight:800;font-size:clamp(36px,5vw,60px);line-height:.8;color:transparent;-webkit-text-stroke:1.5px rgba(20,25,22,.18)}
.bk-titles{min-width:0}.bk-ko{font-family:var(--fd);font-weight:800;font-size:clamp(26px,4vw,44px);line-height:.95;display:block}
.bk-en{display:block;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-top:4px}
.bk-chip{display:inline-flex;gap:5px;flex:0 0 auto;margin-left:auto}
.bk-chip i{font-style:normal;font-weight:700;font-size:12px;padding:4px 9px;border-radius:100px}
.bk-chip i.c{background:rgba(224,26,34,.08);color:var(--coles)}.bk-chip i.w{background:rgba(23,136,65,.08);color:var(--woolies)}

.cols{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.colhead{display:flex;align-items:center;gap:8px;margin-bottom:14px;font-family:var(--fd);font-weight:800;font-size:22px;letter-spacing:-.01em;padding-bottom:10px;border-bottom:3px solid var(--line)}
.col-coles .colhead{border-bottom-color:var(--coles)}.col-woolworths .colhead{border-bottom-color:var(--woolies)}
.colhead .dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto}
.col-coles .colhead .dot{background:var(--coles)}.col-woolworths .colhead .dot{background:var(--woolies)}
.colhead .ccnt{margin-left:auto;font-size:12px;font-weight:700;color:var(--muted);background:var(--paper);border-radius:100px;padding:3px 10px}

.stack{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;align-content:start}

.card{display:flex;flex-direction:column;gap:0;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--card);box-shadow:0 1px 3px rgba(20,25,22,.04);transition:transform .2s cubic-bezier(.2,.7,.3,1),box-shadow .2s}
.card:hover{transform:translateY(-3px);box-shadow:0 14px 28px rgba(20,25,22,.12)}
.thumb{position:relative;width:100%;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 38%,#fff,#eef1ea);border-bottom:1px solid var(--line)}
.thumb img{width:80%;height:80%;object-fit:contain;transition:transform .35s}
.card:hover .thumb img{transform:scale(1.08) rotate(-1deg)}
.stag{position:absolute;top:6px;left:6px;z-index:2;color:#fff;font-weight:800;font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:100px;box-shadow:0 1px 4px rgba(0,0,0,.15)}
.stag.s-coles{background:var(--coles)}.stag.s-woolworths{background:var(--woolies)}
.bdg{position:absolute;top:6px;right:6px;z-index:2;font-family:var(--fd);font-weight:800;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.bdg-half{width:44px;height:44px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:14px;background:#15181c;color:var(--save);clip-path:polygon(50% 0,61% 12%,77% 6%,76% 23%,93% 24%,84% 39%,100% 50%,84% 61%,93% 76%,76% 77%,77% 94%,61% 88%,50% 100%,39% 88%,23% 94%,24% 77%,7% 76%,16% 61%,0 50%,16% 39%,7% 24%,24% 23%,23% 6%,39% 12%);transition:transform .3s}.card:hover .bdg-half{transform:rotate(15deg)}
.bdg-off{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#15181c;font-size:13px}.bdg-off small{font-size:8px;display:block;margin-top:1px}
.bdg-new{background:var(--new);font-size:10px;padding:4px 8px;border-radius:100px;letter-spacing:.06em}
.body{padding:10px 11px 12px;display:flex;flex-direction:column;gap:3px;height:124px;justify-content:space-between}
.nm{font-size:13px;font-weight:700;line-height:1.28;min-height:2.56em;padding: 10px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all;text-align:center}
.vtag{display:inline-block;font-size:10px;font-weight:700;color:var(--muted);background:var(--paper);border:1px solid var(--line);border-radius:100px;padding:0 5px;vertical-align:middle;margin-left:2px}
.variants{font-size:10.5px;color:var(--muted);font-weight:600;text-align:center;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all}
.pricerow{display:flex;align-items:baseline;gap:7px;justify-content:center;flex-wrap:wrap}
.now{font-family:var(--fd);font-weight:800;color:var(--ink);letter-spacing:-.02em}
.now b{font-size:24px}.now i{font-size:13px;vertical-align:super;font-style:normal}
.was{font-size:12px;font-weight:600;color:#9aa094;text-decoration:line-through}
.save{background:var(--save);color:#1c1c1c;font-weight:800;font-size:11px;padding:2px 6px;border-radius:5px}
.unit{font-size:11px;color:var(--muted);text-align:center;font-weight:500}
.empty{color:var(--muted);font-size:13px;padding:16px 4px;text-align:center}

/* HIDDEN CARDS FIX: shown when stack gets .expanded class */
.card.xtra{display:none}
.stack.expanded > .card.xtra{display:flex;animation:cardIn .35s ease both}
@keyframes cardIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

/* More button */
.more{display:block;width:fit-content;margin:14px auto 0;border:1.5px dashed var(--line);background:transparent;border-radius:100px;padding:9px 22px;font-family:var(--fb);font-weight:800;font-size:12px;color:var(--ink);cursor:pointer;transition:all .15s}
.more:hover{border-color:var(--ink);background:var(--ink);color:#fff}
/* Expanded: solid dark pill */
.stack.expanded ~ .more{border-style:solid;background:var(--ink);color:#fff;border-color:var(--ink)}
.stack.expanded ~ .more:hover{background:#000;border-color:#000}

.pick{display:flex;align-items:center;gap:14px;margin:0 0 22px;padding:14px 16px;border-radius:18px;background:#fff;border:1px solid var(--line);position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s}
.pick::before{content:"";position:absolute;inset:0;background:var(--ac);opacity:.04}
.pick.s-coles{--ac:var(--coles)}.pick.s-woolworths{--ac:var(--woolies)}
.pick:hover{transform:translateY(-2px);box-shadow:0 12px 24px rgba(20,25,22,.1)}
.pick-tag{flex:0 0 auto;align-self:flex-start;background:var(--ac);color:#fff;font-family:var(--fd);font-weight:800;font-size:10px;letter-spacing:.04em;padding:5px 11px;border-radius:100px}
.pick-thumb{flex:0 0 60px;height:60px;border-radius:11px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px var(--line)}
.pick-thumb img{width:82%;height:82%;object-fit:contain}
.pick-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.pick-nm{font-weight:800;font-size:14px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pick-price{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.pick-price .now b{font-size:28px}
.pick-store{flex:0 0 auto;font-family:var(--fd);font-weight:800;font-size:15px;color:var(--ac)}

footer{padding:32px 0 44px;border-top:1px solid var(--line);text-align:center}
.foot-cta{display:inline-flex;align-items:center;gap:8px;background:var(--ink);color:#fff;font-family:var(--fd);font-weight:800;font-size:17px;padding:12px 24px;border-radius:100px;text-decoration:none;transition:all .2s}
.foot-cta:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(20,25,22,.2)}
.disc{margin-top:14px;color:var(--muted);font-size:12px;max-width:620px;margin-left:auto;margin-right:auto;line-height:1.6}
.foot-brand{margin-top:12px;font-weight:700;letter-spacing:.08em;font-size:11px;color:var(--muted)}

.reveal{opacity:0;transform:translateY(16px);transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.3,1)}
.reveal.in{opacity:1;transform:none}
.card{opacity:0;animation:cardFade .45s forwards;animation-delay:var(--st,0ms)}
@keyframes cardFade{to{opacity:1}}

@media(max-width:760px){.wrap{padding:0 14px}.cols{grid-template-columns:1fr;gap:26px}.stack{grid-template-columns:repeat(2,1fr);gap:9px}.body{height:110px;padding:8px 9px 10px;gap:2px}.nm{font-size:12px}.now b{font-size:20px}.now i{font-size:12px}.mast h1{font-size:clamp(30px,8vw,56px)}.stat{flex:1 1 42%}.bucket{padding:26px 0}.bk-hd{flex-wrap:wrap}.bk-chip{margin-left:0;margin-top:4px}.pick{flex-wrap:wrap}.pick-store{display:none}}
@media(max-width:400px){.stack{grid-template-columns:1fr}.body{height:104px}}
`;

const js = `
(function(){var obs=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');obs.unobserve(e.target)}})},{threshold:.08});document.querySelectorAll('.reveal').forEach(function(el){obs.observe(el)})})();

(function(){var bar=document.getElementById('progress-bar');function u(){if(!bar)return;var h=document.documentElement,p=h.scrollTop/(h.scrollHeight-h.clientHeight||1);bar.style.transform='scaleX('+Math.min(100,p*100).toFixed(1)+'%)'}window.addEventListener('scroll',u,{passive:true});window.addEventListener('resize',u,{passive:true});u()})();

(function(){var lks=Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));var secs=lks.map(function(l){return document.getElementById(l.getAttribute('data-nav'))}).filter(Boolean);var spy=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){lks.forEach(function(l){l.classList.toggle('active',l.getAttribute('data-nav')===e.target.id)})}})},{rootMargin:'-40% 0px -50% 0px'});secs.forEach(function(s){spy.observe(s)})})();

(function(){var els=Array.prototype.slice.call(document.querySelectorAll('[data-count]'));els.forEach(function(el){var end=parseFloat(el.getAttribute('data-count')),dec=el.hasAttribute('data-dec')?1:0,start=null;function step(ts){if(!start)start=ts;var p=Math.min((ts-start)/800,1),v=end*(1-Math.pow(1-p,3));el.childNodes[0]?el.childNodes[0].textContent=v.toFixed(dec):el.textContent=v.toFixed(dec);if(p<1)requestAnimationFrame(step)}requestAnimationFrame(step)})})();

(function(){
  var btns=Array.prototype.slice.call(document.querySelectorAll('[data-stk]'));
  btns.forEach(function(btn){
    btn.addEventListener('click',function(){
      var stk=document.getElementById(btn.getAttribute('data-stk'));
      if(!stk)return;
      var on=stk.classList.contains('expanded');
      if(on){
        stk.classList.remove('expanded');
        btn.textContent='전체 보기 · '+btn.getAttribute('data-orig')+'개';
      }else{
        stk.classList.add('expanded');
        btn.textContent='접기';
      }
    });
  });
})();
`;

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>이번 주 세일 품목 — Coles × Woolworths | ${esc(combined.range)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Noto+Sans+KR:wght@400;500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/pretendard.min.css">
<style>${css}</style>
</head>
<body>
<div id="progress-bar"></div>
<div class="ticker" aria-label="Biggest saves this week">
  <div class="ticker-track">${tickerChips}${tickerChips}</div>
</div>
<header class="mast">
  <div class="wrap">
    <div class="topbar"><span class="handle">@aussie.umma</span><span class="tag"><span class="tag-dot"></span>WEEKLY UPDATE</span></div>
    <div class="overline">THIS WEEK&nbsp;&nbsp;<span class="ov-x">COLES</span> × <span class="ov-o">WOOLWORTHS</span></div>
    <h1>이번 주<br>세일 품목</h1>
    <div class="stamp"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>${esc(combined.range)}</div>
    <p class="mast-sub">콜스·울월스 이번 주 카탈로그 할인 품목을 카테고리별로, 두 매장을 나란히 정리했어요. 가격은 발행일 기준이며 매장·지역별로 다를 수 있어요.</p>
    <div class="stats">${statsHTML}</div>
  </div>
</header>
<nav class="nav"><div class="nav-inner">${navItems}</div></nav>
<main class="wrap">
${CATS.buckets.map(section).join("\n\n")}
${!SAMPLE ? otherSection() : ""}
</main>
<footer>
  <a class="foot-cta" href="#">저장하기 →</a>
  <p class="disc">가격은 ${esc(combined.range)} Coles·Woolworths 온라인 카탈로그 기준이며, 매장·지역·재고에 따라 다를 수 있어요. 발행 전 실제 매장에서 다시 확인하세요. 본 페이지는 정보 제공 목적이며 각 상표는 해당 소유자의 자산입니다.</p>
  <p class="foot-brand">AUSSIE UMMA · 데이터 갱신 ${esc((combined.scraped_at || "").slice(0, 10))}</p>
</footer>
<script>${js}</script>
</body>
</html>`;

await fs.writeFile(OUT, html);
console.log(`✓ wrote ${OUT}`);
console.log(
  `${stats.total} deals | ${stats.buckets} buckets (${stats.twoSided} two-sided) | ${stats.half} half-price | max $${stats.maxSave.toFixed(1)}`,
);
