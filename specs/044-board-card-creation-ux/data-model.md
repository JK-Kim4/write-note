# Data Model: 보드 카드 만들기 UX 보완

**Phase 1** — 백엔드·DB·API 데이터 모델 **변경 0**. 본 기능은 진입 UX만 다룬다.

## 영속 데이터 (변경 없음)

- **카드(Card)**: 기존 모델 그대로 재사용. `id`, `body`(단일 본문), `type`(종류, nullable), `posX`/`posY`(캔버스 좌표), `zIndex`. 신규 필드·마이그레이션·에러코드 **0**.
- 생성 = 기존 카드 생성 엔드포인트(`POST /api/boards/{id}/cards`, `CreateCardInput { body?, posX, posY, zIndex?, type? }`) 재사용. 빈 본문 카드는 `body=""`로 생성(현행 동작).
- 본문 편집 = 기존 `PATCH .../cards/{cardId}` (`UpdateCardInput { body? }`) 재사용.

## FE 로컬 상태 (신규 — 영속 아님)

| 상태 | 위치 | 타입 | 의미 |
|---|---|---|---|
| `autoEditCardId` | `CanvasInner`(PlotBoardCanvas) | `string \| null` | 생성 직후 자동 편집을 열 대상 카드 id. onSuccess(실제 id 확정)에서 set, CardNode가 consume 후 null |

- `BoardActions`(컨텍스트, `boardActions.ts`)에 추가: `autoEditCardId: string \| null`, `consumeAutoEdit: (cardId: number) => void`.
- 기존 RF 로컬 상태(`nodes`/`edges`/`connectFromId`/`pendingEmptyDrop`)·낙관 패턴·temp id 규약(`temp-*`) 재사용.

## 상태 전이 — 카드 생성 3경로 (공통 `createCardAt(pos)`)

```
[트리거] "+ 카드" 버튼 / 빈 곳 더블클릭(pane) / 빈 보드 안내 버튼
   │  (공통 createCardAt(pos))
   ▼
낙관적 temp 노드 추가 (id=temp-N, body="", kind=null) → nodes.length ≥ 1 (빈 보드 안내 사라짐)
   │  createCard.mutate({ body:"", posX, posY })
   ├─ onSuccess(card) → temp→real id 스왑 + setAutoEditCardId(String(card.id))
   │        └─ CardNode(real id) effect: autoEditCardId===id → setEditing(true) → consumeAutoEdit(id)
   │              └─ 작가 본문 타이핑 → blur/Enter → 기존 editCardBody(updateCard) (빈 본문이면 저장 호출 없이 잔존)
   └─ onError → temp 노드 제거 + "카드 생성에 실패했습니다" (기존 롤백)
```

- **빈 본문 잔존(FR-006)**: 생성 시 `body=""`로 서버에 영속. 편집 후 비운 채 벗어나면 `editCardBody`가 `next === body`(둘 다 "")라 추가 저장 호출 없이 그대로 잔존(삭제하지 않음).

## 검증 규칙

- 신규 검증 없음(서버 계약 무변경). FE 순수 판정만: 빈 곳 판별(`react-flow__pane` 포함), autoEdit consume 1회성.
