# Data Model — Web 포팅 Backend 확장 (014)

기존 backend 엔티티 컨벤션(JPA, `Long` BIGSERIAL PK, `@Column` snake_case, `@PrePersist`/`@PreUpdate` Instant, `TIMESTAMPTZ`, `ON DELETE CASCADE`)을 따른다. 출처: `entity/Project.kt`·`MemoProject.kt`·`Document.kt`, `db/migration/V6__*.sql`.

---

## 1. Project — 확장 (US1)

기존 `projects` 테이블에 컬럼 1개 추가.

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `next_scene` | `TEXT` | `NOT NULL DEFAULT ''` | 작가가 적는 "다음에 쓸 장면" 한 줄. 미입력 = 빈 문자열(desktop `schema.ts:22` 정합) |

- **엔티티 변경**: `Project.kt` 에 `@Column(name = "next_scene", nullable = false) var nextScene: String = ""` 추가.
- **DTO 변경**:
  - `UpdateProjectRequest` 에 `@field:Size(max = 500) val nextScene: String? = null` 추가(null = 미변경, 빈 문자열 = 비우기).
  - `ProjectResponse` 에 `val nextScene: String` 추가.
  - `ProjectMapper.toResponse` 에 `nextScene = project.nextScene` 매핑.
  - `ProjectService.updateProject` 에 `request.nextScene?.let { project.nextScene = it }` 추가(부분 수정, FR-003).
- **검증 규칙**: 길이 ≤ 500(한 줄 보조 표시값). 빈 문자열 허용(FR-001, Edge Case "의도적 비우기").
- **소유권**: 기존 `requireOwnedProject(userId, projectId)` 그대로(FR-022).

## 2. MemoProject — 확장 (US2)

기존 `memo_projects` 연결 테이블에 컬럼 1개 추가.

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `pinned` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | 그 작품 맥락에서의 곁쪽지 고정 여부(desktop `schema.ts:52` INTEGER 0/1 → web BOOLEAN) |

- **엔티티 변경**: `MemoProject.kt` 에 `@Column(nullable = false) var pinned: Boolean = false` 추가.
- **불변식 (FR-007)**: **작품당 pinned=true 인 memo_project 최대 1개**.
  - 앱 로직: pin 설정 트랜잭션에서 `해당 project_id 의 다른 pinned 행 → false` 후 대상 `→ true`.
  - DB 보강: `CREATE UNIQUE INDEX uq_memo_project_pinned ON memo_projects(project_id) WHERE pinned`(partial unique, R8).
- **연결 단위 독립성 (FR-008)**: pinned 는 (memo, project) 행 단위. 같은 memo 가 P1·P2 에 연결 시 각 행의 pinned 독립.
- **소유권 (FR-022)**: setPin 시 memo(`memoRepository.findByIdAndUserId`) + project(`requireOwnedProject`) 둘 다 본인 소유 검증 + 링크 존재 검증.
- **read 노출 (FR-009, R7)**: `GET /api/projects/{projectId}/memos` → 메모 + pinned(`ProjectMemoResponse`).

## 3. ProjectLog — 신규 (US3)

집필 기록(자유 텍스트 메모). desktop `project_logs`(schema.ts:61-66) 정합.

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `id` | `BIGSERIAL` | PK | |
| `project_id` | `BIGINT` | `NOT NULL REFERENCES projects(id) ON DELETE CASCADE` | 소속 작품 |
| `body` | `TEXT` | `NOT NULL` | 기록 본문(자유 텍스트) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | 생성 시각(서버 권위, R2) |

- **인덱스**: `idx_project_logs_project ON project_logs(project_id, created_at DESC)`(최신순 조회, FR-011).
- **엔티티**: `ProjectLog.kt`(@Entity, `@PrePersist` createdAt). **repository**: `ProjectLogRepository : JpaRepository<ProjectLog, Long>` — `findByProjectIdOrderByCreatedAtDesc(projectId)`(FR-011), `findFirstByProjectIdOrderByCreatedAtDesc(projectId)`(최신 1, FR-012).
- **검증 (FR-010, Edge Case)**: `body` 빈 문자열 허용 여부 — 기존 메모 패턴(`MemoEditService.updateMemo` 은 `require(body.isNotBlank())`)과 정합하여 **본문 비어있음 거부**(`@field:NotBlank`, `@field:Size(max = 2000)`). desktop 은 NOT NULL 이나 빈 본문 기록은 의미 없음.
- **소유권 (FR-022)**: 모든 read/write 가 `requireOwnedProject(userId, projectId)` 선행.
- **삭제 연쇄 (FR-013)**: `ON DELETE CASCADE` — 작품 삭제 시 자동 제거.

## 4. WorkSession — 신규 (US4)

작업 세션(집필 시간 구간). desktop `work_sessions`(schema.ts:68-73) 정합.

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `id` | `BIGSERIAL` | PK | |
| `project_id` | `BIGINT` | `NOT NULL REFERENCES projects(id) ON DELETE CASCADE` | 소속 작품 |
| `started_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | 시작 시각(서버 권위) |
| `ended_at` | `TIMESTAMPTZ` | `NULL 허용` | 종료 시각. `NULL` = 열린 세션 |

- **인덱스**: `idx_work_sessions_project ON work_sessions(project_id)`, 부분 인덱스 `idx_work_sessions_open ON work_sessions(project_id) WHERE ended_at IS NULL`(열린 세션 조회·정리용).
- **불변식 (FR-016)**: **작품당 열린 세션(ended_at IS NULL) 최대 1개**.
  - 앱 로직: start 트랜잭션에서 기존 열린 세션 정리(end 규칙) 후 insert.
  - DB 보강(선택): `CREATE UNIQUE INDEX uq_work_session_open ON work_sessions(project_id) WHERE ended_at IS NULL`(partial unique, R8).
- **상태 전이**:
  ```
  (없음) --start--> [열림: ended_at=NULL]
  [열림] --end(자동)--> duration<30s ? (삭제/폐기) : [닫힘: ended_at=now]
  [열림] --endWithLog--> [닫힘: ended_at=now] + ProjectLog 생성 (원자, 30s 폐기 우회)
  [열림] --scheduler(age>maxOpenHours)--> (삭제/폐기)
  [열림] --start(재진입)--> 기존 열림 end 규칙 적용 후 새 [열림]
  ```
- **엔티티**: `WorkSession.kt`. **repository**: `WorkSessionRepository : JpaRepository<WorkSession, Long>` —
  - `findFirstByProjectIdAndEndedAtIsNull(projectId)`(열린 세션, FR-016/017/018)
  - 종료 세션 합산(`totalDurationMs`, R6): JPQL/native `SUM(EXTRACT(EPOCH FROM ended_at - started_at))` `WHERE project_id=? AND ended_at IS NOT NULL` 또는 행 조회 후 서버 합산.
  - dangling 정리(R4): `deleteByEndedAtIsNullAndStartedAtBefore(threshold)`.
- **30초 폐기 (FR-017/018)**: 자동 종료 시 서버 계산 `now - started_at < 30s` → DELETE, else `ended_at = now`. 상수 `workSession.minSessionSeconds`(기본 30).
- **endWithLog 원자성 (FR-019/020)**: 단일 `@Transactional(rollbackFor=[Exception::class])` — 세션 종료(30s 우회, 짧아도 보존) + `ProjectLog` 생성. 로그 생성 실패 시 세션 종료도 롤백.
- **소유권 (FR-022)**: 모든 동작 `requireOwnedProject` 선행.
- **삭제 연쇄**: `ON DELETE CASCADE`.

## 5. 신규 엔티티 의존 관계

```
Project (1) ──< ProjectLog      (CASCADE)
Project (1) ──< WorkSession     (CASCADE)
Project (1) ──< MemoProject     (기존, pinned 추가)
Memo    (1) ──< MemoProject     (기존)
```

신규 엔티티에는 `userId` 직접 컬럼을 두지 않고 **project 소유권을 통해 격리**한다(기존 Document·Character 와 동일 패턴 — project 의 userId 가 권위). 모든 service 진입점에서 `requireOwnedProject(userId, projectId)` 로 검증.

## 6. 표시값 출처 매핑 (rule agent-workflow-discipline §9, R6)

| 화면 표시값 | 출처 | 본 sub-task 제공 | 비고 |
|---|---|---|---|
| 다음 장면(nextScene) | `projects.next_scene` | ✅ ProjectResponse | 저장 입력값 |
| 곁쪽지 고정(pinned) | `memo_projects.pinned` | ✅ ProjectMemoResponse | 저장 입력값 |
| 최신 기록(latestLog) | `project_logs` 최신 1 | ✅ GET logs/latest | 저장 입력값 |
| 작품 총 작업시간(totalDurationMs) | `work_sessions` 종료분 합 | ✅ GET work-sessions/total | 파생 표시값(세션 합) |
| 글자수(wordCount) | `documents.word_count`(기존) | ✅ 기존 Document | 파생 표시값 |
| **마지막 문장(lastSentence)** | document `body`(TipTap JSON) | ❌ **front 파생** | backend `plainText` 컬럼 부재(R6) — front 가 JSON 에서 파생 |
| LogCard/ProjectCard 조립 | 위 요소 합성 | ❌ **front 조립** | 다도메인 집계 = sub-task 2 (R6) |
