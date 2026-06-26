# Phase 1 Contracts — 연결(엣지) API (보존·재사용, 신규 0)

> 트랙 A는 **신규 백엔드 엔드포인트·마이그레이션·에러코드 0**. 본 문서는 FE가 재사용하는 **보존된 계약**과 무방향 FE 가드의 정합을 박는다. (출처: `BoardController`·`BoardService`·`lib/api/boards.ts` 직접 확인.)

## 1. 연결 생성 — `POST /api/boards/{boardId}/edges`

**Request**: `{ "sourceNodeId": number, "targetNodeId": number }`

**Response 200**: `BoardEdgeResponse { id, sourceNodeId, targetNodeId }`

**검증(백엔드 보존)**:
| 조건 | 응답 |
|---|---|
| `sourceNodeId == targetNodeId` (자기연결) | 400 `BOARD_EDGE_INVALID` |
| source/target 중 하나라도 그 보드 노드 아님 | 400 `BOARD_EDGE_INVALID` |
| 정확히 같은 `(source,target)` 순서쌍 이미 존재 | 409 `BOARD_EDGE_DUPLICATE` |
| 보드 미소유 | 403/404 (소유 가드) |

**FE 가드 정합(트랙 A 신규, 호출 전 선제 차단)**:
- 무방향이므로 FE는 `(s,t)` **또는** `(t,s)` 존재 시 호출하지 않음(백엔드 409는 정확순서쌍만 막아 무방향엔 불충분). → `linkGraph.canLink`.
- 자기연결도 FE 선제 차단(백엔드 400 도달 전). → `isSelfLink`.
- ∴ 정상 흐름에서 400/409가 사용자에게 노출되지 않음. (방어적으로 응답 에러 시 `error.code` 분기로 토스트 — `client.ts` generic 경로가 `code` 전달.)

**FE 클라이언트(보존)**: `webElectronApi.boards.createEdge(boardId, sourceNodeId, targetNodeId)` → `useCreateEdge(boardId)`.

## 2. 연결 삭제 — `DELETE /api/boards/{boardId}/edges/{edgeId}`

**Response 204**. 없는 엣지/타보드 → 404(`ResourceNotFoundException`).

**FE 클라이언트(보존)**: `webElectronApi.boards.deleteEdge(boardId, edgeId)` → `useDeleteEdge(boardId)`.

## 3. 하이드레이션 — `GET /api/boards/{boardId}`

**Response**: `BoardDetail { board, nodes: BoardNodeResponse[], edges: BoardEdgeResponse[] }` (보존).
- 캔버스 초기 시드: `detail.edges.map(toRFEdge)` → `useEdgesState` 초기값.
- 재진입 영속 복원(`refetchOnMount:"always"`).

## 4. 트랙 A에서 추가하는 것 (FE 훅 소폭)

보존 훅에 **onError 무효화만 추가**(현재 빈 mutationFn):
```ts
// useBoards.ts
export function useCreateEdge(boardId) { /* mutationFn 보존 + 호출부 onSuccess(id 교체)/onError(reseed) */ }
export function useDeleteEdge(boardId) { /* mutationFn 보존 + 호출부 onError(reseed) */ }
```
- 낙관 SoT는 RF 로컬 `useEdgesState`(노드 패턴 동형). 캐시 무효화는 onError reseed(detail invalidate)만 필요 — `BoardSummary`에 edgeCount 없어 list 무효화 불필요.

## 5. 비범위 (계약 변경 없음 재확인)

- relation_type("어떤 사이인가요?")·방향 화살표 — 후속.
- 신규 엔드포인트(백링크 조회 등) — 없음. 이웃은 FE가 보존된 `edges`에서 계산.
