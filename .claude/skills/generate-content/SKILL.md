---
name: generate-content
description: Use when the user asks to generate today's content, run /generate, or produce a content bundle (blog + Instagram carousel + short video) for the AUSSIE UMMA Korean-parenting brand. Covers the full pipeline from research through review gate; also triggers for /generate-blog, /generate-carousel, /generate-video single-channel runs.
---

# Generate Content — AUSSIE UMMA Pipeline

## Overview

Orchestrates the full content pipeline from a single pass of research into a
bundle of three formats (Naver blog post, Instagram carousel, short video) for
호주에 사는 한국인 엄마.

**Single source of truth:** The pipeline stages are defined by the agent files
in `.claude/agents/` and the orchestrator section of `CLAUDE.md`. This skill
dispatches those agents and enforces the orchestration sequence — it does NOT
redefine their per-stage instructions. Read the agent file before each dispatch.

## When to Use

- User says `/generate`, "generate content for today", "make a content bundle"
- User says `/generate-blog`, `/generate-carousel`, or `/generate-video` (single-channel)
- User wants to re-run one stage with feedback after a review rejection

## When NOT to Use

- The user wants to research a *specific* topic they already named → still use
  this skill, but pass the topic to the researcher agent in the dispatch prompt.
- Editing brand rules, tone guide, or config → use Read/Edit directly.

## Inputs (always read first, in order)

1. `config.json` — brand, niche, `content.topics_to_avoid`, `content.cta_text`, per-channel settings
2. `tone-guide.md` — shared + per-channel voice
3. `topic-memory.json` — previously used topics (avoid 30-day repeats)
4. `templates/brief-template.md` — the brief schema the researcher must fill

Today's date is the current session date. Output root is
`outputs/<YYYY-MM-DD>/<slug>/`.

## Pipeline

### Stage 1 — Research (sequential, blocks everything)

Dispatch the `researcher` agent (`.claude/agents/researcher.md`). It picks one
topic, does all web research, and writes `brief.md` + updates `topic-memory.json`.

**Verify before Stage 2 (stop and report if any fail):**
- `outputs/<YYYY-MM-DD>/<slug>/brief.md` exists
- No `{{...}}` template markers remain anywhere in it
- Every template section is filled (no "TBD", no placeholders)
- At least one statistic has a cited source
- Topic appended to `topic-memory.json`
- Topic not in `topics_to_avoid`, not a 30-day repeat of an existing entry

Extract from the brief: `date_slug` (Meta → Date + Slug) and `topic_title`.

### Stage 2 — Parallel generation

Dispatch all enabled channels **concurrently** (single message, multiple Agent
calls). Each reads only `brief.md` (+ tone-guide/config) — no independent research.

| Channel | Agent file | Expected output |
|---|---|---|
| Blog | `.claude/agents/blogger.md` | `blog/post.md` (해요체, 1500+ chars, 인용 블록 3+) |
| Carousel | `.claude/agents/carousel-maker.md` | `carousel/index.html` + `images/card-01..NN.png` (1080×1350) |
| Video | `.claude/agents/video-maker.md` | `video/output.mp4` (9:16, ≤60s) |

The carousel-maker builds only `carousel/index.html` (reusing the existing
brand design system — copy the `<style>` block from a prior carousel verbatim).
Render the PNG cards yourself after it finishes:
`node scripts/render-carousel.mjs outputs/<date>/<slug>/carousel/index.html`
(Playwright screenshots every `.card` at 1080×1350 into `carousel/images/`.)

**Partial success is OK.** A failed channel does not block the others. Track
per-channel status. If a channel reports a brief gap, surface it to the user
rather than letting that channel invent content.

**Blog always ships with its carousel.** `/generate-blog` dispatches BOTH the
blogger and carousel-maker (parallel) — never blog alone. `/generate-carousel`
runs carousel only; `/generate-video` runs video only.

### Stage 3 — Review gate

Present the bundle and STOP. Do not upload until the user approves.

```
📦 Content Bundle: <topic_title>
📁 outputs/<date_slug>/

✅ Blog:     blog/post.md — <chars> chars, 해요체 verified
✅ Carousel: carousel/index.html + <N> PNGs — spine QA passed
✅ Video:    video/output.mp4 — <duration>s, 9:16

Ready to publish?
- Approve all → Stage 4
- Reject one → re-run that stage with your feedback passed to its agent
- Reject all → restart from Stage 1
```

### Stage 4 — Upload (only on explicit approval)

Per CLAUDE.md Stage 4: Instagram carousel + Reel via Graph API, YouTube via
Data API v3, Naver blog is paste-ready HTML (no auto-publish — present the
checklist). Use credentials from `config.json`. Report each URL or error.

## Orchestration Rules (non-negotiable)

- **No duplicated research.** Stage 2 agents read `brief.md` only. If an agent
  tries to web-search, stop it — that's the researcher's job.
- **Gap reporting, not gap filling.** A Stage 2 agent that finds the brief
  insufficient reports the gap; it never fabricates content to cover it.
- **Brand rules always apply.** See `.claude/rules/brand-rules.md` — no emojis,
  no product names, no unsourced stats, 해요체 blog tone, exact CTA text, etc.
- **One commit per file, no Co-Authored-By trailer** (per CLAUDE.md File Rules).
- **`outputs/` is tracked** (served via raw.githubusercontent.com). Commit artifacts.

## Quick Reference — Dispatch Checklist

```
[ ] Read config.json, tone-guide.md, topic-memory.json, brief-template.md
[ ] Stage 1: dispatch researcher → verify brief.md (no markers, all sections, cited stat)
[ ] Extract date_slug + topic_title from brief
[ ] Stage 2: dispatch enabled channels IN PARALLEL (one message, N Agent calls)
[ ] Collect results; mark per-channel pass/fail; surface any brief-gap reports
[ ] Stage 3: present bundle summary, STOP, wait for user
[ ] Stage 4: on approval, upload enabled channels, report URLs/errors
```

## Common Mistakes

| Mistake | Fix |
|---|---|
| Dispatching Stage 2 before verifying brief.md | Stage 1 is a hard gate. Verify, then parallelize. |
| Running channels sequentially | They're independent — dispatch concurrently. |
| Letting a Stage 2 agent web-search | Re-dispatch with a reminder: "brief.md only, no research." |
| Auto-publishing Naver blog | No official API. Present paste-ready HTML + checklist only. |
| Forgetting to update topic-memory.json | Researcher does this in Stage 1; verify it happened. |
| Reusing a topic from the last 30 days | Check topic-memory.json before dispatching the researcher; tell it which slugs to avoid. |
