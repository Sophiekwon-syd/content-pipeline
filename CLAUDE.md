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

Run only Stage 1 (research) + Stage 2a (blog). Skips carousel and video.

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
- Do NOT auto-publish (no official API)
- Present the paste-ready HTML and publishing checklist
- The user copies to SmartEditor manually

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
