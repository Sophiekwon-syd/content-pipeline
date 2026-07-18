---
name: ship-topic
description: Run the complete AUSSIE UMMA pipeline end-to-end — research a fresh topic, generate blog + Instagram carousel, create Gemini images, then after user approval publish to Naver Blog, Instagram, and Google Blogger. Use when the user says "ship a new topic", "run the whole pipeline", "generate and publish a new topic", or invokes /ship-topic. For generation without publishing, use generate-content instead.
---

# Ship Topic — Full Pipeline

One run = one new topic landing on **Naver + Instagram + Blogger**. Generation
stages are defined by `generate-content` and `.claude/agents/*` — this skill
adds the image, verification, and distribution steps proven in production.
Details and gotchas live in CLAUDE.md (upload sections) and the memory files
(`naver-smarteditor-automation`, `instagram-posting-setup`,
`blogger-posting-setup`, `navermate-design-format`).

## Stage 1-2 — Research + generate (via generate-content rules)

1. Dispatch `researcher` agent → verify `brief.md` (no `{{...}}`, cited stat,
   topic-memory.json updated, no 30-day repeat, not in topics_to_avoid).
2. Dispatch `blogger` + `carousel-maker` agents IN PARALLEL (brief.md only, no
   research). Carousel-maker produces index.html only; render PNGs yourself:
   `node scripts/render-carousel.mjs outputs/<date>/<slug>/carousel/index.html`
   **Video is out of scope** — do not dispatch video-maker even though
   config.json has the channel enabled; only run it if the user explicitly
   asks for video.

## Stage 2.5 — Mechanical verification (agents slip; always run)

```
grep -n '합니다\|됩니다\|습니다\|입니다\|ㅠㅠ' blog/post.md   # must be empty outside 셀프리뷰/체크리스트
grep -n '—' blog/post.md                                    # no em-dashes in title/headings (AI tell)
```
Fix violations in post.md directly (해요체, dash → comma/괄호/question form).

## Stage 2.6 — Images (Gemini in user's Chrome)

For each `hero:` / `section-N:` prompt in post.md `## 이미지 프롬프트`:
1. claude-in-chrome → gemini.google.com → **new chat per image** (follow-up
   prompts in one chat hang) → type prompt, verify text landed, send.
2. Download → crop bottom 160px (`ffmpeg -i in.png -vf "crop=iw:ih-160:0:0"`)
   → save to `outputs/<date>/<slug>/blog/images/{hero,section-N}.png`.

## Stage 3 — REVIEW GATE (hard stop)

Present the bundle (blog chars + sections, carousel card count, image count)
with 2-3 verification screenshots. **STOP and wait for explicit approval
before any publishing.** Publishing is outward-facing and irreversible-ish.

## Stage 4 — Publish (only after approval)

1. **Naver** — `rm -f outputs/<date>/naver-log.json` if re-running, then
   `node scripts/post-to-naver.mjs --date <date>` (**publishes directly** —
   default; use `--draft` only if asked). Naver gets the HERO image only
   (section images render in the Blogger mirror — inline section images
   scramble SmartEditor text). AI 활용 설정 usually shows 0/N on the fresh
   publish — repair via the edit-URL flow (memory: naver-smarteditor-automation),
   which republishes the SAME logNo (no duplicate). Do NOT re-run the whole
   publish to fix the toggle — that creates duplicate live posts.
2. **GitHub** — force-add (`git add -f`) + commit + push: carousel images,
   blog images, `blogger.html` (from step 4). One commit per file for
   outputs; instagram/blogger fetch from raw.githubusercontent so push FIRST.
3. **Instagram** — `gh workflow run post-to-instagram.yml -f date=<date>` then
   `gh run watch <id>`. A red run may still have posted — check the POST step
   log for `PUBLISHED:`; only the log-commit step is flaky.
4. **Blogger** — `node scripts/md-to-blogger.mjs outputs/<date>/<slug>` →
   commit+push blogger.html → blogger.com/u/2 → NEW POST → type title →
   inject body via javascript_tool (sync XHR of raw blogger.html →
   `iframe.editable` contentDocument.body.innerHTML + input event; NEVER
   paste raw HTML into compose — it publishes as literal tags) → labels →
   Publish → CONFIRM.

## Stage 5 — Report

Live URLs for all three platforms + what needs manual follow-up (thumbnail
overlay, replace AI images with originals, delete stale 임시저장 drafts).
Remind: posts_per_week_target is 3 — don't ship more than that.

## Failure rules

- Partial success is OK; a failed channel never blocks the others.
- Naver repair = fix post.md and re-post fresh (delete naver-log entry);
  NEVER surgically edit via the 임시저장 list (it has destroyed drafts).
- IG token errors: see memory `instagram-posting-setup` (expired vs mangled
  vs wrong IG_USER_ID — each has a distinct error signature).
