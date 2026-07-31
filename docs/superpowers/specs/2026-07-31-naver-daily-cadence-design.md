# Naver Daily Cadence — Config-Driven Switch

**Date:** 2026-07-31
**Status:** Approved (design); pending implementation
**Decision owner:** user

## Problem

The daily unattended run (`scripts/daily-ship.sh`, launched by launchd at 01:00
local) ships **Blogger + Instagram every day**, but publishes to **Naver only on
Mon/Wed/Fri**. The user wants Naver to post every day too, like the other two
channels.

The Mon/Wed/Fri throttle was deliberate, not a missing feature: it was set to
match `posts_per_week_target: 3` and to stay under Naver's automation-pattern
detection (저품질 / low-quality search-visibility demotion). The user has been
told this risk and has explicitly chosen **daily, auto-publish**, accepting it.

## Goal

Make Naver publish every day in the unattended daily run, driven by a config
switch so cadence can be changed (including reverted to Mon/Wed/Fri) with a
one-word edit — no shell change required.

Non-goal: changing any publishing *mechanism*. `post-to-naver.mjs`, the
Playwright profile, image generation, and the review/draft-first rules are all
untouched.

## Design

### Source of truth: `config.json`

Add an explicit cadence enum to `channels.blog`:

```json
"blog": {
  "enabled": true,
  "platform": "naver",
  "category": "호주육아",
  "posts_per_week_target": 7,
  "naver_schedule": "daily"
}
```

- `naver_schedule`: `"daily" | "mon-wed-fri"`. This is the cadence gate.
- `posts_per_week_target`: bumped `3 → 7` so the value stays truthful (it is
  referenced in CLAUDE.md / content-strategy.md / the skill). It is a documented
  number, not the gate — the enum is the gate.

Rationale for a dedicated enum rather than overloading `posts_per_week_target
>= 7`: keeps "how many we aim for" and "which days we post" as separate
concepts, and makes intermediate values (4–6) unambiguous.

### Runtime behavior: `scripts/daily-ship.sh`

Read the switch with node (always present in this project; `jq` is not
guaranteed), then branch. The full existing Mon/Wed/Fri gate is retained as the
`else` branch so `"mon-wed-fri"` is a real, reversible setting rather than dead
code:

```bash
NAVER_SCHEDULE=$(node -p "require(process.argv[1]).channels.blog.naver_schedule || 'mon-wed-fri'" "$PROJECT/config.json")
if [ "$NAVER_SCHEDULE" = "daily" ]; then
  NAVER_MODE="Today is on the NAVER-DAILY schedule (naver_schedule=daily): publish directly to Naver as well, every day — same as Blogger and Instagram."
else
  DOW=$(date +%u) # 1=Mon .. 7=Sun
  if [ "$DOW" = "1" ] || [ "$DOW" = "3" ] || [ "$DOW" = "5" ]; then
    NAVER_MODE="Today IS a Naver day (Mon/Wed/Fri): publish directly to Naver as well."
  else
    NAVER_MODE="Today is NOT a Naver day: SKIP Naver entirely (no draft, no publish) — ship Blogger + Instagram only."
  fi
fi
```

The surrounding script (the `claude -p` invocation, the silent-failure detection
that greps the log for auth errors and checks `outputs/$TODAY` exists) is
unchanged.

### Keeping instructions consistent

The unattended run feeds the agent three instruction sources — the `claude -p`
prompt, `ship-topic/SKILL.md`, and `CLAUDE.md`. All must agree with the new
behavior or the agent gets contradictory orders. Edits:

1. `.claude/skills/ship-topic/SKILL.md` (Stage 5 report line) — replace
   "Remind: posts_per_week_target is 3 — don't ship more than that." with a note
   that Naver cadence is driven by `channels.blog.naver_schedule` (currently
   `daily` = 7/week), so the run publishes Naver on whatever days the config says.
2. `CLAUDE.md` — the Naver caution ("keep volume at posts_per_week_target")
   points at the config switch instead of a fixed number, and records that daily
   was chosen 2026-07-31 with the 저품질 risk knowingly accepted.
3. `content-strategy.md` — the "Cadence" section is rewritten: Naver now posts
   daily, gated by `channels.blog.naver_schedule`; the previous Mon/Wed/Fri
   strategy is noted as superseded (2026-07-31) with risk accepted.
4. `scripts/post-to-naver.mjs` — header "NOTE ON BOT DETECTION" comment updated:
   cadence is decided by `daily-ship.sh` reading the config switch; the script
   itself is per-run and does not enforce cadence. Volume warning stays, framed
   as the accepted-risk context.

### What deliberately stays unchanged

- The "draft-first when debugging" hard rule in `ship-topic/SKILL.md` — it is
  about iterating on formatting fixes, not cadence. Direct publish remains the
  default for a normal verified run.
- The `naver-log.json` double-post guard. Each day is a fresh `YYYY-MM-DD/slug`,
  so daily posting needs no change here; re-runs of the same date still skip.
- The auth-failure detection in `daily-ship.sh` (greps the log for "not logged
  in" / "oauth expired" and exits 1). Daily posting makes `.naver-profile/`
  session expiry more likely to surface, but the existing handling already
  covers it and flags the run as failed.
- The launchd plist (`com.aussieumma.ship-topic.plist`) — schedule/time
  unchanged; it still fires `daily-ship.sh` once a day.

## Verification

No real publish happens during verification:

- `bash -n scripts/daily-ship.sh` — syntax valid.
- `node -e "require('./config.json')"` — config still valid JSON; confirm
  `channels.blog.naver_schedule === "daily"` and `posts_per_week_target === 7`.
- Exercise the branch without publishing: run the `NAVER_SCHEDULE` one-liner
  (expect `daily`) and echo `NAVER_MODE`; temporarily set the config to
  `mon-wed-fri` and confirm it resolves to the Mon/Wed/Fri fallback text, then
  restore `daily`.
- `grep -rn "posts_per_week_target is 3\|Mon/Wed/Fri only" .` returns nothing
  that still asserts the old 3x/week behavior as current.

## Rollback

Set `channels.blog.naver_schedule` back to `"mon-wed-fri"` — a one-word config
edit; the shell's `else` branch re-enforces the original gate immediately on the
next run. (`posts_per_week_target` can be set back to 3 at the same time for
documentation accuracy, but does not affect behavior.)

## Risks / accepted tradeoffs

- **저품질 (Naver low-quality demotion):** the reason the throttle existed.
  Moving 3/week → 7/week raises automation-pattern detection risk. The user
  accepted this explicitly (2026-07-31) in exchange for a daily Naver presence.
- **Session expiry:** more frequent automated logins modestly raise the chance
  the `.naver-profile/` session lapses; already detected and surfaced as a
  failed run.
