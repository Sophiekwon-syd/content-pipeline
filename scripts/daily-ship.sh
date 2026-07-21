#!/bin/bash
# Daily 6am (Sydney) unattended run of the AUSSIE UMMA ship-topic pipeline.
# Launched by ~/Library/LaunchAgents/com.aussieumma.ship-topic.plist
#
# REQUIRES at run time: the Mac awake + unlocked, and valid Playwright login
# profiles — .naver-profile/ (Naver) and .blogger-profile/ (Google/Blogger).
# Both publish headlessly, so no Chrome extension is needed.
# Images: scripts/gen-images.mjs generates them headlessly via .gemini-profile,
# so scheduled runs now ship WITH images (no interactive session needed).

set -o pipefail
PROJECT="/Users/sophiekwon/projects/content-pipeline"
cd "$PROJECT" || exit 1

export PATH="/Users/sophiekwon/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

mkdir -p "$PROJECT/logs"
LOG="$PROJECT/logs/ship-$(date +%Y-%m-%d-%H%M).log"

echo "=== ship-topic run started $(date) ===" >> "$LOG"

# Naver cadence (validated strategy): publish to Naver only Mon/Wed/Fri to
# match posts_per_week_target=3 and stay under automation-pattern detection.
# Blogger + Instagram ship every day.
DOW=$(date +%u) # 1=Mon .. 7=Sun
if [ "$DOW" = "1" ] || [ "$DOW" = "3" ] || [ "$DOW" = "5" ]; then
  NAVER_MODE="Today IS a Naver day (Mon/Wed/Fri): publish directly to Naver as well."
else
  NAVER_MODE="Today is NOT a Naver day: SKIP Naver entirely (no draft, no publish) — ship Blogger + Instagram only. The topic's Naver version ships on the next Mon/Wed/Fri run only if still fresh; otherwise it lives on Blogger/IG alone."
fi

claude -p "Invoke the ship-topic skill and run the full AUSSIE UMMA pipeline end to end for today's date. This is a PRE-APPROVED unattended daily scheduled run set up by the user: SKIP the Stage 3 review gate, do NOT ask for confirmation. $NAVER_MODE Publish Instagram via the GitHub workflow. Generate blog images with 'node scripts/gen-images.mjs --date <today>' (headless via .gemini-profile), then re-run scripts/md-to-blogger.mjs so blogger.html picks them up. Publish Blogger with 'node scripts/post-to-blogger.mjs --date <today>' (headless via .blogger-profile). Do NOT use claude-in-chrome for any of this — it is not available in a scheduled session. Always debug Naver fixes in --draft; never re-run the direct publish to test." \
  --permission-mode bypassPermissions >> "$LOG" 2>&1
CLAUDE_EXIT=$?

echo "=== ship-topic run finished $(date) (exit $CLAUDE_EXIT) ===" >> "$LOG"

# Detect silent failures the CLI exit code masks (auth expiry, empty run).
# A real run creates today's output dir; if it didn't, flag it loudly so the
# run shows as failed instead of a misleading success.
TODAY=$(date +%Y-%m-%d)
if grep -qiE 'failed to authenticate|oauth session expired|not logged in' "$LOG"; then
  echo "!!! FAILURE: Claude auth expired — run 'claude' interactively to re-login. No content produced." >> "$LOG"
  exit 1
fi
if [ ! -d "$PROJECT/outputs/$TODAY" ]; then
  echo "!!! FAILURE: no outputs/$TODAY produced — run did not generate a topic." >> "$LOG"
  exit 1
fi
exit "$CLAUDE_EXIT"
