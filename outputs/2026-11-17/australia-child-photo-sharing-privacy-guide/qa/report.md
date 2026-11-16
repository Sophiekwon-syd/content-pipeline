# QA report — 2026-11-17

Topic: 호주 아이 사진 온라인 공유, 가족에게 보내기 전 확인할 개인정보와 동의

## Editorial and source checks

- Scope is family photo sharing and child privacy guidance in Australia. The copy does not present recommendations as universal legal duties or claim that privacy settings or deletion guarantee safety.
- Five official sources were opened and checked on 2026-11-17: eSafety Commissioner pages on child privacy, consent, personal information, and child-safe organisations; and Sport Integrity Australia guidance for children and young people.
- The public blog has 2,342 Korean syllables before the image-prompt section, exactly five public H2 headings, and one FAQ H3. Source citations are linked inline. No `[S#]` placeholders remain.
- AI-created illustrative-image disclosure is included. No personal anecdote, invented statistics, or unsupported search-volume claim was added.
- Formal endings (`합니다`, `됩니다`, `습니다`, `입니다`, `ㅠㅠ`) and em dash scan: zero matches in the public blog, caption, and Threads artifact.

## Assets

- Carousel renderer produced exactly 10 PNGs at 1080×1350. Full-size cards and 360-pixel-wide temporary thumbnails were visually checked; all card text and sources remain inside the layout and readable at reduced size. Thumbnails are in `/tmp` only.
- Gemini generated `hero.png`, `section-1.png`, and `section-3.png` through the headless `.gemini-profile` flow. The latter two were regenerated with a rear-view composition after the first visual inspection. Final images show no readable text, logos, or personal data.
- Blogger HTML was regenerated after the final image generation. It contains three raw GitHub image references and retains the AI-image and source disclosures.

## Pipeline validators

- `node --test`: 26 passed, 0 failed.
- `node scripts/post-to-threads.mjs --date 2026-11-17 --slug australia-child-photo-sharing-privacy-guide --dry-run`: passed; validated 2 posts.
- `node scripts/post-to-naver.mjs --date 2026-11-17 --slug australia-child-photo-sharing-privacy-guide --dry-run`: passed; parsed 5 headings, 1 FAQ, 1 quote, and 1 image.
- Public page URLs for all five official sources opened successfully during this QA pass.

## Publication status

- Blogger publish succeeded once. Public post: https://aussieumma.blogspot.com/2026/11/blog-post_16.html (Blogger post ID `4132990967779374609`). The public Atom feed confirmed the title, all three image references, and the AI-image disclosure.
- Fresh HTTP checks returned 200 for the Blogger post, each of its three raw GitHub image URLs, and the Instagram profile `https://www.instagram.com/aussie.umma/`.
- Instagram workflow `43968329040` succeeded for its Instagram job. It created all 10 image containers and published media ID `18434678149149428`; the Instagram job committed `instagram-log.json` as commit `97072607cc11b5c19d85ebd2ef715b97f860361f`.
- The dependent Threads job received date `2026-11-17`, slug `australia-child-photo-sharing-privacy-guide`, and checked out content commit `ad526e52a1c8946c0b23699c833111ea958a30de`, which contains the matching `threads/thread.json`. It failed at `Verify Threads authentication` with OAuth code 190 (token expired 2026-10-19); `Publish Threads artifact` and the log step were skipped. The local production dry-run did validate the artifact, but the workflow did not reach its publishing/validation step.
- The one direct Naver publish attempt failed before posting: the profile could not detect a blog ID. No Naver publication log was created and the direct command was not repeated.
- Expected date-level logs: Blogger and Instagram present; Naver and Threads absent because their single attempts failed. The workflow run is https://github.com/Sophiekwon-syd/content-pipeline/actions/runs/43968329040.
