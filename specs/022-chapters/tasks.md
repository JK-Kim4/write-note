---
description: "Task list for 챕터(Chapter) — 작품 1:N 본문 구조"
---

# Tasks: 챕터(Chapter) — 작품 1:N 본문 구조

**Input**: Design documents from `specs/022-chapters/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/chapters-api.md, quickstart.md
**Branch**: `022-chapters`

**Tests**: 포함 — 프로젝트 CLAUDE.md §5 TDD HARD-GATE 의무. 각 US 구현 전 실패 테스트 선행.

**Organization**: User Story 단위. 이슈 매핑 — Foundational=#58, US1·US2·US3=#59/#61/#62, US4=#60.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일·의존 없음 → 병렬 가능
- 경로: `backend/src/main/kotlin/com/writenote/...`, `backend/src/test/kotlin/com/writenote/...`, `frontend/src/...`

## 게이트 (전 task 공통, CLAUDE.md HARD-GATE)

- 외부 DB 쓰기: V14 작성·리뷰 OK / **로컬 dev DB 적용(`flywayMigrate`·bootRun)은 사용자 컨펌**. IT/Testcontainers 는 격리 환경이라 자동 적용 허용.
- 409 분기 = `error.code` 기준(status 단독 금지). Kotlin annotation 배열 인자 `[Exception::class]`. RSC 경계 `'use client'` + 작성 직후 `pnpm build`.

---

## Phase 1: Setup

**Purpose**: 마이그레이션 파일 작성 (적용 아님)

- [ ] T001 V14 마이그레이션 SQL 작성 in `backend/src/main/resources/db/migration/V14__documents_chapters.sql` (UNIQUE 해제 + sort_order + deleted_at + 인덱스 2종, data-model.md §마이그레이션). 적용 금지 — 파일 작성만

---

## Phase 2: Foundational (Blocking Prerequisites) — #58

**Purpose**: documents 1:1 → 1:N 구조 전환. 모든 US 의 전제.

**⚠️ CRITICAL**: 이 단계 완료 전 어떤 US 도 시작 불가

- [ ] T002 [P] 기존 documents 의 project_id UNIQUE **실제 제약명 확인** — `\d documents` 또는 information_schema 읽기(읽기 전용, 컨펌 불필요) → T001 의 `DROP CONSTRAINT` 정확명 확정
- [ ] T003 Document 엔티티 확장 in `backend/src/main/kotlin/com/writenote/entity/Document.kt` — `project_id` 의 `unique=true` 제거 + `sortOrder: Int`(`sort_order`) + `deletedAt: Instant?`(`deleted_at`) 추가
- [ ] T004 DocumentRepository 메서드 재구성 in `backend/src/main/kotlin/com/writenote/repository/DocumentRepository.kt` — 단수 `findByProjectId(): Optional` 제거 → `findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc` / `findByProjectIdInAndDeletedAtIsNull` / `findByIdAndDeletedAtIsNull` / `findByIdAndProjectId` (data-model.md §Repository)
- [ ] T005 기존 호출부 컴파일 회복 in `backend/src/main/kotlin/com/writenote/service/ProjectService.kt` — `createProject` 의 document 자동 생성을 1번 챕터(`sortOrder=0`)로 유지 + `listCards` 단건 lookup 을 활성 목록 기반 **최소 수정**으로 컴파일 회복(본격 합산은 US4 T031~). 기존 BE 게이트(ktlint main+test·checkstyle·test·build) GREEN 복구

**Checkpoint**: 1:N 스키마 + 엔티티/repo 확장 완료, 기존 게이트 GREEN — US 시작 가능

---

## Phase 3: User Story 1 - 작품을 여러 챕터로 나눠 집필 (P1) 🎯 MVP — #59·#61

**Goal**: 챕터 목록·생성·전환. 기존 본문 무손실 1번 챕터. 챕터별 격리 자동저장(016 세션 재사용).

**Independent Test**: 작품 열어 새 챕터 2~3개 생성, 오가며 각각 작성, 나갔다 재진입 시 마지막 챕터·내용 복귀.

### Tests for User Story 1 ⚠️ (구현 전 작성·실패 확인)

- [ ] T006 [P] [US1] DocumentService 챕터 목록(활성·sortOrder ASC)·생성(맨 뒤 sortOrder) 단위 테스트 in `backend/src/test/kotlin/com/writenote/service/DocumentServiceTest.kt`
- [ ] T007 [P] [US1] 챕터 목록/생성/단건 endpoint IT (목록 본문 제외·삭제 챕터 단건 404) in `backend/src/test/kotlin/com/writenote/controller/DocumentControllerIT.kt`
- [ ] T008 [P] [US1] ChapterList 컴포넌트 테스트 (목록·현재 하이라이트·새 챕터·선택 onSelect) in `frontend/src/components/editor/ChapterList.test.tsx`
- [ ] T009 [P] [US1] 챕터 전환 초안 키 격리 + 전환 직전 flush 테스트 (msw) in `frontend/src/app/projects/[id]/write/page.test.tsx`

### Implementation for User Story 1

- [ ] T010 [US1] DocumentService 챕터 목록(`listChapters`)·생성(`createChapter` 맨 뒤, title 미지정 시 기본 `새 챕터`) in `backend/src/main/kotlin/com/writenote/service/DocumentService.kt`
- [ ] T011 [US1] 챕터 목록 `GET /api/projects/{projectId}/documents`(메타만) + 생성 `POST` endpoint in `backend/src/main/kotlin/com/writenote/controller/DocumentController.kt` (실측: 기존 document endpoint 위치, ProjectController 아님)
- [ ] T012 [US1] **기존 단건 조회·자동저장 둘 다 삭제 챕터 404 가드** — `getDocumentById`(`GET /api/documents/{id}`, DocumentController.kt:47)·`saveDocument`(`PUT /api/documents/{id}`, :62)가 현재 `findById`(삭제 포함) 사용 → `findByIdAndDeletedAtIsNull` 기반으로 soft-delete 챕터 조회/저장 404. (code-quality 리뷰 ea1f0d8 지적) in `backend/src/main/kotlin/com/writenote/service/DocumentService.kt`, `backend/src/main/kotlin/com/writenote/controller/DocumentController.kt`
- [ ] T013 [US1] FE shim `documents.list/create/get` + 훅 `useProjectChapters(projectId)`·`useChapterDocument(documentId)` in `frontend/src/lib/electron-api/index.ts`, `frontend/src/lib/query/useDocument.ts`
- [ ] T014 [US1] ChapterList presentational 컴포넌트 (A·B 공용, props: 챕터배열·현재·onSelect·onCreate) in `frontend/src/components/editor/ChapterList.tsx` — `'use client'`
- [ ] T015 [US1] A형 집필실 좌패널 2단(챕터 목록 + 기존 아웃라인) + `?chapter={documentId}` 전환 + editorKey 리마운트 + 전환 직전 `flushDraft` in `frontend/src/app/projects/[id]/write/page.tsx`
- [ ] T016 [US1] B형 집필실 좌패널 챕터 목록 + `?chapter` 전환 + flush (ChapterList 재사용) in `frontend/src/app/b/works/[id]/page.tsx`

**Checkpoint**: 여러 챕터 생성·전환·격리 자동저장 동작 — MVP 독립 검증 가능

---

## Phase 4: User Story 2 - 챕터 순서 조절 (P2) — #59·#61

**Goal**: 위/아래 버튼으로 순서 변경, 영속.

**Independent Test**: 챕터 3개 생성 → 가운데를 위로 → 재진입 시 순서 유지.

### Tests for User Story 2 ⚠️

- [ ] T017 [P] [US2] ChapterReorderValidator 테스트 (전량·중복·소속·누락 → ValidationException) in `backend/src/test/kotlin/com/writenote/components/documents/ChapterReorderValidatorTest.kt`
- [ ] T018 [P] [US2] reorder endpoint IT (정상 일괄 반영·400 VALIDATION_FAILED) in `backend/src/test/kotlin/com/writenote/controller/DocumentControllerIT.kt`
- [ ] T019 [P] [US2] FE 순서 위/아래 버튼 + reorder 호출 테스트 in `frontend/src/components/editor/ChapterList.test.tsx`

### Implementation for User Story 2

- [ ] T020 [US2] ChapterReorderValidator (004 CharacterReorderValidator 패턴 복제) in `backend/src/main/kotlin/com/writenote/components/documents/ChapterReorderValidator.kt`
- [ ] T021 [US2] DocumentService.`reorderChapters`(전량 검증 후 index→sortOrder dirty-check) + `PUT /api/projects/{projectId}/documents/order` endpoint in `backend/src/main/kotlin/com/writenote/service/DocumentService.kt`, controller
- [ ] T022 [US2] FE shim `documents.reorder` + ChapterList 위/아래 버튼·끝단 비활성·reorder 호출(낙관적 갱신) in `frontend/src/lib/electron-api/index.ts`, `frontend/src/components/editor/ChapterList.tsx`

**Checkpoint**: US1 + US2 독립 동작 (A·B 양쪽)

---

## Phase 5: User Story 3 - 챕터 삭제 · 되돌리기 (P2) — #59·#62

**Goal**: soft-delete + 되돌리기 토스트 + 마지막 챕터 가드(이중 방어) + 현재 챕터 삭제 시 인접 전환.

**Independent Test**: 챕터 2개 중 하나 삭제→되돌리기 복구. 1개 남으면 삭제 버튼 비활성 + 직접 호출 시 409.

### Tests for User Story 3 ⚠️

- [ ] T023 [P] [US3] DocumentService 삭제(마지막 활성 챕터 → 거부)·복구(맨 뒤 재배치) 단위 테스트 in `backend/src/test/kotlin/com/writenote/service/DocumentServiceTest.kt`
- [ ] T024 [P] [US3] 삭제/복구 endpoint IT — 마지막 챕터 `409 LAST_CHAPTER_UNDELETABLE`·복구 200·삭제 챕터 저장 404 in `backend/src/test/kotlin/com/writenote/controller/DocumentControllerIT.kt`
- [ ] T025 [P] [US3] FE 삭제→토스트→되돌리기 + 마지막 챕터 삭제 버튼 disabled + 현재 챕터 삭제 시 **바로 앞 챕터(맨 앞이면 다음)** 전환 테스트 (msw) in `frontend/src/app/projects/[id]/write/page.test.tsx`

### Implementation for User Story 3

- [ ] T026 [US3] ErrorCode `LAST_CHAPTER_UNDELETABLE`(409) 추가 in `backend/src/main/kotlin/com/writenote/error/ErrorCode.kt`
- [ ] T027 [US3] DocumentService.`deleteChapter`(마지막 활성 챕터 가드 → 예외)·`restoreChapter`(deletedAt=null·맨 뒤) in `backend/src/main/kotlin/com/writenote/service/DocumentService.kt`
- [ ] T028 [US3] `DELETE /api/documents/{id}` + `POST /api/documents/{id}/restore` endpoint in `backend/src/main/kotlin/com/writenote/controller/DocumentController.kt`
- [ ] T029 [US3] client.ts `LAST_CHAPTER_UNDELETABLE` **error.code 기준** 분기(기존 409 코드 grep 후 추가) in `frontend/src/lib/api/client.ts`
- [ ] T030 [US3] FE shim `documents.remove/restore` + ChapterList 삭제 버튼(마지막 disabled) + Toast 되돌리기(`key={seq}` 패턴, memos/page.tsx 참조) + 현재 챕터 삭제 시 **바로 앞 챕터(맨 앞이면 다음)** 전환 in `frontend/src/lib/electron-api/index.ts`, `frontend/src/components/editor/ChapterList.tsx`, `frontend/src/app/projects/[id]/write/page.tsx`, `frontend/src/app/b/works/[id]/page.tsx`

**Checkpoint**: US1·2·3 독립 동작. 작가 편집 핵심 완성

---

## Phase 6: User Story 4 - 대시보드 카드 챕터 합산 (P3) — #60

**Goal**: 작품 카드 글자수=활성 챕터 합, 수정시각=최신, 마지막 문장=최신 챕터. DTO 불변(FE 표시 변경 0).

**Independent Test**: 챕터 2개에 작성 → 대시보드 카드 글자수 = 두 챕터 합, 마지막 문장 = 최신 챕터. 삭제 챕터 제외.

### Tests for User Story 4 ⚠️

- [ ] T031 [P] [US4] listCards 챕터 합산 테스트 — wordCount 합·documentUpdatedAt 최신·마지막 문장 최신 챕터·삭제 제외·N+1 금지(쿼리 수 고정) in `backend/src/test/kotlin/com/writenote/service/ProjectServiceTest.kt`

### Implementation for User Story 4

- [ ] T032 [US4] ProjectService.`listCards` 활성 챕터 합산 재설계 — `findByProjectIdInAndDeletedAtIsNull` 일괄 후 메모리 그룹 집계(wordCount 합·documentUpdatedAt 최신). **+ `ProjectCardResponse` 에 `lastSentenceSource` 추가**(그룹 max-updatedAt 챕터 body 의 plainText, 추가 쿼리 0) **+ FE `projects.list` 의 카드별 `getProjectDocument` 별도 조회 제거**(응답 필드 사용 → N+1 해소·단수 endpoint 미사용화). 정정 근거 = contracts C9. in `backend/.../service/ProjectService.kt`, `backend/.../model/response/ProjectCardResponse.kt`, `frontend/src/lib/electron-api/projects.ts`

**Checkpoint**: 모든 US 독립 동작. FE 대시보드 표시 코드 변경 0 회귀 확인(ProjectWallCard·BWorkMiniCard 불변)

---

## Phase 7: Polish & Cross-Cutting

- [ ] T033 [P] 단수 조회 제거 — BE `DocumentController.getDocumentByProject`(`GET /api/projects/{projectId}/document`)·`getDocumentByProjectId` + FE shim `documents.getByProject` 잔여 참조 정리. **선결**: US4 T032 에서 `projects.list` 의 단수 조회 의존이 이미 제거됨(응답 `lastSentenceSource` 사용) — 잔여 참조만 확인 후 제거 in `backend/.../controller/DocumentController.kt`, `frontend/src/lib/electron-api/index.ts`
- [ ] T034 전체 게이트 — backend `ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` / frontend `pnpm typecheck && pnpm lint && pnpm test && pnpm build`(RSC 경계 검출)
- [ ] T035 quickstart.md dogfooding — US1~4 시나리오 + **한국어 IME 4케이스 + 조합 중 챕터 전환 무유실** + 회귀 가드(016 세션·017 골격·대시보드 표시 불변). **V14 로컬 dev DB 적용은 이 단계에서 사용자 컨펌** (사용자 영역)
- [ ] T036 [P] 설계/계획/vault 문서 동기 — `docs/plan/04-web-launch-v1-plan.md` Round 2.5 체크 + vault `02-PROGRESS.md` 진척(merge 후)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup(P1)**: 즉시 시작
- **Foundational(P2, #58)**: Setup 후 — **모든 US 차단**. T002→T003→T004→T005 순차(같은 엔티티/서비스)
- **US1(P3)**: Foundational 후. MVP
- **US2(P4)·US3(P5)**: Foundational 후 시작 가능하나 ChapterList(T014)·집필실 페이지를 US1 이 신설하므로 **US1 후 권장**(FE 같은 파일)
- **US4(P6)**: Foundational 후 독립(ProjectService만). US1~3 와 병렬 가능
- **Polish(P7)**: 원하는 US 완료 후

### User Story Dependencies

- US1 = 기반(ChapterList·집필실 2단·shim·훅). US2·US3 가 이 위에 버튼/삭제를 얹음 → US1 → US2 → US3 순서 권장
- US4 는 BE listCards 만 건드려 US1~3 와 **파일 충돌 없음** → 병렬 트랙 가능

### 이슈 ↔ Phase 매핑

| 이슈 | Phase |
|---|---|
| #58 BE 마이그레이션·엔티티 | Setup + Foundational (T001~T005) |
| #59 BE 챕터 endpoint | US1(목록·생성·단건) + US2(순서) + US3(삭제·복구) |
| #60 BE 카드 집계 | US4 (T031~T032) |
| #61 FE 목록·전환 | US1(T013~T016) + US2(T022) |
| #62 FE 삭제·되돌리기 | US3(T029~T030) |

### Within Each User Story (TDD)

- 테스트 먼저 작성 → 실패 확인 → 구현. Models/Repo → Service → Endpoint → FE.

### Parallel Opportunities

- Foundational 내 T002 [P] 단독. T003~T005 순차(같은 파일군)
- 각 US 의 테스트 [P] 끼리 병렬(backend·frontend 다른 파일)
- **US4 트랙**(T031~T032)을 US1~3 와 별도 개발자/세션에서 병렬

---

## Parallel Example: User Story 1 테스트

```bash
# US1 테스트 4개 병렬 (서로 다른 파일):
Task: "T006 DocumentServiceTest.kt 챕터 목록·생성 단위 테스트"
Task: "T007 DocumentControllerIT.kt 목록/생성/단건 IT"
Task: "T008 ChapterList.test.tsx 컴포넌트 테스트"
Task: "T009 write/page.test.tsx 전환 초안 격리 테스트"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup(T001) → Phase 2 Foundational(T002~T005, 게이트 GREEN)
2. Phase 3 US1(T006~T016) — 챕터 생성·전환·격리 자동저장
3. **STOP & VALIDATE**: US1 독립 dogfooding(여러 챕터 작성·전환·재진입·IME 조합 중 전환)
4. 이후 US2(순서) → US3(삭제·되돌리기) → US4(카드 합산) 증분

### subagent-driven 권장 분담 (구현 시)

- advisor(Opus): Foundational 설계·각 Phase 게이트 직접 재실행·diff 검증(016 세션/017 골격 불변·A4·409 grep)
- implementer(Sonnet): Phase 단위 dispatch. backend 위임 시 `ktlintFormat` main+test 양쪽 명시 / frontend 위임 시 작성 직후 `pnpm build` 명시(RSC 경계)

---

## Notes

- [P] = 다른 파일·무의존. ChapterList(T014)는 A·B 공용 → US2·US3 의 버튼 추가가 같은 파일이라 [P] 아님
- V14 적용은 IT/Testcontainers 자동(격리) / 로컬 dev DB 는 T035 에서 사용자 컨펌
- 각 US checkpoint 에서 독립 검증 후 다음 우선순위 진입
