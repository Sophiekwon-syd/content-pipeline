# Manual follow-up — 2026-07-19 run (winter-cold-flu-earache-guide)

Unattended scheduled run. Instagram shipped; the two Chrome-dependent steps
could not run because this session had no bridge into the user's Chrome
(no claude-in-chrome tools; the Playwright MCP browser profile is NOT signed
into Google — Gemini showed a Sign in button).

## Shipped

- **Instagram carousel**: PUBLISHED, media ID 18128060017653535
  (workflow run 29659157702, 10 cards). instagram-log.json committed.
- **GitHub**: brief.md, blog/post.md, blog/blogger.html, carousel/index.html,
  10 card PNGs, topic-memory.json — all on main.

## Needs manual publishing

1. **Blog images (Gemini)** — not generated. Prompts are in
   `blog/post.md` → `## 이미지 프롬프트` (hero, section-1, section-2).
   Generate in gemini.google.com, crop bottom 160px
   (`ffmpeg -i in.png -vf "crop=iw:ih-160:0:0" out.png`), save to
   `blog/images/{hero,section-1,section-2}.png`, commit + push.
2. **Blogger post** — NOT published. `blog/blogger.html` is ready but
   text-only (built before images exist). After adding images, re-run
   `node scripts/md-to-blogger.mjs outputs/2026-07-19/winter-cold-flu-earache-guide`,
   commit + push, then publish via the Chrome JS-injection flow
   (blogger.com/u/2 → NEW POST → inject blogger.html → labels → Publish).
3. **Naver** — intentionally SKIPPED (Sat run; Naver ships Mon/Wed/Fri only).
   Topic is seasonal (winter flu) and stays fresh for the Mon 2026-07-20 run.
   post.md already passed 해요체 / em-dash / tone verification.

## Corrections made after generation (brief.md still contains the raw errors)

- "나지막 스프레이" (mistranslation of nasal spray) → "코 스프레이" in
  post.md and carousel.
- "1300 번호" (wrong helpline) → healthdirect 1800 022 222 in post.md and
  carousel card 8.
- "초라피아" (hallucinated word in brief) → "축 처지고 반응이 둔하다" on
  carousel card 9.
- Do NOT copy text straight from brief.md for Naver — use post.md, which has
  the fixes.
