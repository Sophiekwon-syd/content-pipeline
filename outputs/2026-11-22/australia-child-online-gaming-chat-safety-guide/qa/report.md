# QA report — 2026-11-22

Topic: 호주 아이 온라인 게임 시작 전, 채팅·친구·신고 설정 확인법  
Slug: `australia-child-online-gaming-chat-safety-guide`

## Content and factual scope

- The post covers Australian game ratings separately from chat and social features, and avoids claiming that a rating guarantees chat safety.
- Game settings are described as varying by game and device; no specific service menu, account age rule, or legal requirement is generalized.
- The post and carousel use the supplied eSafety Commissioner and Australian Classification sources. Source pages were opened and checked on 2026-11-22.
- The public article has five H2 sections, one FAQ H3, and 1,819 Korean syllables before workflow-only sections.
- The public article retains an AI-image disclosure. The image prompts and self-review are stripped from Blogger HTML by the converter.
- Tone scan: no `합니다`, `됩니다`, `습니다`, `입니다`, `ㅠㅠ`, em dash, or emoji in the blog, carousel copy, caption, and Threads artifact.

## Visual checks

- Carousel: 10 PNGs, each 1080×1350. All ten full-size cards and their 360×450 reductions were inspected; titles, body copy, and sources are inside the card bounds and readable at reduced size.
- Blog images: hero, section-1, section-3 are each 1024×457. They contain no readable game screen, logo, username, chat record, or account data. One first-pass section image with stray notebook markings was replaced with a paper-free family conversation scene.
- Blogger HTML references all three blog images.
- SHA-256 entries cover the 10 carousel PNGs and 3 blog PNGs.

## Automated checks

- `node --test`: 26 passed, 0 failed.
- Threads production dry-run: two posts validated against this brief and post.
- Naver dry-run: five article headings, one FAQ, one callout, and three images parsed.
- Blogger dry-run: title and generated HTML parsed successfully.
- Final publication status is recorded in the run report; Naver or Threads failures do not imply publication.

## Publication results

- Blogger published successfully. Public URL: https://aussieumma.blogspot.com/2026/11/blog-post_21.html. Blogger post ID: `4179372676048489242`. The article and its three image URLs returned HTTP 200.
- Instagram workflow `44955822030` succeeded for the post job. Media ID: `18117858713111541`. The workflow created and uploaded all ten child containers: `18122777735089110`, `18122777753089110`, `18122777771089110`, `18122777792089110`, `18122777816089110`, `18122777837089110`, `18122777873089110`, `18122777894089110`, `18122777912089110`, `18122777954089110`. The Instagram profile returned HTTP 200; the individual post permalink was not provided by the workflow.
- Naver direct publishing was attempted once and stopped before posting with `Could not detect blog ID — are you logged in?`. It was not retried. No Naver log was created.
- The dependent Threads job received date `2026-11-22` and slug `australia-child-online-gaming-chat-safety-guide`, and checked out commit `74b01cd9740e7e82b5dc081f3fa829091e13a788`, which contains this topic's Threads artifact. Authentication failed with OAuth code 190 because the token expired on 2026-10-19; publishing and the Threads log step were skipped.
- Publication logs present: Blogger and Instagram. Naver and Threads logs are absent because those channels did not publish.
