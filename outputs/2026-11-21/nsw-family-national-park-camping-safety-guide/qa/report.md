# QA report — 2026-11-21

## Editorial and factual review

- 주제는 NSW National Parks 캠프장 준비로 한정했고, 최근 topic-memory의 자전거·Medicare·여권·사진 공유 주제와 구분했어요.
- 공식 자료를 확인해 예약이 필요할 수 있는 점, 대부분 캠프장의 식수 부재 가능성, 공원 알림·날씨 확인, 울타리 없는 물가에서 아이 감독, 지정 화로 및 화기 금지, 텐트 내 조리·난방 금지를 반영했어요.
- Total Fire Ban과 공원 화기 금지의 적용 차이 및 방문객 소유 기구의 일반 제한을 함께 적었어요. 현장과 당일 안내 확인을 유지했어요.
- 블로그 공개 H2 5개, FAQ H3 1개, AI 예시 이미지 고지와 네 공식 출처 링크를 확인했어요.
- Thread artifact의 2개 게시물이 brief/post에 있는 주장만 사용하는지 production dry-run으로 확인했어요.

## Carousel and images

- Carousel: 10 PNG cards, each 1080×1350. Full-size review covered all cards; 360px-wide previews were checked for cards 2, 8 and 9. Text and source labels remained within card bounds; no text was clipped.
- Blog images: hero, section-1 and section-3 are 1024×457. Reviewed all three: no readable signs, logos, personal information, active fire or unsafe cooking depiction. Faces are not identifiable.
- Blogger HTML was regenerated after Gemini images and contains exactly 3 image references with descriptive alt text.
- PNG SHA-256 values are recorded in `sha256.txt`.

## Automated checks

- `node --test`: 26 passed, 0 failed.
- `node scripts/post-to-threads.mjs --date 2026-11-21 --slug nsw-family-national-park-camping-safety-guide --dry-run`: 2 posts validated.
- Naver `--dry-run`: parses the title, five H2 sections, FAQ and image prompt exclusion without opening a browser.
- Blogger `--dry-run`: reports the expected slug and generated HTML after conversion.
- Public post tone scan: no `합니다`, `됩니다`, `습니다`, `입니다`, `ㅠㅠ`, em dash or emoji.

## Sources checked on 2026-11-21

- NSW National Parks, [Camping safety](https://www.nationalparks.nsw.gov.au/safety/camping-safety)
- NSW National Parks, [Total Fire Bans and park fire bans](https://www.nationalparks.nsw.gov.au/conservation-and-heritage/~/~/link.aspx?_id=42DB87EF677F493A9EDD141541FF45B3&_z=z)
- NSW Rural Fire Service, [Total Fire Ban rules](https://www.rfs.nsw.gov.au/fire-information/fdr-and-tobans/total-fire-ban-rules)
- NSW Government, [Visit a national park](https://www.nsw.gov.au/visiting-and-exploring-nsw/visit-a-national-park)
