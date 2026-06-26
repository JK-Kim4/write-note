# Feature Specification: 보드 유비쿼터스 언어 정리 (node/edge → Card/Link)

**Feature Branch**: `038-memo-plot-board` (트랙 B, 새 브랜치 미생성 — 트랙 A와 동일 브랜치 유지)

**Created**: 2026-06-25

**Status**: Draft

**Input**: 트랙 B — 보드 도메인의 `node/edge/board_nodes/board_edges` 를 PRD 유비쿼터스 언어 `Card/Link/cards/links` 로 전면 통일. 영향범위·결정 SoT = `docs/board/board-track-b-impact-survey.md`.

> **본질**: 이 트랙은 **순수 rename 리팩토링**이다. 보드 사용자(작가)에게 **관찰 가능한 동작 변화 0**, 코드·DB·API·화면 용어를 PRD §0 유비쿼터스 언어(`Card/Link`)로 통일하는 것이 목적. 새 기능 없음, 동작 보존이 최우선 안전 기준.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 보드 사용자에게 동작은 그대로 (Priority: P1)

작가는 트랙 A까지 구현된 보드 기능(카드 생성·편집·드래그 배치·뷰포트 영속 / 카드 잇기 4경로·끊기·이웃 강조 / 보드↔작품·시리즈 매핑)을 rename 후에도 **완전히 동일하게** 사용한다. 화면 문구·인터랙션·영속·복원이 트랙 A와 한 픽셀도 다르지 않다.

**Why this priority**: rename 리팩토링의 절대 안전 기준. 용어를 바꾸되 사용자가 보는 것·하는 것은 불변이어야 한다. 동작이 깨지면 트랙 자체가 회귀(트랙 A를 망가뜨림).

**Independent Test**: rename 적용본을 로컬 풀스택으로 띄워, 트랙 A quickstart 전항(카드 생성·드래그·영속·잇기 4경로·끊기·이웃·매핑·재진입)을 그대로 통과하는지 dogfooding.

**Acceptance Scenarios**:

1. **Given** rename 적용된 보드, **When** 카드를 만들고 드래그·잇기·끊기·매핑 후 재진입, **Then** 트랙 A와 동일하게 위치·연결·앵커·뷰포트가 복원된다.
2. **Given** rename 적용된 보드, **When** 카드 선택, **Then** 이웃 카드·연결선이 또렷하고 나머지는 dim(트랙 A 동일).
3. **Given** rename 적용된 보드 화면, **When** 화면 어디를 봐도, **Then** `node/edge/메모` 같은 내부·폐기 용어가 노출되지 않는다.

---

### User Story 2 - 코드·DB·API 용어가 Card/Link 로 통일 (Priority: P2)

개발자가 보드 도메인 코드·DB·API를 읽을 때 `node/edge/board_nodes/board_edges` 대신 일관되게 `Card/Link/cards/links` 를 본다. React Flow 라이브러리의 `node/edge` 용어는 **어댑터 경계 안에서만** 남는다(PRD §8).

**Why this priority**: PRD §0 유비쿼터스 언어 — "코드·DB·API·문서·대화·화면이 같은 용어". 번역 계층 제거로 인지 부하·혼선 감소. P1(동작 보존)이 충족된 위에서의 품질 목표.

**Independent Test**: 회귀 grep — 어댑터 파일 밖 보드 도메인 코드에 `node/edge` 식별자 0건, DB에 `board_nodes/board_edges` 테이블 0건, 화면 문구에 `node/edge/메모` 0건.

**Acceptance Scenarios**:

1. **Given** rename 적용본, **When** 보드 도메인 코드(어댑터 제외)를 grep, **Then** `node/edge` 도메인 식별자가 없다.
2. **Given** rename 적용본, **When** DB 스키마 조회, **Then** 테이블이 `cards`·`links`(컬럼 `source_card_id`·`target_card_id`)이고 `board_nodes`·`board_edges`는 없다.
3. **Given** rename 적용본, **When** 어댑터 파일(`PlotBoardCanvas`·`linkGraph`·`CardNode`·`LinkEdge`)을 본다, **Then** React Flow 자체 API(`useNodesState`·`Node`·`onConnect` 등)의 node/edge는 의도적으로 보존돼 있다.

---

### Edge Cases

- **로컬 dev DB가 구 스키마(board_nodes/board_edges)를 이미 적용한 상태**: in-place 마이그레이션 편집은 flyway 체크섬 불일치를 유발 → board 3테이블 drop + `flyway repair`(또는 DB 재생성) 후 재마이그레이션으로 해소. 운영/통합 브랜치는 미배포라 무영향.
- **기존 연결(엣지) 행의 `source_handle/target_handle`이 NULL(V26 이전 데이터)**: 컬럼명 불변(node/edge 단어 없음) — rename 무관, 렌더 폴백 동작 보존.
- **카드 종류 값 문자열(plot/character/place/theme/note)**: DB `type` 컬럼 값이므로 **rename 대상 아님**(값은 유지, 식별자만 cardKinds로). 잘못 바꾸면 기존 카드 종류 깨짐.
- **`Card`/`Link` 의미 중복**(작품 카드 `ProjectCardResponse` / 계정 연결 `LinkEmailResponse`): 보드 도메인 컨텍스트(`BoardController`/`BoardService`/`components/board/`)로 구분 — 하드 충돌 없음(엔티티 `class Card`/`class Link` 부재 확인).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (DB)**: 보드 마이그레이션을 in-place 편집해 테이블 `board_nodes`→`cards`, `board_edges`→`links`, 컬럼 `source_node_id`→`source_card_id`·`target_node_id`→`target_card_id`, 제약·인덱스명(`fk_cards_*`/`fk_links_*`/`uq_links_triplet`/`ck_links_no_self`/`idx_cards_board`/`idx_links_board`)으로 통일한다. `boards` 테이블·`board_nodes`의 type/handle 등 node/edge 단어 없는 컬럼은 불변.
- **FR-002 (BE 코드)**: 엔티티 `BoardNode`→`Card`·`BoardEdge`→`Link`, 리포지토리 `CardRepository`/`LinkRepository`, 서비스 메서드(`createCard`/`updateCard`/`batchUpdateCardPositions`/`deleteCard`/`createLink`/`deleteLink` 및 내부 `requireOwnedCard`/`normalizeCardType`/`toCard`/`toLink`), DTO(`CreateCardRequest`/`UpdateCardRequest`/`BatchCardPositionItem`/`CreateLinkRequest`/`CardResponse`/`LinkResponse`, 필드 `sourceCardId`/`targetCardId`, `BoardDetailResponse.cards`/`.links`, `BoardSummary.cardCount`)로 rename한다.
- **FR-003 (BE API·에러)**: 컨트롤러 endpoint `/{boardId}/nodes`→`/{boardId}/cards`·`/{boardId}/edges`→`/{boardId}/links`, path 변수 `cardId`/`linkId`, 에러코드 `BOARD_EDGE_INVALID`→`BOARD_LINK_INVALID`·`BOARD_EDGE_DUPLICATE`→`BOARD_LINK_DUPLICATE`(메시지 "노드"→"카드"). `BoardController` base `/api/boards`·매핑 에러코드(`BOARD_PROJECT_ALREADY_MAPPED`·`BOARD_CATEGORY_ALREADY_MAPPED`)는 불변.
- **FR-004 (FE 데이터 계층)**: `lib/api/boards.ts`·`lib/electron-api/boards.ts`·`lib/query/useBoards.ts` 의 타입(`CardResponse`/`LinkResponse`/`CreateCardInput`/`UpdateCardInput`/`CardPositionItem`, `BoardDetail.cards`/`.links`), 함수·훅(`createCard`/`createLink`/`useCreateCard`/`useCreateLink` 등), endpoint 경로(`/cards`·`/links`)를 rename한다.
- **FR-005 (FE 어댑터 경계)**: 어댑터 내부 도메인 식별자만 rename — `nodeKinds.ts`→`cardKinds.ts`(값 문자열 유지), `NodeCard.tsx`→`CardNode.tsx`, `LinkEdge.tsx` 유지, `linkGraph.ts` 헬퍼 `neighborNodeIds`→`neighborCardIds`·`incidentEdgeIds`→`incidentLinkIds`(RF 경계 함수 `toRFEdge`는 유지·인자 타입만 `LinkResponse`). React Flow 자체 API(`useNodesState`/`useEdgesState`/`Node`/`Edge`/`onConnect`/`ConnectionMode`/`nodeTypes`/`edgeTypes` 등)는 어댑터 안에 **그대로 보존**.
- **FR-006 (동작 보존)**: 트랙 A 연결 UI 동작(잇기 4경로·끊기·이웃 강조·테두리 앵커 영속·낙관/롤백)과 보드 MVP 동작(카드 CRUD·드래그 배치·뷰포트 영속·매핑)이 rename 전후 **동일**해야 한다.
- **FR-007 (테스트 동기)**: `BoardServiceTest`·`BoardControllerIT` 의 식별자·endpoint 경로·DTO명·에러코드를 rename에 맞춰 동기하고, 기존 검증(엣지 케이스 = 자기연결 400·중복 409·타보드 400·매핑 충돌 409)을 동일하게 보존한다.
- **FR-008 (잔재 0)**: 어댑터 파일 밖 보드 도메인 코드에 `node/edge` 식별자 0, 화면 문구에 `node/edge/메모(구 메뉴명)` 0(worksheet §6 머지 전 체크).

### Key Entities

- **Card** (구 `BoardNode` / 테이블 `cards`): 보드 위의 한 장. 한 보드에 전속. 속성 = board_id, body(평문), pos_x/pos_y(캔버스 좌표), z_index, type(종류 값), created_at/updated_at. 캡처 메모(`memos`)·인물(`characters`)과 무참조(별개).
- **Link** (구 `BoardEdge` / 테이블 `links`): 같은 보드 두 카드를 잇는 무방향 연결. 속성 = board_id, source_card_id, target_card_id, source_handle/target_handle(테두리 앵커, nullable). 유니크(board_id, source_card_id, target_card_id), 자기연결 금지.
- **Board** (불변): 사용자 소유 캔버스. 작품·시리즈 0~1 매핑. 본 트랙에서 **변경 없음**.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001 (동작 보존)**: dogfooding에서 보드 전 흐름(카드 생성·편집·드래그·영속 / 잇기 4경로·끊기·이웃 / 매핑 / 재진입 복원)이 트랙 A와 **동일하게** 통과(전항, 룰 §25).
- **SC-002 (잔재 0)**: 회귀 grep 결과 — 어댑터 파일 밖 보드 도메인 코드의 `node/edge` 도메인 식별자 0건, DB의 `board_nodes/board_edges` 테이블 0건, 화면 문구의 `node/edge/메모(구 메뉴)` 0건.
- **SC-003 (게이트 GREEN·무회귀)**: BE(ktlint main+test·checkstyle·test·build) + FE(typecheck·lint 0err·test·build) 전부 통과, 테스트 수 트랙 A 베이스라인(685) 대비 감소 없음(rename으로 의미 보존).
- **SC-004 (스키마 정합)**: 로컬 DB 조회 시 보드 테이블이 `cards`·`links`이고 컬럼이 `source_card_id`·`target_card_id`이며, `board_nodes`·`board_edges`가 존재하지 않는다.

## Assumptions

- 보드 스키마(V24·V25·V26)는 **develop·main에 미배포**(이 브랜치에만 존재) — 실측 확인. 따라서 API 계약 변경(endpoint·필드명)에도 prod 깨짐 위험 0이며, BE·FE는 038 merge 시 **원자적으로 함께** 나간다("BE 선행→FE"는 구현 순서일 뿐).
- 마이그레이션 in-place 편집 시 **로컬 dev DB는 board 3테이블 drop + flyway repair 후 재마이그레이션**(또는 DB 재생성). 트랙 A dogfooding 테스트 카드는 지워지며 재생성한다. DB 쓰기는 사용자 컨펌 영역(external-infra-safety) — 로컬 한정·컨펌 후 실행.
- React Flow의 `node/edge`는 라이브러리 내부 용어이며 어댑터(`PlotBoardCanvas`·`linkGraph`·`CardNode`·`LinkEdge`)의 일부 — 도메인 용어가 아니므로 그 안에서는 보존한다.
- 트랙 A(연결 UI)가 회귀 표면이다 — 보존 검증이 안전 기준.
- 카드 종류 값(plot/character/place/theme/note)·`type` 컬럼명은 본 트랙 범위 밖(kind↔type 의미 정리는 후속).
- 본 트랙은 새 브랜치를 만들지 않고 `038-memo-plot-board`에서 진행(speckit git 훅 skip).
