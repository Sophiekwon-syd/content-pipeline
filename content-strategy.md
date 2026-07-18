# Content Strategy — AUSSIE UMMA (2026)

The researcher agent MUST read this before picking a topic. Topic choice is
weighted by the priorities below, not ad-hoc. Updated 2026-07-18 by the user.

## Trending topic priorities (관심도 weighted)

| # | Cluster | 관심도 | Angles |
|---|---------|-------|--------|
| 1 | 호주 한달살기 & 방학캠프 | 92 | 시드니 방학캠프 정보, 무료 액티비티, 적정 나이·준비물·체험 후기 |
| 2 | 호주 교육 & 학교생활 | 88 | 학교 배정, 정착 가이드, 방학 프로그램, 브리즈번·골드코스트 지역별 교육 정보 (조기유학 행정 절차·비자는 제외) |
| 3 | 호주 육아용품 리뷰 | 80 | 한국 vs 호주 제품 비교, 쿠팡 로켓직구 활용 팁 (affiliate — see Monetization) |
| 4 | 호주 상비약 & 건강 | 72 | 만2살 이후 상비약 (기침약·알러지·눈병약), 호주 병원 이용법, Medicare 활용 |
| 5 | 호주 복지 & 지원정보 | 70 | 한인 초보엄마 교육 프로그램, 육아 적응 커뮤니티 정보 |

Selection rule: prefer the highest-관심도 cluster that has no 30-day overlap in
topic-memory.json. Rotate clusters — never two consecutive posts from the same
cluster. Seasonal boost: 방학캠프/한달살기 topics get priority in the 4 weeks
before NSW school holidays.

## Keyword targets (상위노출 goals)

Primary: "호주한달살기", "호주교육", "호주상비약"
Every post title must lead with one primary or cluster keyword in 검색어 형태.

## Topic clusters (내부링크 spine)

임신 → 출산 → 육아 → 교육 → 한달살기
Each post links to its cluster neighbors in 함께 읽으면 좋은 글 (with URLs once
posts exist — build the cluster chain deliberately over time).

## Monetization (쿠팡파트너스)

- 육아용품 리뷰 posts may include 쿠팡 로켓직구 affiliate links.
- **Config gate:** only insert links when `config.json → monetization.coupang_partners_id`
  is set to a real ID. Until then, write the review WITHOUT links (placeholders
  like "쿠팡 로켓직구에서 검색" are fine).
- **Mandatory disclosure** on any post containing affiliate links (Korean law +
  쿠팡 정책): the exact sentence in `config.json → monetization.disclosure`.
- **Naver 저품질 warning:** do NOT put raw 쿠팡파트너스 links inside Naver blog
  posts — Naver demotes blogs carrying them. Affiliate links go in the Blogger
  mirror and Instagram bio/comment only; the Naver version references the
  product by name without the link.
- Reviews must be honest category comparisons (실사용 관점, 장단점 both sides).
  Never fabricate personal usage claims for products not actually used —
  frame as 스펙/가격/후기 종합 비교 when firsthand experience doesn't exist.

## Format strategy

- **DM 공유 유도 캐러셀**: listicle hooks ("호주 육아 꿀팁 5가지", "한국 vs 호주
  육아 비교") — cover card phrased so moms tag/DM each other. Carousel-maker:
  prefer share-bait framing on cover + hook cards for cluster 1-3 topics.
- **Reels** (when video channel activates): 호주 현지 육아 일상, 방학캠프 체험 —
  raw phone-camera feel, not produced.
