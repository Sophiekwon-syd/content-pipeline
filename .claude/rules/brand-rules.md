# Brand Rules

These rules apply to every agent in the pipeline. No exceptions.

## Content rules

- **No emojis** — not in headings, body text, CTAs, labels, or anywhere else
- **No placeholder text** — every field in the output must contain real, audience-appropriate copy
- **Product mentions**: institutional/service names are fine. Specific product
  brands are allowed ONLY in 육아용품 리뷰 posts (honest 한국 vs 호주 comparison,
  장단점 both sides, no fabricated personal-use claims). Elsewhere, refer to
  categories, not specific products.
- **Affiliate (쿠팡파트너스)**: links only when `config.json →
  monetization.coupang_partners_id` is set; the exact `monetization.disclosure`
  sentence is MANDATORY on any post with links; links go in Blogger + Instagram
  only — NEVER raw 쿠팡 links inside Naver posts (저품질 demotion risk).
- **No absolute claims without sources** — if using a statistic, cite it
- **Topics to avoid** — always read `config.json` → `content.topics_to_avoid` before generating topics

## Language rules

- Write in Korean for the target audience: 호주에 사는 25-40세 한국인 엄마
- Blog: 해요체 only (`~어요`, `~했어요`). 절대 금지: `습니다/입니다` 체, "ㅠㅠ"
- Carousel: natural conversational Korean, no textbook Korean, no slang-heavy
- Video: spoken-word Korean, calm and friendly pace
- The CTA text must match `content.cta_text` from `config.json` exactly

## Blog-specific rules (navermate)

- **"ㅠㅠ" 절대 사용 금지**
- 해요체 only. `습니다/입니다` 체 섞이면 반려.
- 한 줄 = 한 문단 (네이버 스마트에디터 가독성)
- 1,500자 이상
- 인용 블록 3개 이상 (요약 박스, 복붙 박스, 비교표, 단계 목록, FAQ 중)
- 제목 = 검색어 형태: `[대상 키워드] + [방법/비교/후기] + [구체 조건]`
- 애매함 → 수치로. "많이 줄었어요"❌ → "2시간에서 25분으로"✅
- 검증 안 된 수치·정보 단정 금지 → "2026년 기준", "직접 확인함" 등 근거 표기
- 남의 사진/펌 이미지 금지 → 직접 찍은 원본 사진 필요 (AI 생성 이미지는 플레이스홀더, 발행 전 원본으로 교체)

## Carousel-specific rules (aussie-umma)

- Card count within `channels.carousel.card_count_range` from `config.json` — fit to topic, never pad
- Required spine in order: cover → hook → … → sheet (save-bait) → cta
- No more than two consecutive cards of the same type
- Include at least one `statement` (dark) rhythm card
- Every card: 1080px × 1350px
- Brand handle (`.handle`) at top-right of every card; no footer
- No in-card carousel-position dots or page-number watermark
- Exactly one save-bait `sheet` card
- At least one hero number on any numeric topic

## Video-specific rules

- Hook in first 5 seconds
- 9:16 portrait aspect ratio
- Korean voiceover: ko-KR-SunHiNeural-Female
- Korean-compatible font for subtitles (AppleSDGothicNeo.ttc)
- Subtitle font size minimum 70 for mobile readability
- Max duration per `channels.video.max_duration_seconds` from `config.json`

## File rules

- One commit per file
- No Co-Authored-By trailers
- `outputs/` IS tracked in this repo (required for raw.githubusercontent.com serving)
