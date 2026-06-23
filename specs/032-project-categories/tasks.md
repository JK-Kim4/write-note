---
description: "Task list — 작품 카테고리 분류 (모음)"
---

# Tasks: 작품 카테고리 분류 (모음)

**Input**: Design documents from `/specs/032-project-categories/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/categories-api.md, quickstart.md

**Tests**: 포함(프로젝트 `CLAUDE.md §5` TDD HARD-GATE). BE=service 단위 + controller IT(Testcontainers), FE=vitest. 구현 전 실패 테스트 선작성, 한 번에 1 테스트.

**Organization**: user story(US1 P1 / US2 P2 / US3 P3)별 그룹. 단 본 프로젝트 배포는 **R1(BE) 선행 → R2(FE) 후행**(plan §R-10) — Implementation Strategy 참조.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일·무의존 → 병렬 가능
- **[Story]**: US1/US2/US3 (Setup·Foundational·Polish 은 라벨 없음)
- 모든 태스크에 정확한 파일 경로

## Path Conventions

- BE: `backend/src/main/kotlin/com/writenote/...`, 테스트 `backend/src/test/kotlin/com/writenote/...`
- FE: `frontend/src/...`, 테스트 동일 위치 `*.test.ts(x)`
- 마이그레이션: `backend/src/main/resources/db/migration/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 사전 확인 + FE 컴포넌트 디렉토리

- [X] T001 다음 마이그레이션 번호 확인 — `ls backend/src/main/resources/db/migration/ | grep -c V20` 가 0(미존재)인지, 브랜치 `032-project-categories` 인지 확인
- [X] T002 [P] FE 컴포넌트 디렉토리 생성 `frontend/src/components/library/` (모음 타일·드릴인·dnd·카드 메뉴 수용; `/library/page.tsx` 비대화 방지)

**Checkpoint**: 번호·브랜치·디렉토리 준비 완료

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 user story 가 의존하는 스키마·엔티티·기본 DTO. **이 단계 완료 전 US1~US3 진입 불가.** 신규 로직 최소(매핑·검증은 각 story 에서).

⚠️ 마이그레이션 **작성만** — 로컬/운영 DB 적용은 사용자 컨펌(external-infra-safety §1). IT 는 Testcontainers 가 Flyway 자동 적용.

- [X] T003 V20 마이그레이션 작성 `backend/src/main/resources/db/migration/V20__create_categories_and_project_category.sql` — data-model.md SQL(categories 테이블 + parent_id self-FK CASCADE + projects.category_id FK **ON DELETE SET NULL** + 인덱스 2)
- [X] T004 [P] `Category` 엔티티 `backend/src/main/kotlin/com/writenote/entity/Category.kt` — `Project.kt` 스타일 미러(@Entity name="categories", IDENTITY, @PrePersist/@PreUpdate, 필드 userId/name/parentId/sortOrder/createdAt/updatedAt)
- [X] T005 [P] `CategoryResponse` DTO `backend/src/main/kotlin/com/writenote/model/response/CategoryResponse.kt` (id/name/parentId/sortOrder/projectCount/createdAt/updatedAt)
- [X] T006 [P] `CategoryMapper` `backend/src/main/kotlin/com/writenote/mapper/CategoryMapper.kt` (`toResponse(category, projectCount)` — `ProjectMapper` 스타일)
- [X] T007 `Project` 엔티티에 `categoryId` 추가 `backend/src/main/kotlin/com/writenote/entity/Project.kt` — `@Column(name="category_id") var categoryId: Long? = null`
- [X] T008 응답에 categoryId 전파 — `model/response/ProjectResponse.kt` + `model/response/ProjectCardResponse.kt`(필드 + `from(base)` 전달) + `mapper/ProjectMapper.kt`(`categoryId = project.categoryId`) 3 파일
- [X] T009 `CategoryRepository` `backend/src/main/kotlin/com/writenote/repository/CategoryRepository.kt` — `findByIdAndUserId`, `findByUserIdOrderBySortOrderAscIdAsc(userId): List<Category>`, projectCount group-by projection(`@Query`로 category_id 별 활성 작품 수, N+1 금지)
- [X] T010 [P] (TDD) 매핑 테스트 — `backend/src/test/kotlin/com/writenote/mapper/CategoryMapperTest.kt`(category→response, projectCount 반영) + `ProjectMapperTest` 에 categoryId 매핑 assert 추가

**Checkpoint**: 스키마·엔티티·리포지토리·기본 DTO 준비 — user story 진입 가능

---

## Phase 3: User Story 1 — 카테고리 생성·배정·표시 (Priority: P1) 🎯 MVP

**Goal**: 작가가 모음을 만들고, 작품을 모음에 끌어 넣고(또는 ⋯ 이동), 작품 페이지에서 모음 타일·드릴인으로 분류된 모습을 본다. 미분류 작품은 루트에 그대로.

**Independent Test**: 모음 1개 생성 → 미분류 작품 1개를 그 모음으로 이동 → `/library` 새로고침 시 그 작품이 모음 안에, 나머지는 미분류(루트)에 보임.

### BE (R1 — FE보다 먼저 배포)

- [X] T011 [P] [US1] (TDD) `CategoryService.create` 테스트 `backend/src/test/kotlin/com/writenote/service/CategoryServiceTest.kt` — 정상 생성(sortOrder=max+1), name trim/빈값 400, **parentId 비-null 400**(1뎁스 강제), 소유 격리
- [X] T012 [US1] `CreateCategoryRequest` `backend/src/main/kotlin/com/writenote/model/request/CreateCategoryRequest.kt`(@NotBlank @Size(max=60) name, parentId: Long?=null) + `CategoryService.create` `backend/src/main/kotlin/com/writenote/service/CategoryService.kt`(requireExistingUser, parentId 비-null→ValidationException, sortOrder=현재 max+1)
- [X] T013 [P] [US1] (TDD) `CategoryService.list` 테스트(CategoryServiceTest) — 빈 모음 포함 전량 sortOrder,id 순 + projectCount 정확(작품 0/N), 타 작가 격리
- [X] T014 [US1] `CategoryService.list(userId): List<CategoryResponse>` — repository projectCount 집계 조립(N+1 금지)
- [X] T015 [P] [US1] (TDD) `ProjectService.moveCategory` 테스트 `backend/src/test/kotlin/com/writenote/service/ProjectServiceTest.kt` — categoryId 설정/ null=미분류, 본인 작품 아님 404, 남의/없는 categoryId 404
- [X] T016 [US1] `MoveProjectCategoryRequest` `backend/src/main/kotlin/com/writenote/model/request/MoveProjectCategoryRequest.kt`(categoryId: Long?) + `ProjectService.moveCategory(userId, projectId, categoryId)` `backend/.../service/ProjectService.kt`(requireOwnedProject + categoryId 비-null 시 본인 카테고리 존재 확인 → categoryId 설정)
- [X] T017 [US1] `CategoryController` `backend/src/main/kotlin/com/writenote/controller/CategoryController.kt` — `POST /api/categories`(201), `GET /api/categories`(200) (Result envelope, @AuthenticationPrincipal, Swagger 주석)
- [X] T018 [US1] `ProjectController` 에 `PATCH /api/projects/{projectId}/category` 추가 `backend/.../controller/ProjectController.kt`(MoveProjectCategoryRequest → moveCategory → ProjectResponse)
- [X] T019 [US1] (TDD) Controller IT `backend/src/test/kotlin/com/writenote/controller/CategoryControllerIT.kt` — POST/GET + 이동(`PATCH /projects/{id}/category`) happy path + 404/400 (Testcontainers, Flyway V20 자동, JWT)

### FE (R2 — BE 배포 후)

- [X] T020 [P] [US1] (TDD) API client + 훅 테스트 `frontend/src/...` — `useCategories`(GET 매핑), `useCreateCategory`, `useMoveProjectCategory`(낙관적 업데이트→실패 롤백) 행위 테스트(msw)
- [X] T021 [US1] API 클라이언트 함수 `frontend/src/lib/`(또는 기존 client 위치) — `listCategories`, `createCategory`, `moveProjectCategory(projectId, categoryId|null)` + 타입(CategoryResponse, ProjectCard+categoryId)
- [X] T022 [US1] React Query 훅 `frontend/src/...` — `useCategories`, `useCreateCategory`, `useMoveProjectCategory`(onMutate 낙관적 + onError 롤백 + invalidate categories·cards). `useProjectCards` 재사용
- [X] T023 [US1] 드릴인 상태 — `/library` 에 `?folder=<id>` URL 상태(`useSearchParams`+router), 루트/폴더 분기 셀렉터(cards 를 categoryId 로 그룹)
- [X] T024 [P] [US1] `CategoryTile` 컴포넌트 `frontend/src/components/library/CategoryTile.tsx`(모음 타일 — 이름·projectCount, 단일 클릭=열기) — `'use client'`
- [X] T025 [P] [US1] `WorkCardDraggable` + `MoveMenu` `frontend/src/components/library/`(작품 카드 dnd draggable + ⋯ 이동 메뉴: 모음 목록/분류 없음) — `'use client'`
- [X] T026 [US1] `/library/page.tsx` 재구성 — DndContext(@dnd-kit), 루트=타일+미분류 작품, 폴더=경로+작품, 카드→타일 드롭=moveProjectCategory, "+ 새 모음"=createCategory. 용어 전부 "모음"
- [ ] T027 [US1] (TDD) 컴포넌트 행위 테스트 `frontend/src/.../library/*.test.tsx` — 드롭 후 그룹 이동, ⋯ 이동, 드릴인 진입/이탈, 새 모음 생성
- [X] T028 [US1] `cd frontend && pnpm build` (RSC 경계 — `'use client'` 누락 검출)

**Checkpoint**: US1 단독으로 동작 — 모음 생성·작품 배정·드릴인 표시(MVP)

---

## Phase 4: User Story 2 — 모음 관리 (이름변경·삭제·이동) (Priority: P2)

**Goal**: 모음 이름 변경, 삭제(작품은 미분류로 보존), 작품을 다른 모음으로/미분류로 이동.

**Independent Test**: 작품 2개 든 모음 삭제 → 그 작품 2개가 미분류로 남고 모음만 사라짐.

### BE (R1)

- [X] T029 [P] [US2] (TDD) `CategoryService.rename` 테스트(CategoryServiceTest) — name 갱신/trim/빈값 400, sortOrder 변경, 본인 아님 404
- [X] T030 [US2] `UpdateCategoryRequest` `backend/.../model/request/UpdateCategoryRequest.kt`(name: String?=null @Size, sortOrder: Int?=null) + `CategoryService.rename`(findByIdAndUserId, 명시 필드 갱신)
- [X] T031 [P] [US2] (TDD) `CategoryService.delete` 테스트(CategoryServiceTest 또는 IT) — 삭제 후 소속 작품 category_id NULL(미분류 전환) 검증, 본인 아님 404
- [X] T032 [US2] `CategoryService.delete`(findByIdAndUserId → delete; DB ON DELETE SET NULL 의존) + `CategoryController` `PATCH /api/categories/{id}`(200) · `DELETE /api/categories/{id}`(204)
- [X] T033 [US2] (TDD) IT 보강 `CategoryControllerIT` — rename 200, delete 204 후 작품 미분류 확인(작품 무손실), 404

### FE (R2)

- [X] T034 [P] [US2] (TDD) 훅 테스트 — `useRenameCategory`, `useDeleteCategory`(삭제 후 cards·categories invalidate, 작품 미분류 반영)
- [X] T035 [US2] 훅 + client `useRenameCategory`/`useDeleteCategory` + `renameCategory`/`deleteCategory` 함수
- [X] T036 [US2] `CategoryTile` 에 `⋯` 메뉴(이름 변경 인라인 / 삭제) + 삭제 confirm("작품은 미분류로 이동합니다") `frontend/src/components/library/`
- [X] T037 [US2] 모음 간 이동 — 폴더 안에서 카드를 경로 "내 작품"(루트)으로 드롭 시 미분류화(useDroppable on breadcrumb) + ⋯ 이동 메뉴의 타 모음 선택
- [ ] T038 [US2] (TDD) 컴포넌트 테스트 — 이름변경 반영, 삭제 confirm 후 작품 미분류 복귀, 경로 드롭=미분류
- [X] T039 [US2] `cd frontend && pnpm build`

**Checkpoint**: US1+US2 — 생성·배정·표시 + 관리 완비

---

## Phase 5: User Story 3 — 탐색·빈 상태 (Priority: P3)

**Goal**: 드릴인 경로 탐색 다듬기 + 빈 모음/빈 미분류/첫 사용 empty state + 모바일 반응형.

**Independent Test**: 빈 모음 진입 시 "이 모음에 작품을 끌어다 놓으세요" 안내, 뒤로가기/새로고침에 위치(`?folder`) 보존.

### FE (R2)

- [X] T040 [P] [US3] 빈 상태 — 빈 모음("이 모음에 작품을 끌어다 놓으세요"), 빈 미분류(미표시/안내), 모음 0개 루트("아직 만든 모음이 없어요 + 새 모음") `frontend/src/components/library/`
- [X] T041 [P] [US3] 경로(breadcrumb) "내 작품 / 〈모음명〉 · N편" 다듬기 + 뒤로가기/새로고침 URL 보존 확인
- [X] T042 [P] [US3] 모바일 반응형 — 타일/그리드 1~3열 auto-fill, 드래그 대안(터치는 ⋯ 이동) 노출 확인
- [ ] T043 [US3] (TDD) empty state·URL 보존 컴포넌트 테스트
- [X] T044 [US3] `cd frontend && pnpm build`

**Checkpoint**: 3 user story 모두 동작

> 후속(v1 제외, plan Assumptions): 모음 타일 드래그 순서 변경(sortOrder dnd-kit/sortable), N뎁스(parentId 허용) — 별도 트랙.

---

## Phase 6: Polish & Cross-Cutting

- [X] T045 BE 전체 게이트 — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` GREEN
- [X] T046 FE 전체 게이트 — `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` GREEN
- [ ] T047 dogfooding 체크리스트(authed, 운영) — 드래그 드롭 감각 / 터치 ⋯ 이동 / 드릴인 뒤로가기·새로고침 / 모음 삭제 시 작품 미분류 복귀 / 빈 모음 표시 / 기존 작품 무손실. 자동 게이트 GREEN 을 authed 정합 증거로 단정 금지(CLAUDE.md §19)
- [ ] T048 배포 — BE(Docker blue-green, V20 적용은 컨펌) 선행 → 확인 후 FE(git push) 후행(plan §R-10)
- [ ] T049 vault 동기(`02-PROGRESS`/`03-ISSUES`) + 회고(선택)

---

## Dependencies & Execution Order

- **Setup(P1)** → **Foundational(P2)** → US 단계. P2 미완료 시 어떤 US 도 시작 불가.
- **US1(P3 phase)** = MVP. US2·US3 는 US1 의 BE 스키마/엔드포인트·FE 드릴인 셸에 의존(순차 권장).
- **BE 선행 → FE 후행**(plan §R-10): 각 story 의 BE 태스크(T011~T019, T029~T033)는 FE 태스크보다 먼저 + BE 배포 후 FE.
- TDD: 각 `(TDD)` 테스트 태스크는 같은 번호대 구현 태스크보다 **먼저**(실패 확인 후 구현).

## Parallel Opportunities

- Foundational: T004/T005/T006 [P](서로 다른 파일) 동시. T010 [P] 매핑 테스트 병행.
- US1 BE: T011/T013/T015 [P] 테스트 동시 작성. US1 FE: T024/T025 [P] 컴포넌트 병행.
- US2: T029/T031 [P], FE T034 [P].
- US3: T040/T041/T042 [P].

## Implementation Strategy

**두 가지 실행 렌즈(택1):**

1. **Story 증분(speckit 기본)**: P2 → US1 전부(BE→배포→FE→배포) → US2 → US3. 각 단계가 독립 배포 가능한 증분.
2. **Round 일괄(plan R1/R2)**: P2 + 모든 US 의 BE 태스크(T011~T019, T029~T033) 먼저 → **BE 1회 배포** → 모든 US 의 FE 태스크 → **FE 1회 배포**. 단일 개발자 + 배포 비용 절감에 적합.

**MVP = Phase 1+2+US1(T001~T028)** — 모음 생성·작품 배정·드릴인 표시. 이후 US2(관리)·US3(탐색) 증분.
