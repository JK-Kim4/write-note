# 042 plan — 보드 내부 탭

설계 SoT = `docs/board/board-track-c2-design.md` §1. 본 plan 은 구현 순서·파일·검증만.

## 재사용 (BE=0 확인)
- `GET /boards?ownerType=&ownerId=` → `webElectronApi.boards.list({ownerType, ownerId})` / `useBoardList(filter)` (이미 존재).
- `POST /boards` owner 동봉 → `useCreateBoard()` (이미 존재).
- `BoardSummary`(id·name·ownerLabel·cardCount·updatedAt) 타입 재사용.

## 신규/변경 파일
1. `components/board/InlineBoardList.tsx` (신규) — owner 스코프 보드 목록 + 인라인 생성(이름만) + 열기(→/boards/{id}). 작품·시리즈 공용. props: `{ ownerType, ownerId, variant? }`.
2. `components/b/BWorkSidePanel.tsx` — `Tab` 유니온에 `"boards"` 추가, 탭 버튼 1개, `BoardsTab`(InlineBoardList project owner).
3. `components/b/BStudioShell.tsx` — `panelTab` state 타입 `"memos"|"characters"|"boards"`(전달만, 두 인스턴스 공유).
4. `components/library/LibraryBoard.tsx` — 드릴인 분기 헤더 아래 "시리즈 보드" 섹션(InlineBoardList category owner).

## 구현 순서
1. InlineBoardList 신규 (목록·생성·열기·빈상태·로딩·에러).
2. 단위 테스트 `InlineBoardList.test.tsx` (목록 렌더·빈상태·생성 호출) — RTL 행위.
3. BWorkSidePanel 보드 탭 + BStudioShell 타입 확장.
4. LibraryBoard 시리즈 보드 섹션.
5. 게이트 + 회귀 grep.

## 검증
- FE: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (cwd=frontend).
- 회귀: `grep -rn "board_nodes\|board_edges" frontend/src` = 0(어댑터 밖), 화면 폐기용어 0.

## TDD 적용
- InlineBoardList = 표시 컴포넌트 — RTL 행위 테스트(목록·빈상태·생성 콜백). 순수 로직 없음(필터는 BE).
- 탭/섹션 배선 = 구조 변경(룰 §5-5 완화), 빌드·typecheck 가 게이트.
