# 자체 에디터 R6 — TipTap 완전 폐기

- 상위 설계: `docs/superpowers/specs/2026-06-16-custom-editor-full-replacement-design.md`
- 선행: R3·R4(B형)·R5(A형) 완료 — 모든 활성 라우트가 자체 엔진
- 브랜치: `023-export`. 백엔드 0.

## 개요

A·B 양쪽 집필실이 자체 엔진으로 교체 완료됐으므로(R4·R5), TipTap 의존 코드와 패키지를 완전히 제거한다. `grep @tiptap src = 0` 달성.

## 기능 요구사항

- **FR-001** 타입 이관: `BChapterEditorSyncStatus`/`BChapterEditorConflictHandlers` → `src/components/custom-editor/types.ts`(중립). importer 재지정(BStudioShell·BCustomChapterEditor·projects/[id]/write).
- **FR-002** 삭제: `b/BEditor.tsx`·`b/BChapterEditor.tsx`·`editor/PaperEditor.tsx`·`editor/ChapterEditor.tsx`·`editor/Editor.tsx`(레거시 006)·`editor/useEditorOutline.ts`.
- **FR-003** 고아 삭제(본 교체로 미사용화): `editor/InlineEditableTitle.tsx`(+test) — A·B 본문상단 인라인 제목편집 제거로 미사용.
- **FR-004** TipTap PoC 라우트 삭제: `(poc)/poc/write`(PaperEditor 데모). `poc/editor`·`poc/editor-static`·`poc/export-print` 은 tiptap 비의존이라 유지.
- **FR-005** 패키지 제거: `@tiptap/pm`·`@tiptap/react`·`@tiptap/starter-kit`.
- **FR-006** 잔존 주석의 `@tiptap` 언급 정리(export-print PoC) — grep 0 달성.
- **FR-007** multicol WIP(체크포인트 `7b84c74`: BEditor/PaperEditor multicol 페이지분할 fix) supersede 확인 — 대상 컴포넌트 삭제로 자동 무효.

## 성공 기준

- **SC-001** `grep -rn "@tiptap" src` = 0, `package.json` @tiptap = 0.
- **SC-002** `tsc --noEmit` GREEN(삭제 파일 참조 0).
- **SC-003** 전체 vitest GREEN(삭제 컴포넌트 테스트 없음 — PaperEditor/ChapterEditor/Editor 무테스트, InlineEditableTitle.test 동반 삭제).
- **SC-004** `pnpm build` GREEN(/poc/write 제거 반영).

## 범위 밖 (별도 트랙)

- 원고지 stub(`ManuscriptGrid.tsx`/`manuscript.ts`) — tiptap 비의존, 별도 정리 트랙(설계 §8).
- 폐기 후 b.css/paper-editor.css 의 잔존 dead CSS 규칙 정리(기능 무관, 후속).
- 실제 export 생성(R7).
