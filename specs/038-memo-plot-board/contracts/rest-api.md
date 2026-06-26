# REST API Contract: 플롯 보드

모든 응답은 기존 `Result<T>` envelope(`{ success, data, error: { code, message } }`). 인증 = JWT(`@AuthenticationPrincipal`), 본인 소유만. Base = `/api/boards`. 좌표/줌 = number(double).

## 보드 (Board)

### `POST /api/boards` — 보드 생성
- Body: `{ "name": string(1..120), "projectId"?: number|null, "categoryId"?: number|null }`
- 매핑 동시 지정 가능(둘 다 선택). 대상에 기존 보드 있으면 409.
- 201 → `BoardResponse`
- 오류: 400 `VALIDATION_FAILED`(name) · 409 `BOARD_PROJECT_ALREADY_MAPPED` / `BOARD_CATEGORY_ALREADY_MAPPED` · 404(매핑 대상 미소유)

### `GET /api/boards` — 보드 목록(본인)
- Query(선택): `projectId=<id>` | `categoryId=<id>` | `unmapped=true`
- 200 → `BoardSummary[]` (id, name, projectId, categoryId, nodeCount, updatedAt)

### `GET /api/boards/{boardId}` — 하이드레이션(열기)
- 200 → `BoardDetailResponse` = 보드 메타 + viewport + `nodes: NodeResponse[]` + `edges: EdgeResponse[]`
- 오류: 404 `BOARD_NOT_FOUND`

### `PATCH /api/boards/{boardId}` — 이름 변경
- Body: `{ "name": string(1..120) }`
- 200 → `BoardResponse` · 오류: 400 · 404 `BOARD_NOT_FOUND`

### `PUT /api/boards/{boardId}/project` — 작품 매핑 set/clear
- Body: `{ "projectId": number|null }` (null = 해제)
- 200 → `BoardResponse`
- 오류: 409 `BOARD_PROJECT_ALREADY_MAPPED`(그 작품에 다른 보드) · 404(보드/작품 미소유)

### `PUT /api/boards/{boardId}/category` — 시리즈 매핑 set/clear
- Body: `{ "categoryId": number|null }` (null = 해제)
- 200 → `BoardResponse` · 오류: 409 `BOARD_CATEGORY_ALREADY_MAPPED` · 404

### `PATCH /api/boards/{boardId}/viewport` — 화면 상태 저장(디바운스)
- Body: `{ "zoom": number, "x": number, "y": number }`
- 200 → `BoardResponse`(또는 204) · 오류: 404

### `DELETE /api/boards/{boardId}` — 보드 삭제(노드·엣지 cascade)
- 204 · 오류: 404. 캡처 메모 무영향.

## 노드 (BoardNode)

### `POST /api/boards/{boardId}/nodes` — 노드 생성
- Body: `{ "body"?: string, "posX": number, "posY": number, "zIndex"?: number }`
- 201 → `NodeResponse` · 오류: 400 · 404 `BOARD_NOT_FOUND`

### `PATCH /api/boards/{boardId}/nodes/{nodeId}` — 단건 수정(본문/위치)
- Body(부분): `{ "body"?: string, "posX"?: number, "posY"?: number, "zIndex"?: number }`
- 200 → `NodeResponse` · 오류: 404 `BOARD_NODE_NOT_FOUND`

### `PATCH /api/boards/{boardId}/nodes` — 위치 배치 저장(드래그 종료·다중선택)
- Body: `[{ "id": number, "posX": number, "posY": number, "zIndex"?: number }]`
- 200 → `NodeResponse[]`(갱신분) 또는 204 · 오류: 400 · 404(보드/노드 미소유)
- 드래그 종료 시 변경 노드만 1회 전송(FR-009).

### `DELETE /api/boards/{boardId}/nodes/{nodeId}` — 노드 삭제(걸린 엣지 cascade)
- 204 · 오류: 404 `BOARD_NODE_NOT_FOUND`. 캡처 메모 무영향(FR-016).

## 연결 (BoardEdge)

### `POST /api/boards/{boardId}/edges` — 연결 생성
- Body: `{ "sourceNodeId": number, "targetNodeId": number }`
- 201 → `EdgeResponse`
- 오류: 400 `BOARD_EDGE_INVALID`(자기연결 / 두 노드가 다른 보드 / 노드 부재) · 409 `BOARD_EDGE_DUPLICATE`(같은 방향 동일 쌍) · 404 `BOARD_NOT_FOUND`

### `DELETE /api/boards/{boardId}/edges/{edgeId}` — 연결 삭제
- 204 · 오류: 404 `BOARD_EDGE_NOT_FOUND`

> 백링크(FR-022)는 별도 endpoint 없이 `BoardDetailResponse.edges` 를 클라에서 노드 기준으로 들어오는(target==node)·나가는(source==node) 으로 파생.

## 응답 DTO

```jsonc
// BoardResponse
{ "id": 1, "name": "1부 플롯", "projectId": 7, "categoryId": null,
  "viewport": { "zoom": 1.0, "x": 0, "y": 0 }, "createdAt": "...", "updatedAt": "..." }

// BoardSummary
{ "id": 1, "name": "1부 플롯", "projectId": 7, "categoryId": null, "nodeCount": 12, "updatedAt": "..." }

// BoardDetailResponse
{ "board": { /* BoardResponse */ },
  "nodes": [ /* NodeResponse */ ],
  "edges": [ /* EdgeResponse */ ] }

// NodeResponse
{ "id": 10, "body": "주인공 등장", "posX": 120.5, "posY": -40.0, "zIndex": 0, "updatedAt": "..." }

// EdgeResponse
{ "id": 100, "sourceNodeId": 10, "targetNodeId": 11 }
```

## 에러코드(신규 `BoardErrorCode`)

| code | HTTP | 의미 |
|---|---|---|
| `BOARD_NOT_FOUND` | 404 | 보드 미존재/미소유 |
| `BOARD_NODE_NOT_FOUND` | 404 | 노드 미존재/미소유 |
| `BOARD_EDGE_NOT_FOUND` | 404 | 엣지 미존재/미소유 |
| `BOARD_PROJECT_ALREADY_MAPPED` | 409 | 그 작품에 이미 보드 매핑됨 |
| `BOARD_CATEGORY_ALREADY_MAPPED` | 409 | 그 시리즈에 이미 보드 매핑됨 |
| `BOARD_EDGE_DUPLICATE` | 409 | 같은 방향 동일 쌍 |
| `BOARD_EDGE_INVALID` | 400 | 자기연결/타 보드 노드/노드 부재 |

> **`client.ts` 분기 규칙(HARD-GATE)**: 신규 409(`BOARD_PROJECT_ALREADY_MAPPED`·`BOARD_CATEGORY_ALREADY_MAPPED`·`BOARD_EDGE_DUPLICATE`)는 status 단독이 아닌 **error.code 로 분기**. 기존 409(`DOCUMENT_VERSION_CONFLICT`·`EMAIL_ALREADY_REGISTERED`·`KAKAO_ALREADY_LINKED`·`LAST_CHAPTER_UNDELETABLE`·`NICKNAME_ALREADY_REGISTERED`) 분기를 깨지 않도록 추가만.
