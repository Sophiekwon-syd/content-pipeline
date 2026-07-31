# Naver Daily Cadence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the unattended daily run publish to Naver every day (like Blogger + Instagram), driven by a `config.json` switch so cadence can be reverted with a one-word edit.

**Architecture:** Add a `channels.blog.naver_schedule` enum (`"daily" | "mon-wed-fri"`) to `config.json`. `scripts/daily-ship.sh` reads it with `node` and branches: `daily` → always publish Naver; otherwise the existing Mon/Wed/Fri gate runs unchanged. The skill + three docs/comments are updated so the unattended agent never receives contradictory cadence instructions.

**Tech Stack:** Bash, Node.js (ESM `.mjs` scripts), JSON config, Markdown docs.

## Global Constraints

- **No unit-test harness exists in this repo.** Verification is via `bash -n`, `node -e/-p`, and `grep` commands shown per task — do not invent a test framework.
- **Never run `scripts/daily-ship.sh` or `scripts/post-to-naver.mjs` for real during this work** — they publish live content. Verify with the safe commands only.
- **One commit per file** (brand rule). Each task below touches exactly one file and makes exactly one commit.
- **No `Co-Authored-By` trailers** in commit messages (brand rule).
- Commit messages use the exact strings given in each task.
- `config.json`, `CLAUDE.md`, `content-strategy.md`, and the skill/comment are English/internal — the "no em-dashes in Korean copy" rule does not apply; match each file's existing punctuation.
- Working directory for all commands: `/Users/sophiekwon/projects/content-pipeline`.

---

### Task 1: Add the `naver_schedule` switch to `config.json`

**Files:**
- Modify: `config.json` (the `channels.blog` block, currently lines 44–49)

**Interfaces:**
- Produces: `channels.blog.naver_schedule` (string, `"daily"`) and `channels.blog.posts_per_week_target` (number, `7`). Every later task reads or documents these exact keys/values.

- [ ] **Step 1: Edit the `blog` block**

In `config.json`, replace:

```json
    "blog": {
      "enabled": true,
      "platform": "naver",
      "category": "호주육아",
      "posts_per_week_target": 3
    },
```

with:

```json
    "blog": {
      "enabled": true,
      "platform": "naver",
      "category": "호주육아",
      "posts_per_week_target": 7,
      "naver_schedule": "daily"
    },
```

- [ ] **Step 2: Verify the JSON is valid and the values are correct**

Run:
```bash
node -e "const b=require('./config.json').channels.blog; console.log(b.naver_schedule, b.posts_per_week_target); if(b.naver_schedule!=='daily'||b.posts_per_week_target!==7) process.exit(1)"
```
Expected: prints `daily 7` and exits 0. (If the file had a syntax error, `require` throws — that also fails the step.)

- [ ] **Step 3: Commit**

```bash
git add config.json
git commit -m "config: add naver_schedule switch (daily), set posts_per_week_target=7"
```

---

### Task 2: Make `daily-ship.sh` read the switch and branch

**Files:**
- Modify: `scripts/daily-ship.sh` (the Naver-cadence gate, currently lines 22–30)

**Interfaces:**
- Consumes: `channels.blog.naver_schedule` from `config.json` (Task 1).
- Produces: the `NAVER_MODE` string passed into the `claude -p` prompt — daily-publish text when the switch is `"daily"`, otherwise the original Mon/Wed/Fri gate text.

- [ ] **Step 1: Replace the cadence gate**

In `scripts/daily-ship.sh`, replace:

```bash
# Naver cadence (validated strategy): publish to Naver only Mon/Wed/Fri to
# match posts_per_week_target=3 and stay under automation-pattern detection.
# Blogger + Instagram ship every day.
DOW=$(date +%u) # 1=Mon .. 7=Sun
if [ "$DOW" = "1" ] || [ "$DOW" = "3" ] || [ "$DOW" = "5" ]; then
  NAVER_MODE="Today IS a Naver day (Mon/Wed/Fri): publish directly to Naver as well."
else
  NAVER_MODE="Today is NOT a Naver day: SKIP Naver entirely (no draft, no publish) — ship Blogger + Instagram only. The topic's Naver version ships on the next Mon/Wed/Fri run only if still fresh; otherwise it lives on Blogger/IG alone."
fi
```

with:

```bash
# Naver cadence is config-driven: channels.blog.naver_schedule in config.json.
#   "daily"       -> publish to Naver every day (same as Blogger + Instagram)
#   "mon-wed-fri" -> the old gate: Naver only Mon/Wed/Fri (anti-automation-detection)
# Blogger + Instagram ship every day regardless.
NAVER_SCHEDULE=$(node -p "require(process.argv[1]).channels.blog.naver_schedule || 'mon-wed-fri'" "$PROJECT/config.json")
if [ "$NAVER_SCHEDULE" = "daily" ]; then
  NAVER_MODE="Today is on the NAVER-DAILY schedule (naver_schedule=daily): publish directly to Naver as well, every day — same as Blogger and Instagram."
else
  DOW=$(date +%u) # 1=Mon .. 7=Sun
  if [ "$DOW" = "1" ] || [ "$DOW" = "3" ] || [ "$DOW" = "5" ]; then
    NAVER_MODE="Today IS a Naver day (Mon/Wed/Fri): publish directly to Naver as well."
  else
    NAVER_MODE="Today is NOT a Naver day: SKIP Naver entirely (no draft, no publish) — ship Blogger + Instagram only. The topic's Naver version ships on the next Mon/Wed/Fri run only if still fresh; otherwise it lives on Blogger/IG alone."
  fi
fi
```

Note: `$PROJECT` is already defined near the top of the script (`PROJECT="/Users/sophiekwon/projects/content-pipeline"`), so `$PROJECT/config.json` is an absolute path and `require` resolves it regardless of cwd.

- [ ] **Step 2: Verify the shell syntax**

Run:
```bash
bash -n scripts/daily-ship.sh && echo SYNTAX_OK
```
Expected: prints `SYNTAX_OK`.

- [ ] **Step 3: Verify the switch resolves to `daily`**

Run the exact command the script uses:
```bash
node -p "require(process.argv[1]).channels.blog.naver_schedule || 'mon-wed-fri'" "$PWD/config.json"
```
Expected: prints `daily`.

- [ ] **Step 4: Verify the `mon-wed-fri` fallback resolves too**

Confirm the `else` branch's gate still reads correctly by pointing the same command at a temp config, without touching the real one:
```bash
node -e "const c=require('./config.json'); c.channels.blog.naver_schedule='mon-wed-fri'; require('fs').writeFileSync('/tmp/naver-test-config.json', JSON.stringify(c))"
node -p "require(process.argv[1]).channels.blog.naver_schedule || 'mon-wed-fri'" "/tmp/naver-test-config.json"
rm -f /tmp/naver-test-config.json
```
Expected: prints `mon-wed-fri`. (This exercises the value that routes into the retained `else` branch.)

- [ ] **Step 5: Verify both branches are present in the file**

Run:
```bash
grep -c "naver_schedule=daily" scripts/daily-ship.sh; grep -c "NOT a Naver day" scripts/daily-ship.sh
```
Expected: `1` then `1` (the daily branch text and the retained fallback text both exist).

- [ ] **Step 6: Commit**

```bash
git add scripts/daily-ship.sh
git commit -m "ship: drive Naver cadence from config naver_schedule (daily default)"
```

---

### Task 3: Update `ship-topic` skill's Stage 5 report line

**Files:**
- Modify: `.claude/skills/ship-topic/SKILL.md` (line 81, under `## Stage 5 — Report`)

**Interfaces:**
- Consumes: the `channels.blog.naver_schedule` concept from Task 1.
- Produces: skill text that no longer caps Naver at 3/week, so the unattended agent won't contradict the daily behavior.

- [ ] **Step 1: Replace the report line**

In `.claude/skills/ship-topic/SKILL.md`, replace:

```
Remind: posts_per_week_target is 3 — don't ship more than that.
```

with:

```
Naver cadence is config-driven: read `channels.blog.naver_schedule` (`"daily"` = every day, the current setting; `"mon-wed-fri"` = the old Mon/Wed/Fri gate). Publish Naver on whatever days that setting specifies — do not cap it at a fixed weekly number.
```

- [ ] **Step 2: Verify the old cap is gone and the new text is present**

Run:
```bash
grep -c "posts_per_week_target is 3" .claude/skills/ship-topic/SKILL.md; grep -c "naver_schedule" .claude/skills/ship-topic/SKILL.md
```
Expected: `0` then `1` (or more).

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/ship-topic/SKILL.md
git commit -m "skill: Naver cadence is config-driven, not capped at 3/week"
```

---

### Task 4: Update the Naver caution in `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (the Naver upload caution, currently lines 200–201)

**Interfaces:**
- Consumes: the `channels.blog.naver_schedule` concept from Task 1.
- Produces: project-instruction text (loaded into every agent run) that points at the config switch instead of a fixed weekly volume.

- [ ] **Step 1: Replace the caution lines**

In `CLAUDE.md`, replace:

```
- Caution: Naver detects automation — keep volume at posts_per_week_target
  and prefer draft + manual final publish
```

with:

```
- Caution: Naver detects automation. Cadence is config-driven via
  `channels.blog.naver_schedule` ("daily" — chosen 2026-07-31 with the 저품질
  risk accepted — or "mon-wed-fri" for the old throttled gate). Regardless of
  cadence, prefer draft + manual final publish when debugging.
```

- [ ] **Step 2: Verify**

Run:
```bash
grep -c "naver_schedule" CLAUDE.md; grep -c "keep volume at posts_per_week_target" CLAUDE.md
```
Expected: `1` (or more) then `0`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: point Naver cadence caution at config naver_schedule"
```

---

### Task 5: Rewrite the Cadence section in `content-strategy.md`

**Files:**
- Modify: `content-strategy.md` (the `## Cadence` section, currently lines 57–62)

**Interfaces:**
- Consumes: the `channels.blog.naver_schedule` concept from Task 1.
- Produces: strategy doc reflecting daily Naver, with the old Mon/Wed/Fri strategy marked superseded.

- [ ] **Step 1: Replace the Cadence section**

In `content-strategy.md`, replace:

```
## Cadence [채택됨 2026-07-18]

Naver publishes Mon/Wed/Fri only (matches posts_per_week_target=3, avoids
automation-pattern detection). The daily 6am run ships Blogger + Instagram
every day; `scripts/daily-ship.sh` enforces the Naver day gate. Manual
user-invoked /ship-topic runs publish wherever the user says, any day.
```

with:

```
## Cadence [updated 2026-07-31]

Naver now publishes every day, same as Blogger + Instagram. Cadence is
config-driven via `channels.blog.naver_schedule` ("daily" | "mon-wed-fri"),
read by `scripts/daily-ship.sh`; `posts_per_week_target` is 7. This supersedes
the earlier Mon/Wed/Fri-only gate [채택됨 2026-07-18], which throttled Naver to
avoid automation-pattern detection — the daily cadence was chosen 2026-07-31
with that 저품질 risk knowingly accepted. Manual user-invoked /ship-topic runs
publish wherever the user says, any day.
```

- [ ] **Step 2: Verify**

Run:
```bash
grep -c "naver_schedule" content-strategy.md; grep -c "publishes Mon/Wed/Fri only" content-strategy.md
```
Expected: `1` (or more) then `0`.

- [ ] **Step 3: Commit**

```bash
git add content-strategy.md
git commit -m "docs: Naver cadence now daily via config switch (supersedes Mon/Wed/Fri)"
```

---

### Task 6: Update the bot-detection comment in `post-to-naver.mjs`

**Files:**
- Modify: `scripts/post-to-naver.mjs` (the `NOTE ON BOT DETECTION` header comment, currently lines 23–28)

**Interfaces:**
- Consumes: the `channels.blog.naver_schedule` concept from Task 1.
- Produces: a header comment clarifying the script is per-run (cadence is decided by the scheduler), so a future reader doesn't re-add a cap here.

- [ ] **Step 1: Replace the comment block**

In `scripts/post-to-naver.mjs`, replace:

```
// NOTE ON BOT DETECTION: Naver actively detects automation. This script uses
// a real (headed) browser, a persistent logged-in profile, and human-like
// typing delays to stay low-profile, but automated posting is against the
// spirit of Naver's ToS and carries account-restriction risk. Keep volume
// low (their own posts_per_week_target is 3) and prefer --draft + manual
// final publish if you want to be safe.
```

with:

```
// NOTE ON BOT DETECTION: Naver actively detects automation. This script uses
// a real (headed) browser, a persistent logged-in profile, and human-like
// typing delays to stay low-profile, but automated posting is against the
// spirit of Naver's ToS and carries account-restriction risk. Cadence is NOT
// enforced here (this script is per-run); the daily scheduler decides via
// channels.blog.naver_schedule in config.json. Daily Naver posting was chosen
// 2026-07-31 with that risk accepted; prefer --draft + manual final publish
// when debugging.
```

- [ ] **Step 2: Verify the script still parses**

Run:
```bash
node --check scripts/post-to-naver.mjs && echo PARSE_OK
```
Expected: prints `PARSE_OK`. (Confirms the comment edit didn't break the module.)

- [ ] **Step 3: Verify**

Run:
```bash
grep -c "naver_schedule" scripts/post-to-naver.mjs; grep -c "posts_per_week_target is 3" scripts/post-to-naver.mjs
```
Expected: `1` (or more) then `0`.

- [ ] **Step 4: Commit**

```bash
git add scripts/post-to-naver.mjs
git commit -m "naver: clarify cadence is scheduler-driven, not enforced in-script"
```

---

### Final verification (no commit)

- [ ] **Run the whole-repo consistency check**

Run:
```bash
bash -n scripts/daily-ship.sh && echo SHIP_OK
node -e "const b=require('./config.json').channels.blog; if(b.naver_schedule!=='daily'||b.posts_per_week_target!==7) process.exit(1)" && echo CONFIG_OK
node --check scripts/post-to-naver.mjs && echo NAVER_PARSE_OK
grep -rn "posts_per_week_target is 3" . --include="*.md" --include="*.sh" --include="*.mjs" | grep -v node_modules || echo NO_STALE_CAP
```
Expected: `SHIP_OK`, `CONFIG_OK`, `NAVER_PARSE_OK`, then `NO_STALE_CAP` (no remaining file asserts the old "is 3" cap as current).

- [ ] **Confirm the daily branch is what the scheduler will use**

Run:
```bash
node -p "require(process.argv[1]).channels.blog.naver_schedule || 'mon-wed-fri'" "$PWD/config.json"
```
Expected: `daily`.

Full end-to-end confirmation (that Naver actually publishes on a non-Mon/Wed/Fri day) happens on the next scheduled run, or by manually running `node scripts/post-to-naver.mjs --date <today> --draft` on such a day and inspecting the draft — that is out of scope for this plan and publishes nothing live.
