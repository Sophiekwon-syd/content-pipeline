# Feature: Supermarket Deals Carousel (Coles vs Woolworths)

Status: PLAN — not yet built. Branch: `feature/supermarket-deals-carousel`.
Ad-hoc / manually triggered — NOT part of the daily 1 AM ship-topic schedule.

## What it is

A weekly Instagram carousel showing **what's actually on sale this week at Coles
and Woolworths** — each store discounts DIFFERENT products, so this is not a
same-item price battle. Deals are grouped loosely by category (아이스크림, 우유,
과자…), **1-2 categories per slide**, each showing the real on-sale products
(photo, was→now price, short Korean comment). Save-bait + share-bait in the
proven @ko.au.ji lane (their supermarket-deals posts drive their growth).

Reference: @ko.au.ji weekly "기간제 할인 품목" posts + product-card style
(product photo, was→now price pill, Korean bullet commentary).

## Decisions locked (2026-07-22, revised)

- **Format: each store's OWN weekly sale items, grouped by category.** NOT a
  same-product comparison — Coles and Woolies rarely discount the identical
  item, so we show whatever each store actually has on sale, laid out so a
  reader can eyeball both stores' deals in a category. Some categories may have
  only one store's deal; some slides may not map cleanly to a category at all.
- **Layout: 1-2 categories per slide.** A slide = 1-2 category blocks; each block
  lists that category's on-sale products from Coles and/or Woolworths.
- **No computed "winner."** The value is "here's what's on sale where," not who's
  cheaper (different products can't be fairly compared on price).
- **Data: manual-first, scraper in Phase 2.** Phase 1 renders from a hand-filled
  weekly data file (zero ToS risk, proves the design fast). Phase 2 adds a
  scraper to auto-fill.
- **Stores:** Coles + Woolworths for v1. ALDI is a later add (3rd column).
- **Channel:** Instagram carousel only for v1 (that's where deals content lives).
  Naver/Blogger optional later.

## NON-NEGOTIABLE: prices must be real

This is the vitamin-D / tax-stat lesson applied to money. A deals post with a
WRONG PRICE destroys trust instantly and is worse than no post. Therefore:
- Every price is entered from the real current catalogue, with the week's date
  range stamped on the cover ("2026년 7월 22일~28일 기준").
- **Product images must be REAL** (from the store listing or user-supplied) —
  NOT Gemini-generated. Fake product shots next to real prices are misleading.
  This is the key difference from the editorial blog pipeline.
- No fabricated "winner" — if a category has no clear cheaper option that week,
  drop it rather than invent one.

## Phase 1 — design + manual data + render + publish (this branch)

### Data schema — one file per week
`features/supermarket-deals-carousel/data/<YYYY-MM-DD>.json`
Organized by category; each category holds each store's actual on-sale items
(different products). A slide renders 1-2 categories.
```json
{
  "week_start": "2026-07-22",
  "week_end": "2026-07-28",
  "source_note": "Coles/Woolworths 온라인 카탈로그, 2026-07-22 확인",
  "categories": [
    {
      "category": "아이스크림",
      "coles":   [ { "product": "Streets Blue Ribbon 4L", "was": 12.00, "now": 7.00,
                     "image": "images/streets.jpg", "comment": "4L라 여름 가성비 최고" } ],
      "woolies": [ { "product": "Bulla Ice Cream 2L",     "was": 11.00, "now": 6.50,
                     "image": "images/bulla.jpg",   "comment": "부드럽고 애들이 좋아해요" } ]
      // either store's list may be empty for a category
    }
  ]
}
```
No winner field — we display each store's real deals, not a comparison verdict.

### Card design (dedicated "deals" style, distinct from the dark editorial brand)
Lighter, product-forward look (like the reference's white product cards), NOT the
dark-modern editorial carousel. Proposed:
- **Cover**: date range + "이번 주 콜스 · 울월스 세일 품목" + cart motif. @aussie.umma handle.
- **Deal slides** (1-2 categories each): category label as a section header; under
  it, the on-sale products as small cards (product photo, name, was→now price
  pill), each tagged by store colour (**Coles red #E01A22**, **Woolies green
  #178841**) so the eye separates them. Short Korean comment per product.
- **Sheet (save-bait)**: one-glance list — every category + the standout deals.
- **CTA**: config `content.cta_text` ("저장하기 →").
Keep 1080×1350, @aussie.umma handle top-right, no emojis (brand rule), no dots.
(Light card style is the one open design call — confirm at build time.)

### Scripts
- `scripts/build-deals-carousel.mjs --week <date>` → reads the week's data JSON,
  emits `outputs/<date>/deals-coles-woolies/carousel/index.html` with real
  product images inlined (data URI or copied into images/).
- Then reuse the EXISTING pipeline: `scripts/render-carousel.mjs` → PNGs, and the
  Instagram GitHub Action for publishing (identical to the content carousels).
- Ad-hoc trigger: a `/deals-carousel` skill (or just run the script) — never on
  the cron. Caption = date range + "이번 주 최저가 비교" + config IG hashtags +
  a "가격은 발행일 기준, 매장·지역별로 다를 수 있어요" disclaimer.

### Phase 1 deliverable
Run it for THIS week with 5–8 hand-filled categories + your product photos →
one polished, price-accurate comparison carousel published to Instagram.

## Phase 2 — scraper (separate follow-up, after design is proven)

- Pull weekly specials from Coles + Woolworths (unofficial app/specials
  endpoints or the SaleFinder catalogue feed) into the same weekly JSON schema,
  so Phase 1's renderer is unchanged.
- **ToS reality:** scraping their sites breaches their ToS. At weekly, low-volume,
  read-only scale for a small info account the practical risk is low (this is
  what @ko.au.ji effectively does), but: keep volume tiny, cache aggressively,
  respect robots where feasible, and treat it as best-effort (it WILL break when
  they change their markup — manual entry stays the reliable fallback).
- Product images from listings carry their own reuse question — safest is still
  user/own photos or clearly-attributed catalogue thumbnails.
- Category/product matching across two stores is the hard part; start with a
  small fixed staples list (milk, eggs, ice cream, bananas, chicken, bread…)
  and match by that list, not by trying to reconcile full catalogues.

## Out of scope (v1)
ALDI 3rd column, Naver/Blogger mirror, historical price tracking, auto-scheduling.

## Open design call for build time
Light product-card style (reference look) vs adapting the dark brand system —
recommend the light look for deals; confirm when we build the first card.
