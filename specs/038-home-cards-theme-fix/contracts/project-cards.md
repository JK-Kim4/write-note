# Contract: 작품 카드 응답 — categoryName additive (US1)

## 대상

작품 카드 목록을 반환하는 기존 엔드포인트(홈/보관함이 소비하는 `ProjectCardResponse` 배열). 본 작업은 **응답에 필드 1개를 additive로 추가**한다. 경로·메서드·요청 형식 변경 없음.

## 변경

`ProjectCardResponse`에 `categoryName` 추가:

```
ProjectCardResponse {
  id: Long
  title: String
  categoryId: Long?          // 기존 — 시리즈 식별자 (null = 미분류)
  categoryName: String?      // ★ 신규 (additive) — 시리즈 이름 (null = 미분류)
  wordCount: Int
  documentUpdatedAt: Instant
  createdAt: Instant
  totalDurationMs: Long
  lastSentenceSource: String
  effectivePaperSize: String
  effectiveLayoutMode: String
}
```

## 규칙

- `categoryId == null` ⇒ `categoryName == null` (미분류).
- `categoryId != null` ⇒ `categoryName`은 해당 시리즈의 현재 이름.
- 매핑은 카드 목록에 등장하는 categoryId 집합을 **일괄 조회**해 구성(N+1 금지).
- **하위호환**: 기존 필드/순서 불변. `categoryName`을 모르는 기존 프론트는 무시 가능(additive). 신규 프론트는 null이면 "미분류" 표시.

## 신규 에러코드 / status

- **없음.** 조회 전용, 기존 인증·경로 재사용.

## 테스트(계약)

- 시리즈에 속한 작품 → `categoryName == 시리즈명`.
- 미분류 작품 → `categoryName == null`.
- 여러 작품이 같은 시리즈 → 모두 같은 이름, 카테고리 조회 횟수가 작품 수에 비례하지 않음(일괄 조회 검증).
- 기존 필드(`totalDurationMs`·`documentUpdatedAt`·`lastSentenceSource` 등) 값·형식 회귀 없음.
