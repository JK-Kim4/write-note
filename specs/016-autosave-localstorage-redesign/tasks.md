---
description: "Task list for 자동저장 재설계 — 로컬 우선 보존 + 수정시각 버전 토큰"
---

# Tasks: 자동저장 재설계 — 로컬 우선 보존 + 수정시각 버전 토큰

**Input**: Design documents from `/specs/016-autosave-localstorage-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/document-endpoints.md, quickstart.md

**Tests**: 본 프로젝트는 TDD HARD-GATE(`CLAUDE.md` §5)이므로 테스트 task 포함. 각 테스트는 구현 전 작성·실패(RED) 확인 후 구현(GREEN).

**Organization**: user story 별 phase. Foundational(백엔드 datetime 전환 + 프론트 API 타입)이 모든 story 의 토대.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일 · 미완 의존 없음 → 병렬 가능
- **[Story]**: US1/US2/US3 (Setup·Foundational·Polish 는 라벨 없음)

## Path Conventions

Web app: `backend/src/...`, `frontend/src/...` (plan.md Project Structure 기준)

---

## Phase 1: Setup

**Purpose**: 사전 확인 (기존 프로젝트라 신규 init 불필요)

- [X] T001 `grep -rn "useAutoSave" frontend/src` 로 집필실(`write/page.tsx`) 외 `useAutoSave` 사용처 없음을 확인 — 없으면 Polish 의 제거(T028) 확정, 있으면 그 사용처를 본 작업 범위에 추가

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 백엔드 버전 토큰 datetime 전환 + 프론트 API 타입 string 전환. 모든 user story 가 이 토대 위에 선다.

**⚠️ CRITICAL**: 이 phase 완료 전 어떤 user story 도 시작 불가.

### 백엔드 — 수정시각 버전 토큰 (TDD)

- [X] T002 [P] `backend/src/test/kotlin/com/writenote/service/DocumentServiceTest.kt` 에 datetime 충돌/flush 실패 테스트 작성 (RED): (a) `request.version`(Instant) 불일치 시 409, (b) 일치 시 저장 후 flush 된 새 `updatedAt` 응답, (c) 동일 `updatedAt` 재요청 충돌
- [X] T003 `backend/src/main/kotlin/com/writenote/entity/Document.kt`: `version: Int` 컬럼 제거, `updatedAt: Instant` 에 `@Version` 부여, `@PreUpdate` 의 `updatedAt = Instant.now()` 제거 (`@PrePersist` 의 `createdAt` 유지)
- [X] T004 [P] 백엔드 DTO 5종 `version`/`currentVersion` 을 `Int → Instant` 로: `model/request/SaveDocumentRequest.kt`, `model/response/DocumentResponse.kt`, `model/response/DocumentSaveResponse.kt`, `model/response/DocumentConflictResponse.kt`, `error/DocumentConflictException.kt`
- [X] T005 `backend/src/main/kotlin/com/writenote/service/DocumentService.kt` `performSave`: `if (document.updatedAt != request.version)` 비교, 일치 시 body·wordCount 갱신 후 `flush`(Repository `saveAndFlush` 또는 `EntityManager.flush`) → 새 `updatedAt` 을 `DocumentSaveResponse.version` 으로 응답 (기존 `version + 1` 예측 제거). `toResponse()` 도 `version = updatedAt` 으로 정합
- [X] T006 [P] `backend/src/main/resources/db/migration/V8__replace_document_version_with_timestamp.sql` 작성: `documents.version` 컬럼 drop (⚠️ **적용은 사용자 컨펌** — 외부 DB 안전 룰, 작성·리뷰만)
- [X] T007 백엔드 게이트 GREEN: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test` (T002 테스트 통과 확인)

### 프론트 — API 타입 + 편집 중 refetch 차단

- [X] T008 [P] `frontend/src/types/api.ts`: `DocumentResponse.version`·`DocumentSaveResponse.version`·`DocumentConflictResponse.currentVersion` 을 `number → string`
- [X] T009 [P] `frontend/src/lib/api/client.ts`: `ConflictError.currentVersion` 을 `number → string` (409 분기는 `error.code === "DOCUMENT_VERSION_CONFLICT"` 한정 유지 — 회귀 가드)
- [X] T010 [P] `frontend/src/lib/api/document.ts`: `saveDocument`/`getProjectDocument` 의 `version` string 정합 확인(불투명 토큰 전달)
- [X] T011 `frontend/src/lib/query/useDocument.ts`: 편집 중 refetch 차단 — `staleTime: Infinity` 추가(기존 `refetchOnWindowFocus/Reconnect: false` 유지)

**Checkpoint**: 백엔드가 datetime 토큰으로 저장·충돌 판정, 프론트 타입이 string. user story 진입 가능.

---

## Phase 3: User Story 1 - 거짓 충돌 없는 조용한 자동저장 (Priority: P1) 🎯 MVP

**Goal**: 단일 세션에서 연속 타자·페이지 이동·재진입에도 거짓 충돌 0회, 타자 중 끊김 없음. localStorage 즉시 보존 + 하이브리드 동기화.

**Independent Test**: 단일 세션 한국어 연속 입력 + 이동 + 재진입 시 ConflictDialog 0회, "저장됨" 유지 (quickstart §2).

### Tests for User Story 1 (RED 먼저)

- [X] T012 [P] [US1] `frontend/src/lib/draftStore.test.ts` 작성 (RED): write/read/clear, SSR 가드(`localStorage` 미정의), 손상 JSON 방어, 작품별 키 분리
- [X] T013 [P] [US1] `frontend/src/hooks/useDocumentSession.test.ts` 작성 (RED, msw HTTP 경계만 mock): 진입 1회 로드 / 타자→draft 기록(dirty) / 하이브리드 트리거(멈춤·상한)→PUT 1회 / 200→version 전진 / **편집 중 서버 GET 이 끼어들어도 세션 version 불변(거짓충돌 회귀)** / in-flight 저장 가드(겹친 저장 큐잉)

### Implementation for User Story 1

- [X] T014 [P] [US1] `frontend/src/lib/draftStore.ts` 구현: `readDraft`/`writeDraft`/`clearDraft`(키 `wn:draft:doc:{documentId}`), SSR·손상·용량초과 가드(쓰기 실패 삼킴)
- [X] T015 [US1] `frontend/src/hooks/useDocumentSession.ts` 구현 (depends T014): 진입 1회 로드 + `version` 단독 소유 + 타자→`writeDraft(dirty)` + 하이브리드 동기화(멈춤 1.5초 / 마지막 sync 후 10초, 테스트 주입 파라미터) + in-flight 가드(`isSavingRef`, 완료 후 dirty 면 재저장) + 200 시 `version`/`syncStatus` 갱신 + `onSaved` 로 React Query `setQueryData` 캐시 동기화
- [X] T016 [US1] `frontend/src/app/projects/[id]/write/page.tsx` 결선: `useAutoSave` → `useDocumentSession` 교체, body/version/editorKey 흐름 정합 (충돌·복구 결선은 US3·US2 에서)
- [X] T017 [US1] US1 게이트 GREEN: `cd frontend && pnpm test src/lib/draftStore.test.ts src/hooks/useDocumentSession.test.ts && pnpm build` (RSC 경계 검출)

**Checkpoint**: US1 단독으로 거짓 충돌 없는 자동저장 동작 — MVP 완성, 독립 검증 가능.

---

## Phase 4: User Story 2 - 작성분 복구 안전망 (Priority: P2)

**Goal**: 동기화 전 중단(탭닫기·새로고침·크래시)에도 작성분 보존 + 재진입 시 [복구]/[버리기] 배너.

**Independent Test**: 입력 직후 탭 강제 종료 → 재진입 시 복구 배너 → [복구]로 직전 입력 복원 (quickstart §3).

**의존**: US1 의 `useDocumentSession`·`write/page.tsx` 확장(같은 파일) → US1 완료 후 진행.

### Tests for User Story 2 (RED 먼저)

- [X] T018 [US2] `frontend/src/hooks/useDocumentSession.test.ts` 에 복구 분기 케이스 추가 (RED): 진입 시 dirty draft + `baseVersion === 서버 version` → `recoverable` 설정 / `baseVersion !== 서버 version` → conflict 경로 / 동기화 성공 draft 는 다음 진입 시 정리

### Implementation for User Story 2

- [X] T019 [P] [US2] `frontend/src/components/editor/RecoverBanner.tsx` 신규: "저장되지 않은 변경이 있습니다" + [복구]/[버리기] (`'use client'`, 이벤트 핸들러 prop)
- [X] T020 [US2] `frontend/src/hooks/useDocumentSession.ts` 확장: 진입 복구 분기(`recoverable` 상태 노출) + `pagehide` 시 dirty 면 `sendBeacon` flush + 동기화 성공 draft 다음 진입 정리 로직
- [X] T021 [US2] `frontend/src/app/projects/[id]/write/page.tsx`: `RecoverBanner` 결선, [복구](draft body 적용 + editorKey 증가) / [버리기](`clearDraft` + 서버 본문 유지) 핸들러
- [X] T022 [US2] US2 게이트 GREEN: `cd frontend && pnpm test src/hooks/useDocumentSession.test.ts && pnpm build`

**Checkpoint**: US1 + US2 동작 — 거짓충돌 없음 + 작성분 복구.

---

## Phase 5: User Story 3 - 진짜 충돌 감지 (Priority: P3)

**Goal**: 기준 시점 이후 서버 문서가 실제 변경된 경우에만 충돌 감지, 자동 덮어쓰기 금지, 충돌 시 작성분 보존.

**Independent Test**: 서버 문서를 먼저 변경 후 이전 토큰 세션이 저장 시도 → ConflictDialog + 작성분 보존 (quickstart §4).

**의존**: US1 의 `useDocumentSession`·`write/page.tsx` 확장 → US1 완료 후 진행. US2 와는 다른 분기라 US2 와 병행 가능하나 같은 파일 수정이라 순차 권장.

### Tests for User Story 3 (RED 먼저)

- [X] T023 [US3] `frontend/src/hooks/useDocumentSession.test.ts` 에 409 충돌 케이스 추가 (RED): PUT 409(`DOCUMENT_VERSION_CONFLICT`) → `conflict` 상태 + 미동기화 draft 보존(미삭제) / overwrite → `currentVersion` 으로 재저장 / dismiss → 해제

### Implementation for User Story 3

- [X] T024 [P] [US3] `frontend/src/components/editor/ConflictDialog.tsx`: `currentVersion` 표시 타입 `number → string` 적응
- [X] T025 [US3] `frontend/src/hooks/useDocumentSession.ts` 확장: 409 → `conflict` 상태 + draft 보존 + `overwrite(currentVersion)`/`dismissConflict` 노출
- [X] T026 [US3] `frontend/src/app/projects/[id]/write/page.tsx`: `ConflictDialog` 결선(`handleReload`/`handleOverwrite`), 충돌 시 draft 유실 없음 확인
- [X] T027 [US3] US3 게이트 GREEN: `cd frontend && pnpm test src/hooks/useDocumentSession.test.ts && pnpm build`

**Checkpoint**: US1·US2·US3 모두 동작 — 거짓충돌 없음 + 복구 + 진짜 충돌만 선별.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T028 [P] `frontend/src/hooks/useAutoSave.ts` + `useAutoSave.test.ts` 제거 (T001 에서 사용처 없음 확인됨)
- [X] T029 [P] `frontend/src/middleware.ts` + `[DBG-DOC]` 디버그 로깅 제거 (matcher config 포함)
- [X] T030 전체 게이트: `cd frontend && pnpm test && pnpm build` + `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`
- [ ] T031 quickstart.md 브라우저 dogfooding (⚠️ **V8 마이그레이션 적용 컨펌 후**): P1 거짓충돌 0 / P2 복구 / P3 충돌 / 한국어 IME 4케이스 (dev 서버 단독 확인 — `lsof -iTCP:3000`)
- [X] T032 [P] `specs/015-web-port-frontend/HANDOFF-autosave-conflict.md` 에 해결 기록 + vault `03-ISSUES.md`(ISSUE 갱신) + `02-PROGRESS.md`(016 진척)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: 즉시 시작
- **Foundational (P2)**: Setup 후. **모든 user story 차단**. 백엔드(T002→T003→T004→T005→T006→T007) + 프론트 타입(T008~T011)
- **US1 (P3)**: Foundational 후. MVP
- **US2 (P4)·US3 (P5)**: US1 완료 후(같은 `useDocumentSession`·`write/page.tsx` 확장). US2↔US3 은 서로 다른 분기지만 동일 파일 수정이라 순차 권장
- **Polish (P6)**: 원하는 story 완료 후

### Within Foundational (백엔드 순서)

- T002(테스트 RED) → T003(엔티티) → T004(DTO) → T005(서비스 flush) → T006(마이그레이션) → T007(GREEN)
- T004 는 T003 와 다른 파일이라 [P] 표기했으나 컴파일 정합상 T003 직후 권장

### Parallel Opportunities

- **Foundational**: 백엔드(T002~T007)와 프론트 타입(T008~T011)은 서로 독립 → 병렬 가능. T008·T009·T010 은 [P]
- **US1**: T012·T013(테스트), T014(draftStore) 병렬 가능. T015 는 T014 의존
- 각 US 의 테스트는 구현 전 RED 작성

### Within Each User Story

- 테스트(RED) → 구현 → 게이트(GREEN). models/순수모듈 → hook → page 결선 순.

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup → 2. Phase 2 Foundational(백엔드 datetime + 프론트 타입) → 3. Phase 3 US1 → **STOP & VALIDATE**: 거짓 충돌 0 확인(quickstart §2). 이 시점이 핵심 버그 해결 MVP.

### Incremental Delivery

US1(거짓충돌 제거) → US2(복구) → US3(충돌 선별) 순. 각 단계 독립 검증 후 다음.

### ⚠️ 마이그레이션 적용 게이트

T006 의 `V8` 은 작성만. **실제 적용(`flywayMigrate`)은 사용자 명시 컨펌 후** T031 dogfooding 직전 수행(외부 DB 안전 HARD-GATE).

---

## Notes

- [P] = 다른 파일·미완 의존 없음
- US2·US3 는 US1 의 `useDocumentSession`/`write/page.tsx` 를 확장하므로 story 간 완전 독립은 아님(같은 파일). 순차 진행 권장
- 각 게이트에서 `pnpm build`(RSC 경계) + ktlint main+test 양쪽 필수
- 회귀 가드: `client.ts` 409 분기 `error.code` 한정 / subagent "기존 회귀" 보고 무검증 수용 금지
- task 또는 논리 그룹 단위 커밋
