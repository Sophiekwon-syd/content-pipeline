# Phase A QA report

- Date: 2026-11-13 (Australia/Sydney)
- Topic: 호주 아이 혈액검사 준비, NSW 채혈실 예약·금식 확인법
- Slug: `nsw-child-blood-test-preparation-guide`
- Phase: generation and verification only; no platform publication and no workflow dispatch.
- Demand: search terms are editorial targets. Naver autocomplete/search demand was not verified.

## Research and editorial checks

The five official sources in `brief.md` were opened and each returned HTTP 200 on 2026-11-13. The article keeps the scope to an already-requested child blood test in NSW. It does not prescribe fasting hours or medication changes, promise appointment availability, interpret results, or generalise the Randwick floor/room details to other sites.

The public article has 1,823 non-whitespace characters after excluding the title, citations, image disclosure, date, hashtags, and workflow checklist. It has the five prescribed H2s in order. The public prose scan found no `합니다`, `됩니다`, `습니다`, `입니다`, `ㅠㅠ`, emoji, placeholder, or heading em-dash. The hero disclosure is immediately after the H1 in Markdown.

## Automated checks

- `node --test`: 26 passed, 0 failed.
- Threads dry-run: 2 posts validated for the requested slug.
- Naver dry-run: passed; 5 headings and one enquiry quote parsed.
- Blogger dry-run: passed; 7,467-character HTML payload parsed.
- Blogger HTML: 3 hosted image references; each is immediately followed by `AI로 만든 설명용 일러스트예요. 실제 인물·장소·진료 장면이 아니에요.` No workflow checklist, image prompt, or scope note leaked into the converted HTML. Five public H2s remain.
- `topic-memory.json`: 84 entries, with the 2026-11-13 topic entry exactly once. It remains unstaged and uncommitted.

## Image checks

Gemini produced exactly `hero.png`, `section-1.png`, and `section-4.png`, each 1024×457. I inspected the cropped files individually. No pseudo-text, logo, branded item, UI, watermark, border, malformed object, or framing defect was visible. The cover uses the hero only and places the required AI disclosure directly below it. Blogger has an adjacent disclosure for each of the three images.

The carousel has exactly ten PNGs, all 1080×1350. Each final card was inspected individually at 1080×1350 and at 360×450; the reduced-size derivatives are saved in `qa/card-360/`. The exact supplied copy, punctuation and numbers are visible. Handles and source labels are opaque and readable, labels follow their supporting content, and the cover illustration disclosure is adjacent. Text and meaningful graphics remain inside the 72px safe inset. There is no clipping, footer, page number, dot, logo, or emoji.

| Card | Full 1080×1350 | 360×450 | Review note |
|---|---|---|---|
| 01 | PASS | PASS | Cover, citation, hero and adjacent disclosure visible. |
| 02 | PASS | PASS | Question and source label readable. |
| 03 | PASS | PASS | Request form and booking distinction legible. |
| 04 | PASS | PASS | Fasting and medication wording legible. |
| 05 | PASS | PASS | Randwick collection room and lab floor clearly distinguished. |
| 06 | PASS | PASS | Five explanatory questions and source visible. |
| 07 | PASS | PASS | Child choice and support wording readable. |
| 08 | PASS | PASS | Results guidance and citation visible. |
| 09 | PASS | PASS | All five call rows and both source lines visible inside bounds. |
| 10 | PASS | PASS | Exact CTA and supporting copy visible. |

## Publication gate status

All Phase A artifact checks passed. After the push, each of the three public raw GitHub image URLs returned the exact SHA-256 recorded for its local reviewed image. No Naver, Blogger, Instagram, or Threads publication was attempted. No GitHub Actions workflow was dispatched, and no platform publication logs were created.
