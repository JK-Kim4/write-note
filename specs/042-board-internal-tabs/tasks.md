# 042 tasks — 보드 내부 탭

- [x] T1 `InlineBoardList.tsx` 신규 — View(순수 표시: 목록·빈상태·로딩·에러·인라인 생성) + 컨테이너(useBoardList/useCreateBoard/router 배선).
- [x] T2 `InlineBoardList.test.tsx` — View 행위 5: 빈상태, 목록 렌더, onOpen, 생성 흐름, 로딩/에러.
- [x] T3 `BWorkSidePanel.tsx` — `Tab` 유니온에 `"boards"` 추가 + 보드 탭 버튼 + `BoardsTab`(작품 owner InlineBoardList).
- [x] T4 `BStudioShell.tsx` — `panelTab` 타입 `SidePanelTab`(메모·인물·보드)로 확장(setter 공변 정합).
- [x] T5 `LibraryBoard.tsx` — 시리즈 드릴인에 "시리즈 보드" 섹션(category owner InlineBoardList).
- [x] T6 `LibraryBoard.test.tsx` — 드릴인 시 `GET /api/boards` 기본 핸들러(빈 목록) 추가.
- [x] T7 게이트 GREEN — typecheck / lint 0err(48 warn=기존 ISSUE-034) / test 699(694+5) / build(RSC) / 회귀 grep clean.

## 결과
- BE=0, 마이그레이션 0, FE 단독.
- authed dogfooding(집필실 보드 탭 동작·시리즈 보드 섹션·생성→이동)은 로그인 불가로 보고서 체크리스트로 이연(핸드오프 §7).
- 커밋: 038 브랜치(develop merge 보류).
