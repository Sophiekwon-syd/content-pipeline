#!/usr/bin/env node
// Convert a pipeline blog post.md into clean HTML for Google Blogger.
//
// Usage: node scripts/md-to-blogger.mjs outputs/<date>/<slug>
// Writes <topicDir>/blog/blogger.html and prints the post title to stdout.
//
// - Drops workflow-only sections (메타 정보, 이미지 프롬프트, 셀프 리뷰, 체크리스트)
// - hero.png goes below the intro; section-N.png goes after the Nth H2
// - Images hot-link to raw.githubusercontent.com (must be pushed to main)
// - No em-dashes (reads AI-generated in Korean)

import fs from 'node:fs/promises';
import path from 'node:path';

const topicDir = process.argv[2];
if (!topicDir) { console.error('usage: node scripts/md-to-blogger.mjs outputs/<date>/<slug>'); process.exit(1); }

const REPO = 'Sophiekwon-syd/content-pipeline';
const md = await fs.readFile(path.join(topicDir, 'blog', 'post.md'), 'utf8');
const imgFiles = await fs.readdir(path.join(topicDir, 'blog', 'images')).catch(() => []);
const rawUrl = (f) => `https://raw.githubusercontent.com/${REPO}/main/${topicDir}/blog/images/${f}`;
// images may be .png (Gemini-generated) or .jpg/.jpeg/.webp (own photos)
const findImg = (stem) => imgFiles.find((f) => new RegExp(`^${stem}\\.(png|jpe?g|webp)$`, 'i').test(f));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>')
  .replace(/\s+—\s+/g, ', ');

const SKIP = /^(메타 정보|썸네일 이미지 프롬프트|이미지 프롬프트|셀프 리뷰|네이버 발행 체크리스트)/;
// Photos are often 9:16 stills pulled from phone video. Left unconstrained they
// render 1100px+ tall and the post becomes a wall of image, so cap the HEIGHT
// and let width follow — portrait shots then sit as a tidy centred column.
const IMG_STYLE = 'max-width:100%;max-height:620px;width:auto;height:auto;'
  + 'border-radius:10px;display:block;margin:0 auto;';
const img = (f, alt) => `<div style="text-align:center;margin:32px 0"><img src="${rawUrl(f)}" alt="${esc(alt)}" style="${IMG_STYLE}"/></div>`;

// The Blogger theme centres and italicises blockquotes and flattens headings,
// so every rule below has to be forced inline or the theme wins.
const H2_STYLE = 'font-size:1.5em;font-weight:700;line-height:1.4;margin:52px 0 18px;'
  + 'padding-bottom:12px;border-bottom:2px solid #e5e5e2;letter-spacing:-0.01em;';
const H3_STYLE = 'font-size:1.15em;font-weight:700;line-height:1.5;margin:34px 0 12px;';
const P_STYLE = 'line-height:1.85;margin:0 0 14px;';
const BQ_STYLE = 'border-left:4px solid #2b2b2b;margin:32px 0;padding:20px 24px;'
  + 'background:#f6f6f4;border-radius:0 8px 8px 0;'
  + 'text-align:left !important;font-style:normal !important;line-height:1.85;';

const lines = md.split('\n');
let title = '';
const out = [];
let skip = false;
let h2Count = 0;
let heroPlaced = false;
let listOpen = false;
const closeList = () => { if (listOpen) { out.push('</ul>'); listOpen = false; } };

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const h1 = line.match(/^#\s+(.+)/);
  if (h1 && !title) { title = h1[1].replace(/\s+—\s+/g, ', ').trim(); continue; }

  const h2 = line.match(/^##\s+(.+)/);
  if (h2) {
    closeList();
    skip = SKIP.test(h2[1].trim());
    if (skip) continue;
    // hero goes right before the first content section
    const hero = findImg('hero');
    if (!heroPlaced && hero) { out.push(img(hero, title)); heroPlaced = true; }
    h2Count++;
    out.push(`<h2 style="${H2_STYLE}">${inline(h2[1].replace(/\s+—\s+/g, ', '))}</h2>`);
    const sec = findImg(`section-${h2Count}`);
    if (sec) out.push(img(sec, h2[1]));
    continue;
  }
  if (skip) {
    if (/^\s*---\s*$/.test(line)) { skip = false; continue; }
    if (!/^>/.test(line)) continue;
    skip = false; // a blockquote means real content resumed (workflow sections have none)
  }

  const h3 = line.match(/^###\s+(.+)/);
  if (h3) { closeList(); out.push(`<h3 style="${H3_STYLE}">${inline(h3[1])}</h3>`); continue; }

  if (/^\s*---\s*$/.test(line)) { closeList(); continue; }

  const bq = line.match(/^>\s?(.*)/);
  if (bq) {
    closeList();
    // merge consecutive blockquote lines
    const parts = [bq[1]];
    while (i + 1 < lines.length && /^>\s?/.test(lines[i + 1])) parts.push(lines[++i].replace(/^>\s?/, ''));
    // a markdown table inside a blockquote (e.g. a titled comparison table in
    // a callout) must become a real <table> — pipe-text divs render broken.
    const tableRow = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const sepIdx = parts.findIndex((p, k) => /^\|/.test(p) && /^\|?[\s:|-]+\|[\s:|-]*$/.test(parts[k + 1] || ''));
    if (sepIdx !== -1) {
      const lead = parts.slice(0, sepIdx);
      const header = tableRow(parts[sepIdx]);
      const rows = parts.slice(sepIdx + 2).filter((p) => /^\|/.test(p)).map(tableRow);
      const td = 'border:1px solid #ddd;padding:8px 12px;';
      const tableHtml = `<table style="border-collapse:collapse;margin:12px 0 0;width:100%"><thead><tr>${header.map((h) => `<th style="${td}background:#f2f2f0;text-align:left">${inline(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td style="${td}">${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      out.push(`<blockquote style="${BQ_STYLE}">${lead.filter(Boolean).map(inline).map((x) => `<div style="margin:0 0 6px">${x}</div>`).join('')}${tableHtml}</blockquote>`);
      continue;
    }
    out.push(`<blockquote style="${BQ_STYLE}">${parts.filter(Boolean).map(inline).map((x) => `<div style="margin:0 0 6px">${x}</div>`).join('')}</blockquote>`);
    continue;
  }

  // markdown table
  if (/^\s*\|/.test(line) && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1] || '')) {
    closeList();
    const row = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const header = row(line);
    const rows = [];
    i++; // skip separator
    while (i + 1 < lines.length && /^\s*\|/.test(lines[i + 1])) rows.push(row(lines[++i]));
    const td = 'border:1px solid #ddd;padding:8px 12px;';
    out.push(`<table style="border-collapse:collapse;margin:24px 0;width:100%"><thead><tr>${header.map((h) => `<th style="${td}background:#f2f2f0;text-align:left">${inline(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td style="${td}">${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    continue;
  }

  const li = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.+)/);
  if (li) {
    if (!listOpen) { out.push('<ul style="margin:18px 0;padding-left:26px;line-height:1.85">'); listOpen = true; }
    out.push(`<li style="margin:0 0 8px">${inline(li[1])}</li>`);
    continue;
  }

  if (line.trim()) { closeList(); out.push(`<p style="${P_STYLE}">${inline(line.trim())}</p>`); }
}
closeList();

const html = out.join('\n');
const outPath = path.join(topicDir, 'blog', 'blogger.html');
await fs.writeFile(outPath, html);
console.log(title);
console.error(`wrote ${outPath} (${html.length} chars, ${h2Count} sections)`);
