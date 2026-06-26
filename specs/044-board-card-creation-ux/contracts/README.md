# Contracts: 보드 카드 만들기 UX 보완

**신규 외부 계약(API/엔드포인트/스키마) 0.** 본 기능은 FE 진입 UX만 다루며 기존 보드 계약을 재사용한다.

## 재사용 (변경 없음)

| 용도 | 기존 계약 | 비고 |
|---|---|---|
| 카드 생성 | `POST /api/boards/{boardId}/cards` (`CreateCardInput { body?, posX, posY, zIndex?, type? }` → `CardResponse`) | 세 생성 경로 모두 이 1개 호출. 빈 본문 `body=""` 허용 |
| 본문 편집 | `PATCH /api/boards/{boardId}/cards/{cardId}` (`UpdateCardInput { body? }`) | 자동 편집 진입 후 커밋 시 기존 경로 |

## FE 내부 계약 (컴포넌트 경계)

- `BoardActions`(컨텍스트) 확장: `+ autoEditCardId: string | null`, `+ consumeAutoEdit(cardId: number): void`. 기존 `editCardBody`·`startConnect`·`setCardKind` 보존.
- `BoardEmptyGuide` props: `{ onCreate: () => void }` — 빈 보드 안내 버튼이 `createCardAt(중앙)`을 호출.

신규 에러코드·status 분기 없음 → `client.ts` 변경 없음.
