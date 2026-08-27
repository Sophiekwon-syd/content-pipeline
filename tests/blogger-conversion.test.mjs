import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('internal HTML comment metadata is never rendered in Blogger HTML', async () => {
  const topicDir = await fs.mkdtemp(path.join(os.tmpdir(), 'blogger-metadata-'));
  const blogDir = path.join(topicDir, 'blog');
  await fs.mkdir(path.join(blogDir, 'images'), { recursive: true });
  await fs.writeFile(path.join(blogDir, 'post.md'), [
    '<!--',
    'title: 내부 제목',
    'naver_search_query: 내부 검색어',
    'target_keywords: 내부 키워드',
    'thumbnail_prompt: 내부 프롬프트',
    '-->',
    '',
    '# 공개 제목',
    '',
    '공개 본문이에요.',
  ].join('\n'));

  try {
    const result = spawnSync(process.execPath, ['scripts/md-to-blogger.mjs', topicDir], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);

    const html = await fs.readFile(path.join(blogDir, 'blogger.html'), 'utf8');
    assert.match(html, /공개 본문이에요/);
    assert.doesNotMatch(html, /내부 제목|내부 검색어|내부 키워드|내부 프롬프트|&lt;!--|--&gt;/);
  } finally {
    await fs.rm(topicDir, { recursive: true, force: true });
  }
});
