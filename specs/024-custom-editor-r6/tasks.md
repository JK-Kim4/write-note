# Tasks: 자체 에디터 R6 — TipTap 완전 폐기

**Feature**: `specs/024-custom-editor-r6` | **Branch**: `023-export`. 백엔드 0.

- [x] T001 타입 이관 — `custom-editor/types.ts` 생성(BChapterEditorSyncStatus/ConflictHandlers), importer 3곳 재지정.
- [x] T002 삭제 — BEditor·BChapterEditor·PaperEditor·ChapterEditor·Editor·useEditorOutline.
- [x] T003 고아 삭제 — InlineEditableTitle(+test).
- [x] T004 PoC 라우트 삭제 — (poc)/poc/write. (editor·editor-static·export-print 유지)
- [x] T005 패키지 제거 — @tiptap/pm·react·starter-kit.
- [x] T006 export-print 주석 @tiptap 언급 정리(grep 0).
- [x] T007 게이트 — `grep @tiptap src`=0 + package 0 + tsc + 전체 vitest 545 + build GREEN.

## 결과

@tiptap src=0, package.json=0. tsc GREEN, vitest 545 GREEN, build GREEN(/poc/write 제거).
multicol WIP(7b84c74)은 BEditor/PaperEditor 삭제로 supersede.

## 별도 트랙(후속)

원고지 stub(ManuscriptGrid/manuscript.ts) 정리, b.css/paper-editor.css dead CSS 정리.
