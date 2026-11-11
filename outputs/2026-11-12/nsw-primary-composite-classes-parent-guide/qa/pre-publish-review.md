# Phase A correction QA — 2026-11-12

Topic: NSW 공립초등학교 복식학급, 다른 학년과 한 반이면 무엇이 달라질까요?
Slug: nsw-primary-composite-classes-parent-guide
Scope: correct, render, inspect, validate, commit, and push only. No channel publication and no GitHub workflow dispatch.

## Astra NO-GO correction evidence

- carousel/index.html: every citation follows the content it supports in DOM and visual order. Computed styles are body 52px, card 9 rows 52px, card 10 title 80px, and every source/disclosure 42px.
- Card 3 has one enclosing frame around its two separately outlined groups. Approved copy is unchanged.
- Rendered layout rectangles place every non-absolute content element within x=96–984 and y=210–1050; all citation tops are below the preceding content bottoms. Handles remain right=96/top=96.
- Paper/dark contrast is 17.41:1 and lime/dark is 14.20:1.
- blog/post.md: the third H2 explicitly states that students continue curriculum relevant to their Year/Stage and cites the NSW parent factsheet.
- The exact date label is “자료 확인: 2026년 11월 12일”. The exact public AI disclosure immediately follows the H1.
- The first corrected section-5 candidate was rejected because chair legs touched the lower crop boundary. It was moved to /private/tmp/section-5-rejected-clipped.png.
- The prompt was tightened to keep all chair/table legs complete, leave empty lower floor, and preserve 160px crop allowance. Only section-5.png was regenerated again.
- The accepted section-5 image has complete legs, visible lower floor, a blank notebook, and no pseudo-text, logo, UI, watermark, branded item, person, or malformed object.
- md-to-blogger was rerun after the content/image corrections. The shared converter was not edited. Only today’s blogger.html was patched so each image is immediately followed by the exact disclosure once.

## Content and factual checks

- Blog public body: 2,035 non-whitespace characters after removing headings, the source line, image prompts, and workflow checklists. This exceeds the 1,500-character minimum.
- Naver dry-run publishing representation: 4,609 characters.
- Tone scan on public text: no 합니다|됩니다|습니다|입니다|ㅠㅠ; no emoji or template markers.
- Five H2 headings appear in the approved order.
- The Year/Stage continuation paragraph is under the third H2 and supported by the NSW parent factsheet.
- The Shell Cove policy remains explicitly a one-school example. No statewide placement deadline, placement right, learning outcome guarantee, or participation statistic is claimed.
- Exact date label count: 1. Exact H1-adjacent disclosure check: PASS.

## Official source checks

All six final exact URLs returned HTTP 200:

| ID | Source | Final result |
|---|---|---|
| S1 | NSW Education parent factsheet PDF | HTTP 200; supports definition, Year/Stage-relevant curriculum, placement caveat, and differentiated learning |
| S2 | NESA NSW Curriculum structure | HTTP 200; supports Kindergarten–Year 6 stage mapping |
| S3 | NSW Education multistage programming PDF | HTTP 200; supports planning, differentiation, and assessment checkpoints |
| S4 | Shell Cove Public School placement policy PDF | HTTP 200; supports a school-specific example and no guaranteed request outcome |
| S5 | NSW Education translated-factsheet landing page | HTTP 200; resource locator only |
| S6 | Data.NSW multi-age/composite class dataset page | HTTP 200; supports the dataset definition and historical scope |

## Carousel inspection matrix

All ten corrected PNGs were rendered again and inspected individually at 1080×1350 and 360×450: 20 final-size inspections. Every card passed exact copy/order, citation-below-content placement, visible handle, exact source label, two-line AI disclosure, readability, contrast, clipping, and safe bounds.

| Card | Final inspection | SHA-256 |
|---|---|---|
| 01 | PASS — cover copy, citation below content, handle/disclosure visible | 8db6c50141dafe3de5bf626da956cf6e2c3c463d355c568685a9a739be4f61d8 |
| 02 | PASS — hook copy/emphasis, citation below content | 63f6adb81af23dd5eb37883b03e557eff5d17305ef8301417f13942696e0c87f |
| 03 | PASS — enclosing frame plus two inner frames; citation below content | 6b2e0caac52d394c2a2c8bfabe847c7c921ae3ed06516533d7632a8eeed2235b |
| 04 | PASS — four Year/Stage mappings; citation below mapping; no clipping | 0ceba5a64827fdf1bd38add2d41f6ec3ca02786e2c17467090bb20e08582d4e9 |
| 05 | PASS — 52px body; citation below body; no clipping | e2137f8649923aecf47877dba32c9c74243a20ec3046a6f370b129fc4413ca3b |
| 06 | PASS — school-specific example; citation follows framed content | ef7cdfb42badfce6ad8cda5b8973e1c2be22d64540fa140fef76e59c1ccc902c |
| 07 | PASS — both definitions readable; citation below definitions | 3613e6f6af95a86e156a0397ed98674982283eda6b6f7369ffddc9d87676981e |
| 08 | PASS — question example; citation below example | a0ebea9d42ec88b8f47f808f0bb9fd38b1d4d9a2bea9f04b6d3931c093c83407 |
| 09 | PASS — four 52px rows; citation below rows | 5ada38a26df5d531226cb160361e5043976c70f49f75ee0cc9c12ddb18d7a201 |
| 10 | PASS — 80px CTA title; body/citation/handle/disclosure visible | 766fce59c986a4820d5549bdc4656549ce4d3d5afa53fe9eadfba4d0fb931473 |

Inventory: exactly 10 PNGs; every file is 1080×1350.

## Blog image review

Correction generation result: 1 generated, 0 failed, using .gemini-profile. All three final cropped images were inspected. No logo, readable/pseudo text, fake UI, watermark, branded item, malformed object, damaged framing, or person was found.

| Image | Dimensions | SHA-256 |
|---|---:|---|
| hero.png | 1024×457 | 6393fe14683b9001a9d78535c34bb9a36760530f39acc911183565c704927180 |
| section-3.png | 1024×457 | ba7d6d1798c93cecd3ecd18369c648f0bd41fa5d51ed9439d909663591e272c7 |
| section-5.png | 1024×457 | 492abb6331cd936fcb16de44f8e473a479000f172a5185126622bbf352e0c1de |

## Blogger checks

- Exactly 3 raw GitHub image references.
- Exactly 3 exact disclosures; each is immediately adjacent after its displayed image.
- Exact disclosure: “AI 생성 일러스트예요. 실제 학교·학생을 촬영한 사진이 아니에요.”
- No prompt, self-review, publication checklist, template marker, double asterisk, or double underscore leaked.
- Blogger dry-run parsed the expected slug/title and an 8,363-character body.

## Final artifact hashes

| Artifact | SHA-256 |
|---|---|
| carousel/caption.txt | e5511ab4312d1f0391650a27f11d1ee37b3ebb9e3fff013190a2ac1443f971a8 |
| blog/blogger.html | 103ddb67e3c7668a1d4f3cac31d130efae74ece89e4a3a51eef7b1954fc15a7e |
| threads/thread.json | e093f3efb2386112449d294d76d1174444b88612e7bdcb6ed11ede6dcbe2a64a |
| blog/post.md | 652ecc7e9dff53444ad4838e8b9a7a22e1654a08fa46f0bb3b37d4af5556c708 |
| carousel/index.html | e221d15d3b1a14ef0d46c8b4a84929e11f682b7b0783b7246098f7f213ce8f8f |

## Automated verification

- node --test: 26 passed, 0 failed.
- Threads dry-run: PASS; validated 2 posts for topic 호주육아.
- Naver dry-run: PASS; 4,609 chars, 5 headings, 1 quotation, 3 images.
- Blogger dry-run: PASS; expected slug/title and 8,363-char HTML.
- Tone, placeholder, heading order, dimensions, image references, disclosure adjacency, source availability, and HTML leakage: PASS.
- Publication logs created: none.
- Public posts created: none.
- GitHub workflows dispatched: none.
