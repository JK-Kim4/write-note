---
description: "Task list for 플롯 보드 (Plot Board) implementation"
---

# Tasks: 플롯 보드 (Plot Board)

**Input**: Design documents from `/specs/038-memo-plot-board/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rest-api.md, quickstart.md

**Tests**: 포함 — 본 프로젝트는 TDD HARD-GATE(CLAUDE.md §5). 백엔드 단위(BoardServiceTest)·통합(BoardControllerIT, Testcontainers), 프론트 Vitest(매핑·상태전이) 는 실패 선작성 후 최소 구현.

**Organization**: user story 별 phase. 배포 순서 = **R1 백엔드 전체(Setup+Foundational+각 스토리 BE) GREEN → R2 FE US1 → R3 FE US2 → R4 FE US3** (FE 가 새 계약을 BE 로 보내므로 BE 선행).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일·무의존 → 병렬 가능
- **[Story]**: US1/US2/US3 (Setup·Foundational·Polish 는 라벨 없음)

## Path Conventions

- Backend: `backend/src/main/kotlin/com/writenote/...`, 테스트 `backend/src/test/kotlin/com/writenote/...`, 마이그레이션 `backend/src/main/resources/db/migration/`
- Frontend: `frontend/src/...` (cwd=`frontend/` 고정)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 패키지 골격·의존성 준비. 파괴적 작업 없음.

- [x] T001 `backend/src/main/kotlin/com/writenote/` 아래 신규 파일이 들어갈 위치 확인(entity/repository/service/controller/model/enums/error 디렉토리 기존) + 마이그레이션 다음 번호가 **V24** 임을 `ls backend/src/main/resources/db/migration | sort -V | tail -1` 로 재확인(현 최신 V23)
- [x] T002 [P] frontend: `cd frontend && pnpm add @xyflow/react` 후 설치 로그에서 React 19 peerDeps 경고 여부 확인(research R0), `package.json` 에 의존성 반영 검증

**Checkpoint**: 골격·의존성 확인 완료

---

## Phase 2: Foundational (Blocking Prerequisites) — 백엔드 공유 인프라 (R1)

**Purpose**: 세 스토리가 공유하는 스키마·엔티티·리포지토리·에러·DTO. **모든 user story BE 작업의 선행.**

**⚠️ CRITICAL**: 이 phase 완료 전 어떤 스토리 BE 구현도 시작 불가

- [x] T003 마이그레이션 작성 `backend/src/main/resources/db/migration/V24__create_plot_boards.sql` — `boards`(user_id FK CASCADE, name, category_id/project_id nullable FK ON DELETE SET NULL, viewport_zoom/x/y, 타임스탬프) + `board_nodes`(board_id FK CASCADE, body, pos_x/pos_y, z_index, 타임스탬프) + `board_edges`(board_id FK CASCADE, source/target_node_id FK CASCADE, 타임스탬프) + 인덱스(idx_boards_user, idx_board_nodes_board, idx_board_edges_board) + 부분 유니크(`uq_boards_project`/`uq_boards_category` WHERE NOT NULL) + `UNIQUE(board_id,source_node_id,target_node_id)` + `CHECK(source_node_id<>target_node_id)`. data-model.md 표 그대로. **작성만 — 로컬/운영 적용 금지(external-infra-safety)**
- [x] T004 [P] `entity/Board.kt` — Category.kt 스타일(@Column nullable 명시, @PrePersist/@PreUpdate Instant.now()), FK 는 id 컬럼 직접(@ManyToOne 미사용, Project.kt 정합): userId·name·categoryId?·projectId?·viewportZoom·viewportX·viewportY·createdAt·updatedAt
- [x] T005 [P] `entity/BoardNode.kt` — boardId·body(default "")·posX·posY·zIndex·createdAt·updatedAt
- [x] T006 [P] `entity/BoardEdge.kt` — boardId·sourceNodeId·targetNodeId·createdAt
- [x] T007 [P] `repository/BoardRepository.kt` — `findByIdAndUserId`, `findAllByUserId`, `findAllByUserIdAndProjectId`/`...AndCategoryId`, `findByProjectId`/`findByCategoryId`(매핑 충돌 검사용), `existsByProjectId`/`existsByCategoryId`
- [x] T008 [P] `repository/BoardNodeRepository.kt` — `findAllByBoardId`, `findByIdAndBoardId`, `findAllByIdInAndBoardId`(배치 검증), `countByBoardId`
- [x] T009 [P] `repository/BoardEdgeRepository.kt` — `findAllByBoardId`, `findByIdAndBoardId`, `existsByBoardIdAndSourceNodeIdAndTargetNodeId`
- [x] T010 [P] `enums/BoardErrorCode.kt` — AuthErrorCode 스타일(httpStatus+defaultMessage): BOARD_NOT_FOUND(404)·BOARD_NODE_NOT_FOUND(404)·BOARD_EDGE_NOT_FOUND(404)·BOARD_PROJECT_ALREADY_MAPPED(409)·BOARD_CATEGORY_ALREADY_MAPPED(409)·BOARD_EDGE_DUPLICATE(409)·BOARD_EDGE_INVALID(400)
- [x] T011 `error/BoardException.kt` 신규 + `error/GlobalExceptionHandler.kt` 에 BoardException → Result.failure(code,message) 분기 추가(기존 분기 무회귀, 409 코드 문자열 그대로 전달)
- [x] T012 [P] DTO 작성 `model/request/` (CreateBoardRequest·RenameBoardRequest·SetBoardProjectRequest·SetBoardCategoryRequest·UpdateViewportRequest·CreateNodeRequest·UpdateNodeRequest·BatchNodePositionRequest(List)·CreateEdgeRequest) + `model/response/` (BoardResponse·BoardSummary·BoardDetailResponse·NodeResponse·EdgeResponse) — contracts/rest-api.md DTO 정합
- [x] T013 `service/BoardService.kt` 골격 + 소유권 헬퍼 `requireOwnedBoard(userId, boardId)`(findByIdAndUserId, 없으면 BoardException(BOARD_NOT_FOUND)) — CategoryService.requireOwnedCategory 패턴

**Checkpoint**: 스키마·엔티티·리포지토리·에러·DTO·서비스 골격 준비 → 스토리 BE 구현 시작 가능

---

## Phase 3: User Story 1 - 보드 생성·노드 배치·영속 (Priority: P1) 🎯 MVP

**Goal**: 작가가 독립 보드를 만들고 노드를 생성·편집·드래그 배치하며, 위치·본문·뷰포트가 영속·복원된다.

**Independent Test**: 빈 보드 생성 → 노드 만들고 본문 입력 → 드래그(손 뗄 때 저장)·다중선택 일괄 이동 → 줌/팬 → 재진입 시 위치·본문·뷰포트 100% 복원(SC-001), 드래그 중 저장 호출 0회(SC-002).

### Tests for User Story 1 (TDD — 실패 선작성)

- [x] T014 [P] [US1] `backend/src/test/kotlin/com/writenote/service/BoardServiceTest.kt` — 보드 생성(미매핑 기본)·소유권 격리(타 user 보드 NOT_FOUND)·노드 생성/본문수정/위치 배치 갱신/삭제·뷰포트 갱신을 반환값·상태로 검증(내부 collaborator mock 금지, 시스템경계만). 실패 확인
- [x] T015 [P] [US1] `backend/src/test/kotlin/com/writenote/controller/BoardControllerIT.kt` — Testcontainers 로 POST `/api/boards`·GET `/api/boards`·GET `/api/boards/{id}`(하이드레이션 nodes/edges/viewport)·POST/PATCH(단건)/PATCH(배치)/DELETE nodes·PATCH viewport 계약·인증·소유 검증. 실패 확인

### Implementation for User Story 1 (Backend — R1)

- [x] T016 [US1] `service/BoardService.kt` 에 보드 생성(createBoard: name 검증, 매핑 미지정 시 null)·목록(listBoards: user + 선택 필터)·하이드레이션(getBoardDetail: board+nodes+edges) 구현
- [x] T017 [US1] `service/BoardService.kt` 에 노드 생성(createNode)·단건 수정(updateNode: body/pos/z 부분)·배치 위치(batchUpdateNodePositions: findAllByIdInAndBoardId 로 소유 검증 후 일괄)·삭제(deleteNode, 엣지 DB cascade)·뷰포트 저장(updateViewport) 구현
- [x] T018 [US1] `controller/BoardController.kt` 신규 — POST/GET(list)/GET(detail) boards, POST/PATCH(`{nodeId}`)/PATCH(collection 배치)/DELETE nodes, PATCH viewport. `@AuthenticationPrincipal` 주입, Result envelope 반환(contracts 정합)
- [x] T019 [US1] T014·T015 GREEN 확인 + `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test` 통과

### Implementation for User Story 1 (Frontend — R2)

- [x] T020 [P] [US1] `frontend/src/lib/api/client.ts` 에 `boards` 네임스페이스(list/get/create/updateViewport/createNode/updateNode/batchNodePositions/deleteNode) 추가 + 응답 타입 정의(NodeResponse 등)
- [x] T021 [P] [US1] `frontend/src/lib/query/useBoards.ts` — boardKeys(all/list/detail(id)), useBoardList/useBoardDetail(useQuery), 노드 생성·수정·배치·삭제·뷰포트 useMutation(onMutate 낙관적 + onError 롤백 + onSettled invalidate, useMoveProjectCategory 패턴)
- [x] T022 [US1] `frontend/src/app/(main)/boards/page.tsx` ('use client') — useAuthGuard("requireAuth") + 보드 목록 + 새 보드 만들기(독립 생성)
- [x] T023 [US1] `frontend/src/app/(main)/boards/[boardId]/page.tsx` ('use client') — useBoardDetail 하이드레이션 후 캔버스 dynamic import(`next/dynamic`, `{ssr:false}`)
- [x] T024 [P] [US1] `frontend/src/components/board/NodeCard.tsx` — 본문 말줄임 표시(FR-015) + 본문 편집 진입
- [x] T025 [US1] `frontend/src/components/board/PlotBoardCanvas.tsx` ('use client') — `@xyflow/react` ReactFlow(노드/엣지 state, `colorMode="system"`, `onlyRenderVisibleElements`), 노드 생성(빈 공간), 본문 편집, `onNodeDragStop`→배치 PATCH(드래그 중 미저장), 다중선택 일괄 이동, controlled `viewport`+`onViewportChange`→디바운스 PATCH, 낙관적 반영
- [x] T026 [P] [US1] `frontend/src/lib/query/useBoards.test.ts` (Vitest) — 노드 배치 낙관적 업데이트 onMutate/onError 롤백 동작 검증(msw 경계 mock)
- [x] T027 [US1] `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` 통과(특히 build = RSC 경계 검출)

**Checkpoint**: US1 단독 동작·테스트 가능(보드 생성→노드 배치→영속/복원). **MVP**

---

## Phase 4: User Story 2 - 노드 연결(엣지) + 백링크 (Priority: P2)

**Goal**: 노드를 방향 연결로 잇고, 노드 선택 시 들어오는/나가는 연결을 본다.

**Independent Test**: 두 노드 연결 → 노드 선택 시 백링크 방향 구분 표시 → 연결 삭제 → 노드 삭제 시 걸린 엣지 사라짐 → 재진입 복원(SC-004).

### Tests for User Story 2 (TDD)

- [x] T028 [P] [US2] `BoardServiceTest.kt` 에 엣지 케이스 추가 — 생성·중복(409)·자기연결(400)·타 보드 노드(400)·노드 삭제 시 엣지 cascade 정리 검증. 실패 확인
- [x] T029 [P] [US2] `BoardControllerIT.kt` 에 POST/DELETE `/api/boards/{id}/edges` 계약·중복 409 `BOARD_EDGE_DUPLICATE`·자기연결 400 `BOARD_EDGE_INVALID` 추가. 실패 확인

### Implementation for User Story 2 (Backend — R1)

- [x] T030 [US2] `service/BoardService.kt` 에 createEdge(source≠target·두 노드 같은 board 소속·중복 검사 → BoardException) + deleteEdge 구현
- [x] T031 [US2] `controller/BoardController.kt` 에 POST/DELETE edges 엔드포인트 추가, T028·T029 GREEN + 백엔드 게이트 통과

### Implementation for User Story 2 (Frontend — R3)

- [x] T032 [P] [US2] `frontend/src/lib/api/client.ts` boards 에 createEdge/deleteEdge 추가 + `frontend/src/lib/query/useBoards.ts` 에 엣지 useMutation(낙관적+롤백) + 409 `BOARD_EDGE_DUPLICATE`·400 `BOARD_EDGE_INVALID` 를 error.code 로 분기(기존 409 분기 무회귀, code-quality HARD-GATE)
- [x] T033 [US2] `PlotBoardCanvas.tsx` 에 `onConnect`(엣지 생성, 자기연결/중복 가드) + 엣지 선택·삭제 연결
- [x] T034 [P] [US2] `frontend/src/components/board/BacklinkPanel.tsx` — 선택 노드 기준 BoardDetail.edges 에서 들어오는(target==node)·나가는(source==node) 파생 표시(FR-022)
- [x] T035 [US2] `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` 통과

**Checkpoint**: US1+US2 독립 동작(배치 + 연결/백링크)

---

## Phase 5: User Story 3 - 작품/시리즈 매핑 + 보드 관리 (Priority: P3)

**Goal**: 보드를 작품/시리즈에 매핑·해제하고, 보드 이름변경·삭제·목록 필터로 관리한다.

**Independent Test**: 독립 보드를 작품에 매핑 → 그 작품에서 보임 → 해제 시 사라지되 보드 잔존(SC-005) → 이미 매핑된 작품에 다른 보드 매핑 시 409 → 보드 삭제 후 쪽지 책상 캡처 메모 그대로(SC-007).

### Tests for User Story 3 (TDD)

- [x] T036 [P] [US3] `BoardServiceTest.kt` 에 매핑 set/clear·대상당 1개 충돌(409)·대상 미소유·이름변경·보드 삭제(노드/엣지 cascade) 검증. 실패 확인
- [x] T037 [P] [US3] `BoardControllerIT.kt` 에 PUT project/category(set/clear)·409 `BOARD_*_ALREADY_MAPPED`·PATCH(rename)·DELETE board·GET 목록 필터(projectId/categoryId/unmapped) 추가. 실패 확인

### Implementation for User Story 3 (Backend — R1)

- [x] T038 [US3] `service/BoardService.kt` 에 setProjectMapping/setCategoryMapping(null=해제, 대상 소유 검증, 기존 보드 매핑 시 BoardException 409, 부분 유니크 위반 방어)·renameBoard·deleteBoard·목록 필터 구현
- [x] T039 [US3] `controller/BoardController.kt` 에 PUT `/{id}/project`·PUT `/{id}/category`·PATCH `/{id}`(rename)·DELETE `/{id}` + GET 필터 쿼리 추가, T036·T037 GREEN + 백엔드 전체 게이트(`ktlint... checkstyleMain test build`) 통과

### Implementation for User Story 3 (Frontend — R4)

- [x] T040 [P] [US3] `client.ts`/`useBoards.ts` 에 setProject/setCategory/rename/deleteBoard mutation 추가 + 409 `BOARD_PROJECT_ALREADY_MAPPED`·`BOARD_CATEGORY_ALREADY_MAPPED` error.code 분기
- [x] T041 [P] [US3] `frontend/src/components/board/BoardMappingControl.tsx` — 작품/시리즈 선택 매핑·해제 UI(0~1, 충돌 409 안내)
- [x] T042 [US3] `frontend/src/app/(main)/boards/page.tsx` 에 이름변경·삭제·매핑 상태 표시 + 필터(작품/시리즈/미매핑) 반영
- [ ] T043 [P] [US3] library(작품)·시리즈 화면에서 매핑된 보드 진입점 노출 — `frontend/src/app/(main)/library/page.tsx` 등에 보드 열기 링크(매핑된 보드 GET 필터 사용)
- [x] T044 [US3] `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` 통과

**Checkpoint**: 세 스토리 모두 독립 동작

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T045 [P] 성능 확인 — 노드 ~300개 보드에서 열기·드래그·줌 끊김 없음(SC-003), 필요 시 `onlyRenderVisibleElements` 재확인
- [ ] T046 [P] quickstart.md dogfooding 게이트 실행(US1~3 authed 화면, §19 prod 한계 명시) + 캡처 메모 무영향(SC-007) 확인
- [x] T047 접근성/오류 표시 — 저장 실패 시 롤백·실패 노출(FR-014) UX 점검
- [x] T048 회귀 점검 — `client.ts` 신규 409 분기가 기존 409(DOCUMENT_VERSION_CONFLICT 등) 무회귀 확인(grep + 해당 폼 동작)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup(P1)**: 즉시 시작
- **Foundational(P2)**: Setup 후 — 모든 스토리 BE 의 선행(BLOCKING)
- **US1(P3) → US2(P4) → US3(P5)**: Foundational 후. 우선순위 순 권장(독립 테스트 가능하나 BE 가 같은 BoardService/Controller 파일을 확장하므로 같은 파일 작업은 순차)
- **Polish(P6)**: 원하는 스토리 완료 후

### 배포 순서(HARD-GATE)

- 각 스토리의 **Backend(R1)** 를 먼저 완성·GREEN → 사용자 컨펌 시 OCI blue-green 배포 → 그 뒤 **Frontend(R2/R3/R4)**. FE 가 새 계약을 BE 로 보내므로 BE 선행.
- 마이그레이션 V24 적용은 배포 시점 사용자 컨펌(로컬 dev 적용 금지, IT 는 Testcontainers).

### Within Each User Story

- 테스트(실패) → 서비스 → 컨트롤러 → 프론트. 모델/리포지토리는 Foundational 에서 선완료.
- 같은 파일(BoardService.kt·BoardController.kt·client.ts·useBoards.ts)을 여러 스토리가 확장 → 그 파일 작업은 스토리 간 순차([P] 미부여).

### Parallel Opportunities

- T004~T010, T012(엔티티/리포지토리/에러/DTO, 서로 다른 파일) 병렬
- 각 스토리 내 테스트 2종(Service/Controller IT) 병렬, 서로 다른 컴포넌트 파일([P]) 병렬
- 스토리 간 병렬은 같은 BE 파일 충돌로 제한 — 워크트리 격리 시에만 권장

---

## Parallel Example: Foundational

```bash
# 서로 다른 파일 → 병렬
Task: "entity/Board.kt"        # T004
Task: "entity/BoardNode.kt"    # T005
Task: "entity/BoardEdge.kt"    # T006
Task: "repository/BoardRepository.kt"     # T007
Task: "repository/BoardNodeRepository.kt" # T008
Task: "repository/BoardEdgeRepository.kt" # T009
Task: "enums/BoardErrorCode.kt"           # T010
```

---

## Implementation Strategy

### MVP First (US1)

1. Setup(P1) → Foundational(P2, 백엔드 공유) → US1 BE(T016~T019) GREEN → BE 배포(컨펌) → US1 FE(T020~T027)
2. **STOP & VALIDATE**: 빈 보드 생성→노드 배치→재진입 복원 dogfooding(SC-001/002)
3. 데모/배포

### Incremental Delivery

- US1(MVP) → US2(엣지·백링크) → US3(매핑·관리). 각 스토리 BE 선행→FE 후행, 스토리마다 독립 검증·배포.

---

## Notes

- [P] = 다른 파일·무의존. 같은 파일(BoardService/Controller·client.ts·useBoards.ts) 확장 작업은 순차.
- TDD: 각 스토리 테스트 실패 확인 후 구현. mock 은 시스템 경계만(내부 collaborator 금지, CLAUDE.md §5-2).
- subagent 위임 시(agent-workflow-discipline §4): verbose cap·tool_uses cap·`ktlintFormat` main+test 양쪽·FE 작성 직후 `pnpm build`·인프라 쓰기 금지 명시 + 완료 후 실제 상태 확인.
- 마이그레이션·운영 쓰기는 사용자 컨펌(external-infra-safety). dogfooding 은 DB+BE+FE 3개 기동(quickstart).
