---
description: "Task list — Web 포팅 Backend 확장 (014)"
---

# Tasks: Web 포팅 — Backend 확장 (하위 작업 1)

**Input**: Design documents from `/specs/014-web-port-backend-extension/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 포함됨 — 본 프로젝트는 TDD HARD-GATE(CLAUDE.md §5). 각 Story 의 핵심 행위 테스트를 구현 **이전** RED 로 작성한다.

**Organization**: Story 단위(US1~US4). 모든 경로는 `backend/` 기준.

**공통 규약(전 태스크 적용)**:
- 소유권: `requireOwnedProject(userId, projectId)` 선행 → 실패 시 404 `RESOURCE_NOT_FOUND`
- 쓰기 service: `@Transactional(rollbackFor = [Exception::class])`, 읽기: `readOnly = true`
- Kotlin annotation 배열 인자 = `[Exception::class]` 형식 (kotlin/code-quality 회귀)
- Mock 은 repository 경계만(Classist), 상태/반환 검증 (CLAUDE.md §5-2)
- 응답 envelope = `Result<T>`, 시각 = 서버 권위 `Instant`

---

## Phase 1: Setup (Shared Schema)

**Purpose**: 4종 기능이 공유하는 스키마. research §R9 = 단일 V7.

- [x] T001 Flyway 마이그레이션 작성 `backend/src/main/resources/db/migration/V7__add_next_scene_pin_and_create_logs_sessions.sql` — `projects.next_scene TEXT NOT NULL DEFAULT ''`, `memo_projects.pinned BOOLEAN NOT NULL DEFAULT FALSE`, `project_logs`(BIGSERIAL PK, project_id FK CASCADE, body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()), `work_sessions`(BIGSERIAL PK, project_id FK CASCADE, started_at TIMESTAMPTZ NOT NULL, ended_at TIMESTAMPTZ NULL), 인덱스(`idx_project_logs_project(project_id, created_at DESC)`, `idx_work_sessions_open(project_id) WHERE ended_at IS NULL`), partial unique(`uq_memo_project_pinned(project_id) WHERE pinned`, `uq_work_session_open(project_id) WHERE ended_at IS NULL`). data-model §1~4 정합. (⚠️ 적용은 사용자 컨펌 — 작성·리뷰만, external-infra-safety §1)

**Checkpoint**: Testcontainers 가 V7 까지 자동 적용 → 모든 Story 테스트 실행 가능.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 본 feature 는 기존 backend 확장이라 별도 공통 기반 불필요. V7(Phase 1)이 유일한 공유 전제.

**⚠️ CRITICAL**: 없음 — Phase 1 완료 후 모든 Story 진입 가능.

(별도 foundational 태스크 없음. 기존 인증·소유권·Result envelope·에러 핸들러 재사용.)

**Checkpoint**: Foundation ready — US1~US4 착수 가능.

---

## Phase 3: User Story 1 — "다음 장면" 서버 저장 (Priority: P1) 🎯 MVP

**Goal**: 작품에 "다음 장면" 한 줄을 저장·수정·비우기, 조회 반영, 계정 격리. "컬럼 추가+마이그레이션+소유권+Response 확장" 패턴 확립.

**Independent Test**: 작품 생성 → nextScene 저장 → 재조회 시 반환. 빈 값으로 비우기. 타 계정 PATCH 404. 부분수정 시 타 메타 불변.

### Tests for User Story 1 (TDD — RED 먼저)

- [x] T002 [P] [US1] 통합 테스트 작성(RED) `backend/src/test/kotlin/com/writenote/controller/ProjectControllerIT.kt` 에 nextScene 케이스 추가 — PATCH 로 nextScene 저장→GET 반환(AS1), 빈 값 비우기(AS2), 타 계정 404(AS3), nextScene 만 갱신 시 title/genre 불변(AS4)

### Implementation for User Story 1

- [x] T003 [US1] `backend/src/main/kotlin/com/writenote/entity/Project.kt` — `@Column(name = "next_scene", nullable = false) var nextScene: String = ""` 추가
- [x] T004 [US1] `backend/src/main/kotlin/com/writenote/model/request/UpdateProjectRequest.kt` — `@field:Size(max = 500) val nextScene: String? = null` 추가(null=미변경, ""=비우기)
- [x] T005 [US1] `backend/src/main/kotlin/com/writenote/model/response/ProjectResponse.kt` — `val nextScene: String` 추가
- [x] T006 [US1] `backend/src/main/kotlin/com/writenote/mapper/ProjectMapper.kt` — `nextScene = project.nextScene` 매핑 추가
- [x] T007 [US1] `backend/src/main/kotlin/com/writenote/service/ProjectService.kt` `updateProject` 에 `request.nextScene?.let { project.nextScene = it }` 추가(부분수정, FR-003) → T002 GREEN
- [x] T008 [US1] 게이트 1회: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test`

**Checkpoint**: US1 독립 동작·테스트 가능 (MVP). PATCH/GET 에 nextScene 노출.

---

## Phase 4: User Story 2 — 곁쪽지 고정(작품당 1개) (Priority: P1)

**Goal**: (메모,작품) 연결에 고정 토글, 작품당 1개 불변식(새 고정 시 이전 해제), 연결단위 독립, 목록 조회에 pin 반영, 계정 격리.

**Independent Test**: 작품에 메모 2개 연결 → M1 고정 → M2 고정 시 M1 해제·M2만 고정. 해제. 같은 메모 P1·P2 연결 시 독립. 타 계정 404.

### Tests for User Story 2 (TDD — RED 먼저)

- [x] T009 [P] [US2] service 단위 테스트(RED) `backend/src/test/kotlin/com/writenote/service/MemoPinServiceTest.kt` — pin true 시 작품의 기존 pin 해제 후 대상 pin(AS2 불변식), pin false 해제(AS3), 연결단위 독립(AS4). repository 경계만 mock, 상태 검증
- [x] T010 [P] [US2] 통합 테스트(RED) `backend/src/test/kotlin/com/writenote/controller/ProjectMemoControllerIT.kt` — PUT pin 반영(AS1), 작품당 1개 전환(AS2), GET memos 에 pinned 노출(FR-009), 타 계정 404(AS5), partial unique 동시성 보강 확인

### Implementation for User Story 2

- [x] T011 [US2] `backend/src/main/kotlin/com/writenote/entity/MemoProject.kt` — `@Column(nullable = false) var pinned: Boolean = false` 추가
- [x] T012 [US2] `backend/src/main/kotlin/com/writenote/repository/MemoProjectRepository.kt` — `findByMemoIdAndProjectId`, `findAllByProjectIdAndPinnedIsTrue`, `findAllByProjectId` 추가
- [x] T013 [P] [US2] `backend/src/main/kotlin/com/writenote/model/request/SetPinRequest.kt` 신규 — `val pinned: Boolean`
- [x] T014 [P] [US2] `backend/src/main/kotlin/com/writenote/model/response/ProjectMemoResponse.kt` 신규 — MemoResponse 필드 + `pinned: Boolean`
- [x] T015 [US2] `backend/src/main/kotlin/com/writenote/service/MemoPinService.kt` 신규 — `setPin(userId, projectId, memoId, pinned)`: memo+project 소유 검증, 링크 존재 검증, pin=true 시 작품 내 기존 pin 해제 후 대상 pin(트랜잭션, FR-007) → T009 GREEN
- [x] T016 [US2] `backend/src/main/kotlin/com/writenote/service/MemoQueryService.kt` — `listByProject(userId, projectId): List<ProjectMemoResponse>`(소유 검증 + pinned 포함, 고정 우선/최신순) 추가
- [x] T017 [US2] `backend/src/main/kotlin/com/writenote/controller/ProjectMemoController.kt` 신규 — `PUT /api/projects/{projectId}/memos/{memoId}/pin`(SetPinRequest), `GET /api/projects/{projectId}/memos` → T010 GREEN
- [x] T018 [US2] 게이트 1회: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test`

**Checkpoint**: US1·US2 독립 동작. 곁쪽지 고정 + 작품 맥락 메모 목록.

---

## Phase 5: User Story 3 — 집필 기록(작품 로그) (Priority: P2)

**Goal**: 집필 기록 독립 생성(Q1) + 최신순 목록 + 최신 1건, 계정 격리, 작품 삭제 연쇄.

**Independent Test**: 기록 생성→목록 등장. 다건 시각차 → 최신순. 최신 1건. 타 계정 404. 작품 삭제 시 연쇄 제거.

**Dependency note**: US4(endWithLog)가 본 Story 의 ProjectLog 엔티티/repository 에 의존 → US3 가 US4 선행.

### Tests for User Story 3 (TDD — RED 먼저)

- [x] T019 [P] [US3] service 단위 테스트(RED) `backend/src/test/kotlin/com/writenote/service/ProjectLogServiceTest.kt` — create→반환(AS1), listByProject 최신순(AS2), latest 1건/없으면 null(AS3), 소유 검증. repository 경계만 mock
- [x] T020 [P] [US3] 통합 테스트(RED) `backend/src/test/kotlin/com/writenote/controller/ProjectLogControllerIT.kt` — POST 생성(AS1), GET 최신순(AS2), GET latest(AS3), 타 계정 404(AS4), 작품 삭제 시 CASCADE 제거(AS5), 빈 본문 400

### Implementation for User Story 3

- [x] T021 [P] [US3] `backend/src/main/kotlin/com/writenote/entity/ProjectLog.kt` 신규 — id/projectId/body/createdAt, `@PrePersist` createdAt
- [x] T022 [US3] `backend/src/main/kotlin/com/writenote/repository/ProjectLogRepository.kt` 신규 — `findByProjectIdOrderByCreatedAtDesc`, `findFirstByProjectIdOrderByCreatedAtDesc`
- [x] T023 [P] [US3] `backend/src/main/kotlin/com/writenote/model/request/CreateProjectLogRequest.kt` 신규 — `@field:NotBlank @field:Size(max = 2000) val body: String`
- [x] T024 [P] [US3] `backend/src/main/kotlin/com/writenote/model/response/ProjectLogResponse.kt` 신규 — id/projectId/body/createdAt
- [x] T025 [US3] `backend/src/main/kotlin/com/writenote/service/ProjectLogService.kt` 신규 — `create`(소유검증), `listByProject`, `latestByProject` → T019 GREEN
- [x] T026 [US3] `backend/src/main/kotlin/com/writenote/controller/ProjectLogController.kt` 신규 — `POST /api/projects/{projectId}/logs`, `GET /api/projects/{projectId}/logs`, `GET /api/projects/{projectId}/logs/latest` → T020 GREEN
- [x] T027 [US3] 게이트 1회: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test`

**Checkpoint**: US1~US3 독립 동작. 집필 기록 CRUD(생성/조회).

---

## Phase 6: User Story 4 — 작업 세션 추적 (Priority: P3)

**Goal**: 세션 시작(작품당 1개)/자동종료(30s 폐기)/종료+기록(원자, 짧아도 보존)/총 작업시간 + dangling 스케줄러 정리. 계정 격리.

**Independent Test**: 시작→열린세션 1개. 재시작 시 기존 정리. 30s 미만 자동종료 폐기. 30s 이상 보존. endWithLog 짧아도 보존+로그. 로그 실패 시 세션종료 롤백. 스케줄러가 임계초과 dangling 폐기.

**Dependency**: US3(ProjectLog 엔티티/repository) 선행 필요(endWithLog).

### Tests for User Story 4 (TDD — RED 먼저)

- [x] T028 [P] [US4] service 단위 테스트(RED) `backend/src/test/kotlin/com/writenote/service/WorkSessionServiceTest.kt` — start 시 기존 열린세션 정리(AS2), 총 작업시간 합(종료분만). repository 경계만 mock
- [x] T029 [P] [US4] 통합 테스트(RED) `backend/src/test/kotlin/com/writenote/controller/WorkSessionControllerIT.kt` — start(AS1), 재시작 1개 불변식(AS2), 30s 미만 폐기(AS3), 30s 이상 보존(AS4), endWithLog 짧아도 보존+로그(AS5), 로그 실패 시 롤백(AS6, 부분적용 없음), total, 타 계정 404
- [x] T030 [P] [US4] 스케줄러 테스트(RED) `backend/src/test/kotlin/com/writenote/service/WorkSessionCleanupServiceTest.kt` — maxOpenHours 초과 열린세션 폐기, 미만/종료세션 보존(AS7)

### Implementation for User Story 4

- [x] T031 [P] [US4] `backend/src/main/kotlin/com/writenote/entity/WorkSession.kt` 신규 — id/projectId/startedAt/endedAt(nullable), `@PrePersist` startedAt
- [x] T032 [US4] `backend/src/main/kotlin/com/writenote/repository/WorkSessionRepository.kt` 신규 — `findFirstByProjectIdAndEndedAtIsNull`, 종료세션 duration 합 쿼리(native/JPQL), `deleteByEndedAtIsNullAndStartedAtBefore(threshold)`
- [x] T033 [P] [US4] `backend/src/main/kotlin/com/writenote/model/request/EndWithLogRequest.kt` 신규 — `@field:NotBlank @field:Size(max = 2000) val body: String`
- [x] T034 [P] [US4] `backend/src/main/kotlin/com/writenote/model/response/WorkSessionResponse.kt` + `EndWithLogResponse.kt` 신규 — session/log 조합
- [x] T035 [US4] 설정값: `backend/src/main/resources/application.yml`(+profile) 에 `worksession.min-session-seconds=30`, `worksession.max-open-hours=12`, `worksession.cleanup-cron` 추가 + `@ConfigurationProperties` 홀더 클래스 `config/WorkSessionProperties.kt`
- [x] T036 [US4] `backend/src/main/kotlin/com/writenote/service/WorkSessionService.kt` 신규 — `start`(기존 열린세션 end 규칙 후 insert, FR-016), `end`(30s 미만 폐기/이상 ended_at, 서버계산 FR-017/018), `endWithLog`(원자 트랜잭션, 30s 우회 보존 + ProjectLog 생성, FR-019/020), `totalDurationMs`(R6) → T028/T029 GREEN
- [x] T037 [US4] `backend/src/main/kotlin/com/writenote/service/WorkSessionCleanupService.kt` 신규 — `@Scheduled(cron)` `@Transactional` dangling(started_at < now - maxOpenHours) 폐기(FR-021, TokenCleanupService 패턴) → T030 GREEN
- [x] T038 [US4] `backend/src/main/kotlin/com/writenote/controller/WorkSessionController.kt` 신규 — `POST .../work-sessions/start`, `.../end`, `.../end-with-log`, `GET .../work-sessions/total` → T029 GREEN
- [x] T039 [US4] 게이트 1회: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test`

**Checkpoint**: US1~US4 전부 독립 동작.

---

## Phase 7: Polish & Cross-Cutting

- [x] T040 [P] 계약 검증 — `contracts/ipc-rest-mapping.md` 의 ✅ 9행 + 🧩 2행이 실제 구현 endpoint 와 1:1 일치 확인(SC-005, 공백 0). 불일치 시 회고 §어긋남 박음
- [x] T041 OpenAPI/Swagger 어노테이션(`@Operation`/`@ApiResponses`) 신규 controller 3종에 기존 패턴대로 부착(ProjectController 정합)
- [x] T042 전체 게이트(최종 1회): `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`
- [x] T043 quickstart.md 검증 흐름 실행(부팅 smoke 선택) + DoD 확인
- [ ] T044 V7 마이그레이션 **로컬/운영 적용은 사용자 명시 컨펌 후**(external-infra-safety §1) — 적용 전 영향범위·rollback 보고
- [ ] T045 vault `~/obsidian/write-note/02-PROGRESS.md` 갱신(Phase 완료 시점, CLAUDE.md HARD-GATE) + 발견 이슈 `03-ISSUES.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1, T001)**: 즉시. 모든 Story 의 스키마 전제(Testcontainers 자동 적용)
- **Foundational (Phase 2)**: 없음
- **User Stories**:
  - US1(P1) → 독립. MVP
  - US2(P1) → 독립(US1 무관)
  - US3(P2) → 독립
  - **US4(P3) → US3 의존**(endWithLog 가 ProjectLog 엔티티/repository 사용)
- **Polish (Phase 7)**: 전 Story 완료 후

### 권장 실행 순서 (research §R11)

US1 → US2 → US3 → US4 (spec 우선순위 + US4 의 US3 의존). 각 Story 끝에 게이트 1회, 최종 T042 전체 게이트.

### Within Each Story (TDD)

테스트(RED) → 엔티티/DTO(§5-5 완화) → repository → service(GREEN) → controller(GREEN) → 게이트. 테스트는 한 번에 하나씩 추가(CLAUDE.md §5-1).

### Parallel Opportunities

- 같은 Story 내 [P] = 서로 다른 파일: DTO(request/response)들, 엔티티, 테스트 파일은 병렬 가능
- US1·US2·US3 는 서로 독립 → 인력 있으면 병렬. US4 는 US3 후
- 단, 같은 파일 수정 태스크(예: ProjectService, MemoQueryService)는 직렬

---

## Parallel Example: User Story 4

```text
# 테스트 RED 동시 작성(서로 다른 파일):
T028 WorkSessionServiceTest.kt
T029 WorkSessionControllerIT.kt
T030 WorkSessionCleanupServiceTest.kt

# DTO/엔티티 동시 작성:
T031 WorkSession.kt
T033 EndWithLogRequest.kt
T034 WorkSessionResponse.kt + EndWithLogResponse.kt
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1(T001 V7) → 2. US1(T002~T008) → 3. STOP & VALIDATE(nextScene 왕복·격리) → 데모 가능.

### Incremental Delivery

V7 → US1(MVP) → US2 → US3 → US4 → Polish. 각 Story 독립 검증 후 다음.

---

## Notes

- [P] = 다른 파일·무의존. [Story] = 추적용
- ktlint 는 **main+test 양쪽**(agent-workflow-discipline §4 회귀)
- 빌드/테스트는 **포어그라운드** 실행(CLAUDE.md 작업 실행 지침)
- subagent 위임 시: 검증 cap·verbose 통제·tool_uses cap·lint 정합(ktlintFormat main+test) 명시(agent-workflow-discipline §4)
- 마이그레이션 적용·DB 쓰기는 사용자 컨펌(external-infra-safety)
- 각 태스크/논리 그룹 후 커밋
