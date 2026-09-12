#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const API_BASE = 'https://graph.threads.net/v1.0';
const TIME_ZONE = 'Australia/Sydney';

function parseArgs(argv) {
  const options = { root: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (['--date', '--slug', '--root'].includes(arg)) options[arg.slice(2)] = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.date || !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) throw new Error('--date YYYY-MM-DD is required');
  if (!options.slug) throw new Error('--slug is required');
  return options;
}

function localDate(timestamp) {
  if (!timestamp) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return '';
  }
}

function redact(value, secret) {
  return String(value).split(secret).join('[REDACTED]');
}

export function filterThreads(posts, { date, artifactTexts }) {
  const exactTexts = new Set(artifactTexts);
  return posts
    .filter((post) => exactTexts.has(post.text) || localDate(post.timestamp) === date)
    .map(({ id, text, timestamp, permalink }) => ({ id, text, timestamp, permalink }));
}

export async function inspectThreads({ date, artifactTexts, accessToken, fetchImpl = globalThis.fetch, apiBase = API_BASE }) {
  if (!accessToken) throw new Error('THREAD_ACCESS_TOKEN is required');
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');

  const url = new URL(`${apiBase}/me/threads`);
  url.searchParams.set('fields', 'id,text,timestamp,permalink');
  url.searchParams.set('limit', '50');
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let body;
  try { body = await response.json(); } catch { body = {}; }
  if (!response.ok || !Array.isArray(body.data)) {
    const message = body?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Threads inspection failed: ${redact(message, accessToken)}`);
  }

  return {
    posts: filterThreads(body.data, { date, artifactTexts }),
    pagination: {
      returned: body.data.length,
      hasNext: Boolean(body.paging?.next),
      hasAfterCursor: Boolean(body.paging?.cursors?.after),
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const artifactPath = path.join(path.resolve(options.root), 'outputs', options.date, options.slug, 'threads', 'thread.json');
  const artifact = JSON.parse(await fs.readFile(artifactPath, 'utf8'));
  const result = await inspectThreads({
    date: options.date,
    artifactTexts: artifact.posts.map(({ text }) => text),
    accessToken: process.env.THREAD_ACCESS_TOKEN,
  });
  console.log(JSON.stringify(result, null, 2));
}

const invokedPath = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
