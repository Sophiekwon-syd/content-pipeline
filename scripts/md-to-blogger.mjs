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

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\s+—\s+/g, ', ');

const SKIP = /^(메타 정보|썸네일 이미지 프롬프트|이미지 프롬프트|셀프 리뷰|네이버 발행 체크리스트)/;
const IMG_STYLE = 'max-width:100%;height:auto;border-radius:8px;';
const img = (f, alt) => `<div style="text-align:center;margin:24px 0"><img src="${rawUrl(f)}" alt="${esc(alt)}" style="${IMG_STYLE}"/></div>`;

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
    if (!heroPlaced && imgFiles.includes('hero.png')) { out.push(img('hero.png', title)); heroPlaced = true; }
    h2Count++;
    out.push(`<h2>${inline(h2[1].replace(/\s+—\s+/g, ', '))}</h2>`);
    const sec = `section-${h2Count}.png`;
    if (imgFiles.includes(sec)) out.push(img(sec, h2[1]));
    continue;
  }
  if (skip) {
    if (/^\s*---\s*$/.test(line)) { skip = false; continue; }
    if (!/^>/.test(line)) continue;
    skip = false; // a blockquote means real content resumed (workflow sections have none)
  }

  const h3 = line.match(/^###\s+(.+)/);
  if (h3) { closeList(); out.push(`<h3>${inline(h3[1])}</h3>`); continue; }

  if (/^\s*---\s*$/.test(line)) { closeList(); continue; }

  const bq = line.match(/^>\s?(.*)/);
  if (bq) {
    closeList();
    // merge consecutive blockquote lines
    const parts = [bq[1]];
    while (i + 1 < lines.length && /^>\s?/.test(lines[i + 1])) parts.push(lines[++i].replace(/^>\s?/, ''));
    out.push(`<blockquote style="border-left:4px solid #333;margin:24px 0;padding:12px 20px;background:#f7f7f5">${parts.filter(Boolean).map(inline).join('<br/>')}</blockquote>`);
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
    if (!listOpen) { out.push('<ul style="margin:16px 0;padding-left:24px">'); listOpen = true; }
    out.push(`<li>${inline(li[1])}</li>`);
    continue;
  }

  if (line.trim()) { closeList(); out.push(`<p>${inline(line.trim())}</p>`); }
}
closeList();

const html = out.join('\n');
const outPath = path.join(topicDir, 'blog', 'blogger.html');
await fs.writeFile(outPath, html);
console.log(title);
console.error(`wrote ${outPath} (${html.length} chars, ${h2Count} sections)`);
