# Tasks: 보드 유비쿼터스 언어 정리 (node/edge → Card/Link)

**Feature**: `specs/040-board-ubiquitous-language/` | **Branch**: `038-memo-plot-board`(새 브랜치 미생성)

**입력 산출물**: plan.md · research.md · data-model.md · contracts/board-api.md · quickstart.md · `docs/board/board-track-b-impact-survey.md`(영향범위 SoT)

> **본질**: 순수 rename 리팩토링(동작 변화 0). US1(동작 보존, P1)·US2(용어 통일, P2)는 **같은 rename으로 동시 달성** — BE/FE rename 태스크가 US2를 수행하고, 검증 태스크가 US1을 보증. TDD = 룰 §5-5 예외(rename·시그니처 조정), 신규 로직 0이라 기존 테스트 동기가 회귀 게이트.
>
> **순서(quickstart §0)**: BE 선행 → 로컬 DB 리셋(컨펌) → FE 후행 → 검증. **배포 순서 아님**(보드 미배포, 038 merge 시 원자적 동반).

---

## Phase 1: Setup

- [ ] T001 베이스라인 게이트 캡처 — 현재(트랙 A) BE/FE 게이트 GREEN·테스트 수(FE 685) 기록. `cd backend && ./gradlew test` / `cd frontend && pnpm test` 결과를 rename 후 비교 기준으로 삼는다.
- [ ] T002 implement 직전 식별자 정합 grep(룰 §6) — `docs/board/board-track-b-impact-survey.md`의 파일명·식별자가 실제 코드와 일치하는지 재확인(`grep -rl "BoardNode\|BoardEdge" backend/src`, `ls frontend/src/components/board/`). 불일치 시 인벤토리 갱신.

---

## Phase 2: BE rename [US2] (serves US1 동작 보존 + US2 용어 통일)

> 마이그레이션 → 엔티티 → repo → service → DTO → controller → 에러코드 → 테스트 → 게이트. 컴파일 의존이라 대체로 순차(병렬 [P]는 독립 파일만).

### 마이그레이션 (in-place 편집)
- [ ] T003 `backend/src/main/resources/db/migration/V24__create_plot_boards.sql` in-place 편집 — `board_nodes`→`cards`, `board_edges`→`links`, `source_node_id`→`source_card_id`, `target_node_id`→`target_card_id`, 제약·인덱스명(`fk_cards_*`/`fk_links_*`/`uq_links_triplet`/`ck_links_no_self`/`idx_cards_board`/`idx_links_board`), 주석 노드/엣지→카드/연결. `boards` 블록 불변. (data-model.md V24 DDL 기준)
- [ ] T004 `V25__add_board_node_type.sql` → 파일명 `V25__add_card_type.sql`(version 25 유지) + 내용 `ALTER TABLE cards ADD COLUMN type ...` + 주석 정합.
- [ ] T005 `V26__add_board_edge_handles.sql` → 파일명 `V26__add_link_handles.sql`(version 26 유지) + 내용 `ALTER TABLE links ADD COLUMN source_handle/target_handle` + 주석 정합.

### 엔티티
- [ ] T006 [P] `backend/src/main/kotlin/com/writenote/entity/BoardNode.kt` → `Card.kt` — class `BoardNode`→`Card`, `@Table("board_nodes")`→`@Table("cards")`, KDoc 정합. (컬럼명 불변)
- [ ] T007 [P] `entity/BoardEdge.kt` → `Link.kt` — class `BoardEdge`→`Link`, `@Table("board_edges")`→`@Table("links")`, 필드 `sourceNodeId/targetNodeId`(+`@Column source_node_id/target_node_id`)→`sourceCardId/targetCardId`(+`source_card_id/target_card_id`), KDoc 정합.

### 리포지토리
- [ ] T008 [P] `repository/BoardNodeRepository.kt` → `CardRepository.kt` — 타입·쿼리 메서드의 `BoardNode`→`Card`, 시그니처 정합(findByBoardId 등).
- [ ] T009 [P] `repository/BoardEdgeRepository.kt` → `LinkRepository.kt` — `BoardEdge`→`Link`, 쿼리 메서드 인자/컬럼 참조(`sourceNodeId`→`sourceCardId` 등) 정합.

### 서비스
- [ ] T010 `service/BoardService.kt` — 메서드 `createNode/updateNode/batchUpdateNodePositions/deleteNode/createEdge/deleteEdge`→`createCard/updateCard/batchUpdateCardPositions/deleteCard/createLink/deleteLink`, 내부 헬퍼 `requireOwnedNode→requireOwnedCard`·`normalizeNodeType→normalizeCardType`·`toNode→toCard`·`toEdge→toLink`, repo/엔티티/DTO 참조 동기.

### DTO
- [ ] T011 [P] `model/request/BoardRequests.kt` — `CreateNodeRequest→CreateCardRequest`, `UpdateNodeRequest→UpdateCardRequest`, `BatchNodePositionItem→BatchCardPositionItem`, `CreateEdgeRequest→CreateLinkRequest`(필드 `sourceNodeId/targetNodeId`→`sourceCardId/targetCardId`).
- [ ] T012 [P] `model/response/BoardResponses.kt` — `NodeResponse→CardResponse`, `EdgeResponse→LinkResponse`(필드 `sourceNodeId/targetNodeId`→`sourceCardId/targetCardId`), `BoardDetailResponse.nodes/edges`→`.cards/.links`, `BoardSummary.nodeCount`→`cardCount`.

### 컨트롤러 · 에러코드
- [ ] T013 `controller/BoardController.kt` — endpoint `/{boardId}/nodes`→`/{boardId}/cards`·`/{boardId}/edges`→`/{boardId}/links`, 메서드명 card/link, path 변수 `nodeId/edgeId`→`cardId/linkId`, import·DTO 참조 동기. base `/api/boards` 불변.
- [ ] T014 [P] `enums/AuthErrorCode.kt` — `BOARD_EDGE_INVALID`→`BOARD_LINK_INVALID`(메시지 "노드"→"카드"), `BOARD_EDGE_DUPLICATE`→`BOARD_LINK_DUPLICATE`. 매핑 에러코드(`BOARD_PROJECT_ALREADY_MAPPED`·`BOARD_CATEGORY_ALREADY_MAPPED`) 불변.

### 테스트 동기 (룰 §5-5 — 기존 테스트가 회귀 게이트)
- [ ] T015 `backend/src/test/kotlin/com/writenote/service/BoardServiceTest.kt` — 식별자·DTO명·에러코드·메서드 호출 동기. 검증 의미 보존(자기연결 400·중복 409·타보드 400·매핑 충돌 409).
- [ ] T016 `backend/src/test/kotlin/com/writenote/controller/BoardControllerIT.kt` — endpoint 경로(`/cards`·`/links`)·요청/응답 JSON 키(`cards`/`links`·`sourceCardId`)·에러코드 동기.

### BE 게이트
- [ ] T017 BE 게이트 GREEN — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`(포어그라운드). 베이스라인 대비 테스트 감소 0. 실패 시 수정 후 재실행(룰 §7 — "기존 회귀" 자기진단 무검증 수용 금지).

---

## Phase 3: 로컬 dev DB 리셋 (BE↔FE 브리지, DB 쓰기 — 사용자 컨펌 후)

- [ ] T018 로컬 DB 리셋(quickstart §3) — board 3테이블 drop + flyway history 3행 삭제 + 재마이그레이션. **DB 쓰기 = external-infra-safety 컨펌 필수**(로컬 한정). 확인: `cards`·`links` 존재, `board_nodes`·`board_edges` 부재, `links.source_card_id/target_card_id` 존재.

---

## Phase 4: FE rename [US2] (serves US1 + US2)

> 데이터 계층(타입·함수·훅) → 카드 종류 → 어댑터 컴포넌트 → 캔버스 → 게이트. RF 자체 API는 어댑터 안 보존(PRD §8).

### 데이터 계층
- [ ] T019 `frontend/src/lib/api/boards.ts` — 타입 `BoardNodeResponse→CardResponse`·`BoardEdgeResponse→LinkResponse`(필드 `sourceNodeId/targetNodeId→sourceCardId/targetCardId`)·`BoardDetail.nodes/edges→.cards/.links`·`CreateNodeInput→CreateCardInput`·`UpdateNodeInput→UpdateCardInput`·`NodePositionItem→CardPositionItem`; 함수 `createNode/updateNode/batchNodePositions/deleteNode/createEdge/deleteEdge`→card/link; endpoint `/nodes`·`/edges`→`/cards`·`/links`.
- [ ] T020 `frontend/src/lib/electron-api/boards.ts` — shim 함수·import 타입 rename(T019 정합).
- [ ] T021 `frontend/src/lib/query/useBoards.ts` — 훅 `useCreateNode/useUpdateNode/useBatchNodePositions/useDeleteNode/useCreateEdge/useDeleteEdge`→card/link, import·mutationFn 인자(`sourceNodeId`→`sourceCardId`) 동기.
- [ ] T022 [P] `frontend/src/lib/query/useBoards.test.tsx` — 훅명·타입 참조 동기.

### 카드 종류 · 어댑터 컴포넌트
- [ ] T023 [P] `frontend/src/components/board/nodeKinds.ts` → `cardKinds.ts` — 식별자(`NODE_KINDS`/`NodeKind` 등)→card. **값 문자열(plot/character/place/theme/note) 유지**(DB type 값).
- [ ] T024 `frontend/src/components/board/NodeCard.tsx` → `CardNode.tsx` — 컴포넌트 `NodeCard`→`CardNode`, props 타입(`BoardNodeResponse`→`CardResponse`)·cardKinds import 동기. (RF custom node — 어댑터)
- [ ] T025 [P] `frontend/src/components/board/LinkEdge.tsx` — 유지(Link-led). import 타입(`BoardEdgeResponse`→`LinkResponse`)만 동기.
- [ ] T026 `frontend/src/components/board/linkGraph.ts` (+ `linkGraph.test.ts`) — `neighborNodeIds`→`neighborCardIds`·`incidentEdgeIds`→`incidentLinkIds`, `toRFEdge` 인자 `edge: BoardEdgeResponse`→`link: LinkResponse`(반환 RF `Edge` 유지), `isPairLinked/isSelfLink/canLink`의 RF `Edge[]` 인자명 유지. 테스트 헬퍼명·기대값 동기.
- [ ] T027 [P] `frontend/src/components/board/boardActions.ts` — 스토어 도메인 식별자(connect 대상 등) rename(node→card). RF 무관 부분만.

### 캔버스 (어댑터 — RF API 보존)
- [ ] T028 `frontend/src/components/board/PlotBoardCanvas.tsx` — 도메인 참조만 rename: 훅(`useCreateNode`→`useCreateCard` 등)·`.nodes/.edges`→`.cards/.links`·`BoardNodeResponse`→`CardResponse`·`sourceNodeId/targetNodeId`→`sourceCardId/targetCardId`·`nodeKinds`→`cardKinds`·`NodeCard`→`CardNode`·`linkGraph` 헬퍼명. **RF 자체 API 보존**: `useNodesState`·`useEdgesState`·`Node`/`Edge` 타입·`onConnect`·`OnConnect`·`ConnectionMode`·`nodeTypes`/`edgeTypes`·`nodesConnectable`·`getNode`·`useReactFlow`·`@xyflow/react` 그대로.

### FE 게이트
- [ ] T029 FE 게이트 GREEN — `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build`(포어그라운드). 베이스라인(685) 대비 테스트 감소 0. RSC 경계 build 통과.

---

## Phase 5: 검증 [US1] (동작 보존) + US2 (잔재 0)

- [ ] T030 회귀 grep(quickstart §5, SC-002) — (a) `grep -rniE "board_node|board_edge|BoardNode|BoardEdge" backend/src --include=*.kt` = 0, (b) `grep -rniE "board_nodes|board_edges" backend/src/main/resources/db/migration` = 0, (c) FE 어댑터 밖(`lib`·`app`) 도메인 node/edge 식별자 0, (d) 화면 문구 노드/엣지 0. 어댑터 RF API는 의도적 보존(미카운트).
- [ ] T031 풀스택 dogfooding(quickstart §4, SC-001·룰 §25) — DB→BE bootRun→FE pnpm dev 기동 후 **전항**(카드 만들기·드래그 영속·잇기 4경로·테두리 앵커·끊기·이웃 강조·매핑·뷰포트 영속·화면 문구 0)을 사용자가 확인. 일부 통과를 전체로 단정 금지.

---

## Phase 6: Polish & 마무리

- [ ] T032 [P] 문서 갱신 — `docs/board/board-roadmap.md` §0/§1/§5-B 트랙 B 체크박스 완료 + `board-track-b-impact-survey.md` 완료 표기.
- [ ] T033 finish-work — 게이트·dogfooding·grep 전부 GREEN 확인 후. **develop merge 여부(A+B 함께)는 사용자 확인**(roadmap §5-B). 회고(retrospective) + vault(02-PROGRESS/03-ISSUES) 갱신.

---

## Dependencies & 실행 순서

- **Phase 1 → 2 → 3 → 4 → 5 → 6** 순차(BE 계약 확정 후 FE, 그 후 통합 검증).
- Phase 2 내부: T003~T005(마이그레이션) → T006~T009(엔티티·repo, [P] 가능) → T010(service) → T011~T012(DTO, [P]) → T013~T014(controller·에러코드) → T015~T016(테스트) → T017(게이트).
- Phase 4 내부: T019~T021(데이터계층 순차, 타입 의존) → T022~T027([P] 가능) → T028(캔버스, 모든 FE 식별자 의존) → T029(게이트).
- **T018(DB 리셋)은 BE 게이트(T017) 후, FE dogfooding(T031) 전**. DB 쓰기 컨펌.

## 병렬 기회
- T006/T007/T008/T009(엔티티·repo 독립 파일) — 단 T010 service가 모두 의존.
- T011/T012(request/response DTO 독립) [P].
- T022~T027(FE 어댑터 컴포넌트·테스트 독립 파일) [P] — 단 T028 canvas가 모두 의존.

## MVP / 증분
- 이 트랙은 **단일 원자 increment**(rename은 부분 적용 시 컴파일 깨짐). MVP 분리 불가 — BE+FE 전부 GREEN + dogfooding 전항이 완료 기준.
