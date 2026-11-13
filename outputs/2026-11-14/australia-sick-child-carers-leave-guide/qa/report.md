# Post-publication artifact correction audit — 2026-11-14

Topic: 호주 아이 아플 때 돌봄휴가, 유급·무급 carer's leave와 증빙 확인법  
Slug: `australia-sick-child-carers-leave-guide`

## Corrections

- Replaced the mistranslated `즉시 가족` wording with `법에서 정한 immediate family(가족 범주)` and retained the Fair Work Ombudsman source and national-system scope.
- Replaced the imprecise `상·협약` wording with `어워드(award)나 기업협약(enterprise agreement)`.
- Regenerated `blog/blogger.html` from the corrected Markdown, then restored exactly three AI-image disclosures, each immediately following its corresponding image.
- Replaced every literal `/` citation separator in the carousel with a visible line break. Card 9 keeps `적용 제도·병가·돌봄휴가` and `휴가 통지·증빙` on distinct source lines.
- Re-rendered all ten carousel PNGs from the corrected HTML.

## Editorial and mechanical verification

- Rendered public blog text: 2,882 characters / 2,230 non-whitespace characters under the local Markdown-to-plain-text count.
- Tone scan found no banned formal endings, `ㅠㅠ`, emojis, placeholders, or the superseded `즉시 가족` and `상·협약` wording in public output.
- `node --test`: 26 passed, 0 failed.
- Threads production dry-run: passed; validated 3 posts.
- Naver dry-run: passed; 5 headings and 3 parsed image assets. The first body block remains the exact hero disclosure.
- Blogger dry-run command completed without mutation and skipped the slug because the existing publication log records it as already posted. Direct HTML verification passed: exactly 3 unique raw image references, exactly 3 disclosures, and all 3 disclosures immediately follow their images.
- Carousel source verification found 10 card sections, zero literal citation separators, and three distinct source lines on card 9.
- Publication logs were not edited.

## Image review

- Blog images remain unchanged: three PNGs at 1024×457.
- Carousel: exactly 10 ordered PNGs at 1080×1350.
- Every regenerated carousel PNG was inspected individually at full 1080×1350 and at temporary 360×450 size, for 20 inspections total. Copy, line breaks, handle, scope, source placement, contrast, safe bounds, and card-1 disclosure passed with no clipping or overflow.
- Temporary 360×450 inspection copies are outside the repository at `/private/tmp/aussie-umma-2026-11-14-audit-360/`.

## Frozen asset hashes

`qa/sha256.txt` contains refreshed SHA-256 values for the brief, corrected blog and Blogger HTML, unchanged blog images and caption, corrected carousel source, all ten regenerated cards, and Threads JSON.

## Live publication state

- This correction audit did not publish, retry, or dispatch any platform action.
- The already-live Blogger and Instagram posts still contain the earlier artifacts and were intentionally left unchanged.
- Existing Blogger and Instagram publication logs remain unchanged. The earlier failed Naver and Threads outcomes remain unchanged, with no Naver or Threads publication log created.
