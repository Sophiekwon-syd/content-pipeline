import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('tag metadata never becomes a numbered Naver heading quote', async () => {
  const date = '2099-01-01';
  const slug = 'tag-heading-regression';
  const dateDir = path.resolve('outputs', date);
  const postDir = path.join(dateDir, slug, 'blog');
  await fs.mkdir(postDir, { recursive: true });
  await fs.writeFile(path.join(postDir, 'post.md'), [
    '<!--',
    'title: 내부 제목',
    'naver_search_query: 내부 검색어',
    'target_keywords: 내부 키워드',
    'thumbnail_prompt: 내부 프롬프트',
    '-->',
    '',
    '# 테스트 글',
    '',
    '## 1위. Sydney Grammar School',
    '',
    '본문이에요.',
    '',
    '## 태그',
    '',
    '#호주육아 #호주맘',
    '',
    '## 이미지 프롬프트',
    '',
    'hero: test',
  ].join('\n'));

  try {
    const result = spawnSync(process.execPath, [
      'scripts/post-to-naver.mjs', '--date', date, '--slug', slug, '--dry-run',
    ], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /STYLE: 1 headings/);
    assert.match(result.stdout, /^1위\. Sydney Grammar School$/m);
    assert.doesNotMatch(result.stdout, /^1\. 1위\. Sydney Grammar School$/m);
    assert.doesNotMatch(result.stdout, /내부 제목|내부 검색어|내부 키워드|내부 프롬프트|<!--|-->/);
    assert.doesNotMatch(result.stdout, /^태그$/m);
    assert.equal((result.stdout.match(/#호주육아 #호주맘/g) || []).length, 1);
  } finally {
    await fs.rm(dateDir, { recursive: true, force: true });
  }
});
