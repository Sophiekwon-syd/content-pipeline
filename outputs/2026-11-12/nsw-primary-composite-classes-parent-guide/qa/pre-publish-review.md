# Phase A QA — 2026-11-12

Topic: NSW 공립초등학교 복식학급, 다른 학년과 한 반이면 무엇이 달라질까요?
Slug: `nsw-primary-composite-classes-parent-guide`
Scope: generation, rendering, inspection, validation, commit and push only. No channel publication or workflow dispatch.

## Content and factual checks

- Topic-memory duplicate check: no matching composite/multi-age class topic in memory or the recent-output search described in Astra’s handoff. Today’s entry appears once in `topic-memory.json`; the standalone entry is `topic-memory-entry.json`.
- Search demand: Naver autocomplete and search volume were not verified. Search terms are editorial targets only.
- Blog public body: **1,768 non-whitespace characters** after removing headings, source-line markup, image prompts, and workflow checklists; exceeds the 1,500-character minimum.
- Tone scan on public text: no `합니다|됩니다|습니다|입니다|ㅠㅠ`; no emoji or template markers.
- The five H2 headings match the approved order. No statewide class-placement deadline or right, learning outcome guarantee, participation statistic, or invented internal link is stated.
- Year/Stage are described as school year and curriculum stage. The Shell Cove policy is explicitly a single-school example. Curriculum-stage mapping is not presented as a participation statistic or procedure sequence.
- Search/autocomplete limitations are explicitly recorded in the brief.

## Official source link checks

All six exact source URLs were opened and readable during source review:

| ID | Source | Review result |
|---|---|---|
| S1 | NSW Education parent factsheet PDF | Opened; supports multi-age definition, stage-appropriate curriculum, class-placement caveat, and differentiated learning. |
| S2 | NESA NSW Curriculum structure | Opened; supports the Kindergarten–Year 6 stage mapping. |
| S3 | NSW Education multistage programming PDF | Opened; supports planning, differentiation, and assessment checkpoints as guidance. |
| S4 | Shell Cove Public School class-placement policy PDF | Opened; supports a clearly school-specific example and no guaranteed request outcome. |
| S5 | NSW Education translated-factsheet landing page | Opened as a resource locator only; no policy-change claim derived from its update date. |
| S6 | Data.NSW multi-age/composite class dataset page | Opened; supports the dataset definition and historical scope. |

Source-demand evidence is not claimed. Source facts are mapped in `brief.md`; public copy links to the primary sources beside the relevant sections.

## Carousel inspection matrix

All ten final PNGs were inspected individually at **1080×1350** and **360×450**. After the card 2 emphasis and card 6 line-wrap adjustments, the carousel was rendered again and all twenty final-size inspections were repeated. Each card passed copy/order, visible handle, exact source label, two-line AI illustration disclosure, readability, no clipping, and safe-area review. The 96px safe bounds were also checked from rendered layout rectangles; no measured element crossed x=96–984 or y=96–1254. Text uses the specified high-contrast paper/dark and lime/dark pairs; no reduced-opacity source labels.

| Card | Visual check at both sizes | SHA-256 |
|---|---|---|
| 01 | PASS — lime cover; exact title/body; visible citation, handle, disclosure | `8d5e1cbb9f0ea6950f71316ee9363fc70c5b5c181be5cbaf0e5b973faf8b054b` |
| 02 | PASS — hook; exact copy; “뜻은 아니에요.” emphasized; visible citation, handle, disclosure | `3cc17b04510460ad16e7d4d02624a02c0619a5218886040cc223c7f6c1bfdbd0` |
| 03 | PASS — two outlined groups; no invented student counts; visible citation, handle, disclosure | `e932d42518c80935a144ae64d1a45107aa6380210dd5003b0ac301a3ed72e7ed` |
| 04 | PASS — four Year/Stage mappings readable; no text clipping; visible citation, handle, disclosure | `d7f9a235ddcb3e30a8cf6a0e48d5469da5fa2461c700f9fa7d51ab1f9c62b474` |
| 05 | PASS — learning-plan statement; readable body; visible citation, handle, disclosure | `49ea30fe9a78117f769e1fd55ebaec36e318b8f7285dd662f4226315017515b8` |
| 06 | PASS — school-specific example prominent; title wraps without clipping; visible citation, handle, disclosure | `82b2d035f561a67db3fe9b4afc6f58969c5d87fd997de33dd62dff1290e877ae` |
| 07 | PASS — both Year 1/2 and Stage 1 definitions readable; visible citation, handle, disclosure | `a3c8e3821c7316769147aceac9bc827fe33d13a75aa295258278c8fe9fca1723` |
| 08 | PASS — editorial question example; no official-form implication; visible citation, handle, disclosure | `222a090173418cc43d0fd0d058250c9a75f05be1c9688b734e34c448b70cef2f` |
| 09 | PASS — four saveable questions; rows and citation readable; visible handle and disclosure | `367d72fc230e95519b7412b57136afee26c3db76922ebf9ffed064d4f3a2c581` |
| 10 | PASS — exact `저장하기 →` CTA; supporting line, citation, handle, and disclosure visible | `fdb548f4fb443bb2e537831814e0f09867f6f929fd0c3355ff42e85e7682acda` |

Exact card PNG inventory: 10 files, all 1080×1350. No added page numbers, carousel dots, logos, or extra text.

## Blog image review

Gemini command: `node scripts/gen-images.mjs --date 2026-11-12` using `.gemini-profile`; result: **3 generated, 0 failed**. Each cropped output was inspected individually. No visible logo, readable or pseudo text, fake UI, watermark residue, branded item, malformed person/object, or damaged framing was found. Files are clearly editorial illustrations; disclosure is present next to each Blogger image.

| Image | Dimensions | SHA-256 |
|---|---:|---|
| `hero.png` | 1024×457 | `6393fe14683b9001a9d78535c34bb9a36760530f39acc911183565c704927180` |
| `section-3.png` | 1024×457 | `ba7d6d1798c93cecd3ecd18369c648f0bd41fa5d51ed9439d909663591e272c7` |
| `section-5.png` | 1024×457 | `eb90037dbecc5f50127d66a9992c7a782106fd9b7c8449ab5f72cd8873766724` |

## Threads, Naver, and Blogger checks

- Threads dry-run: PASS; artifact validates two posts for topic `호주육아`.
- Naver dry-run: PASS; five headings, one parent-question quotation, three detected image assets. No direct Naver post was attempted.
- Blogger dry-run: PASS; expected slug and title, generated HTML parsed.
- `blogger.html`: three raw GitHub image references, each immediately followed by the exact disclosure `AI 생성 일러스트예요. 실제 학교·학생을 촬영한 사진이 아니에요.` No image prompts, review checklists, visible Markdown emphasis markers, or template placeholders leaked.
- `md-to-blogger.mjs` was run after image generation. Only today’s generated `blogger.html` received the three disclosure paragraphs; the shared converter was not edited.

## Automated verification

- `node --test`: **26 passed, 0 failed**.
- Threads production validator dry-run: PASS.
- Public-text tone, emoji, placeholder, heading-order, image-count, disclosure-count, and HTML leakage checks: PASS.
- No publication log or public post was created; no GitHub workflow was dispatched.
