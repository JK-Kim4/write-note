# Phase 0 Research — Web 포팅 Backend 확장 (014)

본 문서는 spec 의 [NEEDS CLARIFICATION] 후속(specify 단계에서 Q1·Q2 해소 완료) + plan 단계에서 결정해야 할 설계 미지수를 코드베이스 실측 근거로 확정한다. 형식: **Decision / Rationale / Alternatives**.

조사 출처(실측): backend `entity/Project.kt`·`MemoProject.kt`·`Document.kt`, `service/ProjectService.kt`·`MemoEditService.kt`, `controller/ProjectController.kt`·`MemoController.kt`, `service/TokenCleanupService.kt`, `BackendApplication.kt`(@EnableScheduling), `db/migration/V6__*.sql`, desktop `db/schema.ts`·`types.ts`·`workSessionRepository.ts`·`projectLogRepository.ts`·`ipc/contract.ts`.

---

## R1. ID 타입 — desktop TEXT(UUID) ↔ backend Long(BIGSERIAL)

- **Decision**: 신규 엔티티(ProjectLog·WorkSession) 및 모든 PK/FK 는 기존 backend 컨벤션대로 `Long`(BIGSERIAL) 사용. desktop 의 TEXT UUID 는 채택하지 않는다.
- **Rationale**: backend 전 엔티티(`Project`·`Memo`·`Document`·`Character`)가 `@GeneratedValue(IDENTITY)` Long. 신규 2 테이블만 UUID 로 하면 FK·소유권 쿼리 패턴이 깨진다. desktop↔web 의 ID 형식 차이는 front 이식(하위 작업 2)의 매핑 책임이며 본 backend 범위 밖.
- **Alternatives**: UUID 채택(기각 — 전 엔티티 비정합, 인덱스 비용↑).

## R2. 시각 표현 — desktop 클라이언트 ISO 문자열 ↔ backend Instant/TIMESTAMPTZ

- **Decision**: 모든 시각(세션 started_at/ended_at, 로그 created_at)은 **서버 권위 시각**(`Instant` + DB `TIMESTAMPTZ`)으로 박는다. desktop 의 `new Date().toISOString()`(클라 시계)는 채택하지 않는다.
- **Rationale**: 다중 기기 환경에서 클라 시계는 신뢰 불가(세션 길이·30초 임계값 판정 왜곡). 기존 엔티티의 `@PrePersist`(`createdAt`/`updatedAt`) 패턴과 정합.
- **Alternatives**: 클라 제공 시각 수용(기각 — 통계 왜곡·악용 가능).

## R3. 작업 세션 30초 임계값 판정 위치

- **Decision**: 30초(`MIN_SESSION_MS=30_000`) 미만 폐기 판정은 **서버에서** `now - started_at` 으로 계산. 자동 종료(`end`) 경로에만 적용, "종료+기록"(`endWithLog`)은 우회(짧아도 보존). desktop `workSessionRepository.ts:43-62`·`109-145` 동일 로직.
- **Rationale**: started_at 이 서버 권위 시각(R2)이므로 판정도 서버. 클라가 duration 을 보내면 조작 가능.
- **임계값 상수**: backend 설정값(`@Value` 또는 properties, 기본 30초)으로 노출 — desktop 과 동일 기본값.
- **Alternatives**: 클라가 duration 전달(기각 — R2).

## R4. dangling 세션 정리 트리거 (spec Q2 = 서버 스케줄러 확정)

- **Decision**: 두 층으로 정리한다.
  1. **즉시(트랜잭션 내)** — 세션 시작 시 그 작품의 기존 열린 세션을 정리(FR-016). 재진입 시 dangling 자동 해소(desktop `start()`→`endOpen()` 정합). 단 이 경로는 30초 폐기 규칙을 탄다(desktop 동일).
  2. **주기 스케줄러** — `@Scheduled` 작업이 **현실적 최대 작업 길이(기본 12시간) 초과**해 열려 있는 세션을 폐기(DELETE). 기존 `TokenCleanupService`(`@Scheduled(cron="0 0 0 * * *")`)·`@EnableScheduling`(이미 활성) 패턴 재사용.
- **Rationale**: spec Q2 가 클라 heartbeat 가 아닌 서버 스케줄 채택. 재진입한 작품은 (1)이 즉시 정리, 다시 안 들어온 작품의 dangling 은 (2)가 청소. dangling 세션은 의미 있는 종료 시각이 없으므로 보존하지 않고 폐기(desktop `closeDangling()` 정합 — desktop 은 "앱 시작 시" 전량 삭제, web 은 "임계 초과분" 삭제로 다중기기 안전화).
- **임계값/주기**: `workSession.maxOpenHours`(기본 12) + cron(기본 매시간 `0 0 * * * *`)을 properties 로 노출. 베타에서 조정 가능.
- **Alternatives**:
  - 클라 heartbeat(기각 — spec Q2, front 복잡도↑).
  - 즉시 정리만(기각 — 다시 안 들어온 작품의 dangling 영구 잔존).
  - desktop 식 "전량 삭제"(기각 — web 다중기기에서 타 기기의 정상 진행 세션까지 삭제 위험).

## R5. 집필 기록 생성 경로 (spec Q1 = 독립 생성 endpoint 확정)

- **Decision**: 두 생성 경로 모두 제공.
  1. **독립 생성** `POST /api/projects/{projectId}/logs` (세션 무관, Q1·설계 §4 POST).
  2. **세션 종료+기록** `POST /api/projects/{projectId}/work-sessions/end-with-log` (원자 트랜잭션, 세션 종료 + 로그 생성).
- **Rationale**: Q1 확정. 두 경로는 동일 `ProjectLog` 행을 만든다. (2)는 desktop 의 유일 경로, (1)은 web 추가(설계 §4).
- **Alternatives**: (2)만(기각 — Q1 사용자 선택이 독립 endpoint 추가).

## R6. `logs:list`(LogCard 집계)·`projects:listCards`(ProjectCard) 의 표시값 출처 — 본 backend vs front 조립 (HARD-GATE: agent-workflow-discipline §9)

desktop `LogCard`(types.ts:60-67) = `{ project, wordCount(document.word_count), lastSentenceSource(document.plain_text), latestLog, totalDurationMs(종료 세션 합) }`. `ProjectCard`(types.ts:43-44) = `Project + lastSentenceSource`.

- **실측 발견**: backend `Document`(entity/Document.kt) 에는 `wordCount`(존재) 는 있으나 **`plainText` 컬럼이 없다**(`body` jsonb + `wordCount` 만). desktop `plain_text` 의 backend 대응 컬럼이 부재.
- **Decision**:
  - **backend(본 sub-task)가 제공하는 직접 read**: 작품별 `latestLog`(`GET .../logs/latest`), 작품별 `totalDurationMs`(`GET .../work-sessions/total`), `nextScene`(ProjectResponse 확장), `wordCount`(기존 Document). 곧 각 카드 구성 요소를 backend 가 1건씩 조회 가능하게 한다.
  - **카드 집계(LogCard/ProjectCard 조립)와 "마지막 문장(lastSentence)" 파생은 front(하위 작업 2)** 가 담당. lastSentence 는 backend `plainText` 부재로 front 가 document 의 TipTap JSON(`body`)에서 파생(에디터가 이미 JSON 을 다루므로 정합).
  - 따라서 `logs:list` 의 계약 매핑 = "front 가 (작품 목록 + 작품별 latestLog + 작품별 totalDuration + document wordCount + 클라 파생 lastSentence) 로 조립". 단일 backend 집계 endpoint 는 본 sub-task 에서 만들지 않는다.
- **Rationale**: §4 범위는 컬럼 2 + 테이블 2. 다도메인(project+document+log+session) 집계 read-model 은 베타 "desktop 1:1" 의 front 조립 영역(rule §9: 표시값 출처를 plan 에 명시). backend `plainText` 신설은 §4 범위 밖 scope creep.
- **Alternatives**:
  - backend 단일 집계 endpoint `GET /api/logs`(작품별 카드 일괄)(보류 — N+1 우려 시 sub-task 2 에서 추가 결정. 베타 작품 수 적어 front 조립으로 충분).
  - backend `Document.plainText` 컬럼 신설(기각 — §4 범위 밖, front JSON 파생으로 해결).
- **Surfacing(별도 트랙)**: "records 화면 N+1(작품 N개 × latestLog/total 조회)" 은 베타 규모에서 수용. 규모 증가 시 집계 endpoint 신설을 sub-task 2 또는 후속에서 재검토 — 회고/02-progress 에 메모.

## R7. 곁쪽지 고정 read 노출 — FR-009 충족 경로

- **Decision**: 작품 맥락 메모 조회 `GET /api/projects/{projectId}/memos`(작품에 연결된 메모 + 각 `pinned`)를 본 sub-task 에 포함(desktop `memos:listByProject`→`ProjectMemo[]` 1:1). setPin 응답에도 갱신된 pin 상태 반영.
- **Rationale**: FR-009("목록 조회에 고정 상태 반영")는 본 sub-task 요구. 기존 `GET /api/memos?projectId=` 는 `MemoResponse`(pinned 없음) 반환이라 부족. pinned 컬럼의 자연스러운 read 이므로 본 작업에 포함.
- **Alternatives**: 기존 `GET /api/memos` 에 pinned 필드 추가(기각 — pinned 는 작품 맥락 종속값이라 작품 무관 목록에 넣으면 의미 모호; 작품별 전용 read 가 정합).

## R8. 불변식의 강제 위치 — 앱 로직 vs DB 제약

- **Decision**: 두 "유일성" 불변식을 **앱 로직(트랜잭션) 우선 + DB partial unique index 보강**으로 강제.
  - 곁쪽지 작품당 1개 고정: 트랜잭션에서 "그 작품의 다른 pinned 해제 후 대상 pin" + `CREATE UNIQUE INDEX ... ON memo_projects(project_id) WHERE pinned`(partial).
  - 작품당 열린 세션 1개: start 트랜잭션에서 "기존 열린 세션 정리 후 insert" + (선택) `CREATE UNIQUE INDEX ... ON work_sessions(project_id) WHERE ended_at IS NULL`(partial).
- **Rationale**: desktop 은 앱 로직만으로 보장(단일 기기라 충분). web 다중기기 동시성에서 앱 로직만이면 race 로 2개 고정/2개 열린 세션 가능 → DB partial unique 로 최종 일관성 보강(spec Edge Cases "마지막 고정 승리"·"열린 세션 1개" 충족). 동시 insert 충돌 시 한쪽 실패는 클라 재시도/사용자 재시도로 흡수(베타 수용).
- **Alternatives**: 앱 로직만(기각 — 다중기기 race). 비관적 락(기각 — 베타 과설계).

## R9. 마이그레이션 — Flyway V7 (컬럼 2 + 테이블 2)

- **Decision**: 단일 마이그레이션 `V7__add_next_scene_pin_and_create_logs_sessions.sql`.
  - `ALTER TABLE projects ADD COLUMN next_scene TEXT NOT NULL DEFAULT ''`
  - `ALTER TABLE memo_projects ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE`
  - `CREATE TABLE project_logs (...) ON DELETE CASCADE` + index `(project_id, created_at DESC)`
  - `CREATE TABLE work_sessions (...) ON DELETE CASCADE` + index `(project_id)`, partial index `(ended_at) WHERE ended_at IS NULL`
  - partial unique index 2건(R8)
- **Rationale**: 기존 V1~V6 컨벤션(`V{N}__{desc}.sql`, BIGSERIAL, TIMESTAMPTZ, `ON DELETE CASCADE`) 정합. 적용은 **사용자 컨펌 필수**(external-infra-safety §1 — 마이그레이션 적용은 컨펌; 작성·리뷰는 자유).
- **Alternatives**: 항목별 4개 마이그레이션(기각 — 한 sub-task 의 원자적 스키마 변경, 단일 버전이 명료).

## R10. 테스트 전략 (TDD HARD-GATE)

- **Decision**: 항목별 Red-Green-Refactor. 단위(service: MockK 로 repository 경계만 mock, 상태·반환 검증) + 통합(controller/repository: Spring Boot Test + Testcontainers Postgres). `@DisplayName` 한국어. ktlint(main+test)+checkstyle+test+build 게이트.
- **핵심 행위 테스트**: 30초 경계(미만 폐기/이상 보존), endWithLog 원자성(로그 실패 시 세션 종료 롤백 — FR-020), 작품당 1개 불변식(pin·열린세션), 소유권 격리(타 계정 404), dangling 스케줄러(임계 초과 폐기/미만 보존).
- **Rationale**: CLAUDE.md TDD 규율 + kotlin/code-quality. endWithLog 원자성·30초 경계는 mock 으로 검증 불가한 트랜잭션/시각 로직이라 통합 테스트 필수.

## R11. 구현 순서 (spec User Story 우선순위 정합)

US1(next_scene, P1) → US2(pinned, P1) → US3(project_logs, P2) → US4(work_sessions, P3). next_scene 가 "컬럼 추가+마이그레이션+소유권+ProjectResponse 확장" 패턴을 먼저 확립하고, 이후 항목이 재사용. work_sessions 는 logs(endWithLog 의존) 다음. 각 항목 GREEN 후 전체 게이트 1회.
