import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  validateThreadArtifact,
  nextThreadFormat,
  readThreadsLog,
  writeThreadsLog,
  createThreadsClient,
  publishThreadArtifact,
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

test('approved editorial examples satisfy the production validator', async () => {
  for (const format of ['question', 'information', 'experience', 'observation']) {
    const fixturePath = new URL(`./fixtures/threads/${format}.json`, import.meta.url);
    const artifact = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
    const allText = artifact.posts.map(({ text }) => text).join('\n');
    const validated = validateThreadArtifact(artifact, {
      brief: '5세 미만 아이는 팔이 닿는 거리에서 지켜봐야 해요.',
      post: '2026년 7월 23일 Castle Hill에 직접 다녀왔어요.',
    });
    assert.equal(validated.format, format);
    assert.doesNotMatch(allText, /ㅎㅎ|\b\d+\/\d+\b|#호주/);
    assert.ok(artifact.posts.length >= 1 && artifact.posts.length <= 3);
    if (format === 'experience') assert.equal(artifact.experience_verified, true);
  }
});

test('publishes a root post with one topic tag', async () => {
  const requests = [];
  const responses = [{ id: 'container-1' }, { id: 'thread-1' }];
  const fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify(responses.shift()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const artifact = validateThreadArtifact({
    version: 1,
    slug: 'messy-play',
    format: 'experience',
    experience_verified: true,
    topic_tag: '호주육아',
    posts: [{ text: '아이는 신나게 놀고 나는 손만 닦여서 나오면 끝.' }],
    sources: [],
  });

  const progress = await publishThreadArtifact(artifact, {
    client: createThreadsClient({ accessToken: 'secret-token', userId: 'user-1', fetch }),
  });

  assert.equal(progress.status, 'published');
  assert.deepEqual(progress.postIds, ['thread-1']);
  const createUrl = new URL(requests[0].url);
  assert.equal(createUrl.pathname, '/v1.0/user-1/threads');
  assert.equal(createUrl.searchParams.get('media_type'), 'TEXT');
  assert.equal(createUrl.searchParams.get('topic_tag'), '호주육아');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer secret-token');
  const publishUrl = new URL(requests[1].url);
  assert.equal(publishUrl.pathname, '/v1.0/user-1/threads_publish');
  assert.equal(publishUrl.searchParams.get('creation_id'), 'container-1');
});

test('resumes at the next reply without publishing a duplicate root', async () => {
  const requests = [];
  const responses = [{ id: 'container-2' }, { id: 'thread-2' }];
  const fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify(responses.shift()), { status: 200 });
  };
  const artifact = validateThreadArtifact({
    version: 1,
    slug: 'two-posts',
    format: 'observation',
    posts: [{ text: '첫 글' }, { text: '이어지는 글' }],
    sources: [],
  });

  const progress = await publishThreadArtifact(artifact, {
    client: createThreadsClient({ accessToken: 'secret-token', userId: 'user-1', fetch }),
    progress: { status: 'in_progress', rootId: 'thread-1', postIds: ['thread-1'], nextIndex: 1 },
  });

  assert.equal(requests.length, 2);
  const createUrl = new URL(requests[0].url);
  assert.equal(createUrl.searchParams.get('reply_to_id'), 'thread-1');
  assert.equal(createUrl.searchParams.has('topic_tag'), false);
  assert.deepEqual(progress.postIds, ['thread-1', 'thread-2']);
});

test('redacts an access token from Threads API errors', async () => {
  const fetch = async () => new Response(JSON.stringify({
    error: { message: 'Invalid token secret-token' },
  }), { status: 401 });
  const client = createThreadsClient({ accessToken: 'secret-token', userId: 'user-1', fetch });

  await assert.rejects(
    client.createTextContainer({ text: '글', topicTag: '호주육아' }),
    (error) => {
      assert.doesNotMatch(error.message, /secret-token/);
      assert.match(error.message, /\[REDACTED\]/);
      return true;
    },
  );
});

test('CLI dry-run validates an artifact without credentials or writing a log', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'threads-cli-'));
  const topicDir = path.join(root, 'outputs', '2026-07-24', 'messy-play');
  await fs.mkdir(path.join(topicDir, 'threads'), { recursive: true });
  await fs.writeFile(path.join(topicDir, 'threads', 'thread.json'), JSON.stringify({
    version: 1,
    slug: 'messy-play',
    format: 'experience',
    experience_verified: true,
    topic_tag: '호주육아',
    posts: [{ text: '아이는 한 시간 놀고 나는 손만 닦여서 나오면 끝.' }],
    sources: [],
  }));

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/post-to-threads.mjs'),
    '--date', '2026-07-24', '--slug', 'messy-play', '--dry-run', '--root', root,
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DRY RUN.*messy-play.*1 post/s);
  await assert.rejects(fs.access(path.join(root, 'outputs', '2026-07-24', 'threads-log.json')));
});
