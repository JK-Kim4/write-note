# 043 tasks — 집필 중 보드 참조

## BE (선행) — 완료
- [x] B1 `BoardServiceTest` — `listReferenceBoards` 단위 3(작품+상위시리즈 최근순 / 미분류=작품만 / 비소유 404). TDD RED→GREEN.
- [x] B2 `BoardService.listReferenceBoards(userId, projectId)` — 본인 작품(findByIdAndUserId, 없으면 404) → 작품 보드 + project.categoryId 시리즈 보드, 최근순 toSummaries 재사용.
- [x] B3 `BoardController` — `GET /reference?projectId=`(`/{boardId}` 앞 리터럴 배치).
- [x] B4 `BoardControllerIT` — reference 2(작품+상위시리즈 반환·아이디어 제외 / 비소유 404) + `moveToCategory` 헬퍼.
- [x] B5 BE 게이트 GREEN — ktlint(main+test format·check)·checkstyle·test·build.

## FE (후행) — 완료
- [x] F1 `lib/lastViewedBoard.ts`(순수) + 테스트 4 — localStorage projectId→boardId(손상 내성). TDD.
- [x] F2 `lib/api/boards.ts` `listReferenceBoards(projectId)` + `electron-api/boards.ts` `referenceBoards`.
- [x] F3 `lib/query/useBoards.ts` `useReferenceBoards(projectId, open)` + `boardKeys.reference`.
- [x] F4 `components/b/BoardReferencePanel.tsx`(신규) — 우측 슬라이드오버: 후보 전환(>1 드롭다운)·`PlotBoardCanvas` dynamic·last-viewed 파생 기본선택·빈/로딩/에러 상태·ESC 닫기.
- [x] F5 `BStudioShell.tsx` — 좌패널 "보드 참조" 토글 + 패널 마운트(닫힘 기본).
- [x] F6 FE 게이트 GREEN — typecheck / lint 0err(48 warn=기존) / test 703(699+4) / build(RSC) / 회귀 grep clean.

## 결과
- BE 선행 → FE 후행. 마이그레이션 0. 보드 미배포라 prod 위험 0.
- **authed 분할뷰 dogfooding(보드 표시·전환·last-viewed·집필 레이아웃 무회귀) = 보고서 체크리스트**(로그인 불가, 핸드오프 §7).
- 커밋: 038 브랜치(develop merge 보류).
