# 트랙 B (유비쿼터스 언어 정리) — rename 영향범위 전수 조사

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-06-25 |
| 트랙 | B — `node/edge/board_nodes/board_edges` → `Card/Link/cards/links` 전면 통일 |
| 근거 | `board-roadmap.md` §4 결정 3(테이블명까지 일괄) + `board-prd.md` §0 유비쿼터스 언어 + §8 어댑터 경계 |
| 본 문서 역할 | brainstorming/SDD의 **사실 기반**(grep 실측). 설계 결정은 §아래 + 후속 design doc |

> **핵심 사실**: 보드 스키마(V24·V25·V26)는 **develop·main에 한 번도 없음**(prod 미배포). 이 브랜치(`038-memo-plot-board`)에서만 존재. **로컬 dev DB에는 적용됨**(flyway success=t, Track A dogfooding 데이터).

---

## 0. 네이밍 맵 (확정 — roadmap §4)

| 현재 (node/edge) | 목표 (card/link) | 비고 |
|---|---|---|
| `board_nodes` (table) | `cards` | |
| `board_edges` (table) | `links` | |
| `boards` (table) | `boards` (유지) | "board"는 이미 유비쿼터스 |
| `board_edges.source_node_id` | `links.source_card_id` | PRD §7 data model |
| `board_edges.target_node_id` | `links.target_card_id` | |
| `board_nodes.*` 컬럼 | (유지) | id/board_id/body/pos_x/pos_y/z_index/type/created_at/updated_at — node/edge 단어 없음 |
| `board_edges.source_handle/target_handle` | (유지) | V26, node/edge 단어 없음 |

---

## 1. Backend (Kotlin)

### 1-1. 마이그레이션 (DDL)
- 테이블: `board_nodes`→`cards`, `board_edges`→`links`
- 컬럼: `source_node_id`→`source_card_id`, `target_node_id`→`target_card_id`
- 제약/인덱스 rename:
  - `fk_board_nodes_board`→`fk_cards_board`, `idx_board_nodes_board`→`idx_cards_board`
  - `fk_board_edges_board`→`fk_links_board`, `fk_board_edges_source`→`fk_links_source`, `fk_board_edges_target`→`fk_links_target`
  - `uq_board_edges_triplet`→`uq_links_triplet`, `ck_board_edges_no_self`→`ck_links_no_self`, `idx_board_edges_board`→`idx_links_board`

### 1-2. 엔티티
- `entity/BoardNode.kt` → `Card.kt`: class `BoardNode`→`Card`, `@Table("board_nodes")`→`@Table("cards")`
- `entity/BoardEdge.kt` → `Link.kt`: class `BoardEdge`→`Link`, `@Table("board_edges")`→`@Table("links")`, `sourceNodeId/targetNodeId`(+`@Column source_node_id/target_node_id`)→`sourceCardId/targetCardId`(+`source_card_id/target_card_id`)

### 1-3. 리포지토리
- `BoardNodeRepository.kt`→`CardRepository.kt` (식별자 5)
- `BoardEdgeRepository.kt`→`LinkRepository.kt` (식별자 4)

### 1-4. 서비스 `BoardService.kt` (BoardNode/BoardEdge 식별자 11 + 메서드)
- `createNode/updateNode/batchUpdateNodePositions/deleteNode` → `createCard/updateCard/batchUpdateCardPositions/deleteCard`
- `createEdge/deleteEdge` → `createLink/deleteLink`
- `requireOwnedNode`→`requireOwnedCard`, `normalizeNodeType`→`normalizeCardType`, `toNode/toEdge`→`toCard/toLink`

### 1-5. DTO
- request `model/request/BoardRequests.kt`: `CreateNodeRequest`→`CreateCardRequest`, `UpdateNodeRequest`→`UpdateCardRequest`, `BatchNodePositionItem`→`BatchCardPositionItem`, `CreateEdgeRequest`→`CreateLinkRequest`(필드 `sourceNodeId/targetNodeId`→`sourceCardId/targetCardId`)
- response `model/response/BoardResponses.kt`: `NodeResponse`→`CardResponse`, `EdgeResponse`→`LinkResponse`(필드 `sourceNodeId/targetNodeId`→`sourceCardId/targetCardId`), `BoardDetailResponse.nodes/edges`→`.cards/.links`, `BoardSummary.nodeCount`→`cardCount`

### 1-6. 컨트롤러 `BoardController.kt` (base `/api/boards`)
- endpoint: `/{boardId}/nodes`→`/{boardId}/cards`, `/{boardId}/edges`→`/{boardId}/links`
- 메서드 `createNode/updateNode/batchUpdateNodes/deleteNode/createEdge/deleteEdge` → card/link 변형
- path var `nodeId/edgeId`→`cardId/linkId`

### 1-7. 에러코드 `enums/AuthErrorCode.kt`
- `BOARD_EDGE_INVALID`→`BOARD_LINK_INVALID`, `BOARD_EDGE_DUPLICATE`→`BOARD_LINK_DUPLICATE`
- 메시지 텍스트 "노드"→"카드"("연결"은 Link의 화면 표현이라 유지)
- `BOARD_PROJECT_ALREADY_MAPPED`/`BOARD_CATEGORY_ALREADY_MAPPED`는 node/edge 무관 → 유지

### 1-8. 테스트
- `BoardServiceTest.kt`, `BoardControllerIT.kt`: 모든 node/edge 식별자 + endpoint 경로 + DTO명

---

## 2. Frontend (TS/TSX)

### 2-1. 데이터/도메인 계층 (전부 rename)
- `lib/api/boards.ts` (31): 타입 `BoardNodeResponse`→`CardResponse`, `BoardEdgeResponse`→`LinkResponse`(필드 `sourceNodeId/targetNodeId`→`sourceCardId/targetCardId`), `BoardDetail.nodes/edges`→`.cards/.links`, `CreateNodeInput`→`CreateCardInput`, `UpdateNodeInput`→`UpdateCardInput`, `NodePositionItem`→`CardPositionItem`; 함수 `createNode/updateNode/batchNodePositions/deleteNode/createEdge/deleteEdge`→card/link; endpoint `/nodes`·`/edges`→`/cards`·`/links`
- `lib/electron-api/boards.ts` (23): shim 함수 동일 rename
- `lib/query/useBoards.ts` (21): 훅 `useCreateNode/useUpdateNode/useBatchNodePositions/useDeleteNode/useCreateEdge/useDeleteEdge`→card/link
- `components/board/nodeKinds.ts` (7) → `cardKinds.ts`(또는 `cardTypes.ts`): 카드 종류(plot/character/place/theme/note) 정의. **값 문자열(plot 등)은 유지**(DB `type` 컬럼 값)
- `components/board/boardActions.ts` (3): Zustand 스토어 `startConnect` 등

### 2-2. 어댑터 경계 (PRD §8 — React Flow `node/edge`는 **여기 안에서만** 합법)
> `linkGraph.ts` 헤더가 이미 명시: "React Flow 용어는 본 파일·`PlotBoardCanvas`·`LinkEdge`에서만". 어댑터는 **이미 존재·문서화됨**.

- `PlotBoardCanvas.tsx` (raw 130) — **분류**:
  - React Flow API (유지): `useNodesState/useEdgesState/onNodesChange/onEdgesChange/nodeTypes/edgeTypes/Node/Edge 타입/OnConnect/ConnectionMode/nodesConnectable/getNode/useReactFlow/@xyflow` (~절반)
  - 우리 도메인 데이터 (rename): `useCreateNode/useCreateEdge/.../.nodes/.edges/BoardNodeResponse/sourceNodeId/nodeKinds/NodeCard/LinkEdge` (~절반)
- `linkGraph.ts` (24) — 어댑터 헬퍼. RF `Edge[]` 받음. 헬퍼명 도메인 의미: `neighborNodeIds`→`neighborCardIds`?, `incidentEdgeIds`→`incidentLinkIds`?, `toRFEdge`(RF용)·`isPairLinked/isSelfLink/canLink` (§결정 2)
- `NodeCard.tsx` — RF custom node 컴포넌트(카드 렌더). 어댑터 내부 (§결정 2 — 이름)
- `LinkEdge.tsx` — RF custom edge 컴포넌트(연결 렌더). 어댑터 내부

### 2-3. node/edge 무관 (불변)
- `components/board/BoardMappingControl.tsx`, `app/(main)/boards/page.tsx`, `[boardId]/page.tsx`(0~1 ref)

---

## 3. 결정 (brainstorming 2026-06-25 — 사용자 승인 ✅)

1. **마이그레이션 전략 = (A) V24~26 in-place 편집** + 로컬 DB 리셋/repair. 보드 prod 미배포(develop·main에 V24~26 없음) → 최종 스키마가 깨끗(rename cruft 0). 로컬 dev DB는 board 3테이블 drop + `flyway repair` 후 재마이그레이션(또는 DB 재생성). 트랙 A dogfooding 테스트 카드는 지워지고 dogfooding 때 다시 생성.
2. **FE 범위 = (A) 이름만 통일** (어댑터 구조 보존). 캔버스=어댑터, React Flow 자체 API(`useNodesState`·`Node`·`onConnect`·`ConnectionMode` 등)는 어댑터 안에 **그대로 유지**. 도메인 의미 식별자만 rename. 얇은 어댑터 추출 리팩토링은 안 함(룰 §15 — rename에 구조 변경 끼워넣어 연결 UI 회귀 위험 키우지 않음).
3. **네이밍 = bare `Card`/`Link`** (PRD §0 유비쿼터스 언어). 하드 충돌 없음(BE에 `class Card`/`class Link` 부재). 의미 중복(`ProjectCardResponse` 작품 카드 / `LinkEmailResponse`·`LinkKakaoStateRequest` 계정 연결)은 board 도메인 컨텍스트(`BoardController`/`BoardService`/`components/board/`)로 구분.
   - 어댑터 내부 RF 컴포넌트: `NodeCard.tsx`→`CardNode.tsx`(RF custom node가 Card 렌더), `LinkEdge.tsx` **유지**(이미 Link-led). 헬퍼: `neighborNodeIds`→`neighborCardIds`, `incidentEdgeIds`→`incidentLinkIds`; `toRFEdge`는 RF 경계 함수라 유지(인자 타입 `BoardEdgeResponse`→`LinkResponse`).
   - 카드 종류 파일 `nodeKinds.ts`→`cardKinds.ts`. 값 문자열(plot/character/place/theme/note)은 DB `type` 컬럼 값이라 **유지**(kind↔type 의미 정리는 트랙 범위 밖).
4. **불변**: `boards` 테이블·`Board` 엔티티·`BoardController` base `/api/boards`·`boards.category_id/project_id` 매핑·`BOARD_PROJECT_ALREADY_MAPPED`/`BOARD_CATEGORY_ALREADY_MAPPED` 에러코드.

> **배포 맥락**: 보드 미배포라 API 계약 변경(`/nodes→/cards`·`sourceNodeId→sourceCardId`)에도 prod 깨짐 위험 0. "BE 선행→FE"는 구현 순서일 뿐, 배포는 038 merge 시 원자적 동반.

> **회귀 가드**: 연결 UI(트랙 A) 동작 보존 필수. 검증 = 게이트(BE ktlint(main+test)·checkstyle·test·build / FE typecheck·lint·test·build) + dogfooding 전항(룰 §25) + 회귀 grep(어댑터 파일 밖 도메인 코드에 `node/edge` 식별자 0, 화면 문구에 `node/edge/메모` 0 = worksheet §6 머지 전 체크).
