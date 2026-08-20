#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createThreadsClient,
  publishThreadArtifact,
  readThreadsLog,
  validateThreadArtifact,
  writeThreadsLog,
} from './lib/threads.mjs';

function parseArgs(argv) {
  const options = { root: process.cwd(), dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (['--date', '--slug', '--root'].includes(arg)) options[arg.slice(2).replace('-', '')] = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.date || !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) throw new Error('--date YYYY-MM-DD is required');
  if (!options.slug) throw new Error('--slug is required');
  return options;
}

async function readOptional(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const topicDir = path.join(path.resolve(options.root), 'outputs', options.date, options.slug);
  const artifactPath = path.join(topicDir, 'threads', 'thread.json');
  const rawArtifact = JSON.parse(await fs.readFile(artifactPath, 'utf8'));
  const artifact = validateThreadArtifact(rawArtifact, {
    brief: await readOptional(path.join(topicDir, 'brief.md')),
    post: await readOptional(path.join(topicDir, 'blog', 'post.md')),
  });

  if (options.dryRun) {
    console.log(`DRY RUN: ${artifact.slug} — ${artifact.posts.length} post(s), topic ${artifact.topic_tag}`);
    return;
  }

  const logPath = path.join(path.resolve(options.root), 'outputs', options.date, 'threads-log.json');
  const entries = await readThreadsLog(logPath);
  let existingIndex = entries.findIndex((entry) => entry.slug === artifact.slug);
  const existing = existingIndex >= 0 ? entries[existingIndex] : undefined;
  if (existing?.status === 'published') {
    console.log(`SKIP: ${artifact.slug} is already published (${existing.rootId})`);
    return;
  }

  const saveProgress = async (progress) => {
    const entry = {
      slug: artifact.slug,
      format: artifact.format,
      topicTag: artifact.topic_tag,
      ...progress,
      updatedAt: new Date().toISOString(),
    };
    if (existingIndex >= 0) entries[existingIndex] = entry;
    else {
      entries.push(entry);
      existingIndex = entries.length - 1;
    }
    await writeThreadsLog(logPath, entries);
  };

  const result = await publishThreadArtifact(artifact, {
    client: createThreadsClient({
      accessToken: process.env.THREAD_ACCESS_TOKEN,
      userId: process.env.THREAD_USER_ID,
    }),
    progress: existing,
    onProgress: saveProgress,
  });
  console.log(`PUBLISHED: ${artifact.slug} — ${result.postIds.join(', ')}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
