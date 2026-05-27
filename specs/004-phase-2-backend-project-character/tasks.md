# Tasks: Phase 2 Backend — Project Metadata & Character CRUD

**Input**: Design documents from `/specs/004-phase-2-backend-project-character/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/project-endpoints.md](./contracts/project-endpoints.md), [contracts/character-endpoints.md](./contracts/character-endpoints.md), [contracts/cascade-and-auto-provisioning.md](./contracts/cascade-and-auto-provisioning.md), [quickstart.md](./quickstart.md)

**Tests**: Test tasks 포함. 본 spec 의 TDD HARD-GATE (research R-7 + plan Constitution Check) — 메타 부분 수정 매핑 / archive 시각 박기 / reorder 일괄 갱신 / cascade 정책 / Document auto-provisioning 트랜잭션 정합 / ownership 격리 모두 RED → GREEN 의무.

**Organization**: User Story 별 phase 박음. 각 phase = 독립 increment 단위 (spec template 정합).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일 변경 + 의존 없는 task 만. 같은 파일 변경 시 [P] 미부착
- **[Story]**: spec.md 의 user story 매핑 (US1 ~ US5). Setup / Foundational / Polish 는 미부착
- 모든 task = 정확 파일 경로 명시 (agent-workflow-discipline.md §6 정합 — implement 진입 직전 grep 의무)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 본 spec 작업 진입 직전 디렉토리 / 파일 placeholder 신설. 본 spec 영역 의존성 변경 없음 (plan.md Technical Context 정합).

- [X] T001 [P] Verify backend dependency 변경 영역 없음 by running `cd backend && grep -n 'oauth2-client\|starter-data-jpa\|starter-validation' build.gradle.kts` — 본 spec 신규 의존성 0건 정합 (plan.md 정합)
- [X] T002 [P] Create components/characters/ 디렉토리 by writing placeholder file `backend/src/main/kotlin/com/writenote/components/characters/.gitkeep`
- [X] T003 [P] Create test fixture 디렉토리 by writing `backend/src/test/kotlin/com/writenote/components/characters/.gitkeep`

**Checkpoint**: 디렉토리 신설 완료, V5 마이그레이션 작성 진입 가능.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: V5 마이그레이션 + entity 3 + repository 3 + DTO 신설/확장. 모든 User Story 가 본 phase 산출에 의존.

**⚠️ CRITICAL**: 본 phase 완료 전 User Story 작업 진입 금지.

### Migration (외부 인프라 안전 HARD-GATE — 적용은 사용자 컨펌)

- [X] T004 Create V5 마이그레이션 SQL in `backend/src/main/resources/db/migration/V5__expand_projects_and_create_character_document.sql` per data-model.md §4 (projects 메타 5 컬럼 + archived → archived_at 변환 + characters/documents 테이블 신설 + 인덱스 교체)
- [X] T005 사용자 명시 컨펌 of V5 마이그레이션 적용 (`.claude/rules/infra/external-infra-safety.md` HARD-GATE) — 컨펌 후 `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'` 자동 적용

### Entity (data-model.md §1~3 정합)

- [X] T006 [P] Extend Project entity by editing `backend/src/main/kotlin/com/writenote/entity/Project.kt` — genre / targetLength / toneNotes / synopsis / worldNotes / archivedAt 6 필드 추가 + `archived BOOLEAN` 폐기 + `archive(now)` / `unarchive()` / `applyMetadata(req)` 메서드 + `isArchived()` helper
- [X] T007 [P] Create Character entity in `backend/src/main/kotlin/com/writenote/entity/Character.kt` per data-model.md §2-3 — id / projectId / name / shortDescription / notes / displayOrder / createdAt / updatedAt
- [X] T008 [P] Create Document entity in `backend/src/main/kotlin/com/writenote/entity/Document.kt` per data-model.md §3-3 — id / projectId UNIQUE / title / body JSONB (`@JdbcTypeCode(SqlTypes.JSON)`) / wordCount / version (`@Version`) / created_at / updated_at

### Repository (plan.md §"Source Code" 정합)

- [X] T009 Extend ProjectRepository in `backend/src/main/kotlin/com/writenote/repository/ProjectRepository.kt` — `findAllByUserIdAndArchivedAtIsNull(userId, Pageable)` / `findAllByUserIdAndArchivedAtIsNotNull(userId, Pageable)` / `findByIdAndUserId(id, userId)` 메서드 (기존 grep 후 정합 확인)
- [X] T010 [P] Create CharacterRepository in `backend/src/main/kotlin/com/writenote/repository/CharacterRepository.kt` — `findAllByProjectIdOrderByDisplayOrderAscCreatedAtAsc(projectId, Pageable)` / `findByIdAndProjectId(id, projectId)` / `deleteByIdAndProjectId(id, projectId)`
- [X] T011 [P] Create DocumentRepository in `backend/src/main/kotlin/com/writenote/repository/DocumentRepository.kt` — `findByProjectId(projectId)` (1:1 lookup)

### DTO (contracts/ 정합)

- [X] T012 [P] Extend CreateProjectRequest in `backend/src/main/kotlin/com/writenote/model/request/CreateProjectRequest.kt` — 메타 5 필드 추가 (모두 nullable) + Validation 어노테이션 per data-model.md §6
- [X] T013 [P] Extend UpdateProjectRequest in `backend/src/main/kotlin/com/writenote/model/request/UpdateProjectRequest.kt` — 메타 5 필드 nullable (null = 미변경 정합)
- [X] T014 [P] Extend ProjectResponse in `backend/src/main/kotlin/com/writenote/model/response/ProjectResponse.kt` — 메타 5 필드 + archivedAt + `from(project: Project)` factory
- [X] T015 [P] Create CreateCharacterRequest in `backend/src/main/kotlin/com/writenote/model/request/CreateCharacterRequest.kt` — name (필수) / shortDescription / notes / displayOrder (nullable)
- [X] T016 [P] Create UpdateCharacterRequest in `backend/src/main/kotlin/com/writenote/model/request/UpdateCharacterRequest.kt` — 모든 필드 nullable (null = 미변경)
- [X] T017 [P] Create ReorderCharactersRequest in `backend/src/main/kotlin/com/writenote/model/request/ReorderCharactersRequest.kt` — `characterIds: List<Long>` (전체 인물 순서 일괄)
- [X] T018 [P] Create CharacterResponse in `backend/src/main/kotlin/com/writenote/model/response/CharacterResponse.kt` per contracts/character-endpoints.md #20 양식 + `from(character: Character)` factory

### Repository IT (RED 의무 — TDD HARD-GATE, JPA 1차 캐시 우회 패턴)

- [X] T019 [P] Create ProjectRepositoryIT in `backend/src/test/kotlin/com/writenote/repository/ProjectRepositoryIT.kt` — `findAllByUserIdAndArchivedAtIsNull` / `findAllByUserIdAndArchivedAtIsNotNull` 분리 조회 케이스 + `flush() + clear()` 후 SELECT 검증 + N+1 회피 assertion
- [X] T020 [P] Create CharacterRepositoryIT in `backend/src/test/kotlin/com/writenote/repository/CharacterRepositoryIT.kt` — display_order 오름차순 + 동순위 created_at ASC 정렬 케이스 + `flush() + clear()` 후 SELECT
- [X] T021 [P] Create DocumentRepositoryIT in `backend/src/test/kotlin/com/writenote/repository/DocumentRepositoryIT.kt` — 1:1 lookup + body JSONB DB DEFAULT 검증 (`{"type":"doc","content":[]}`) + `flush() + clear()` 후 SELECT

**Checkpoint**: V5 마이그레이션 적용 완료 + entity / repository / DTO 모두 컴파일 + Repository IT GREEN. User Story 작업 진입 가능.

---

## Phase 3: User Story 1 - Project Metadata Persistence (Priority: P1) 🎯 MVP

**Goal**: 작가가 프로젝트에 장르·목표 분량·톤 노트·시놉시스·세계관 노트 메타 5 필드를 영속·갱신 (메타 카드 본질, DESIGN.md 74-83).

**Independent Test**: 단일 사용자 컨텍스트에서 새 프로젝트 + 메타 5 필드 영속 → 단건 조회 동일 값 → 부분 수정 후 미명시 필드 유지.

### Tests for User Story 1 (TDD RED 의무)

- [X] T022 [P] [US1] Create ProjectServiceTest in `backend/src/test/kotlin/com/writenote/service/ProjectServiceTest.kt` — 메타 부분 수정 매핑 케이스 (null = 미변경 / 명시값 = 갱신 / 빈 문자열 = 빈 문자열 저장) MockK 단위 테스트 (`eq()` / `match {}` 정확값)
- [X] T023 [P] [US1] Extend ProjectControllerIT in `backend/src/test/kotlin/com/writenote/controller/ProjectControllerIT.kt` — POST 메타 5 필드 영속 happy / PATCH 부분 수정 / `title` 누락 400 / 길이 초과 400 / 다른 사용자 404 케이스 (003 의 기존 IT 위에 추가)

### Implementation for User Story 1

- [X] T024 [US1] Extend ProjectService in `backend/src/main/kotlin/com/writenote/service/ProjectService.kt` — `createProject(userId, req)` 가 메타 5 필드 처리 / `updateProject(userId, id, req)` 가 `Project.applyMetadata(req)` 호출 (entity 위임)
- [X] T025 [US1] Update ProjectController in `backend/src/main/kotlin/com/writenote/controller/ProjectController.kt` — `createProject` / `updateProject` 메서드 시그니처 갱신 (메타 5 필드 처리 + 003 의 `@AuthenticationPrincipal` 정합 유지)
- [X] T026 [US1] Run targeted verification by executing `cd backend && ./gradlew test --tests "*ProjectServiceTest" --tests "*ProjectControllerIT"` — Phase 3 GREEN 확인

**Checkpoint**: US1 완료 — 메타 5 필드 영속 + 부분 수정 + 검증 + ownership 격리 모두 GREEN. 단독 dogfooding 가능 (quickstart.md §3-1).

---

## Phase 4: User Story 2 - Project Lifecycle (Priority: P1)

**Goal**: 작가가 프로젝트를 보관 / 보관 해제 / 영구 삭제 — 활성 목록 분리 + cascade 정책 (DESIGN.md 234 "보관함").

**Independent Test**: 프로젝트 2개 → 1개 보관 → 활성 목록 빠짐 → 보관 해제 → 다시 활성 → 영구 삭제 → cascade 검증.

### Tests for User Story 2 (TDD RED 의무)

- [X] T027 [P] [US2] Extend ProjectServiceTest in `backend/src/test/kotlin/com/writenote/service/ProjectServiceTest.kt` — archive / unarchive 멱등성 단위 케이스 + delete 가 DB FK CASCADE 위임 검증 (Service 내부 명시 자식 삭제 없음 확인)
- [X] T028 [P] [US2] Extend ProjectControllerIT in `backend/src/test/kotlin/com/writenote/controller/ProjectControllerIT.kt` — `?archived=false/true` 분리 조회 / POST archive 멱등 / POST unarchive no-op / DELETE 204 / DELETE 후 404 / 다른 사용자 404 케이스
- [X] T029 [P] [US2] Extend ProjectControllerOwnerCleanupTest in `backend/src/test/kotlin/com/writenote/controller/ProjectControllerOwnerCleanupTest.kt` (003 박힘) — 본 spec 의 7 endpoint (003 의 5 endpoint + archive/unarchive/delete) 모두 owner 격리 회귀 케이스 추가

### Implementation for User Story 2

- [X] T030 [US2] Extend ProjectService in `backend/src/main/kotlin/com/writenote/service/ProjectService.kt` — `archiveProject(userId, id)` (멱등 — 이미 archived 상태면 시각 유지) / `unarchiveProject(userId, id)` (no-op 허용) / `deleteProject(userId, id)` (`projectRepository.delete(project)` 호출, DB FK CASCADE 위임) per cascade-and-auto-provisioning.md §2-3
- [X] T031 [US2] Update ProjectController in `backend/src/main/kotlin/com/writenote/controller/ProjectController.kt` — `POST /api/projects/{id}/archive` / `POST /api/projects/{id}/unarchive` / `DELETE /api/projects/{id}` 3 endpoint 신설 per contracts/project-endpoints.md #17~#19
- [X] T032 [US2] Update SecurityConfig in `backend/src/main/kotlin/com/writenote/config/SecurityConfig.kt` if needed — 003 의 `/api/projects/**` 매핑이 본 spec 의 3 신규 endpoint 자동 포함되는지 grep 의무 (별도 매핑 불필요 시 T032 skip)
- [X] T033 [US2] Run targeted verification by executing `cd backend && ./gradlew test --tests "*ProjectServiceTest" --tests "*ProjectControllerIT" --tests "*ProjectControllerOwnerCleanupTest"`

**Checkpoint**: US2 완료 — Project lifecycle 3 endpoint + 멱등성 + ownership 격리 GREEN. cascade 자식 정리 검증은 Phase 8 cross-cutting (Character / Document 신설 후 가능).

---

## Phase 5: User Story 3 - Document Auto-Provisioning (Priority: P2)

**Goal**: 새 프로젝트 생성 시 빈 본문 1:1 자동 행 생성 — Week 3 본문 입력 시 별도 "본문 만들기" 단계 없음 (DESIGN.md 135-137).

**Independent Test**: 새 프로젝트 생성 직후 DB 조회 → `documents` 1:1 행 존재 + body default 검증 + 프로젝트 삭제 시 본문 자동 사라짐.

### Tests for User Story 3 (TDD RED 의무)

- [X] T034 [P] [US3] Extend ProjectServiceTest in `backend/src/test/kotlin/com/writenote/service/ProjectServiceTest.kt` — createProject 호출 시 documentRepository.save 가 동일 트랜잭션 안에서 호출되는지 MockK 검증 (`eq(projectId)` 매칭)
- [X] T035 [P] [US3] Create ProjectServiceIT in `backend/src/test/kotlin/com/writenote/service/ProjectServiceIT.kt` (happy 경로, 클래스 레벨 `@Transactional`) + `ProjectAutoProvisioningFailureIT.kt` (failure 경로, 비-transactional + `@MockitoBean DocumentRepository` + `@AfterEach` cleanup — production stack rollback 정합, ISSUE-014 회귀 회피) — happy: POST /api/projects 성공 → `documents.project_id` 일치 행 1개 + `body = {"type":"doc","content":[]}` (Postgres JSONB normalize 정합 JSON parse 비교) / 실패: documentRepository.save mock throws → `projects` 행도 0 (트랜잭션 롤백) per cascade-and-auto-provisioning.md §1-3

### Implementation for User Story 3

- [X] T036 [US3] Extend ProjectService.createProject in `backend/src/main/kotlin/com/writenote/service/ProjectService.kt` — `@Transactional(rollbackFor = [Exception::class])` 안에서 `documentRepository.save(Document(projectId = project.id!!))` 호출 per cascade-and-auto-provisioning.md §1-2
- [X] T037 [US3] Run targeted verification by executing `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` — BUILD SUCCESSFUL 확인 (cross-suite 회귀 검증 포함, 003 ISSUE-010 회피)

**Checkpoint**: US3 완료 — Project 생성 시 Document 자동 행 + 트랜잭션 정합 + 롤백 GREEN. Project 삭제 시 Document cascade 는 Phase 8 cross-cutting IT 에서 검증.

---

## Phase 6: User Story 4 - Character CRUD (Priority: P2)

**Goal**: 작가가 한 프로젝트의 등장인물을 추가·수정·삭제·조회 (DESIGN.md 80, 132-134). 본 spec 의 데이터 영역만 — UI 페이지는 후속 frontend spec.

**Independent Test**: 프로젝트 1개 + 인물 3개 생성 → 목록 조회 모두 등장 → 1명 수정 → 1명 삭제 → 다른 사용자 차단.

### Tests for User Story 4 (TDD RED 의무)

- [X] T038 [P] [US4] Create CharacterServiceTest in `backend/src/test/kotlin/com/writenote/service/CharacterServiceTest.kt` — CRUD 단위 케이스 + ownership 검증 helper 호출 (`eq(userId)` / `eq(projectId)` 정확값)
- [X] T039 [P] [US4] Create CharacterControllerIT in `backend/src/test/kotlin/com/writenote/controller/CharacterControllerIT.kt` — 5 endpoint (#20 GET 목록 / #21 GET 단건 / #22 POST / #23 PATCH / #25 DELETE) × happy / 다른 사용자 404 / 검증 fail 400 / 인증 401 케이스 per contracts/character-endpoints.md

### Implementation for User Story 4

- [X] T040 [US4] Create CharacterService in `backend/src/main/kotlin/com/writenote/service/CharacterService.kt` — `listCharacters` / `getCharacter` / `createCharacter` / `updateCharacter` / `deleteCharacter` 5 메서드 — 모두 ownership 검증 의무 (`projectService.requireOwnedProject` 재사용 — default A) + CharacterMapper 신설 + `requireOwnedCharacter` private helper
- [X] T041 [US4] **default A 채택** — 기존 `ProjectService.requireOwnedProject(userId, projectId)` 재사용 (`requireProjectOwnership` 신설 X, DRY 원칙 + 중복 회피)
- [X] T042 [US4] Create CharacterController in `backend/src/main/kotlin/com/writenote/controller/CharacterController.kt` — 5 endpoint (#20~#23, #25) per contracts/character-endpoints.md. `@AuthenticationPrincipal AuthenticatedPrincipal` + `Result.success` 패턴 정합 (ProjectController 정합)
- [X] T043 [US4] SecurityConfig grep 확인 — 003 의 `anyRequest().authenticated()` 정책이 `/api/projects/{pId}/characters/**` 자동 보호 (별도 매핑 불필요)
- [X] T044 [US4] Run targeted verification — `./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` BUILD SUCCESSFUL (cross-suite 회귀 0건)

**Checkpoint**: US4 완료 — Character CRUD 5 endpoint + ownership 격리 GREEN. reorder 는 Phase 7.

---

## Phase 7: User Story 5 - Character Ordering (Priority: P3)

**Goal**: 작가가 등장인물 순서를 명시 정렬 (DESIGN.md 80 사이드 패널 표시 순서). 일괄 reorder 1회.

**Independent Test**: 인물 3명 → 새 순서 일괄 전송 → 목록 응답 순서 변경 반영.

### Tests for User Story 5 (TDD RED 의무)

- [X] T045 [P] [US5] Create CharacterReorderValidatorTest in `backend/src/test/kotlin/com/writenote/components/characters/CharacterReorderValidatorTest.kt` — 누락 / 중복 / 외부 ID / 빈 배열 + happy 5 케이스
- [X] T046 [P] [US5] Extend CharacterServiceTest in `backend/src/test/kotlin/com/writenote/service/CharacterServiceTest.kt` — reorder 일괄 갱신 트랜잭션 정합 (happy + no-op 2 케이스 — ReorderValidator 호출 검증)
- [X] T047 [P] [US5] Extend CharacterControllerIT in `backend/src/test/kotlin/com/writenote/controller/CharacterControllerIT.kt` — #24 PUT reorder happy / 누락 400 / 빈 배열 200 / cross-user 404 (중복/외부ID 는 ValidatorTest 단위 영역 cover)

### Implementation for User Story 5

- [X] T048 [US5] Create CharacterReorderValidator in `backend/src/main/kotlin/com/writenote/components/characters/CharacterReorderValidator.kt` — 4 검증 (누락 / 중복 / 외부 ID / 빈 배열 = no-op) per research R-4. `ValidationException` 신설 + GlobalExceptionHandler 매핑 (400 VALIDATION_FAILED — contracts #24 정합)
- [X] T049 [US5] Extend CharacterService.reorderCharacters in `backend/src/main/kotlin/com/writenote/service/CharacterService.kt` — `@Transactional(rollbackFor = [Exception::class])` 안에서 (a) ownership 검증 (b) Validator 호출 (c) 정렬 순서대로 displayOrder = index 갱신 + PageResponse 반환 (contracts #24)
- [X] T050 [US5] Extend CharacterController PUT `/reorder` endpoint per contracts #24
- [X] T051 [US5] Run targeted verification — `./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` BUILD SUCCESSFUL (cross-suite 회귀 0건)

**Checkpoint**: US5 완료 — reorder + 4 검증 GREEN. 모든 US (5개) 독립 동작.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 모든 US 가 박힌 시점에 가능한 횡단 검증 + 문서 갱신 + frontend 트리거.

### Cross-Cutting IT (US2 cascade 완성)

- [X] T052 Extend ProjectServiceIT in `backend/src/test/kotlin/com/writenote/service/ProjectServiceIT.kt` — Project 영구 삭제 cascade 통합 검증: 인물 3명 + 본문 1행 보유 Project DELETE → `projects` / `characters` / `documents` 모두 0행 (DB FK CASCADE 정합)

### N+1 회피 검증 (FR-019, SC-009)

- [X] T053 Extend ProjectRepositoryIT — Hibernate Statistics API (`generate_statistics: true` application-test.yml 추가) + Project 목록 조회 시 `prepareStatementCount <= 2` (메인 + COUNT 외 추가 0)
- [X] T054 Extend CharacterRepositoryIT — Character 목록 조회 시 동일 Statistics assertion

### OpenAPI 문서

- [X] T055 [P] Extend ProjectController — 7 endpoint 모두에 `@Tag` + `@Operation` + `@SecurityRequirement(BearerJwt)` + `@ApiResponses` 보강 (응답 코드 명시 — 200/201/204 + 400/401/404/500)
- [X] T056 [P] Extend CharacterController — 6 endpoint 모두에 동일 OpenAPI annotation 보강 + 클래스 레벨 `@SecurityRequirement` 추가

### Docs / SoT 갱신

- [X] T057 Update SoT 변경 이력 in `docs/plan/03-backend-requirements.md` §6 — 004 R-1~R-4 결정 4행 + Phase 7 ValidationException 결정 1행 추가
- [X] T058 Update progress in `docs/plan/02-progress.md` §1 — 004 완료 항목 (Phase 1+2+3+4 MVP + Phase 5+6+7+8) 추가 + §3 다음 진입점 = 005 Frontend Views 명시
- [X] T059 Update external vault in `~/obsidian/write-note/02-PROGRESS.md` — 상태 한 줄 갱신 + §1 004 완료 항목 + §2 "다음 진입점 = 005" 신설 + §3 git 상태 갱신 + 본 세션 본질 결정 / 회귀 사례 6건 박음

### Retrospective + 검증 게이트

- [X] T060 Create retrospective in `docs/retrospectives/2026-05-27-004-phase-2-backend.md` — 5축 회고 (무엇/어떻게/잘된점/어긋난점/교훈) + §5-2 룰 갱신 후보 4건 박음 (Edit fail 검증 / JSONB roundtrip / agent-workflow-discipline §6 강조 / vault § 단위 정합)
- [X] T061 단일 검증 게이트 — `./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` BUILD SUCCESSFUL (P8-R6 시점 실행)
- [ ] T062 사용자 dogfooding execution per quickstart.md §3-1 ~ §3-9 — **사용자 영역 분리** (Claude 단독 실행 불가, curl 9건 + 본인 환경 검증 의무)

**Checkpoint**: 본 spec 의 자동 + 수동 dogfooding 모두 GREEN. 후속 frontend spec 진입 트리거 박힘.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: 의존 없음 — 즉시 시작
- **Phase 2 Foundational**: Phase 1 완료 → 모든 US 차단 prerequisite
  - 단, T005 (V5 마이그레이션 적용 사용자 컨펌) 통과 후만 T019~T021 (Repository IT) 시작 가능
- **Phase 3 US1**: Phase 2 완료 후 가능 — Project entity / Service 확장 영역
- **Phase 4 US2**: Phase 2 완료 후 가능. Phase 3 와 독립 (다른 endpoint / Service 메서드) — 병렬 가능
- **Phase 5 US3**: Phase 3 의 createProject 위에 박음 (`ProjectService.createProject` 같은 메서드 수정) — **Phase 3 완료 후 진행 (병렬 X)**
- **Phase 6 US4**: Phase 2 완료 후 가능 — Character entity / Service / Controller 신설 영역. Phase 3/4/5 와 독립 — 병렬 가능
- **Phase 7 US5**: Phase 6 완료 후 진행 (`CharacterService.reorderCharacters` 가 Phase 6 의 helper 호출) — **순차**
- **Phase 8 Polish**: 모든 Phase 완료 후. T052 cascade IT 는 Phase 5/6 산출 의존

### Parallel Opportunities

- Phase 1: T001 / T002 / T003 모두 [P] — 병렬
- Phase 2 entity 신설: T006 / T007 / T008 [P] — 다른 파일 — 병렬
- Phase 2 repository: T010 / T011 [P] — 다른 파일 (T009 는 ProjectRepository 확장, 003 결과 위에 박음 — 단독)
- Phase 2 DTO: T012~T018 모두 [P] — 모두 다른 파일
- Phase 2 Repository IT: T019 / T020 / T021 [P] — 다른 파일
- Phase 3 / Phase 4 / Phase 6: 다른 Service / Controller 영역 — 병렬 가능 (단, Phase 3 의 `ProjectService` 수정 영역 = Phase 4 의 `ProjectService` 수정 영역 → 같은 파일 충돌 회피 위해 순차 권장)
- Phase 8 OpenAPI: T055 / T056 [P] — 다른 Controller

### Within Each User Story (TDD HARD-GATE)

- Test task (T022 / T023 / T027 / T028 / T029 / T034 / T035 / T038 / T039 / T045 / T046 / T047) MUST RED 박힘 (FAIL) 확인 후 Implementation task 진입
- Implementation 후 GREEN 확인 → 다음 task 진입

---

## Parallel Example: Phase 2 Foundational

```bash
# Entity 3종 병렬 (다른 파일):
Task: "Extend Project entity in backend/src/main/kotlin/com/writenote/entity/Project.kt"
Task: "Create Character entity in backend/src/main/kotlin/com/writenote/entity/Character.kt"
Task: "Create Document entity in backend/src/main/kotlin/com/writenote/entity/Document.kt"

# DTO 7종 병렬 (모두 다른 파일):
Task: "Extend CreateProjectRequest..."
Task: "Extend UpdateProjectRequest..."
Task: "Extend ProjectResponse..."
Task: "Create CreateCharacterRequest..."
Task: "Create UpdateCharacterRequest..."
Task: "Create ReorderCharactersRequest..."
Task: "Create CharacterResponse..."

# Repository IT 3종 병렬 (다른 파일):
Task: "Create ProjectRepositoryIT..."
Task: "Create CharacterRepositoryIT..."
Task: "Create DocumentRepositoryIT..."
```

---

## Implementation Strategy

### MVP First (US1 + US2 = 메타 영속 + lifecycle)

본 spec 의 MVP 정의 = Project 메타 5 필드 영속 + lifecycle (P1 두 개). 작가가 *프로젝트 메타 카드를 채우고 보관 / 삭제* 가능한 시점이 dogfooding 의 최소 가치 단위.

1. Phase 1 Setup
2. Phase 2 Foundational (V5 마이그레이션 사용자 컨펌 박음)
3. Phase 3 US1 → STOP 후 quickstart §3-1 검증
4. Phase 4 US2 → STOP 후 quickstart §3-2 검증
5. **MVP Ready** — Week 3 본문 입력 진입 전 dogfooding 가능

### Incremental Delivery

1. MVP (위) → 추가 검증 → 후속 phase
2. Phase 5 US3 (Document auto-provisioning) → Week 3 본문 진입 사전 준비
3. Phase 6 US4 (Character CRUD) → 메모 큐레이션 (Week 4) 사전 준비
4. Phase 7 US5 (reorder) → 사이드 패널 표시 (Week 3) 사전 준비
5. Phase 8 Polish → 본 spec 종료 + frontend 트리거

### Cost / Subagent 정책 (`~/.claude/rules/shared/subagent-delegation-cost.md` 정합)

- Phase 1 / Phase 8 docs 갱신: 직접 (LOC < 50)
- Phase 2 Foundational (entity / DTO / migration): 직접 (다른 파일 다수 — Read+Write 직접)
- Phase 3 / 4 / 5 (Project Service / Controller 변경): 직접 또는 단일 agent 위임 (LOC ~200~300, 라운드 의존)
- Phase 6 / 7 (Character 신설): 단일 agent 위임 검토 (LOC ~400, 다중 분기 — reorder validator)
- Phase 8 cross-cutting (cascade IT): 직접 (단일 IT 파일)

위임 시 dispatch prompt 의무 (subagent-delegation-cost.md 정합):
- 라운드별 검증 명령 2개 이하 (좁은 테스트 + ktlint), 전체 검증 마지막 1회 (T061)
- `--rerun-tasks` 사용 금지 (SQL 변경 시만)
- commit 금지 (orchestrator 가 phase 묶어서 commit)
- tool_uses 50 cap + 같은 에러 3 회 재시도 금지

---

## Notes

- [P] tasks = 다른 파일 + 의존 없음
- 모든 task 의 정확 파일 경로는 implement 진입 직전 grep 의무 (`~/.claude/rules/shared/agent-workflow-discipline.md §6`) — 003 의 `T066 명시 "6 endpoint 모두" vs 실제 5 endpoint` 회귀 회피
- 본 spec 의 endpoint 수 = 13 (Project 7 + Character 6). 회귀 검증 = T026 / T033 / T044 / T051 의 좁은 테스트 실행 결과
- 각 phase 종료 후 commit 권장 (Phase 단위 원자성) — `~/.claude/rules/shared/git-workflow.md` 정합
- V5 마이그레이션 적용은 HARD-GATE — T005 사용자 컨펌 박은 후만 진행 (`.claude/rules/infra/external-infra-safety.md`)
- frontend 트리거는 T058 (본 repo `docs/plan/02-progress.md`) + T059 (외부 vault) 양쪽 갱신 의무 — spec.md Assumptions §2 정합
