# 보드 트랙 C-2 설계 — 내부 탭 + 집필 참조 (042 / 043)

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-06-26 (야간 자동 진행) |
| 상위 SoT | `board-prd.md` §5.4·§9·§10, `board-ux-worksheet.md` TASK-4B·TASK-5, `board-roadmap.md` §5 C-2 |
| 분할 | **042 = 내부 탭**(FE-only) · **043 = 집필 참조**(BE+FE) |
| 결정 정책 | 사용자 부재(야간 자동) — 핸드오프 §4 우선순위(코드베이스 확인 → PRD 정책 → 보수적 기본값)로 자동 확정. 본 문서가 결정 로그 SoT |

> 본 문서는 야간 자동 진행 중 **추측 없이 코드베이스를 직접 실측**해 확정한 결정을 박는다(CLAUDE.md 최우선 금지 1·핸드오프 §4).

---

## 0. 실측으로 확정한 사실 (코드베이스 grep/Read)

| 사실 | 근거(파일) | 결론 |
|---|---|---|
| 별도 작품/시리즈 상세 페이지 **없음** | `frontend/src/app/(main)` 라우트 = `/library`, `/works/[id]`, `/boards`(+하위)만 | 작품 상세=집필 화면(`works/[id]`), 시리즈 상세=`library` 드릴인 |
| `GET /boards?ownerType=&ownerId=` **존재** | `BoardController.listBoards`(L65-72)·`BoardService.listBoards`(L80-97) | 내부 탭 BE 계약 준비됨 → **042 BE=0** |
| `GET /works/:id/reference-boards` **미존재** | grep `reference-boards` = 0 | 집필 참조 → **043 BE 신규** |
| `SettingsService.ALLOWED` = key별 **값 화이트리스트** | `SettingsService.kt` L54-62 (`mapOf(...setOf(...))`) | 임의 boardId 적재 불가 → 마지막 본 보드는 **localStorage**(비파괴) |
| `Project.categoryId: Long?` **존재** | `entity/Project.kt` L42 | 상위 시리즈 = `project.categoryId` |
| `ProjectRepository.findByIdAndUserId` **존재** | `repository/ProjectRepository.kt` L40 | reference-boards 인증(본인 작품) |
| `BoardService.toSummaries`/owner 필터 헬퍼 | `BoardService.kt` L80-97·L376-423 | reference-boards 가 재사용 |
| nav "보드" 메뉴 존재 | `(main)/layout.tsx` L24 `{ href:"/boards", label:"보드" }` | 전역 허브 진입점 살아있음(041) |
| `BWorkSidePanel` 탭 = `"memos"|"characters"` | `BWorkSidePanel.tsx` L16·L258-294 | "보드" 탭 추가 가능(flex-1 3개) |
| 집필실 셸 `panelTab` state | `BStudioShell.tsx` L120 `useState<"memos"|"characters">` | 타입 확장 필요 |
| 보드 캔버스 재사용 단위 | `boards/[boardId]/page.tsx` → `PlotBoardCanvas`(dynamic ssr:false) | 참조 슬라이드오버가 재사용 |

---

## 1. 042 — 보드 내부 탭 (작품·시리즈 상세) · FE only · BE=0

### 목표 (PRD §5.4 ② / UX TASK-4B 변형)
작품/시리즈 "상세"에서 **그 주체에 매달린 보드만** 보이는 진입점. 맥락 안에서 관리(목록·생성·열기). 생성 시 owner 자동.

### 결정
| 결정 지점 | 채택 | 근거 |
|---|---|---|
| 작품 상세 호스트 | **집필 화면 `BWorkSidePanel`에 "보드" 탭 추가**(메모·인물·**보드**) | 별도 작품 상세 페이지 부재(실측). 집필 화면이 곧 작품 상세 |
| 시리즈 상세 호스트 | **`library` 드릴인(`activeFolder != null`)에 "시리즈 보드" 섹션** | 별도 시리즈 상세 페이지 부재. 드릴인이 곧 시리즈 상세 |
| 데이터 | `useBoardList({ ownerType, ownerId })` 재사용 | BE 계약 준비됨(041) |
| 생성 | `useCreateBoard({ name, ownerType, ownerId })` owner 자동 — picker 없이 이름만 | UX TASK-4 "내부 생성 = owner 자동, 이름만"(마찰 적음) |
| 열기 | `→ /boards/{id}` 네비(전체 화면 편집) | 동일 보드 실체(PRD §5.4) |
| 빈 상태 | "아직 이 {작품/시리즈} 보드가 없어요. + 새 보드" | 빈 캔버스 노출 금지 원칙 정합 |

### 변경 파일
- `frontend/src/components/board/InlineBoardList.tsx` (신규) — owner 스코프 보드 목록+인라인 생성(이름만)+열기. 작품·시리즈 공용.
- `frontend/src/components/b/BWorkSidePanel.tsx` — `Tab` 에 `"boards"` 추가 + 탭 버튼 + `BoardsTab`(InlineBoardList 호출).
- `frontend/src/components/b/BStudioShell.tsx` — `panelTab` 타입 `"memos"|"characters"|"boards"` 확장(전달만).
- `frontend/src/components/library/LibraryBoard.tsx` — 드릴인 분기에 "시리즈 보드" 섹션(InlineBoardList).
- `COPY` 상수: 내부 생성 = `+ 새 보드`, 이름 placeholder 재사용.

### 배포 순서 / 위험
FE 단독, 마이그레이션 0, 신규 BE 0. 위험 낮음(탭/섹션 추가, 에디터 레이아웃 무변경).

---

## 2. 043 — 집필 중 보드 참조 (분할/슬라이드 뷰) · BE+FE

### 목표 (PRD §5.4 ③ / §9 / UX TASK-5)
집필 화면에서 **그 작품 보드 + 상위 시리즈 보드**를 곁눈질로 참조(읽기 중심). 마지막 본 보드 기억. 원고 옆에서 본다.

### 결정
| 결정 지점 | 채택 | 근거 |
|---|---|---|
| reference-boards 엔드포인트 경로 | **`GET /api/boards/reference?projectId={id}`**(BoardController) | 코드베이스 API 베이스는 `/api/projects`(작가 친화 "works"는 FE 라우트만). 보드 도메인 로직이라 `/api/boards` 하위 응집. 핸드오프의 `/works/:id/...` 표기는 PRD 표현이며 실제 베이스로 정합 |
| 응답 형태 | `BoardSummary[]`(작품 보드 + 상위 시리즈 보드, 최근순) | `toSummaries` 재사용. ownerLabel 로 그룹 구분 |
| 상위 시리즈 도출 | `project.categoryId` | 실측(Project.categoryId) |
| 인증 | `requireOwnedProject`(`findByIdAndUserId`) — 없으면 404 | 보드 격리 패턴 동일 |
| 참조 UI 형태 | **우측 슬라이드오버(overlay) 패널** + 보드 전환 + 인라인 캔버스(dynamic import) | 집필실 3패널 flex 레이아웃 **무변경**(회귀 위험 ↓, ISSUE-048 EditContext 포커스 민감). 읽기 중심이라 overlay 적합(PRD §5.4 "곁눈질") |
| 마지막 본 보드 | **localStorage** `writenote.board.lastViewed.v1` (projectId→boardId 맵) | `SettingsService.ALLOWED` 값 화이트리스트라 임의 boardId 서버 키 불가(실측). 비파괴 기본값 |
| 보드 번들 격리 | `dynamic(() => import("PlotBoardCanvas"), { ssr:false })` | PRD §9 — 집필 번들에 영향 0 |
| 1개면 전환 생략 | 보드 1개면 바로 표시(드롭다운 숨김) | PRD §9 / UX TASK-5 |

### 변경 파일 (BE 선행)
- BE:
  - `BoardController` — `GET /reference` (projectId param) 추가.
  - `BoardService` — `listReferenceBoards(userId, projectId)`: 본인 작품 검증 → 작품 보드(owner=project) + 상위 시리즈 보드(owner=category, project.categoryId) 합쳐 최근순 `toSummaries`.
  - 테스트: `BoardServiceTest`(참조 목록 파생 단위) + `BoardControllerIT`(엔드포인트·격리·미인증).
- FE:
  - `lib/api/boards.ts` — `listReferenceBoards(projectId)`.
  - `lib/electron-api/boards.ts` — 어댑터.
  - `lib/query/useBoards.ts` — `useReferenceBoards(projectId)`.
  - `components/b/BoardReferencePanel.tsx` (신규) — 슬라이드오버: 보드 전환 + 캔버스(dynamic) + last-viewed.
  - `lib/lastViewedBoard.ts` (신규, 순수) — localStorage projectId→boardId 읽기/쓰기 (TDD).
  - `BStudioShell.tsx` — "보드 참조" 토글 버튼 + 패널 마운트.

### 배포 순서 / 위험
**BE 선행 → FE 후행**(BE 가 reference-boards 계약 제공). 보드 미배포라 prod 위험 0(원자적 동반 merge 대기). FE 슬라이드오버=중간 위험(신규 패널·dynamic). **authed 분할뷰 dogfooding 은 로그인 불가로 보고서 체크리스트로 이연**(핸드오프 §7).

---

## 3. 검증 게이트 (각 단위)
- BE: `ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`
- FE: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- 회귀 grep: 어댑터 밖 node/edge 0, 화면 폐기 용어(메모/인물 구메뉴·viewport) 0.
- 마이그레이션 0(042·043 모두 — 신규 테이블·컬럼 없음).

## 4. 범위 밖 (E·후속)
- 메모·인물 통합(E) = 별도 비파괴 설계 초안만(자동 진행 금지 — 핸드오프 §5 가드 3).
- undo/redo·온보딩(TASK-6·7 잔여) = 별도 트랙.
- 작품 side-panel "보드" 탭(관리)과 "보드 참조" 슬라이드오버(읽기)의 의도적 분리(PRD 관리 vs 읽기). dogfooding 에서 중복감 확인되면 통합 후속.
