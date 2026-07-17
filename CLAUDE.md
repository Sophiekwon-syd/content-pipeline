# Content Pipeline — AUSSIE UMMA

Unified content pipeline: one `/generate` command produces a blog post,
Instagram carousel, and short video from a single research pass.

## Quick Start

```
/generate
```

The orchestrator handles everything. When it finishes, your content is in
`outputs/<YYYY-MM-DD>/<topic-slug>/`.

---

## Pipeline Overview

```
/generate
    │
    ▼
Stage 1: Research & Content Brief    researcher agent
    │  - Picks topic (one pass, all channels)
    │  - Deep research with web search
    │  - Writes brief.md (shared artifact)
    │
    ▼
Stage 2: Parallel Generation         (runs concurrently)
    ├── 2a: Blog     (blogger agent)
    ├── 2b: Carousel (carousel-maker agent)  
    └── 2c: Video    (video-maker agent)
    │
    ▼
Stage 3: Review Gate                 user approves per-piece
    │
    ▼
Stage 4: Upload                      Instagram + YouTube + Naver
```

## Commands

### `/ship-topic`

The full production run: research a fresh topic → blog + carousel + Gemini
images → review gate → publish to Naver + Instagram + Blogger. Defined in
`.claude/skills/ship-topic/SKILL.md`. Use this when you want a new topic to
actually land on all platforms, not just be generated.

### `/generate`

Run the full pipeline: research → blog + carousel + video → review → upload.

**What it does:**
1. Dispatches the `researcher` agent to pick a topic and write `brief.md`
2. Waits for brief.md to be written, then verifies it's complete
3. Dispatches `blogger`, `carousel-maker`, and `video-maker` in parallel
4. Collects results from all three
5. Presents the bundle for your review
6. On approval, uploads to configured platforms

### `/generate-blog`

Run Stage 1 (research) + Stage 2a (blog) **and** Stage 2b (carousel) in
parallel. Blog and its Instagram carousel are always produced together — the
carousel reuses the same brief, so there is no reason to ship one without the
other. Skips only the video. Render carousel PNGs with
`node scripts/render-carousel.mjs outputs/<date>/<slug>/carousel/index.html`.

### `/generate-carousel`

Run only Stage 1 (research) + Stage 2b (carousel). Skips blog and video.

### `/generate-video`

Run only Stage 1 (research) + Stage 2c (video). Skips blog and carousel.

## Orchestrator Instructions

When `/generate` is invoked:

### 1. Launch Stage 1: Researcher

```
Agent: researcher (from .claude/agents/researcher.md)
Input: config.json, tone-guide.md, topic-memory.json, templates/brief-template.md
Expected output: outputs/<YYYY-MM-DD>/<slug>/brief.md + updated topic-memory.json
```

Verify the output:
- brief.md exists at the expected path
- All template sections are filled (no "{{...}}" markers)
- Topic is appended to topic-memory.json
- If verification fails, report the issue and stop

### 2. Extract metadata

From brief.md, extract:
- `date_slug`: from Meta → Date and Slug (e.g. `2026-07-08/mchn-green-book-guide`)
- `topic_title`: from Topic line

### 3. Launch Stage 2: Parallel generation

Launch all three agents concurrently:

```
Agent: blogger (from .claude/agents/blogger.md)
Input: outputs/<date_slug>/brief.md, tone-guide.md, config.json
Expected output: outputs/<date_slug>/blog/post.md

Agent: carousel-maker (from .claude/agents/carousel-maker.md)
Input: outputs/<date_slug>/brief.md, tone-guide.md, config.json
Expected output: outputs/<date_slug>/carousel/index.html + images/*.png

Agent: video-maker (from .claude/agents/video-maker.md)
Input: outputs/<date_slug>/brief.md, config.json
Expected output: outputs/<date_slug>/video/output.mp4
```

Track completion per agent. Partial success is OK:
- Blog fails → blog output missing, carousel + video continue
- Carousel fails → carousel output missing, blog + video continue
- Video fails → video output missing, blog + carousel continue

Report per-agent status to the user.

### 4. Stage 3: Review Gate

Present the bundle summary:

```
📦 Content Bundle: <topic_title>
📁 outputs/<date_slug>/

✅ Blog:     blog/post.md (1,500+ chars, 해요체 verified)
✅ Carousel: carousel/index.html + 10 PNGs (QA passed)
✅ Video:    video/output.mp4 (60s, 9:16, Korean subtitles)

Ready to publish?
- Approve all → upload to all platforms
- Reject one → re-run that stage with feedback
- Reject all → restart from Stage 1
```

Wait for your response. If you provide feedback, pass it to the rejected
stage's agent as additional input.

### 5. Stage 4: Upload

On approval, upload each format:

**Instagram Carousel (if carousel succeeded):**
- Use Instagram Graph API with credentials from `config.json` → `instagram`
- Upload PNGs as carousel post
- Caption: first sentence of blog summary + CTA
- Report: post URL or error

**Instagram Reel / YouTube (if video succeeded):**
- Instagram: upload MP4 as Reel via Graph API
- YouTube: upload MP4 via YouTube Data API v3 with:
  - Title: blog title
  - Description: blog summary + link to Naver post
  - Tags: SEO keywords from brief
- Report: video URLs or errors

**Naver Blog (if blog succeeded):**
- No official API — use `scripts/post-to-naver.mjs` (Playwright, persistent
  login profile in `.naver-profile/`)
- Before posting, mechanically verify the tone: `grep -n '합니다\|됩니다\|습니다\|입니다\|ㅠㅠ' blog/post.md`
  must return nothing outside the 셀프 리뷰/체크리스트 sections (agents slip on 합니다).
- Before posting, generate blog images from the `## 이미지 프롬프트` section of
  post.md using Gemini in the user's Chrome (claude-in-chrome tools,
  gemini.google.com): one prompt per image, download each, then crop the
  bottom 160px (Gemini watermark zone): `ffmpeg -i in.png -vf "crop=iw:ih-160:0:0" out.png`
  Save to `outputs/<date>/<slug>/blog/images/` as `hero.png` / `section-N.png`
  (N = 본문 H2 순번) — the posting script auto-places hero at top and
  section-N under the Nth heading block.
- The script applies the navermate design format automatically: 마루부리 font,
  줄간격 180%, left-aligned, numbered ❝ heading quote blocks + 구분선, 세로선
  인용구 callout boxes, real 표 components from markdown tables, bold FAQ lines.

**Google Blogger (mirror of the Naver post):**
- Blog: 호주 육아 이야기 — aussieumma.blogspot.com (Google account /u/2 in Chrome)
- Convert: `node scripts/md-to-blogger.mjs outputs/<date>/<slug>` → writes
  `blog/blogger.html` (images hot-linked from raw.githubusercontent — commit
  blog images AND blogger.html to main first, force-add past the gitignore)
- Post via claude-in-chrome on blogger.com: NEW POST → type title → inject the
  HTML into the compose editor with javascript_tool (sync XHR fetch of the raw
  blogger.html → set `iframe.editable` contentDocument.body.innerHTML →
  dispatch input event) → labels → Publish → CONFIRM dialog.
- Do NOT paste raw HTML into the compose view (it gets escaped and publishes
  as literal tags) — the view toggle is unreliable; the JS injection is the
  proven path.
- One-time setup: `npm install playwright && npx playwright install chromium`,
  then `node scripts/post-to-naver.mjs --login` (user logs in manually)
- Post: `node scripts/post-to-naver.mjs --date <YYYY-MM-DD> --draft`
  (draft mode recommended; drop `--draft` to publish directly)
- Preview parsing without a browser: add `--dry-run`
- Keeps a per-date `naver-log.json` so re-runs skip already-posted topics
- Caution: Naver detects automation — keep volume at posts_per_week_target
  and prefer draft + manual final publish

### 6. Summary

Report final status:
```
🎉 Pipeline complete: <topic_title>

📱 Instagram: <carousel URL> + <reel URL>
📺 YouTube: <video URL>
📝 Naver Blog: outputs/<date_slug>/blog/post.md (paste-ready, checklist included)

Token usage: ~XX,XXX input + ~XX,XXX output
```

## Directory Structure

```
outputs/
└── YYYY-MM-DD/
    └── <topic-slug>/
        ├── brief.md            Stage 1 artifact
        ├── blog/
        │   └── post.md         Naver-ready draft + publishing checklist
        ├── carousel/
        │   ├── index.html      HTML carousel
        │   └── images/         PNG cards (card-01.png … card-10.png)
        └── video/
            └── output.mp4      9:16 short video
```

## Key Rules

- **No duplicated research.** Stage 2 agents read brief.md only. They never search or research.
- **Partial success is OK.** Missing one format doesn't block the others.
- **Gap reporting, not gap filling.** If a Stage 2 agent finds the brief insufficient, it reports the gap rather than filling it with made-up content.
- **Existing tools stay intact.** aussie-umma, navermate, and MoneyPrinterTurbo remain independently usable from their own repos.
