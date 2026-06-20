# Implementation Plan: 자동저장 재설계 — 로컬 우선 보존 + 수정시각 버전 토큰

**Branch**: `016-autosave-localstorage-redesign` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-autosave-localstorage-redesign/spec.md`

**설계 SoT**: [`specs/015-web-port-frontend/DESIGN-localstorage-autosave.md`](../015-web-port-frontend/DESIGN-localstorage-autosave.md) — 본 plan 은 그 설계를 speckit 산출물로 구체화한다.

## Summary

집필실 자동저장의 거짓 409 충돌을 **구조적으로 제거**하고, 작성분 복구 안전망과 비동기 공동 집필 토대를 함께 확보한다. 접근:

1. **프론트** — 편집 세션을 버전의 단일 기준으로 삼는다. 진입 시 1회 서버 로드 후 편집 중 document 재조회를 차단하고, 버전은 저장 응답으로만 갱신한다. 타자는 localStorage draft 에 즉시 보존하고, "타자 멈춤 1.5초 또는 마지막 동기화 후 10초(먼저 도래)"에 서버로 PUT 한다.
2. **백엔드** — 정수 `version` 을 제거하고 `updatedAt: Instant` 에 `@Version` 을 부여(수정시각 = 낙관적 잠금 토큰 겸용). 저장 후 flush 하여 새 시각을 응답한다. API 의 `version`·`currentVersion` 은 ISO8601 문자열(불투명 토큰)로 바뀐다.

## Technical Context

**Language/Version**: Frontend — TypeScript 5.9 / Next.js 16.2.6 (App Router) / React 19.2. Backend — Kotlin 2.2 / Spring Boot 4.0.6 (Java 24 toolchain).

**Primary Dependencies**: Frontend — React Query 5(`@tanstack/react-query`), Zustand, TipTap/ProseMirror. Backend — Spring Data JPA / Hibernate ORM 6, Flyway, Jackson.

**Storage**: PostgreSQL(Supabase) — `documents` 테이블. 브라우저 `localStorage` — 작품별 draft 보존(키 `wn:draft:doc:{documentId}`).

**Testing**: Frontend — Vitest + React Testing Library + msw(HTTP 경계 mock). Backend — JUnit 5 + AssertJ + MockK + Testcontainers(Postgres).

**Target Platform**: 웹 브라우저(프론트) + JVM 서버(백엔드).

**Project Type**: web (frontend + backend).

**Performance Goals**: 타자 시 로컬 반영 즉시(네트워크 왕복 0). 미동기화 구간 상한 10초. 거짓 충돌 0회.

**Constraints**: 작성분 무유실(동기화 전 중단·충돌 시에도 보존). 한국어 IME 입력 안정(저장 로직 변경이 조합 입력을 깨지 않음). datetime 버전 토큰의 동일-시각-해상도 약점은 사용 패턴상 수용(spec Assumptions).

**Scale/Scope**: 단일 작가 기본(비동기 공동 집필 예정). 범위 = 집필실 1화면(프론트) + `Document` 1엔티티/4엔드포인트(백엔드). 신규 모듈 2(`draftStore`, `useDocumentSession`), 제거 1(`useAutoSave`).

## Constitution Check

*GATE: Phase 0 이전 통과 필수, Phase 1 이후 재확인.*

프로젝트 `.specify/memory/constitution.md` 는 미작성 placeholder 이므로, gate 는 프로젝트 HARD-GATE 룰(`CLAUDE.md` + `.claude/rules/`)로 대체한다.

| Gate | 적용 | 상태 |
|---|---|---|
| **TDD (Red-Green-Refactor) HARD-GATE** | `draftStore`·`useDocumentSession`·`performSave` 모두 실패 테스트 선작성 후 구현. 한 번에 한 테스트. | ✅ Phase 1 design 이 테스트 우선 반영 |
| **Mock 경계 (Classist)** | HTTP 경계(msw)·시계만 mock. 내부 collaborator(`saveDocument` 등) mock 금지 — 상태/반환값 검증. | ✅ |
| **TS 코드 퀄리티** | `any` 금지, `version` 불투명 `string` 타입, RSC 경계(`'use client'`) 유지, named export. | ✅ |
| **Kotlin 코드 퀄리티** | `@Version` 단일 필드 적용, `@Transactional(rollbackFor=[Exception::class])` 배열 인자, ktlint main+test. | ✅ |
| **공용 fetch status 분기** | 409 분기는 `error.code === "DOCUMENT_VERSION_CONFLICT"` 한정 유지(이메일 중복 409 회귀 방지). | ✅ 회귀 가드 명시 |
| **외부 DB 안전 (HARD-GATE)** | Flyway `V8` 마이그레이션 **작성/리뷰만**. 적용(`flywayMigrate`)은 사용자 컨펌. | ✅ |
| **한국어 검증 cadence** | 저장 로직 변경이라 TipTap extension 변경은 아니나, dogfooding 에 IME 4케이스 + 한국어 본문 포함. | ✅ quickstart 반영 |

**위반 없음 → GATE PASS.** Complexity Tracking 불필요.

## Project Structure

### Documentation (this feature)

```text
specs/016-autosave-localstorage-redesign/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 기술 결정/근거/대안
├── data-model.md        # Phase 1 — Document 엔티티 변경 + Draft 구조
├── quickstart.md        # Phase 1 — 검증 시나리오(P1~P3 dogfooding)
├── contracts/
│   └── document-endpoints.md  # Phase 1 — version 문자열 토큰 반영 API 계약
├── checklists/
│   └── requirements.md  # spec 품질 체크(완료)
└── tasks.md             # Phase 2 — /speckit-tasks 산출(본 명령 범위 밖)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── lib/
│   │   ├── draftStore.ts                 # 신규 — localStorage draft CRUD(순수)
│   │   ├── draftStore.test.ts            # 신규 — 단위 테스트
│   │   ├── api/
│   │   │   ├── document.ts               # version: string 반영
│   │   │   └── client.ts                 # ConflictError.currentVersion: string
│   │   └── query/
│   │       └── useDocument.ts            # 편집 중 refetch 차단(staleTime: Infinity)
│   ├── hooks/
│   │   ├── useDocumentSession.ts         # 신규 — 세션 진실원(useAutoSave 대체)
│   │   ├── useDocumentSession.test.ts    # 신규 — 행위 테스트(msw)
│   │   ├── useAutoSave.ts                # 제거(사용처 grep 후)
│   │   └── useAutoSave.test.ts           # 제거
│   ├── components/editor/
│   │   ├── ConflictDialog.tsx            # currentVersion: string 표시
│   │   └── RecoverBanner.tsx             # 신규 — [복구]/[버리기] 배너
│   ├── app/projects/[id]/write/page.tsx  # 결선 교체(useDocumentSession + 복구 배너)
│   ├── types/api.ts                      # version·currentVersion: string
│   └── middleware.ts                     # 제거(디버그 로깅)

backend/
└── src/
    ├── main/kotlin/com/writenote/
    │   ├── entity/Document.kt             # version:Int 제거, updatedAt @Version
    │   ├── service/DocumentService.kt     # performSave: Instant 비교 + flush
    │   ├── model/request/SaveDocumentRequest.kt   # version: Instant
    │   ├── model/response/DocumentResponse.kt     # version: Instant
    │   ├── model/response/DocumentSaveResponse.kt # version: Instant
    │   ├── model/response/DocumentConflictResponse.kt # currentVersion: Instant
    │   └── error/DocumentConflictException.kt     # currentVersion: Instant
    ├── main/resources/db/migration/
    │   └── V8__replace_document_version_with_timestamp.sql  # 신규(적용은 컨펌)
    └── test/kotlin/com/writenote/
        └── service/DocumentServiceTest.kt # performSave datetime 충돌/flush 테스트
```

**Structure Decision**: 기존 web(frontend+backend) 구조 유지. 신규 파일은 기존 디렉토리 컨벤션(`lib/`, `hooks/`, `components/editor/`, `entity/`, `service/`)에 그대로 배치. 별도 모듈/패키지 신설 없음(YAGNI).

## Phase 0 — Research

`research.md` 참조. 설계 SoT 에서 확정된 결정을 speckit 형식(Decision/Rationale/Alternatives)으로 정리하고, 검증 완료 항목(`@Version` + `Instant` Hibernate 지원)을 박았다. 미해결 NEEDS CLARIFICATION 없음.

## Phase 1 — Design & Contracts

- `data-model.md` — `Document` 엔티티 변경(version Int 제거 → updatedAt @Version Instant 겸용) + `localStorage Draft` 구조 + 상태 전이.
- `contracts/document-endpoints.md` — D1~D4 계약을 version 문자열 토큰으로 갱신(006 계약의 후속 버전).
- `quickstart.md` — P1~P3 검증 시나리오 + 거짓충돌/복구/충돌 dogfooding 절차.
- agent context — `CLAUDE.md` SPECKIT 마커 사이에 본 plan 참조 추가.

## Phase 2 — (다음 명령) Tasks

`/speckit-tasks` 가 본 plan + data-model + contracts 에서 의존 정렬된 tasks.md 를 생성한다. 본 명령 범위 밖.
