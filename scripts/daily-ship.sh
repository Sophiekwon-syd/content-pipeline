#!/bin/bash
# Daily 6am (Sydney) unattended run of the AUSSIE UMMA ship-topic pipeline.
# Launched by ~/Library/LaunchAgents/com.aussieumma.ship-topic.plist
#
# REQUIRES at run time: the Mac awake + unlocked, Chrome running and logged
# into Gemini and Blogger, and a valid Naver login profile (.naver-profile/).
# Browser steps can't run without a live GUI session — if Chrome/logins aren't
# available, the run still generates content, pushes to GitHub, and posts
# Instagram, then logs what needs manual publishing.

set -o pipefail
PROJECT="/Users/sophiekwon/projects/content-pipeline"
cd "$PROJECT" || exit 1

export PATH="/Users/sophiekwon/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

mkdir -p "$PROJECT/logs"
LOG="$PROJECT/logs/ship-$(date +%Y-%m-%d-%H%M).log"

echo "=== ship-topic run started $(date) ===" >> "$LOG"

claude -p "Invoke the ship-topic skill and run the full AUSSIE UMMA pipeline end to end for today's date. This is a PRE-APPROVED unattended daily scheduled run set up by the user: SKIP the Stage 3 review gate, do NOT ask for confirmation, and publish directly to Naver, Instagram, and Blogger. It needs Chrome running and logged into Gemini/Blogger and a valid Naver profile. If any browser step is unavailable, generate everything you can, push to GitHub, post Instagram via the workflow, and clearly log what still needs manual publishing. Always debug Naver fixes in --draft; never re-run the direct publish to test." \
  --permission-mode bypassPermissions >> "$LOG" 2>&1

echo "=== ship-topic run finished $(date) (exit $?) ===" >> "$LOG"
