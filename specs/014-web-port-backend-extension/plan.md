# Implementation Plan: Web 포팅 — Backend 확장 (하위 작업 1)

**Branch**: `014-web-port-backend-extension` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-web-port-backend-extension/spec.md`

## Summary

desktop(Electron 로컬 단독)에서 검증된 기능 4종 — "다음 장면"(`projects.next_scene`), 곁쪽지 고정(`memo_projects.pinned`), 집필 기록(`project_logs`), 작업 세션(`work_sessions`) — 을 기존 Spring Boot 백엔드에 서버 영속·계정 격리로 확장한다. 컬럼 2건 추가 + 신규 테이블 2건(Flyway V7), 신규 엔티티/repository/service/controller, 그리고 dangling 세션 정리용 스케줄러를 추가한다. 산출물로 desktop 27 IPC 채널 ↔ REST 계약 매핑을 확정해 하위 작업 2(front 이식)의 입력 계약으로 삼는다.

기술 접근(research.md): ID=Long(기존 정합), 시각=서버 권위 Instant/TIMESTAMPTZ, 30초 폐기·endWithLog 원자성=서버 트랜잭션, dangling 정리=`@Scheduled`(기존 `TokenCleanupService` 패턴), 불변식=앱 로직+DB partial unique index. LogCard/ProjectCard 다도메인 집계와 "마지막 문장" 파생은 front(sub-task 2) 조립(backend `Document.plainText` 부재).

## Technical Context

**Language/Version**: Kotlin 2.2 on Java 24 toolchain (시스템 Corretto 25)

**Primary Dependencies**: Spring Boot 4.0.6 (Web · Security · Data JPA · Validation), Flyway, Hibernate, Jackson

**Storage**: PostgreSQL (Supabase Postgres — DB 만 사용). 통합 테스트는 Testcontainers Postgres

**Testing**: JUnit 5 + AssertJ + MockK (단위), Spring Boot Test + Testcontainers (통합). TDD HARD-GATE

**Target Platform**: Render 호스팅 백엔드 (Linux server)

**Project Type**: Web service (backend) — 기존 `backend/` 모듈 확장. front/desktop 변경 없음(본 sub-task)

**Performance Goals**: 베타 규모(소수 사용자·작품). 특별 목표 없음. records 화면 N+1(작품별 조회)은 베타 수용(research §R6)

**Constraints**: 외부 DB 쓰기·마이그레이션 적용은 사용자 컨펌(external-infra-safety §1). ktlint(main+test)+checkstyle 게이트. 추측 금지 HARD-GATE

**Scale/Scope**: 컬럼 2 + 테이블 2 + 엔티티 2(+repo/service/controller/DTO) + 스케줄러 1 + 마이그레이션 1(V7). 신규 REST endpoint ~10개. 변경 파일 추정 ~25

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> `.specify/memory/constitution.md` 는 미작성 템플릿(placeholder). 본 프로젝트의 실질 governance = `CLAUDE.md` + `.claude/rules/*`. 이를 게이트로 적용.

| 게이트(출처) | 판정 | 근거 |
|---|---|---|
| 추측 금지 / 단정 금지(CLAUDE.md 최우선) | ✅ | 4종 데이터 모델·IPC·패턴 전부 코드 실측(research 출처 인용). Q1·Q2 사용자 확정 |
| TDD Red-Green-Refactor(CLAUDE.md §5) | ✅ | research §R10·quickstart 에 항목별 사이클. 30s 경계·endWithLog 원자성=통합 테스트 |
| Mock 경계 Classist(§5-2) | ✅ | service 단위테스트는 repository 경계만 mock, 상태/반환 검증. 내부 collaborator mock 금지 |
| Kotlin code-quality(ktlint/checkstyle, `[Exception::class]`) | ✅ | quickstart 게이트에 main+test 양쪽 ktlint. 배열 인자 `[Exception::class]` 명시 |
| Spring 정합(생성자 주입, @Transactional rollbackFor, 스케줄링) | ✅ | 기존 패턴 재사용. `@EnableScheduling` 이미 활성 |
| 외부 인프라 안전(쓰기/마이그레이션 컨펌)(external-infra-safety) | ✅ | 마이그레이션 적용=컨펌. Testcontainers 격리 DB 는 자유 |
| 표시값 출처 명시(agent-workflow-discipline §9) | ✅ | data-model §6 표시값 출처 표 + R6 front 조립 seam 명시 |
| Surgical changes(CLAUDE.md §3) | ✅ | 기존 코드 "개선" 금지, 4종 관련 변경만 |

**위반 없음.** Complexity Tracking 불요.

## Project Structure

### Documentation (this feature)

```text
specs/014-web-port-backend-extension/
├── plan.md              # 본 파일
├── spec.md              # /speckit-specify 산출
├── research.md          # Phase 0 (R1~R11)
├── data-model.md        # Phase 1 — 엔티티 4 + 표시값 출처
├── quickstart.md        # Phase 1 — 실행/검증
├── contracts/
│   ├── rest-api.md      # REST endpoint 계약
│   └── ipc-rest-mapping.md  # FR-023 IPC↔REST 매핑
└── checklists/
    └── requirements.md  # spec 품질 체크리스트(통과)
```

### Source Code (repository root)

기존 `backend/` 단일 모듈 확장. 신규/변경 파일(패키지 `com.writenote`):

```text
backend/src/main/kotlin/com/writenote/
├── entity/
│   ├── Project.kt              # 변경: + nextScene
│   ├── MemoProject.kt          # 변경: + pinned
│   ├── ProjectLog.kt           # 신규
│   └── WorkSession.kt          # 신규
├── repository/
│   ├── MemoProjectRepository.kt  # 변경: pin 조회/갱신 쿼리
│   ├── ProjectLogRepository.kt   # 신규
│   └── WorkSessionRepository.kt  # 신규
├── service/
│   ├── ProjectService.kt       # 변경: updateProject + nextScene
│   ├── MemoPinService.kt       # 신규(setPin + 작품당 1개 불변식)
│   ├── MemoQueryService.kt     # 변경 or 신규: listByProject(+pinned)
│   ├── ProjectLogService.kt    # 신규(create/list/latest)
│   ├── WorkSessionService.kt   # 신규(start/end/endWithLog/total)
│   └── WorkSessionCleanupService.kt  # 신규(@Scheduled dangling)
├── controller/
│   ├── ProjectController.kt    # 변경: PATCH nextScene 노출
│   ├── MemoController.kt       # 변경 or 신규 엔드포인트: pin/listByProject
│   ├── ProjectLogController.kt # 신규
│   └── WorkSessionController.kt # 신규
├── model/request/   # CreateProjectLogRequest, EndWithLogRequest, SetPinRequest, UpdateProjectRequest(확장)
├── model/response/  # ProjectLogResponse, WorkSessionResponse, EndWithLogResponse, ProjectMemoResponse, ProjectResponse(확장)
├── mapper/          # ProjectMapper(확장), 신규 mapper(or 인라인)
└── src/main/resources/db/migration/
    └── V7__add_next_scene_pin_and_create_logs_sessions.sql  # 신규

backend/src/test/kotlin/com/writenote/   # 항목별 단위(service) + 통합(controller/repository, Testcontainers)
```

**Structure Decision**: 기존 backend 레이어 컨벤션(Controller→Service→Component→Repository)을 그대로 따른다. ProjectLog·WorkSession 은 project 소유권 경유 격리(userId 직접 컬럼 없음 — Document·Character 패턴 정합). controller/service 분리는 도메인별 단일책임(MemoPinService 를 MemoEditService 와 분리해 pin 트랜잭션 독립).

## Phase 0 — Research

완료 → [research.md](./research.md). R1~R11 결정: ID=Long, 서버 권위 시각, 30s 서버 판정, dangling 2층 정리(start 즉시+스케줄러), 독립 로그 생성 endpoint, LogCard front 조립, pin read 노출, 불변식 앱+DB partial unique, V7 단일 마이그레이션, TDD 전략, 구현 순서. spec [NEEDS CLARIFICATION] 0건.

## Phase 1 — Design & Contracts

완료:
- [data-model.md](./data-model.md) — Project/MemoProject 확장 + ProjectLog/WorkSession 신규 + 상태 전이 + 표시값 출처 표(§6)
- [contracts/rest-api.md](./contracts/rest-api.md) — endpoint 계약(요청/응답/소유권/검증)
- [contracts/ipc-rest-mapping.md](./contracts/ipc-rest-mapping.md) — FR-023 IPC↔REST 매핑(✅ 9 + 🧩 2 + 🔜 sub-task2)
- [quickstart.md](./quickstart.md) — TDD 사이클·게이트·DoD
- Agent context: `CLAUDE.md` SPECKIT 마커를 본 plan 으로 갱신

### Post-Design Constitution Re-check

✅ 재확인 — 설계가 게이트 위반 도입 없음. 신규 도메인 에러코드 불필요(기존 enum 충분), 신규 엔티티 소유권은 기존 패턴 경유, 스케줄러는 기존 `@Scheduled` 패턴.

## 미해결 / 리스크 (sub-task 경계)

- **records 화면 N+1**(R6): 베타 수용. 규모 증가 시 집계 endpoint 신설을 sub-task 2/후속 재검토.
- **"마지막 문장" front 파생**(R6): backend `plainText` 부재 → front 가 TipTap JSON 파생. sub-task 2 검증.
- **불변식 동시성**(R8): partial unique index 충돌 시 한쪽 실패 → 클라 재시도 흡수(베타 수용).
- **dangling 임계값/주기**(R4): 기본 12h/매시간, properties 노출. 베타 모니터링으로 조정.

## 다음 단계

`/speckit-tasks` — 본 plan/contracts/data-model 기반 의존순 tasks.md 생성(US1→US4, 항목별 Red-Green-Refactor + 마이그레이션 + 스케줄러 + 계약 검증).
