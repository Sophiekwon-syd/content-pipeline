#!/usr/bin/env bash
# Rebuild the weekly deals page from the CURRENT scraped data (no network).
# Run after a fresh scrape, or any time you edit categories.json / the builders.
#   ./features/supermarket-deals-carousel/build.sh
# For a full weekly refresh (scrape + build) use the /deals-carousel skill,
# or: npm run deals:all  (pass the current Coles saleId: add --sale to deals:scrape).
set -euo pipefail
cd "$(dirname "$0")/../.."          # repo root (scripts resolve paths from here)

echo "→ combining Coles + Woolworths data…"
node features/supermarket-deals-carousel/build-combined.mjs

echo "→ rendering weekly-deals.html…"
node features/supermarket-deals-carousel/build-deals-page.mjs

echo "✓ done → features/supermarket-deals-carousel/weekly-deals.html"
