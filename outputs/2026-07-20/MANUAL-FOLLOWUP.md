# Manual follow-up — 2026-07-20 run (winter-holiday-activity-guide)

Unattended scheduled run (Mon = Naver day). Naver + Instagram shipped; the two
Chrome-dependent steps could not run because this session had no bridge into
the user's Chrome (no claude-in-chrome tools; the Playwright MCP browser
profile is not signed into Google).

## Shipped

- **Naver Blog**: PUBLISHED directly, logNo 224351580244
  https://blog.naver.com/ai-in-syd/224351580244
  10 heading blocks, 1 table, 3 FAQ bolded. No images attached (Gemini
  pending), so no AI 활용 toggle repair needed. naver-log.json committed.
  Note: post.md metadata lines are now wrapped in `## 메타 정보` so the
  parser strips them — the 2026-07-19 post.md has them loose; if that post
  ever ships to Naver/Blogger, add the same heading first.
- **Instagram carousel**: PUBLISHED, media ID 18114938353906926
  (workflow run 29701985685, 10 cards). instagram-log.json committed.
- **GitHub**: brief.md, blog/post.md, blog/blogger.html, carousel/index.html,
  10 card PNGs, topic-memory.json, naver-log.json — all on main.

## Needs manual publishing

1. **Blog images (Gemini)** — not generated. Prompts are in
   `blog/post.md` → `## 이미지 프롬프트` (hero, section-1, section-2).
   Generate in gemini.google.com, crop bottom 160px
   (`ffmpeg -i in.png -vf "crop=iw:ih-160:0:0" out.png`), save to
   `blog/images/{hero,section-1,section-2}.png`, commit + push.
   Then add the hero to the live Naver post (or leave text-only; thumbnail
   overlay is manual anyway).
2. **Blogger post** — NOT published. `blog/blogger.html` is ready but
   text-only (built before images exist). After adding images, re-run
   `node scripts/md-to-blogger.mjs outputs/2026-07-20/winter-holiday-activity-guide`,
   commit + push, then publish via the Chrome JS-injection flow
   (blogger.com/u/2 → NEW POST → inject blogger.html → labels → Publish).
3. **2026-07-19 topic (winter-cold-flu-earache-guide) Naver publish** — the
   07-19 log deferred its Naver publish to "the Mon 2026-07-20 run", but
   today's run shipped a fresh topic to Naver instead. Two live Naver posts
   in one day risks the automation heuristics (posts_per_week_target = 3),
   so it was NOT published. Decide: publish it on the next Naver day
   (Wed 2026-07-22) instead of a fresh topic, or drop it. Before publishing,
   wrap its post.md metadata lines in `## 메타 정보` (see note above).
4. Also outstanding from 2026-07-19: Gemini images + Blogger for
   winter-cold-flu-earache-guide (see outputs/2026-07-19/MANUAL-FOLLOWUP.md).
