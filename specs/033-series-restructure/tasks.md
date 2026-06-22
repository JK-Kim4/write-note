# Tasks: 시리즈 중심 재구성 (챕터 제거 + 메타데이터 시리즈 종속화)

**Feature**: 033-series-restructure | **Branch**: `033-series-restructure` | **Date**: 2026-06-22

**Input**: plan.md · spec.md · research.md · data-model.md · contracts/api-changes.md · quickstart.md

> **TDD HARD-GATE** (CLAUDE.md §5): 매핑·effective 해석·진척 집계·마이그레이션은 행위 단위 테스트 선행(Red→Green→Refactor). 설정/타입/제거-only 작업은 §5-5 완화.
> **무손실 원칙**: 챕터 제거는 endpoint/UI 레벨, 스키마 컬럼 보존. 톤류 컬럼 보존.
> **마이그레이션**: V21 작성·리뷰만. 로컬/운영 적용은 사용자 컨펌(external-infra-safety §1). 테스트는 Testcontainers.
> **배포**: `buffer` 통합 브랜치(032+033 함께 검증 후 develop). prod 단일 배포라 라운드 간 BE/FE 순서 위험 완화.
> **§6 검증 완료(2026-06-22)**: 아래 모든 파일 경로는 실제 grep 으로 확정. 작품 폼=`library/page.tsx` 인라인(별도 모달 없음).

---

## Phase 1: Setup

- [ ] T001 현재 브랜치가 `033-series-restructure`(buffer 기반)인지 확인하고 `git log --oneline HEAD..buffer` 로 032 자산(V20 categories) 포함 확인
- [ ] T002 마이그레이션 파일 골격 생성: `backend/src/main/resources/db/migration/V21__add_series_metadata_to_categories.sql` (빈 파일, Phase 2에서 채움)

---

## Phase 2: Foundational (R2~R4 BE 전제 — US1 과 독립, 병렬 가능)

**목표**: Category(시리즈)에 출판 메타 컬럼을 additive 추가. 모든 메타 라운드(R2/R3/R4)의 전제.

- [ ] T003 V21 마이그레이션 작성 in `backend/.../db/migration/V21__add_series_metadata_to_categories.sql` — `categories` 에 `paper_size VARCHAR(16) NULL`, `layout_mode VARCHAR(16) NULL`, `genre VARCHAR(100) NULL`, `synopsis TEXT NULL`, `target_length INTEGER NULL` 추가(전부 nullable, data-model.md 기준)
- [ ] T004 [P] Category 엔티티 확장 in `backend/.../entity/Category.kt` — paperSize/layoutMode/genre/synopsis/targetLength nullable 필드 추가
- [ ] T005 V21 적용 후 스키마 검증 통합 테스트 in `backend/.../` (Testcontainers) — categories 신규 컬럼 존재·nullable 확인

**Checkpoint**: Category 메타 컬럼 준비 완료 → R2/R3/R4 진입 가능. (R1 은 본 Phase 와 무관하게 병렬 진행 가능)

---

## Phase 3: User Story 1 — 챕터 제거 (R1, Priority P1) 🎯 MVP

**Goal**: 작품을 단일 본문으로 회귀. 챕터 목록/생성/순서/삭제/복구/제목 endpoint·UI 제거(스키마 보존).

**Independent Test**: 기존 작품을 열어 챕터 UI 없이 단일 본문이 그대로 표시·집필·저장되고, 새 작품이 본문 1개로 생성되는지.

### 테스트 (TDD, 제거 후 잔존 경로 보호)

- [x] T006 [US1] 단일 본문 조회·저장 통합 테스트 보강 in `backend/.../` — `GET /api/projects/{id}/document`, `GET/PUT /api/documents/{id}`(016 @Version 유지)가 챕터 endpoint 제거 후에도 GREEN
- [x] T007 [P] [US1] 작품 생성 시 본문 1개 동반 생성 테스트 in `backend/.../` (다중 본문 생성 경로 부재 확인)

### BE 챕터 제거

- [x] T008 [US1] `backend/.../controller/DocumentController.kt` 에서 챕터 endpoint 6개 제거 — 목록(`GET /projects/{id}/documents`)·생성(`POST /projects/{id}/documents`)·순서(`PUT /projects/{id}/documents/order`)·제목(`PATCH /documents/{id}/title`)·삭제(`DELETE /documents/{id}`)·복구(`POST /documents/{id}/restore`). 단일 본문 3 endpoint 유지
- [x] T009 [US1] `backend/.../service/DocumentService.kt` 에서 챕터 목록/생성/순서/삭제/복구 로직 제거, 단일 본문 조회·저장만 유지
- [x] T010 [P] [US1] 챕터 전용 DTO 제거: `backend/.../model/response/ChapterResponse.kt`, `ChapterMetaResponse.kt`, `backend/.../model/request/CreateChapterRequest.kt`
- [x] T011 [P] [US1] 챕터 순서 검증기 제거: `backend/.../components/documents/ChapterReorderValidator.kt` + `backend/src/test/.../ChapterReorderValidatorTest.kt`
- [x] T012 [P] [US1] 마지막 챕터 가드 제거: `backend/.../error/LastChapterException.kt` (409 LAST_CHAPTER_UNDELETABLE 사용 중단) + 참조처 정리
- [x] T013 [US1] `backend/.../repository/DocumentRepository.kt` 챕터 쿼리(reorder/다중 목록) 정리, 활성 단일 본문 조회만 유지

### FE 챕터 UI 제거

- [x] T014 [P] [US1] `frontend/src/components/editor/ChapterList.tsx` + `ChapterList.test.tsx` 제거
- [x] T015 [US1] `frontend/src/components/b/BStudioShell.tsx` 에서 챕터 목록·전환·추가 UI 및 `?chapter` URL 파라미터 처리 제거, 단일 본문 집필로 단순화
- [x] T016 [US1] `frontend/src/components/custom-editor/BCustomChapterEditor.tsx` 를 단일 본문 에디터로 정리(챕터 전환 리마운트 로직 제거; 016 세션 documentId 단위 유지)
- [x] T017 [P] [US1] `frontend/src/lib/api/document.ts` 챕터 호출(목록/생성/순서/제목/삭제/복구) 제거, 단일 본문 조회·저장만
- [x] T018 [P] [US1] `frontend/src/lib/query/useDocument.ts` 챕터 훅(useProjectChapters/useCreateChapter/useDeleteChapter/useRestoreChapter/useReorderChapters) 제거
- [x] T019 [US1] `frontend/src/lib/export/collectChapters.ts`·`mergeChapters.ts`(+테스트) 를 단일 본문 수집으로 정리(다중 챕터 병합 경로 제거)
- [x] T020 [US1] `frontend/src/app/(main)/works/[id]/page.tsx` 챕터 props·상태 정리

### 검증

- [x] T021 [US1] backend verify + frontend verify GREEN (`cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` / `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`)

**Checkpoint**: 챕터 제거 완결 — 단일 본문 집필 dogfoodable. (016 거짓 409 경로 소멸 확인)

---

## Phase 4: User Story 2·3 — 판형·출판방식 시리즈 종속 + 미분류 fallback (R2, Priority P1·P2)

**Goal**: 판형·출판방식을 시리즈에 설정, 작품은 effective 값 적용(미분류·미설정=기본값). 집필실·내보내기가 effective 단일 경로.

**Independent Test**: 시리즈 판형 설정 시 하위 작품 일괄 렌더, 변경 시 일괄 반영, 미분류 작품은 기본 판형, 작품 이동 시 새 판형 적용.

### 테스트 (TDD)

- [ ] T022 [P] [US2] effective 판형 해석 단위 테스트 in `backend/.../` — (a)시리즈값 (b)미분류→"A4"/"paper" (c)시리즈 미설정→기본값 (data-model.md 규칙)
- [ ] T023 [P] [US3] 작품 시리즈 이동(PATCH category) 후 effective 재해석 테스트 in `backend/.../`
- [ ] T024 [P] [US2] Category 생성/수정 시 판형·출판방식 저장·응답 테스트 in `backend/.../`

### BE

- [ ] T025 [US2] `backend/.../model/request/CreateCategoryRequest.kt`·`UpdateCategoryRequest.kt` 에 paperSize/layoutMode 필드 추가(optional, layoutMode 검증 paper/web·null 허용)
- [ ] T026 [US2] `backend/.../model/response/CategoryResponse.kt` 에 paperSize/layoutMode 추가
- [ ] T027 [US2] `backend/.../service/CategoryService.kt`·`mapper/CategoryMapper.kt` 에 판형·출판방식 저장/매핑
- [ ] T028 [US2] `backend/.../model/response/ProjectResponse.kt`·`ProjectCardResponse.kt` 에 `effectivePaperSize`·`effectiveLayoutMode` 추가
- [ ] T029 [US2] `backend/.../mapper/ProjectMapper.kt`(또는 ProjectService) 에 effective 해석 구현(시리즈 join, fallback "A4"/"paper")
- [ ] T030 [P] [US2] 시스템 기본값 상수 정의(`"A4"`/`"paper"`) — 현행 Project default 재사용 위치에 단일 상수

### FE

- [ ] T031 [US2] `frontend/src/types/api.ts` — CategoryResponse(paperSize/layoutMode), ProjectResponse(effectivePaperSize/effectiveLayoutMode) 타입 확장
- [ ] T032 [US2] `frontend/src/components/library/LibraryBoard.tsx`·`CategoryTile.tsx` 시리즈 생성·편집 폼에 판형·출판방식 입력 추가
- [ ] T033 [US2] `frontend/src/app/(main)/library/page.tsx` 작품 폼(`ProjectFormState`)에서 판형·출판방식 입력 제거
- [ ] T034 [US2] `frontend/src/lib/api/categories.ts` createCategory/updateCategory 시그니처에 판형·출판방식 반영
- [ ] T035 [US3] 집필실 effective 결선 — `frontend/src/components/custom-editor/CustomEditor.tsx`·`BCustomChapterEditor.tsx`·`components/b/BStudioShell.tsx`·`app/(main)/works/[id]/page.tsx` 에서 `project.paperSize`/`layoutMode` → `effectivePaperSize`/`effectiveLayoutMode` 전환
- [ ] T036 [US3] 내보내기 effective 결선 — `frontend/src/components/export/PrintDocument.tsx`·`PrintOverlay.tsx`·`ExportDialog.tsx` 에서 effective 판형 사용
- [ ] T037 [US2] backend verify + frontend verify GREEN

**Checkpoint**: 판형·출판방식 시리즈 종속 + 미분류 fallback dogfoodable.

---

## Phase 5: User Story 2·5·6 — 장르·줄거리 시리즈 이동 + 톤류 UI 제거 + 화면 간소화 (R3, Priority P1·P3)

**Goal**: 장르·줄거리 시리즈 단위, 톤류 화면 제거(데이터 보존), 작품/시리즈 폼 정리.

**Independent Test**: 시리즈 폼에 장르·줄거리, 작품 카드·폼에 장르·줄거리·톤류 미표시, 톤류 DB 값 보존.

### 테스트 (TDD)

- [ ] T038 [P] [US2] Category genre/synopsis 저장·응답 테스트 in `backend/.../`
- [ ] T039 [P] [US5] 작품 생성/수정 시 톤류·장르·줄거리 입력 무시(미저장 변경) + 기존 톤류 데이터 보존 테스트 in `backend/.../`

### BE

- [ ] T040 [US2] `CreateCategoryRequest`/`UpdateCategoryRequest`/`CategoryResponse` 에 genre/synopsis 추가(T025~T027 연장) + Service/Mapper 매핑
- [ ] T041 [US5] `backend/.../model/request/CreateProjectRequest.kt`·`UpdateProjectRequest.kt` 에서 genre/synopsis/toneNotes/worldNotes/nextScene 입력 제거(구 클라이언트 전송 시 무시, 400 아님). Project 컬럼은 보존(DROP 안 함)
- [ ] T042 [US5] `backend/.../service/ProjectService.kt` 작품 생성/수정에서 위 메타 미반영(default 유지)

### FE

- [ ] T043 [US6] `frontend/src/app/(main)/library/page.tsx` 작품 폼(`ProjectFormState`/`emptyForm`/`fromProject`)에서 genre/synopsis/toneNotes/worldNotes/nextScene 입력 제거 → 제목+작품목표분량 중심
- [ ] T044 [US5] `frontend/src/components/library/DraggableWorkCard.tsx` 에서 장르·줄거리·다음장면(nextScene) 표시 제거(FR-023)
- [ ] T045 [P] [US5] `frontend/src/components/b/dashboard/BResumeCard.tsx` 등 nextScene 표시처 정리(작품 표면 노출 제거)
- [ ] T046 [US2] `frontend/src/components/library/LibraryBoard.tsx`·`CategoryTile.tsx` 시리즈 폼에 장르·줄거리 입력 추가 + 시리즈 타일/표시에 장르 노출
- [ ] T047 [US2] `frontend/src/types/api.ts`·`lib/api/categories.ts` genre/synopsis 반영
- [ ] T048 [US5] backend verify + frontend verify GREEN

**Checkpoint**: 장르·줄거리 시리즈 이동 + 톤류 화면 제거(데이터 보존) dogfoodable.

---

## Phase 6: User Story 4 — 두 층위 목표 분량 (R4, Priority P2)

**Goal**: 시리즈 총 목표(하위 작품 글자수 합산 진척) + 작품 단위 목표 유지.

**Independent Test**: 시리즈 총 목표 입력 시 하위 작품 글자수 합 대비 진척 표시, 작품 목표 독립, 미설정 시 오류 없음.

### 테스트 (TDD)

- [ ] T049 [P] [US4] Category target_length 저장·응답 테스트 in `backend/.../`
- [ ] T050 [P] [US4] totalWordCount 집계 테스트 in `backend/.../` — 하위 작품(archived 제외) 활성 본문 word_count 합, 목표 null/0 가드

### BE

- [ ] T051 [US4] `CreateCategoryRequest`/`UpdateCategoryRequest`/`CategoryResponse` 에 targetLength 추가 + `CategoryResponse.totalWordCount` 추가
- [ ] T052 [US4] `backend/.../service/CategoryService.kt` 시리즈 진척 집계(하위 작품 word_count 합) — 기존 ProjectCardResponse 집계 경로 재사용

### FE

- [ ] T053 [US4] `frontend/src/components/library/LibraryBoard.tsx`·`CategoryTile.tsx` 시리즈 폼에 총 목표 입력 + 진척(totalWordCount/targetLength) 표시(목표 없음/0 나눗셈 가드)
- [ ] T054 [US4] `frontend/src/app/(main)/library/page.tsx` 작품 폼 작품 목표(targetLength) 입력 유지 확인(시리즈 총 목표와 독립)
- [ ] T055 [P] [US4] `frontend/src/types/api.ts`·`lib/api/categories.ts` targetLength/totalWordCount 반영
- [ ] T056 [US4] backend verify + frontend verify GREEN

**Checkpoint**: 두 층위 목표 분량 dogfoodable.

---

## Phase 7: Polish & 통합 검증

- [ ] T057 [P] 전 라운드 dogfooding (quickstart.md R1~R4 시나리오) — 로컬 dev 서버(포트 확인 §20)
- [ ] T058 무손실 확인 — 운영 DB 읽기 조회(메모리 [[oci-db-readonly-access]])로 배포 전후 작품 본문·톤류(tone_notes/world_notes/next_scene) 데이터 유실 0 비교
- [ ] T059 [P] 잔존 챕터 참조 grep 0 확인 — `grep -rn "chapter\|Chapter" backend/src frontend/src` 로 제거 누락 점검(테스트·주석 제외 실 참조)
- [ ] T060 `git fetch origin && git log --oneline HEAD..origin/develop` 누락 커밋(보안·공개경로 계약) 재점검(§18)
- [ ] T061 buffer 통합 — 033 → buffer 머지(032 와 함께), 전체 게이트 GREEN 재확인 후 사용자에게 develop 머지 결정 surfacing

---

## Dependencies & 실행 순서

```
Phase 1 (Setup)
   ├─→ Phase 2 (Foundational: V21 Category 메타) ──→ Phase 4 (R2) ──→ Phase 5 (R3) ──→ Phase 6 (R4)
   └─→ Phase 3 (US1 챕터제거, 독립) ─────────────────────────────────────────────────┘
                                                                                      ↓
                                                                              Phase 7 (Polish)
```

- **Phase 3(US1 챕터제거)는 Phase 2 와 독립** — 병렬 가능(Category 무관).
- **Phase 4→5→6 순차** — 모두 V21(Phase 2) 의존, Category DTO/Service/Mapper·시리즈 폼을 누적 확장(같은 파일 다수 공유).
- **R2 effective(T028~T029)는 R1(단일 본문) 무관** — 단 집필실 결선(T035)은 R1 의 BStudioShell 정리(T015~T016) 후가 충돌 적음.

## 병렬 실행 기회

- **Phase 2 ∥ Phase 3**: Foundational(BE Category) 과 US1(챕터제거)은 다른 파일군 → 병렬.
- Phase 3 내: T010·T011·T012·T014·T017·T018 [P] (서로 다른 파일 제거).
- Phase 4 내: T022·T023·T024 [P] 테스트, T030 [P] 상수.
- Phase 5 내: T038·T039 [P], T045 [P].

## Implementation Strategy

- **MVP = Phase 3 (US1 챕터 제거)** — 단독으로 "시리즈=책/작품=장" 모형의 핵심 전환(챕터 소멸)을 dogfoodable 하게 전달.
- 이후 Phase 2→4→5→6 순으로 시리즈 메타를 증분 적층.
- 각 Phase Checkpoint 에서 게이트 GREEN + dogfooding 후 다음 진입.
- 전 라운드는 `buffer` 에 누적, 032 와 함께 검증 후 develop(사용자 승인 시 main).

## 잔여 가정 (implement 직전 재확인 — §6)

- T029 effective 해석 위치: `ProjectMapper` vs `ProjectService` 중 기존 매핑 패턴 따라 결정(implement 시 grep).
- T045 nextScene 표시처: `BResumeCard` 등 dashboard 컴포넌트의 실제 노출 여부 grep 후 정리 범위 확정.
- T019 export 단일 본문 정리: `collectChapters`/`mergeChapters` 의 호출처(ExportDialog 등) 영향 범위 grep.
