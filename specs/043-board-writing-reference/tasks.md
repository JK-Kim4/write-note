# 043 tasks — 집필 중 보드 참조

## BE (선행) — 완료
- [x] B1 `BoardServiceTest` — `listReferenceBoards` 단위 3(작품+상위시리즈 최근순 / 미분류=작품만 / 비소유 404). TDD RED→GREEN.
- [x] B2 `BoardService.listReferenceBoards(userId, projectId)` — 본인 작품(findByIdAndUserId, 없으면 404) → 작품 보드 + project.categoryId 시리즈 보드, 최근순 toSummaries 재사용.
- [x] B3 `BoardController` — `GET /reference?projectId=`(`/{boardId}` 앞 리터럴 배치).
- [x] B4 `BoardControllerIT` — reference 2(작품+상위시리즈 반환·아이디어 제외 / 비소유 404) + `moveToCategory` 헬퍼.
- [x] B5 BE 게이트 GREEN — ktlint(main+test format·check)·checkstyle·test·build.

## FE (후행)
- [ ] F1 `lib/lastViewedBoard.ts`(순수) + 테스트 — localStorage projectId→boardId 읽기/쓰기(TDD).
- [ ] F2 `lib/api/boards.ts` `listReferenceBoards(projectId)` + `electron-api/boards.ts` 어댑터.
- [ ] F3 `lib/query/useBoards.ts` `useReferenceBoards(projectId)`.
- [ ] F4 `components/b/BoardReferencePanel.tsx`(신규) — 슬라이드오버: 보드 전환 + 캔버스(dynamic) + last-viewed + 빈상태.
- [ ] F5 `BStudioShell.tsx` — "보드 참조" 토글 버튼 + 패널 마운트.
- [ ] F6 FE 게이트 GREEN — typecheck·lint0err·test·build + 회귀 grep.

## 결과(예정)
- authed 분할뷰 dogfooding = 보고서 체크리스트(핸드오프 §7).
