# 2026-07-21 Manual Follow-up

Topic: 호주 겨울철 아이 비타민D 결핍 (`winter-vitamin-d-deficiency-guide`)

Shipped unattended (scheduled run). Naver intentionally skipped — not a Mon/Wed/Fri day.

## Shipped

- Instagram: published (media ID `18096956441254983`), 10 cards
- Blogger: https://aussieumma.blogspot.com/2026/07/d.html — TEXT ONLY, no images

## Pending — Gemini images

The scheduled run has no interactive session, so no images were generated.
Blogger post is live without them. To backfill: generate each prompt in a NEW
Gemini chat, download, crop the bottom 160px
(`ffmpeg -i in.png -vf "crop=iw:ih-160:0:0" out.png`), save to
`outputs/2026-07-21/winter-vitamin-d-deficiency-guide/blog/images/`, then
re-run `md-to-blogger.mjs`, commit + push, and update the live Blogger post.

Prompts are in `blog/post.md` → `## 이미지 프롬프트` (hero, section-1, section-2).

## Pending — Naver

This topic has NOT been posted to Naver. Ship it on the next Mon/Wed/Fri run
only if still fresh; otherwise it lives on Blogger + Instagram alone.

## Content fix applied during this run

Stage 1 invented a non-existent Australian city, "브래스밴드" (literally "brass
band"), and it propagated into brief.md, post.md, and the carousel. Corrected
to 케언즈 (Cairns) in all three before publishing. Worth watching for in future
runs — the researcher agent asserted it as fact in a regional comparison table.
