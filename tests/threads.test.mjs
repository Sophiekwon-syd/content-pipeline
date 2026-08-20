import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  validateThreadArtifact,
  nextThreadFormat,
  readThreadsLog,
  writeThreadsLog,
} from '../scripts/lib/threads.mjs';

test('accepts a natural question artifact and defaults its topic', () => {
  const value = {
    version: 1,
    slug: 'swimming-lessons',
    format: 'question',
    posts: [{ text: '스친들아 아이 수영수업은 언제 시작했어?' }],
    sources: [],
  };
  const result = validateThreadArtifact(value, { brief: '', post: '' });
  assert.equal(result.format, 'question');
  assert.equal(result.topic_tag, '호주육아');
});

test('rejects excessive self replies', () => {
  const value = {
    version: 1,
    slug: 'x',
    format: 'observation',
    posts: Array.from({ length: 4 }, (_, i) => ({ text: `관찰 ${i}` })),
    sources: [],
  };
  assert.throws(() => validateThreadArtifact(value, { brief: '', post: '' }), /1-3/);
});

test('rejects banned voice patterns', () => {
  const value = {
    version: 1,
    slug: 'x',
    format: 'question',
    posts: [{ text: '1/3 궁금해ㅎㅎ #호주육아' }],
    sources: [],
  };
  assert.throws(() => validateThreadArtifact(value, { brief: '', post: '' }), /ㅎㅎ|numbered|hashtag/);
});

test('rejects unverified experience', () => {
  const value = {
    version: 1,
    slug: 'x',
    format: 'experience',
    posts: [{ text: '직접 가보니 좋았어.' }],
    sources: [],
  };
  assert.throws(() => validateThreadArtifact(value, { brief: '', post: '' }), /experience_verified/);
});

test('requires information numbers to exist in source material', () => {
  const value = {
    version: 1,
    slug: 'x',
    format: 'information',
    posts: [{ text: '아이에게 15일을 지원한대.' }],
    sources: ['https://www.servicesaustralia.gov.au/example'],
  };
  assert.throws(() => validateThreadArtifact(value, { brief: '지원', post: '지원' }), /15/);
});

test('rotates to a suitable format not used recently', () => {
  assert.equal(
    nextThreadFormat(['question', 'information'], ['question', 'information', 'observation']),
    'observation',
  );
});

test('atomically persists publication progress', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'threads-log-'));
  const logPath = path.join(dir, 'threads-log.json');
  const entries = [{ slug: 'x', status: 'in_progress', rootId: '1', postIds: ['1'], nextIndex: 1, format: 'question' }];
  await writeThreadsLog(logPath, entries);
  assert.deepEqual(await readThreadsLog(logPath), entries);
  await assert.rejects(fs.access(`${logPath}.tmp`));
});
