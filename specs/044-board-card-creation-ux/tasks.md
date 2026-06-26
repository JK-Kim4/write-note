# Tasks: 보드 카드 만들기 UX 보완 (Board Card Creation UX)

**Feature**: `specs/044-board-card-creation-ux/` | **Branch**: `worktree-044-board-card-creation-ux`

**Input**: plan.md · spec.md · research.md · data-model.md · contracts/ · quickstart.md (전부 존재)

**Scope**: FE only (BE·스키마·에러코드 0). 변경 = `frontend/src/components/board/` 4파일(3 수정 + 1 신규) + 순수헬퍼·테스트 + 038 spec.md 1줄 정정.

**경로 주의**: 모든 frontend 명령은 `cd frontend` 에서 실행(repo 루트 vitest = jsdom 미적용).

**TDD(룰 §5)**: 순수/결정 로직(pane 판별)은 Red→Green. 캔버스 상호작용·시각·포커스는 jsdom 미검증 → dogfooding 게이트(룰 14·§5-5).

---

## Phase 1: Setup

- [ ] T001 베이스라인 게이트 — `cd frontend && pnpm test` 가 현재 GREEN 인지 확인(기존 보드 테스트 포함). 회귀 비교 기준 확보.

---

## Phase 2: Foundational (US1·US2 공통 선행 — 자동 편집 메커니즘 + 생성 통합)

**목표**: 세 생성 경로가 공유할 `createCardAt(pos)` + 생성 직후 자동 편집(autoEdit) 신호 + pane 판별 순수헬퍼. US1·US2 모두 이 위에 얹힌다.

- [ ] T002 [P] 순수헬퍼 TDD(Red) — `frontend/src/components/board/__tests__/boardCanvasHelpers.test.ts` 작성: `isPaneHit(target)` 가 `react-flow__pane` 클래스 요소엔 true, 카드(`react-flow__node`)·기타 요소엔 false 를 반환하는 실패 테스트(아직 구현 없음).
- [ ] T003 [P] 순수헬퍼 구현(Green) — `frontend/src/components/board/boardCanvasHelpers.ts` 신규: `export function isPaneHit(target: EventTarget | null): boolean`(`target instanceof HTMLElement && target.classList.contains("react-flow__pane")`). T002 GREEN 확인.
- [ ] T004 `boardActions.ts` 확장 — `frontend/src/components/board/boardActions.ts` `BoardActions` 타입에 `autoEditCardId: string | null` + `consumeAutoEdit: (cardId: number) => void` 추가(기존 `editCardBody`·`startConnect`·`setCardKind` 보존, KDoc 1줄씩).
- [ ] T005 캔버스 `createCardAt(pos)` 통합 + autoEdit 상태 — `frontend/src/components/board/PlotBoardCanvas.tsx`(CanvasInner): `autoEditCardId` 상태 추가 + `consumeAutoEdit` 콜백 + 공통 `createCardAt(position)` 도입(낙관적 temp 노드 → `createCard.mutate` → **onSuccess: temp→real id 스왑 + `setAutoEditCardId(String(card.id))`**, onError 롤백). 기존 `handleAddCard` 를 `createCardAt(중앙좌표)` 호출로 치환(동작 보존 + 자동편집 획득). `boardActions` useMemo 에 `autoEditCardId`·`consumeAutoEdit` 포함.
- [ ] T006 `CardNode` 자동 편집 진입 — `frontend/src/components/board/CardNode.tsx`: `useBoardActions()` 에서 `autoEditCardId`·`consumeAutoEdit` 사용. `useEffect`로 `autoEditCardId === id && !editing` 이면 `setEditing(true)` 후 `consumeAutoEdit(Number(id))`(1회성). 기존 더블클릭 편집(`onDoubleClick`)·외부 본문 동기화 effect 보존.

**검증(Phase 2)**: `cd frontend && pnpm test`(T002 GREEN) + `pnpm typecheck`. "+ 카드" 버튼 누르면 생성 후 자동 편집 진입(dogfooding 예비 확인 가능하나 정식은 Phase 5).

---

## Phase 3: User Story 1 — 빈 보드 첫 카드 (Priority: P1) 🎯 MVP

**목표**: 카드 0개 보드 진입 시 빈 캔버스 대신 중앙 안내 + 버튼 생성 + 자동 편집.

**독립 테스트**: 카드 0개 보드 열기 → 안내 보임 → 버튼 → 카드 생성 + 즉시 타이핑 → 안내 사라짐.

- [ ] T007 [US1] 빈 보드 안내 컴포넌트 — `frontend/src/components/board/BoardEmptyGuide.tsx` 신규(`"use client"`, props `{ onCreate: () => void }`). 중앙 정렬 안내 문구 `"여기에 첫 카드를 적어보세요"` + 버튼 `"+ 카드 만들기"`(클릭 → `onCreate`). COPY 는 worksheet §5 상수 정합(로컬 상수 + 주석). 보드 colorMode=light 대비 맞춤.
- [ ] T008 [US1] 빈 보드 오버레이 결선 — `frontend/src/components/board/PlotBoardCanvas.tsx`(CanvasInner): `nodes.length === 0` 이면 캔버스 영역 위 중앙 오버레이로 `<BoardEmptyGuide onCreate={() => createCardAt(중앙좌표)} />` 렌더(빈 격자 캔버스를 덮음 — FR-001). 중앙좌표 = 기존 `handleAddCard` 의 wrapperRef 중심 → `screenToFlowPosition` 재사용.

**Checkpoint(US1)**: Phase 5 dogfooding US1 항목으로 검증. 빈 보드 안내·버튼 생성·자동편집·빈카드 잔존·1개 생기면 안내 사라짐.

---

## Phase 4: User Story 2 — 빈 곳 더블클릭 생성 (Priority: P2)

**목표**: 카드 있는 보드의 빈 곳 더블클릭 → 그 자리 생성 + 자동 편집. 더블클릭 줌 비활성.

**독립 테스트**: 카드 있는 보드 빈 곳 더블클릭 → 그 위치 카드 + 즉시 타이핑 / 카드 위 더블클릭 = 기존 편집 / 더블클릭 줌 안 됨.

- [ ] T009 [US2] 더블클릭 줌 비활성 — `frontend/src/components/board/PlotBoardCanvas.tsx`: `<ReactFlow>` 에 `zoomOnDoubleClick={false}` 추가(휠·핀치·fitView 기본값 유지, 다른 zoom prop 미변경).
- [ ] T010 [US2] 빈 곳 더블클릭 → 그 자리 생성 — `frontend/src/components/board/PlotBoardCanvas.tsx`: wrapper `div` 에 `onDoubleClick` 핸들러 추가 → `isPaneHit(e.target)`(T003) 일 때만 `createCardAt(screenToFlowPosition({ x: e.clientX, y: e.clientY }))`. 카드/핸들/컨트롤/패널 위 더블클릭은 무시(pane 한정). 기존 `onPaneClick`(잇기 모드 해제)·`onConnectEnd`(잇기 빈곳 drop) 무변경.

**Checkpoint(US2)**: Phase 5 dogfooding US2 항목으로 검증.

---

## Phase 5: Polish & 문서 화해 & 검증

- [ ] T011 [P] 038 FR-005 정정 — `specs/038-memo-plot-board/spec.md` FR-005 문구를 "노드 0개 보드는 빈 캔버스 대신 중앙 안내를 표시(044-board-card-creation-ux 로 대체)" 로 정정 + 출처 주석(룰 28 모순 화해). Acceptance Scenario 2(빈 캔버스로 열린다) 도 정정 정합.
- [ ] T012 회귀 grep — `frontend/src/components/board/` 에서 기존 잇기(`onConnectEnd`·`connectCards`)·드래그(`onNodeDragStop`)·선택해제(`onPaneClick`)·종류(`setCardKind`)·매핑 식별자가 보존됐는지 grep 확인(의도치 않은 제거 0).
- [ ] T013 게이트 — `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`(0 err, build = RSC 경계 검출: `BoardEmptyGuide` `"use client"`). 결과 직접 확인(포어그라운드).
- [ ] T014 Dogfooding(authed 로컬 풀스택, 룰 25 — quickstart.md 전항 사용자 확인) — DB→BE bootRun→FE pnpm dev. US1(빈보드 안내·버튼생성·자동편집·빈카드 잔존)·US2(빈곳 더블클릭 그 자리·카드위 더블클릭 기존편집·더블클릭 줌 안됨)·줌수단(휠/핀치/fitView)·두 화면(보드페이지·참조패널)·회귀(잇기/드래그/종류/매핑)·시각(라이트/다크)·재진입 잔존. **전항 통과 사용자 확인 후에만 완료 단정.**

---

## Dependencies & 실행 순서

- **Phase 1(T001)** → **Phase 2(T002~T006, 공통 선행)** → **Phase 3(US1) / Phase 4(US2) 병렬 가능**(둘 다 Phase 2 위) → **Phase 5(검증)**.
- T002→T003(Red→Green 순서 의존). T004·T005·T006 는 같은/연관 파일이라 순차(T004 boardActions → T005 canvas → T006 CardNode).
- T007(컴포넌트)→T008(결선). T009·T010 은 같은 파일(PlotBoardCanvas) 순차.
- T011(038 spec, [P] 독립 파일).

## 병렬 기회

- T002·T003(헬퍼, 독립 파일) 와 T011(038 spec) 은 다른 작업과 파일 충돌 없음([P]).
- US1(T007~T008) 과 US2(T009~T010) 는 Phase 2 완료 후 독립 — 단 둘 다 `PlotBoardCanvas.tsx` 를 만지므로 실제 편집은 순차 권장(머지 충돌 회피).

## MVP 범위

- **MVP = Phase 1+2+3(US1)**: 빈 보드 안내 + 버튼 생성 + 자동 편집만으로도 "막막함 제거" 핵심 가치 전달. US2(빈곳 더블클릭)는 가속 경로로 증분.

## 구현 전략

1. Phase 2 공통 메커니즘(createCardAt + autoEdit)을 먼저 세워 "+ 카드" 버튼이 자동 편집을 얻는 것부터 확인.
2. US1 빈 보드 안내 → US2 더블클릭 순서로 증분.
3. 각 단계 typecheck 통과 유지, 마지막 T013 전체 게이트 + T014 dogfooding(전항 사용자 확인).
