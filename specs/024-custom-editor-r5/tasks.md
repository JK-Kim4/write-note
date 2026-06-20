# Tasks: 자체 에디터 R5 — A형 전면 교체

**Feature**: `specs/024-custom-editor-r5` | **Branch**: `023-export` | **Spec**: spec.md
**상속**: R3/R4 plan. 결선·라우팅 교체(신규 엔진 로직 0, 백엔드 0). A형 레거시 — 가벼운 검증.

경로 접두사: `frontend/`

- [x] T001 [US1] `src/app/projects/[id]/write/page.tsx` 재작성 → `BCustomChapterEditor`(key={currentChapterId}) + `useCustomOutline` + `ConflictDialog`(onConflict 핸들러). `editor`/`onEditorReady`/`useEditorOutline`/`lined`/`zoom` 제거.
- [x] T002 [US1] 작품 미존재(404) 분기 추가(로딩→미존재→챕터빈) — R4 정합.
- [x] T003 [US2] 상단 컨트롤 정리 — 줄노트·줌 버튼 제거(자체엔진 내장). 본문 상단 인라인 제목편집 제거.
- [x] T004 [US1] `page.test.tsx` 갱신 — `PaperEditor` mock → `BCustomChapterEditor`/`useCustomOutline` mock. 거짓409 딥테스트·본문상단 제목편집 테스트 제거(공유 컴포넌트가 커버), 챕터 관리 테스트 6 유지.
- [x] T005 자동 게이트: tsc·vitest(custom-editor+src/app/b+src/app/projects/[id]/write 292)·build GREEN.
- [ ] T006 가벼운 dogfooding — `/projects/[id]/write` 기존 작품 자체엔진 로드·기본 동작 확인. **정지: 사용자 확인(가벼움).**

## 무변경(R6 폐기 담당)

`@tiptap/*`·`ChapterEditor`·`PaperEditor`·`Editor`·`useEditorOutline` 삭제 안 함.
