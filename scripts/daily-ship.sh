#!/bin/bash
# Daily 6am (Sydney) unattended run of the AUSSIE UMMA ship-topic pipeline.
# Launched by ~/Library/LaunchAgents/com.aussieumma.ship-topic.plist
#
# REQUIRES at run time: the Mac awake + unlocked, and valid Playwright login
# profiles — .naver-profile/ (Naver) and .blogger-profile/ (Google/Blogger).
# Both publish headlessly, so no Chrome extension is needed.
# STILL manual: Gemini image generation needs an interactive claude-in-chrome
# session, so scheduled runs ship text-only and log the image prompts.

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

claude -p "Invoke the ship-topic skill and run the full AUSSIE UMMA pipeline end to end for today's date. This is a PRE-APPROVED unattended daily scheduled run set up by the user: SKIP the Stage 3 review gate, do NOT ask for confirmation. $NAVER_MODE Publish Instagram via the GitHub workflow. Publish Blogger with 'node scripts/post-to-blogger.mjs --date <today>' — it uses the .blogger-profile Playwright login and works headlessly, so do NOT try claude-in-chrome for it. Gemini images need an interactive session, so if unavailable just ship text-only and log the image prompts for manual follow-up. Always debug Naver fixes in --draft; never re-run the direct publish to test." \
  --permission-mode bypassPermissions >> "$LOG" 2>&1

echo "=== ship-topic run finished $(date) (exit $?) ===" >> "$LOG"
