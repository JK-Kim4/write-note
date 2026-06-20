# Tasks: 자체 에디터 R4 — B형 전면 교체

**Feature**: `specs/024-custom-editor-r4` | **Branch**: `023-export` | **Spec**: spec.md
**상속**: R3 plan/아키텍처(신규 엔진 로직 0, 백엔드 0). 결선·라우팅 교체 라운드.

경로 접두사: `frontend/`

## Phase 1: Export 셸 통합 (US2)

- [ ] T001 [US2] `src/components/b/BStudioShell.tsx`: `ExportDialog` import + `exportOpen` 상태 + `ChapterList onExport={() => setExportOpen(true)}` + `{exportOpen && <ExportDialog open chapters={chapters} paperSize={paperSize} onExportPdf={()=>{}} onClose={...} />}`. (chapters·paperSize 는 셸에 이미 있음)

## Phase 2: 기본 라우트 교체 (US1)

- [ ] T002 [US1] `src/app/b/works/[id]/page.tsx` 재작성 → `BStudioShell`(chapterUrlBase 기본) + renderEditor=`BCustomChapterEditor`(key={currentChapterId}) + `useCustomOutline(".custom-editor-scroll")`. 기존 monolithic(TipTap·useEditorOutline·수동 챕터관리·export·모달) 제거(셸이 대체).
- [ ] T003 [US1] `src/app/b/works/[id]/page.test.tsx` 갱신: `BEditor`/`useEditorOutline` mock → `BCustomChapterEditor`/`useCustomOutline` mock 으로 교체. 챕터 목록·순서이동(PUT order)·본문 제목 인라인편집(PATCH title)·전환(replace ?chapter)·복귀링크 행위 검증 유지(BStudioShell 제공). BCustomChapterEditor mock 은 chapterTitle/onChapterRename testid 노출.

## Phase 3: 실험 라우트·배너 제거 (US3)

- [ ] T004 [US3] `src/app/b/works/[id]/custom/` 디렉토리 제거(page.tsx) — 기본이 자체 엔진이므로 중복 제거. 경고 배너도 함께 사라짐.

## Phase 4: 검증

- [ ] T005 자동 게이트: `pnpm exec tsc --noEmit` + `pnpm exec vitest run src/components/custom-editor src/app/b` + `pnpm build`(RSC, /custom 제거 후 GREEN).
- [ ] T006 dogfooding 준비 — `/b/works/3537` 기본 진입, 기존 챕터 무손실·전 기능 점검. **정지: 사용자 dogfooding 게이트.**

## 무변경(R4 비대상, R6 폐기 담당)

`BChapterEditor`·`BEditor`·`useEditorOutline`·`@tiptap/*` 는 삭제 안 함(A형이 아직 사용). R6 에서 일괄 폐기.

## Dependencies

T001(셸 export) → T002(라우트가 셸 사용) → T003(테스트) → T004(제거) → T005(게이트) → T006(dogfooding).
