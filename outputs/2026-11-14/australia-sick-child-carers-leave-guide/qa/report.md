# Pre-publication QA — 2026-11-14

Topic: 호주 아이 아플 때 돌봄휴가, 유급·무급 carer's leave와 증빙 확인법  
Slug: `australia-sick-child-carers-leave-guide`

## Editorial and factual review

- Topic-memory review found no duplicate; the entry appears exactly once in the existing root memory and is also saved in `topic-memory-entry.json`.
- Official Fair Work Ombudsman source URLs A–E in `brief.md` were opened on 2026-11-14. Claims retain national-system scope, NSW public-sector/local-government exception, shared paid balance, unpaid-leave conditions, prompt notice, and possible short-absence evidence requests.
- Naver search demand is not verified; the query is marked as an editorial target.
- Blog has 2,047 public characters / 1,508 non-whitespace characters under the local count; no banned formal endings, `ㅠㅠ`, emojis, placeholders, or em-dashes in headings. Five required H2s are in order.
- Tests: `node --test` — 26 passed, 0 failed.
- Threads production dry-run: passed, 3 posts.
- Naver dry-run: passed, 5 headings, 3 source image assets. Parsed first body block is the exact adjacent hero disclosure. The Naver script is configured to switch AI-use marks on for every inserted image; live editor confirmation is pending publication.
- Blogger dry-run: passed. Final HTML contains exactly 3 raw image references and exactly 3 matching adjacent disclosure paragraphs; no prompt/checklist leakage.

## Image review

- Gemini generation used `node scripts/gen-images.mjs --date 2026-11-14` with `.gemini-profile`; three final image files exist. Final hero was regenerated after rejecting candidates with pseudo-text and a logo-like clothing mark. Final hero, section-2, and section-5 were visually inspected; no pseudo-text, logo, UI, border, bottom strip, watermark, or framing/anatomy defect observed.
- Final blog images: three PNGs, each 1024×457. (Hero is an explanatory illustration, not documentary photography.)
- Carousel: exactly 10 ordered PNGs; all 1080×1350. Each final PNG was opened and checked individually at full size and at 360×450 (20 inspections). Exact prescribed visible copy, citation, scope line, handle, source position, and card-1 disclosure passed. All text remained legible; measured CSS body sizes are at least 52px, source/scope/disclosure at least 36px, and titles 76–88px. Handle and content stayed within the 72px safe inset; no clipping or overflow observed.
- Temporary 360×450 inspection copies were kept under `/private/tmp/2026-11-14-carousel-360/`, outside the repository.

## Frozen asset hashes

See `qa/sha256.txt` for SHA-256 of the brief, blog, Blogger HTML, three blog images, caption, carousel source, all ten final cards, and Threads JSON. Any later content/image edit requires refreshing relevant checks and hashes.

## Publication status at QA freeze

- No publication attempt has occurred yet.
- After commit/push, verify the three remote raw GitHub image bytes match the local approved files before publishing Blogger.
- Naver direct publication is authorized once after this gate; do not retry direct publishing. Instagram workflow is authorized once with date and slug; inspect its dependent Threads job.
