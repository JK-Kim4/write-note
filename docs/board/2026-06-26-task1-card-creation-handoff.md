# 핸드오프 — 보드 TASK-1 카드 만들기 UX 보완 (+ TASK-7·프로세스) · 새 세션용

> 다음 세션 첫 메시지로 붙여넣어 사용. GAP 분석에서 드러난 **미회수 잔여**를 회수한다. 작업 방식 = **기능 요구사항 정의 → speckit(specify→plan→tasks→implement)**.

---

## 0. 한 줄
기획(UX worksheet) vs 구현 **GAP 분석**에서 드러난 미구현 잔여 중 **TASK-1 ②③(빈 보드 안내 + 빈 곳 더블클릭 생성)**을 중심으로, 기능 요구사항을 먼저 정의한 뒤 speckit 사이클로 구현한다.

## 1. 배경 (왜 이 작업 / 왜 누락됐나)
- **GAP 보고서**: `docs/research/2026-06-26-board-spec-vs-impl-gap.html` (브라우저로 열기 — 항목별 상태·근거 file:line·원인).
- **누락 원인 요약**: 로드맵 §3 갭 분석이 UX worksheet **TASK 단위 디테일**(TASK-1 ②③·TASK-7)을 갭으로 카탈로그하지 않음 + 트랙 A(`specs/039`)가 "TASK-1 잔여"로 Out of Scope 명시했으나 **추적 주인(ISSUE) 부재**로 어느 후속 트랙도 회수 안 함. 게다가 038 `spec.md FR-005`("빈 캔버스로 정상 표시")가 worksheet TASK-1("빈 캔버스 절대 노출 금지")과 **정면 모순**인데 화해 안 됨.
- **선행 상태**: 보드 코어(트랙 A·B·C·D·C-2·E1)는 **develop에 merge**됨(PR #74). 본 작업은 **develop 기반 새 브랜치**.

## 2. 작업 범위

### 주 (🟠 이번 핵심 — TASK-1)
- **TASK-1 ② 빈 보드 안내**: 카드 0개인 보드 진입 시 **빈 캔버스를 노출하지 않고** 중앙에 단일 진입점(안내 + 첫 카드 만들기). COPY 준비됨(§4 참조).
- **TASK-1 ③ 빈 곳 더블클릭 → 그 자리에 카드 생성** + 생성 직후 본문 편집 포커스.
- **038 FR-005 모순 정정**: `specs/038-memo-plot-board/spec.md` FR-005("빈 캔버스로 정상 표시")를 worksheet 정합으로 정정(또는 본 spec에서 supersede 명시).
- 완료 기준(worksheet): 버튼·더블클릭 두 경로 동일 결과 / 생성 직후 바로 본문 타이핑 / 빈 보드에서 빈 캔버스 미노출 / 본문 없이 벗어나면 카드 안 남음.

### 부 (🟡 같이 또는 후속 분리)
- **TASK-2 hover "끌어서 잇기" 텍스트 힌트**: 현재 `Handle`(연결점)만 hover 노출, COPY `link.hoverHint`("끌어서 잇기") 텍스트 단서 미렌더.
- **TASK-7 첫 진입 코치마크**: 처음 카드 hover "끌어서 잇기" 1회 / 처음 선택 "이건 뭔가요?" 1회(상황형). driver.js 온보딩과 겹쳐 범위 큼 → **별도 트랙 권장**.

### 프로세스 (🟠 재발 방지)
- 본 잔여들을 **vault ISSUE로 등재**(추적 주인 부여). 회고/룰 후보: "Out of Scope로 명시 제외한 잔여는 ISSUE로 추적 주인 부여" + "갭 분석은 PRD 축뿐 아니라 UX worksheet TASK 단위까지 대조".

## 3. 작업 방식 (사용자 지정)
1. **기능 요구사항 정의 먼저** — brainstorming으로 결정 지점 확정(아래 §4 결정 지점). 특히 빈 보드 안내 디자인·문구, 더블클릭 생성 후 즉시 편집 여부, TASK-7 포함 범위.
2. **speckit 사이클**: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
3. **새 spec 디렉토리 = `specs/044-...`** (현재 최대 043). 예: `044-board-card-creation-ux`.
4. **브랜치**: develop 기반 새 브랜치(예: `044-board-card-creation-ux`), 워크트리 격리 권장(`git worktree`, base=develop 검증 — 룰 §26).

## 4. 알려진 결정 지점 / 제약 (추측 금지 — 코드 직접 확인)
- **카드 = body 단일 모델**(title/content 분리 아님). worksheet의 "제목칸"은 **body로 매핑**한다. `CardResponse`=body·type·posX·posY·zIndex. `CardNode` 더블클릭=본문 편집(이미 존재).
- **빈 곳 더블클릭 핸들러**: `onPaneClick`(현재 선택 해제용, `PlotBoardCanvas:468`)와 별개로 `onPaneDoubleClick`(RF) 또는 pane `onDoubleClick` 추가. 좌표는 `screenToFlowPosition`(이미 "+ 카드"가 사용, `:380` 부근)으로 flow 좌표 변환.
- **생성 핸들러 재사용**: "+ 카드" = `createCard`(무지정, 트랙 D, `:365`). 더블클릭 생성도 동일 무지정 + **생성 직후 편집 진입**(temp id editing 상태). 낙관적 생성+롤백은 기존 패턴 재사용.
- **빈 보드 COPY 준비됨**: `board-ux-worksheet.md` §5 — `card.emptyBoard`="여기에 첫 카드를 적어보세요", `card.emptyBoardButton`="+ 카드 만들기". (현 버튼 문구는 "+ 카드".)
- **BE 변경 0 예상**: 카드 생성 endpoint(`POST /boards/{id}/cards`) 이미 있음. **FE only**.
- **회귀 주의**: 빈 곳 클릭/더블클릭이 기존 잇기(빈 곳 drop 연결)·선택 해제·드래그와 충돌하지 않게(이벤트 분기). 종류·매핑·집필 참조 무회귀.

## 5. 검증
- 게이트: FE `typecheck·lint(0err)·test·build`.
- dogfooding(authed, 로컬 풀스택): 빈 보드 진입 안내 / 더블클릭 그 자리 생성+편집 / 버튼·더블클릭 동일 결과 / 본문 없이 벗어나면 카드 미잔존 / 기존 잇기·종류·매핑 무회귀.
- 메모리 [[local-dogfooding-needs-backend]] — DB→BE bootRun→FE pnpm dev 3개 기동.

## 6. 참조
- GAP 보고서 `docs/research/2026-06-26-board-spec-vs-impl-gap.html`
- UX worksheet `docs/board/board-ux-worksheet.md` (TASK-1 L62-81 · TASK-7 L204-207 · §5 COPY)
- PRD `docs/board/board-prd.md` (§3 목표 · §7 데이터 모델)
- roadmap `docs/board/board-roadmap.md`
- 코드: `frontend/src/components/board/PlotBoardCanvas.tsx`(`onPaneClick:468`·`createCard:365`·빈곳drop:533) · `CardNode.tsx`(더블클릭 편집) · `boardActions.ts`
- 원본 스펙 `specs/038-memo-plot-board/spec.md`(FR-005 모순) · `specs/039-board-link-ui/spec.md`(Out of Scope "TASK-1 잔여")

## 7. 진행 순서 (제안)
1. brainstorming — §4 결정 지점 확정(빈 보드 안내 디자인·문구 / 더블클릭 즉시 편집 / TASK-7 포함 여부 / 038 FR-005 정정 방식).
2. `specs/044-board-card-creation-ux/` speckit 사이클.
3. 구현(FE) → 게이트 GREEN → dogfooding → 마무리(develop merge + vault + 회고).
4. (분리 시) TASK-7 코치마크는 후속 트랙.
