# Content Strategy — AUSSIE UMMA (validated 2026-07-18)

The researcher agent MUST read this before picking a topic.
Labels: [검증] = backed by research/official Naver signals · [가설] = plausible
but unvalidated assumption · [위험] = validated risk.

## Positioning (the one-line strategy)

**"호주 육아 시스템을 직접 통과하고 있는 한국 엄마의 실전 기록"** — one
consistent lane. Naver's C-Rank rewards 주제 집중도 (topic consistency) above
almost everything [검증], and Naver's 메이트 program explicitly values: 직접
경험한 지식, 일관된 주제 전문성, 거짓 없는 진정성, 읽기 쉬운 구조, 최신성
[검증 — Naver 공식 발언, 서울경제 2026]. Chasing disconnected trending keywords
dilutes C-Rank. Every topic must fit the lane: *a Korean mum in Australia
navigating the actual system and telling you exactly how.*

## Topic clusters (validated against the lane)

| Cluster | Fit | Verdict |
|---|---|---|
| 호주 교육 & 학교생활 (배정, 정착, 방학캠프, 방학 프로그램) | 시스템 실전 정보 ✓ | [검증-적합] core lane, strong search intent. 조기유학/비자 행정 제외 |
| 호주 상비약 & 건강 (만2세+ 상비약, 병원 이용, Medicare) | ✓ | [검증-적합] continues existing Medicare/건강검진 posts — cluster chain |
| 호주 복지 & 지원정보 (지원금, 프로그램, 커뮤니티) | ✓ | [검증-적합] already the blog's proven core (CCS, PANDA, playgroup) |
| 육아용품 리뷰 (한국 vs 호주, 쿠팡 직구) | △ | [가설+위험] see Monetization — Naver版 only with 직접 사용 + 원본 사진 |
| 호주 한달살기 | ✗ audience mismatch | [위험] targets Korea-based visitors, not 호주 거주 엄마 (config target_audience). High volume but dilutes 주제 집중도. Only publish via the resident angle: "호주 사는 엄마가 방문 가족/친구에게 알려주는" framing, max occasional |

Selection rule: rotate among the three [검증-적합] clusters; never two
consecutive posts from one cluster; 방학캠프 topics get priority in the 4 weeks
before NSW school holidays [가설 — seasonal search spike is assumed, sanity-check
with Naver 검색어트렌드 when picking].

The user's original 관심도 scores (92/88/80/72/70) are directional intuition,
not measured data [가설] — researcher should sanity-check demand per topic
(Naver autocomplete, 카페 질문 빈도) during Stage 1 rather than trust the numbers.

## What makes it rank AND feel human [검증 — 2026 algorithm]

- D.I.A. 2026 (하이퍼클로바X 기반) evaluates full-document context, factual
  accuracy, **image originality detection (sharpened)**, and gives bonus for
  embedded video. AI-written text is NOT auto-penalized — quality and 진정성
  signals decide.
- Therefore, in priority order:
  1. **원본 사진이 최대 레버.** AI-generated images are now algorithmically
     detectable and hurt. Real phone photos (even imperfect ones) of 실제
     현장 — school notice boards, pharmacy shelves, playground — outrank
     polished AI images. Pipeline keeps AI images as placeholders, but every
     post the user can add even ONE real photo to gains ranking + human feel.
  2. **직접 경험 마커 in the text**: one first-person micro-anecdote per
     section (구체적 지명·가격·시간·실수담). Specific beats generic:
     "채스우드 도서관 화요일 10시" > "가까운 도서관".
  3. **거짓 금지**: never fabricate personal experience. Frame unexperienced
     info as "확인해보니 / 공식 안내 기준" — honesty is itself a ranking signal.
  4. **최신성**: "2026년 7월 기준" date-stamps (already doing) + periodically
     update old posts.
  5. Video embeds = bonus points → future lever for the video channel.

## Cadence [채택됨 2026-07-18]

Naver publishes Mon/Wed/Fri only (matches posts_per_week_target=3, avoids
automation-pattern detection). The daily 6am run ships Blogger + Instagram
every day; `scripts/daily-ship.sh` enforces the Naver day gate. Manual
user-invoked /ship-topic runs publish wherever the user says, any day.

## Monetization (쿠팡파트너스 AF1100561)

- [검증] Affiliate links do NOT automatically cause Naver 저품질 — the killer
  is copy-pasted product images/detail pages. Survivors write 직접 사용 기반
  reviews with original photos.
- Consequence for us: **no 쿠팡 links in Naver posts until a review is backed
  by 직접 사용 + user's real photos.** Until then affiliate links live in the
  Blogger mirror + Instagram only. Mandatory disclosure sentence
  (config.json → monetization.disclosure) on any post with links.
- Reviews = honest 한국 vs 호주 category comparison, 장단점 both sides.

## Format strategy [가설]

- DM 공유 유도 캐러셀 covers ("호주 육아 꿀팁 5가지", "한국 vs 호주 비교") —
  plausible share mechanics, keep.
- Reels (video channel later): 현지 일상 raw phone-camera feel.
