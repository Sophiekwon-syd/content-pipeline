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
    '# 테스트 글',
    '',
    '## 본문 제목',
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
    assert.doesNotMatch(result.stdout, /^태그$/m);
    assert.equal((result.stdout.match(/#호주육아 #호주맘/g) || []).length, 1);
  } finally {
    await fs.rm(dateDir, { recursive: true, force: true });
  }
});
