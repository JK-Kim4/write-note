# Contract: `/api/cards` (카드 관리)

신규 `CardController` — 카드 관리(cross-board 목록/상세/수정/삭제 + 독립 카드 생성/재배정). 유저 스코프(소유=`card.user_id == principal.userId`). 기존 `/api/boards/{boardId}/cards/*`(보드 캔버스)는 무변경.

- 인증: `@AuthenticationPrincipal AuthenticatedPrincipal`(JWT Bearer). 미인증 401.
- 응답 봉투: 기존 `Result<T>`(success/실패 code·message). 에러는 `error.code` 로 FE 분기(신규 code 0).
- 타인 카드/없는 카드 = 404(존재 은닉).

## GET /api/cards — 카드 목록(cross-board)

본인 모든 카드(보드 소속 + 독립), 최근 수정순.

- 요청: 없음(쿼리 파라미터 없음 — 전체 로드 후 FE 검색·필터, D5).
- 200 `Result<List<CardItemResponse>>`:

```json
{ "success": true, "data": [
  { "id": 12, "boardId": 3, "boardName": "1부 플롯", "body": "복선: 편지", "type": "event", "linkCount": 2, "createdAt": "...", "updatedAt": "..." },
  { "id": 9,  "boardId": null, "boardName": null, "body": "생각나서 적어둔 메모", "type": null, "linkCount": 0, "createdAt": "...", "updatedAt": "..." }
] }
```

- `boardName` null = 독립 카드(FE "속한 보드 없음"). `linkCount` = 연결된 다른 카드 수(distinct).
- 정렬: **created_at DESC, 동률 id DESC**(생성 순서라 편집해도 안정). N+1 회피(boardName 일괄·linkCount grouped projection).
- 검색(내용·보드명)·필터(소속 전체/보드소속/독립, 종류 4종+무지정)는 **FE 클라이언트 처리** — BE 쿼리 파라미터·신규 조회 0.

## POST /api/cards — 독립 카드 생성

- 요청 `CreateCardRequest`:

```json
{ "body": "새 메모 내용", "type": null }
```

- `body` 미지정 → `''`(백엔드 관대, D7). `type` 미지정 → 무지정(null). 4종 외 값 → 400 ValidationException.
- 생성 카드: `board_id=null`, `user_id=principal`, `pos_x/pos_y=0`.
- 201 `Result<CardItemResponse>`(boardId=null, boardName=null, linkCount=0).

## GET /api/cards/{cardId} — 카드 상세

- 200 `Result<CardItemResponse>`(boardName·linkCount 포함, 단건).
- 없음/타인 → 404.

## PATCH /api/cards/{cardId} — 본문/종류 수정

- 요청 `UpdateCardRequest`: `{ "body": "...", "type": "place" }` (null 필드 미변경).
- 보드 카드·독립 카드 공통. 종류 4종 검증(normalizeCardType).
- 200 `Result<CardItemResponse>`. 없음/타인 → 404. 잘못된 종류 → 400.

## DELETE /api/cards/{cardId} — 삭제

- 성공 204 No Content. 카드에 걸린 링크는 DB cascade(FE 링크 중복삭제 금지 — code-quality §cascade).
- 없음/타인 → 404.
- (삭제 경고는 FE 가 목록/상세의 `linkCount>0` 로 확인 후 확정 다이얼로그 표시 — 백엔드는 확정 삭제만 수행.)

## PATCH /api/cards/{cardId}/board — 소속 보드 변경(재배정)

연결 없는 카드의 소속 보드를 변경(붙이기·떼기·옮기기).

- 요청 `SetCardBoardRequest`:

```json
{ "boardId": 5 }   // 대상 보드(본인 소유)에 배정
{ "boardId": null } // 독립으로 떼기
```

- 검증 순서:
  1. `findByIdAndUserId(cardId)` 없음 → 404.
  2. 카드 `linkCount > 0`(연결 있음) → 400 ValidationException("연결이 있는 카드는 소속 보드를 바꿀 수 없습니다"). (FR-017a)
  3. `boardId != null` 이고 `boardRepository.findByIdAndUserId(boardId)` 없음 → 400 BOARD_OWNER_INVALID.
  4. 통과 → `card.boardId = boardId`; 보드에 배정 시 `posX=posY=0`(기본 위치).
- 200 `Result<CardItemResponse>`(갱신된 boardId/boardName).

## 에러 코드 매트릭스 (신규 0 — 재사용)

| 상황 | status | code / 예외 |
|---|---|---|
| 카드 없음/타인 | 404 | ResourceNotFoundException |
| 종류 4종 외 | 400 | ValidationException |
| 연결 있는 카드 재배정 | 400 | ValidationException |
| 잘못된/타인 대상 보드 | 400 | AuthErrorCode.BOARD_OWNER_INVALID |
| 미인증 | 401 | (Security) |

## 소유 격리 (보안)

- 모든 엔드포인트: `card.user_id` 또는(재배정 대상) `board.user_id` 가 principal 과 일치해야 함. 불일치는 404(카드)·400(대상 보드)로 존재 은닉.
- 기존 보드 스코프 엔드포인트와 이중 경로지만 동일 사용자 소유 불변식 유지(전 카드 user_id = 그 보드 user_id).
