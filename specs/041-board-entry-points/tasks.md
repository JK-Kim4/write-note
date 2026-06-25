# Tasks: 보드 진입점·매핑·아이디어 보드 (트랙 C 코어)

**Branch**: `038-memo-plot-board` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**설계 SoT**: `docs/board/board-track-c-design.md` · **계약**: [contracts/board-api.md](./contracts/board-api.md) · **데이터**: [data-model.md](./data-model.md)

> 순서: **BE 선행 → FE 후행**. 모델 전환(Phase 2)이 모든 스토리의 선행. TDD = owner 검증·라벨 파생 등 순수 로직(룰 §5). 게이트 전 로컬 DB 리셋(컨펌).

## Phase 1: Setup & Migration

- [ ] T001 V24 in-place 편집 — `backend/src/main/resources/db/migration/V24__create_plot_boards.sql` boards 블록: `category_id`/`project_id`+두 FK+부분유니크인덱스 2개 제거, `owner_type VARCHAR(16)`+`owner_id BIGINT`+`ck_boards_owner_pair` CHECK+`idx_boards_owner` 추가. cards/links 블록 불변.
- [ ] T002 로컬 dev DB 리셋(사용자 컨펌 후) — `docker exec write-note-postgres psql`로 links/cards/boards DROP + `flyway_schema_history` V24·V25·V26 삭제([quickstart.md](./quickstart.md) §1). 재마이그레이션은 BE 기동/테스트가 수행.

## Phase 2: Foundational — BE 모델 전환 (모든 스토리 선행, blocking)

- [ ] T003 `backend/.../entity/Board.kt` — `categoryId`/`projectId` → `ownerType: String?`(`owner_type`)·`ownerId: Long?`(`owner_id`).
- [ ] T004 [P] `backend/.../repository/BoardRepository.kt` — 매핑충돌·project/category 기준 finder 제거, owner 기준 finder 추가(`findByUserIdAndOwnerTypeAndOwnerIdOrderByUpdatedAtDesc`·`findByUserIdAndOwnerTypeIsNullOrderByUpdatedAtDesc`) + `@Modifying clearOwner(ownerType, ownerId)`.
- [ ] T005 [P] `backend/.../enums/AuthErrorCode.kt` — `BOARD_PROJECT_ALREADY_MAPPED`·`BOARD_CATEGORY_ALREADY_MAPPED` 제거, `BOARD_OWNER_INVALID`(400) 추가.
- [ ] T006 [P] `backend/.../model/request/BoardRequests.kt`·`response/BoardResponses.kt` — `CreateBoardRequest` owner化, `SetBoardOwnerRequest` 신규, `SetBoardProjectRequest`/`SetBoardCategoryRequest` 제거. `BoardResponse`/`BoardSummary` owner化 + `BoardSummary.ownerLabel` 추가.

## Phase 3: US2 (P1) — 한 작품/시리즈에 보드 여러 개 + 단일 소유 [매핑]

**독립 테스트**: 한 작품에 보드 2개 생성(충돌 0), owner 변경 시 작품↔시리즈 배타, 본인 아닌 대상 거부.

- [ ] T007 [US2] `backend/.../service/BoardService.kt` — `validateOwner`(짝/type/본인소유, 위반 `BOARD_OWNER_INVALID`) 신설, `createBoard` owner化, `requireMappable*`의 매핑충돌 409 분기 제거. 단위테스트 RED 선행(T010).
- [ ] T008 [US2] `BoardService.setBoardOwner` + `BoardController` `PATCH /{boardId}/owner`(`SetBoardOwnerRequest`, null=해제) 신규. `PUT /{boardId}/project`·`/category`·`setProjectMapping`·`setCategoryMapping` 제거.
- [ ] T009 [US2] `BoardController.listBoards` + `BoardService.listBoards` 필터 `projectId/categoryId/unmapped` → `ownerType/ownerId/unmapped`.
- [ ] T010 [P] [US2] `backend/.../service/BoardServiceTest.kt` — owner 검증(짝 불완전·미지원·타인 대상 400)·1:N(같은 작품 보드 2개 생성)·owner set/clear 단위 (RED→GREEN, T007/T008 선행 테스트).

## Phase 4: US1 (P1) — 전역 허브에서 모든 보드 찾기 [허브]

**독립 테스트**: 작품·시리즈·아이디어 보드가 라벨과 함께 최근순, 검색으로 가로질러 필터.

- [ ] T011 [US1] `BoardService.listMyBoards` — 전체 보드 최근순 + 라벨 파생(owner_id 종류별 `findAllById` 일괄, id→title/name map, null="아이디어"), `BoardSummary(ownerLabel)` 반환. N+1 회피.
- [ ] T012 [US1] `BoardController` `GET /boards/mine` 신규.
- [ ] T013 [P] [US1] `backend/.../controller/BoardControllerIT.kt` — `GET /mine`(라벨·최근순)·`POST` owner·`PATCH /owner`·1:N·`GET` owner필터 통합 (기존 IT 갱신: projectId/categoryId→owner).
- [ ] T014 [US1] `frontend/src/lib/api/boards.ts` — `BoardSummary`/`BoardResponse` owner化+`ownerLabel`, `CreateBoardInput` owner化, `listBoardsMine()`·`setBoardOwner()` 추가, `setBoardProject`/`setBoardCategory` 제거.
- [ ] T015 [US1] `frontend/src/lib/electron-api/boards.ts`·`lib/query/useBoards.ts` — shim 정합, `useBoardsMine`·`usePatchBoardOwner` 추가, `useSetBoardProject`/`useSetBoardCategory` 제거.
- [ ] T016 [US1] `frontend/src/app/(main)/boards/page.tsx` — `useBoardsMine` 기반, 소속 라벨 칩, 클라 검색바(작품명/시리즈명/보드명 OR 필터).

## Phase 5: US3 (P2) — 아이디어 보드 & 나중에 붙이기 [picker]

**독립 테스트**: 전역 생성 picker 3경로, 아이디어 보드 생성·라벨, "작품/시리즈에 연결".

- [ ] T017 [US3] `frontend/src/components/board/BoardOwnerPicker.tsx` 신규 — "이 보드는 어디에 쓸 건가요?"(이 작품/시리즈 전체/아이디어 + 대상 select + 이름). COPY = `board-ux-worksheet.md` §5. `useProjectCards`·`useCategories` 재사용.
- [ ] T018 [US3] `boards/page.tsx` — "보드 만들기"→picker(`POST` owner), 아이디어 보드 "작품/시리즈에 연결"→picker(`PATCH /owner`). `BoardMappingControl.tsx` 제거(picker로 대체).

## Phase 6: US4 (P3) — 대상 삭제 시 보드 보존 [BE 훅]

**독립 테스트**: 작품/시리즈 hard delete 후 보드가 아이디어로 남고 카드·연결 보존.

- [ ] T019 [US4] `backend/.../service/ProjectService.kt` — `BoardRepository` 주입, `deleteProject`에 `clearOwner("project", projectId)`(같은 @Transactional).
- [ ] T020 [P] [US4] `backend/.../service/CategoryService.kt` — `BoardRepository` 주입, `delete`에 `clearOwner("category", categoryId)`.
- [ ] T021 [US4] 삭제 보존 테스트 — `BoardServiceTest` 또는 Project/Category 테스트에 hard delete 후 보드 owner null·보드 존속 검증.

## Phase 7: Polish & 검증

- [ ] T022 회귀 grep ([quickstart.md](./quickstart.md) §3) — 어댑터 밖 node/edge 0·폐기 문구 0·제거 에러코드/`BoardMappingControl`/`setBoard*` 잔존 0.
- [ ] T023 BE 게이트(로컬 리셋 T002 후) — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`.
- [ ] T024 FE 게이트 — `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] T025 dogfooding 준비 — 풀스택 기동(docker postgres→bootRun→pnpm dev) + [quickstart.md](./quickstart.md) §4 체크리스트 6항 사용자 제시.

## Dependencies & 실행 순서

- **Phase 1(T001) → Phase 2 → 나머지**. T002 리셋은 게이트(T023) 전 필수(컨펌).
- **Phase 2(T003~T006)**가 US1~US4 모두 선행(모델 전환 blocking). T004/T005/T006 [P] 병렬 가능(다른 파일).
- **US2(Phase 3)** = 매핑 코어, **US1(Phase 4)**가 그 위 허브. US2→US1 권장(매핑 계약 먼저). US1 BE(T011~T013)→FE(T014~T016).
- **US3(Phase 5)**는 US1 FE(허브·api) 후행. **US4(Phase 6)**는 Phase 2 후 독립(BE-only, T019/T020 [P]).
- **Phase 7**: 전 구현 후. T023(BE 게이트)는 T002 리셋 의존.

## MVP & 증분

- **MVP** = Phase 1+2+US2+US1(매핑 전환 + 전역 허브). 여기까지면 "1:N 매핑된 보드를 라벨과 함께 찾기"가 동작.
- US3(picker·아이디어)·US4(삭제 보존)는 증분. 전부 합쳐 트랙 C 코어 완성.
- 후속(범위 밖): 내부 탭②·집필 참조③.
