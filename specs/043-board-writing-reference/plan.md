# 043 plan — 집필 중 보드 참조

설계 SoT = `docs/board/board-track-c2-design.md` §2. 본 plan 은 구현 순서·결정만.

## BE (선행)
- `listReferenceBoards(userId, projectId)` — 본인 작품 검증(`findByIdAndUserId`, 없으면 404) → 작품 보드(owner=project) + 상위 시리즈 보드(owner=category, project.categoryId; null이면 생략) 합쳐 최근순 → `toSummaries` 재사용. 신규 repo 메서드 0(`findByUserIdAndOwnerTypeAndOwnerIdOrderByUpdatedAtDesc` 재사용).
- `GET /api/boards/reference?projectId=` — `/{boardId}` 보다 먼저(리터럴 우선, 라우팅 충돌 방지). 마이그레이션 0.

## FE (후행)
- `lastViewedBoard.ts` 순수 헬퍼(localStorage projectId→boardId, JSON 맵, 손상 내성) — TDD.
- API/어댑터/훅: `listReferenceBoards`·`boards.referenceBoards`·`useReferenceBoards`.
- `BoardReferencePanel.tsx`: 우측 슬라이드오버(overlay, 집필 3패널 flex 무변경) — 후보 전환 + `PlotBoardCanvas` dynamic import + last-viewed 기본선택 + 빈상태(→/boards 안내).
- `BStudioShell.tsx`: "보드 참조" 토글 + 패널 마운트(닫힘 기본).

## 검증
- BE: `ktlint*Check checkstyleMain test build`.
- FE: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- 회귀: 어댑터 밖 node/edge 0.

## TDD
- `listReferenceBoards`(파생 로직)·`lastViewedBoard`(순수) = TDD RED→GREEN.
- 슬라이드오버 캔버스 상호작용 = dogfooding 게이트(jsdom 미검증, 보고서 체크리스트).
