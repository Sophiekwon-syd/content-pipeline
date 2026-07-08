#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://graph.facebook.com/v21.0';
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_TRIES = 36;

const REPO = process.env.GITHUB_REPOSITORY || 'Sophiekwon-syd/content-pipeline';
const REF = process.env.GITHUB_SHA || 'main';

const IG_TOKEN = process.env.IG_ACCESS_TOKEN;
const IG_USER_ID = process.env.IG_USER_ID;
if (!IG_TOKEN || !IG_USER_ID) {
  console.error('IG_ACCESS_TOKEN and IG_USER_ID env vars are required.');
  process.exit(1);
}

const dateArgIdx = process.argv.indexOf('--date');
const date = dateArgIdx >= 0 ? process.argv[dateArgIdx + 1] : new Date().toISOString().slice(0, 10);
const baseDir = path.join('outputs', date);

let slugs;
try {
  slugs = (await fs.readdir(baseDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
} catch {
  console.log(`No outputs directory for ${date} — nothing to post.`);
  process.exit(0);
}

if (slugs.length === 0) {
  console.log(`No topics found in ${baseDir} — nothing to post.`);
  process.exit(0);
}

console.log(`Found ${slugs.length} topic(s) in ${baseDir}: ${slugs.join(', ')}`);

const logPath = path.join(baseDir, 'instagram-log.json');
let posted = [];
try { posted = JSON.parse(await fs.readFile(logPath, 'utf8')); } catch {}

for (const slug of slugs) {
  if (posted.includes(slug)) {
    console.log(`[skip] ${slug} — already posted`);
    continue;
  }

  const imgDir = path.join(baseDir, slug, 'carousel', 'images');
  let files;
  try {
    files = (await fs.readdir(imgDir))
      .filter((f) => f.startsWith('card-') && f.endsWith('.png'))
      .sort();
  } catch {
    console.log(`[skip] ${slug} — no images/ directory`);
    continue;
  }

  if (files.length === 0) {
    console.log(`[skip] ${slug} — no PNGs found`);
    continue;
  }

  console.log(`Posting ${slug}: ${files.length} images`);

  const urls = files.map((f) => {
    const rel = path.join(baseDir, slug, 'carousel', 'images', f);
    return `https://raw.githubusercontent.com/${REPO}/${REF}/${rel}`;
  });

  // Step 1: Create item containers (matching aussie-umma's working pattern)
  const itemIds = [];
  for (let i = 0; i < urls.length; i++) {
    const body = new URLSearchParams({
      image_url: urls[i],
      is_carousel_item: 'true',
      access_token: IG_TOKEN,
    });
    const res = await fetch(`${API}/${IG_USER_ID}/media`, { method: 'POST', body });
    const data = await res.json();
    if (data.id) {
      itemIds.push(data.id);
      console.log(`  item ${String(i + 1).padStart(2, '0')}: container=${data.id}`);
    } else {
      console.error(`  image upload failed: ${JSON.stringify(data)}`);
    }
  }

  if (itemIds.length === 0) {
    console.error(`[fail] ${slug} — no image containers created`);
    continue;
  }

  // Step 2: Extract caption from brief.md
  let caption = '';
  try {
    const brief = await fs.readFile(path.join(baseDir, slug, 'brief.md'), 'utf8');
    const titleMatch = brief.match(/^# Topic: (.+)$/m);
    const title = titleMatch ? titleMatch[1] : slug;
    caption = `${title}\n\n호주 육아 정보 @aussie.umma\n\n#호주육아 #호주도서관 #호주엄마`;
  } catch {
    caption = `호주 육아 정보 @aussie.umma\n\n#호주육아`;
  }

  // Step 3: Create carousel container
  const carouselBody = new URLSearchParams({
    media_type: 'CAROUSEL',
    children: itemIds.join(','),
    caption,
    access_token: IG_TOKEN,
  });
  const carouselRes = await fetch(`${API}/${IG_USER_ID}/media`, { method: 'POST', body: carouselBody });
  const carousel = await carouselRes.json();
  if (!carousel.id) {
    console.error(`[fail] ${slug} — carousel container failed: ${JSON.stringify(carousel)}`);
    continue;
  }
  console.log(`  carousel: container=${carousel.id}`);

  // Step 4: Publish
  const pubBody = new URLSearchParams({ creation_id: carousel.id, access_token: IG_TOKEN });
  const pubRes = await fetch(`${API}/${IG_USER_ID}/media_publish`, { method: 'POST', body: pubBody });
  const pub = await pubRes.json();
  if (pub.id) {
    console.log(`  PUBLISHED: ${pub.id}`);
    posted.push(slug);
  } else {
    console.error(`  publish failed: ${JSON.stringify(pub)}`);
  }
}

await fs.writeFile(logPath, JSON.stringify(posted, null, 2));
console.log(`\nDone. Posted ${posted.length} topic(s).`);
