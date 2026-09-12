import test from 'node:test';
import assert from 'node:assert/strict';

import { inspectThreads } from '../scripts/inspect-threads.mjs';

test('GETs recent Threads posts, filters by artifact text or Sydney date, and never exposes the token', async () => {
  const token = 'secret-token';
  let request;
  const fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({
      data: [
        { id: 'match-text', text: '오늘의 승인된 글', timestamp: '2026-09-11T14:00:00.000Z', permalink: 'https://threads.net/p/text' },
        { id: 'match-date', text: '다른 오늘 글', timestamp: '2026-09-12T01:00:00.000Z', permalink: 'https://threads.net/p/date' },
        { id: 'ignore', text: '예전 글', timestamp: '2026-09-10T01:00:00.000Z', permalink: 'https://threads.net/p/old' },
      ],
      paging: { cursors: { after: 'opaque-after' }, next: 'https://graph.threads.net/v1.0/me/threads?after=opaque-after' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const result = await inspectThreads({
    date: '2026-09-12',
    artifactTexts: ['오늘의 승인된 글'],
    accessToken: token,
    fetchImpl: fetch,
  });

  assert.equal(request.options.method, 'GET');
  assert.equal(new URL(request.url).pathname, '/v1.0/me/threads');
  assert.equal(new URL(request.url).searchParams.get('fields'), 'id,text,timestamp,permalink');
  assert.equal(new URL(request.url).searchParams.get('limit'), '50');
  assert.doesNotMatch(request.url, /secret-token/);
  assert.equal(request.options.headers.Authorization, `Bearer ${token}`);
  assert.deepEqual(result.posts.map(({ id }) => id), ['match-text', 'match-date']);
  assert.deepEqual(result.pagination, { returned: 3, hasNext: true, hasAfterCursor: true });
  assert.doesNotMatch(JSON.stringify(result), /secret-token/);
});

test('sanitizes token text in inspection errors', async () => {
  const token = 'secret-token';
  const fetch = async () => new Response(JSON.stringify({
    error: { message: `The requested resource does not exist: ${token}` },
  }), { status: 400 });

  await assert.rejects(
    inspectThreads({ date: '2026-09-12', artifactTexts: [], accessToken: token, fetchImpl: fetch }),
    (error) => {
      assert.doesNotMatch(error.message, /secret-token/);
      assert.match(error.message, /\[REDACTED\]/);
      return true;
    },
  );
});
