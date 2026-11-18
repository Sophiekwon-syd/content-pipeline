# QA report: 2026-11-19

## Content and factual checks

- Topic and slug match the approved Astra package: `nsw-child-bike-helmet-footpath-safety-guide`.
- Blog title is correct, with five public H2 sections and one FAQ H3. The body exceeds 1,500 Korean characters.
- Scope is NSW bicycle safety. The copy distinguishes the under-10 riding guidance, the footpath exception for children under 16 and supervising adults, pedestrian crossings, helmet fit, and required bike equipment.
- Five official sources are linked. NSW rules were checked against the NSW Government page; helmet fit and removal guidance against ACCC Product Safety; the child riding and footpath guidance was checked in the official Transport for NSW PDF search result. Direct opening of that PDF returned HTTP 403 in the research viewer.
- AI-image disclosure is present. No personal riding anecdote, invented statistic, product recommendation, or claim that a helmet prevents every injury was added.
- Tone scan: no `합니다`, `됩니다`, `습니다`, `입니다`, `ㅠㅠ`, em dash, or emoji in public blog, carousel, caption, or Threads content.
- Threads production dry-run validated two posts against the brief and final blog.
- Naver dry-run parsed five headings, one FAQ, one quote, and three images.

## Visual checks

- Carousel renderer produced exactly 10 PNG cards, each 1080×1350.
- Each card was inspected at full resolution and in a 360×450 preview. Copy and footer fit within the cards; text remains legible at preview size.
- Temporary preview thumbnails were removed after inspection and are not part of the committed output.
- Three Gemini images were generated with `node scripts/gen-images.mjs --date 2026-11-19` using `.gemini-profile`. Each is 1024×457. The images show ordinary family riding scenes without legible text, logos, road signs, or identifying faces.
- `blogger.html` was regenerated after image generation; it contains five public H2 elements and references all three blog images.
- SHA-256 checksums for all 10 carousel PNGs and all three blog images are recorded in `qa/sha256.txt`.

## Tests

- `node --test`: 26 passed, 0 failed.
- Blogger dry-run passed.
- Threads production dry-run passed.
- Naver dry-run passed.
