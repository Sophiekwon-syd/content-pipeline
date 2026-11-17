# QA Report — 2026-11-18

Topic: 호주 신생아 Medicare 등록, 출생 후 준비할 서류와 myGov 확인 순서  
Slug: `australia-newborn-medicare-enrolment-guide`

## Editorial and source checks

- Research is limited to the four Services Australia pages linked in `brief.md` and the post.
- Blog scope is Australian-born newborn Medicare enrolment. Overseas birth, adoption, surrogacy and payment eligibility are referred back to their separate official guidance.
- Blog public article has 5 H2 sections and 1 FAQ H3. Public body has over 1,500 Korean syllables.
- The physical card estimate is qualified as usual guidance, not a delivery guarantee. Medicare Safety Net family-change notification is described separately from enrolment.
- Tone scan on public blog, caption, carousel and Threads artifact: no formal endings, `ㅠㅠ`, em dash or emoji found.
- AI image disclosure is present in blog and Blogger HTML.

## Asset checks

- Carousel: 10 rendered PNGs; each 1080×1350. Reviewed at full size and 360px previews; text is legible and no copy is clipped.
- Blog images: hero, section-1 and section-3; each 1024×457. Visual review found no legible personal or medical information, government branding or card numbers.
- Blogger HTML was regenerated after image generation and contains 3 image references.
- All 13 image SHA-256 values are recorded in `qa/sha256.txt`.
- No temporary 360px preview images are stored in the output folder.

## Validator and pre-publish checks

- Threads production dry-run: 2 posts, passed.
- Naver dry-run: 5 headings, 1 FAQ, 1 disclosure quote and 3 blog images parsed.
- Blogger dry-run: HTML prepared after the final image conversion.
- Full test suite: 26 passed, 0 failed.

## Publication status

- Blogger published successfully. Public URL: https://aussieumma.blogspot.com/2026/11/medicare-mygov.html. Feed post ID: `5922907163086217002`. The feed shows the AI disclosure and three image references.
- Instagram workflow `44188310250` completed the Instagram job successfully. Published media ID: `17944448022380575`. Ten child containers were created, in order: `18122261711089110`, `18122261729089110`, `18122261747089110`, `18122261765089110`, `18122261783089110`, `18122261813089110`, `18122261888089110`, `18122261945089110`, `18122261969089110`, `18122261996089110`.
- The dependent Threads job checked out commit `7bf175d922a494bcd456f44198e76a5bfa4c1be3`, which contains this slug's `threads/thread.json`, and received the requested date and slug. Threads authentication failed with OAuth error 190 because the token expired on 2026-10-19. Artifact publication and Threads log steps were skipped. No Threads post or log exists.
- The single authorized direct Naver attempt stopped before publication with `Could not detect blog ID — are you logged in?`. It was not repeated. No Naver log exists.
- Date-level logs present: Blogger and Instagram. Naver and Threads logs are absent because their publish steps did not complete.
