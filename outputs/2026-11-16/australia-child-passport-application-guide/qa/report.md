# QA report — 2026-11-16

- Scope: Australian Passport Office domestic child-passport application guidance for Australian citizen children.
- Sources: all six official Australian Passport Office pages are linked in the brief and published blog; checked 2026-11-16.
- Editorial checks: blog public body 3,946 characters; exactly five public H2 sections; FAQ is H3; formal Korean endings and em dashes scan clean; no fabricated first-person experience.
- Carousel: ten rendered PNG cards, each 1080×1350. Full-size cards 1–10 reviewed; 360px previews of cards 1, 9, and 10 reviewed. Main copy and source labels remain readable, with no visible clipping or overflow.
- Blog images: hero, section-1, and section-3 generated headlessly through the `.gemini-profile` script. Images contain no legible text, logos, or personal information. They are illustrative only; the blog and cover disclose that they are AI-generated and are not real application documents or passport photos.
- Blogger conversion: rerun after image generation; generated HTML references all three raw GitHub image paths and includes the source links and AI-image disclosure.
- Threads: `threads/thread.json` passed the production dry-run validator (two posts).
- Test run: `node --test` — 26 passed, 0 failed.
- Naver and Blogger posting scripts: dry-run parsing was performed before publication. Blogger published successfully; its public post and all three hot-linked images returned HTTP 200. Instagram published successfully (media ID `17892379425686784`); its workflow log is committed. Naver's one direct attempt stopped before posting because the session's blog ID could not be detected, so no Naver log was written. The dependent Threads job received the date and slug but failed its authentication check because the access token expired; artifact publication and a Threads log were skipped. No direct Naver or Instagram/Threads workflow retry was made.
- Workflow: [run 43773323595](https://github.com/Sophiekwon-syd/content-pipeline/actions/runs/43773323595). The Instagram job uploaded 10 children and published the carousel; the Threads job failed before the artifact posting step.
