---
description: "Task list — 플롯 보드 연결(Link) UI 트랙 A"
---

# Tasks: 플롯 보드 연결(Link) UI — 트랙 A

**Input**: Design documents from `specs/039-board-link-ui/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Branch**: `038-memo-plot-board` (트랙 A 연장) · **Scope**: frontend 단독 (신규 백엔드 0)

**Tests**: TDD 포함 — 순수 헬퍼(`linkGraph`)는 RED→GREEN 단위테스트(CLAUDE.md §5). 캔버스 상호작용은 jsdom 미검증 → dogfooding 게이트(quickstart).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일·의존 없음 → 병렬 가능
- **[Story]**: US1(잇기) / US2(끊기) / US3(이웃 하이라이트)
- 모든 task는 정확한 파일 경로 포함

---

## Phase 1: Setup (신규 파일 골격)

**Purpose**: 트랙 A 신규 파일 생성. 의존성 설치 0(`@xyflow/react@12.11.1` 기설치).

- [X] T001 [P] `frontend/src/components/board/linkGraph.ts` 신규 생성 — 순수 헬퍼 시그니처 스텁(`toRFEdge`/`isSelfLink`/`isPairLinked`/`canLink`/`neighborNodeIds`/`incidentEdgeIds`). RF `Edge` 타입·`BoardEdgeResponse` import. 어댑터 경계 주석(이 파일·캔버스·LinkEdge 내부만 edge 용어).
- [X] T002 [P] `frontend/src/components/board/LinkEdge.tsx` 신규 생성 — custom edge 골격. `EdgeProps`·`BaseEdge`·`getBezierPath`(또는 `getStraightPath`)로 **무방향 기본 선**만 렌더(markerEnd 없음·hover ✕는 US2에서). `"use client"`.

**Checkpoint**: 신규 파일 존재, 아직 캔버스 미결선.

---

## Phase 2: Foundational (모든 US 선행 — 엣지 렌더 기반 + 핵심 순수 헬퍼)

**⚠️ CRITICAL**: 이 단계 완료 전 어떤 US도 화면에 나타나지 않는다(엣지 렌더·가드 헬퍼 공유 토대).

### 순수 헬퍼 TDD (US1까지 필요분)

- [X] T003 [P] `frontend/src/components/board/linkGraph.test.ts` — RED 테스트 작성: `toRFEdge`(edge→`{id,source,target,type:"link"}` 매핑, markerEnd 없음)·`isSelfLink`(a===b)·`isPairLinked`(무방향: `(s,t)`·`(t,s)` 모두 true)·`canLink`(자기연결·무방향중복 통합). 행위명: `should_treat_pair_as_linked_regardless_of_direction`·`should_reject_self_link`·`should_allow_new_pair`.
- [X] T004 `frontend/src/components/board/linkGraph.ts` — GREEN 구현: T003의 `toRFEdge`/`isSelfLink`/`isPairLinked`/`canLink`만 통과시키는 최소 구현(`neighborNodeIds`/`incidentEdgeIds`는 US3에서). `cd frontend && npx vitest run src/components/board/linkGraph.test.ts` GREEN.

### 엣지 렌더 기반 결선 (공유)

- [X] T005 `frontend/src/components/board/PlotBoardCanvas.tsx` — 엣지 상태 결선: `useEdgesState`로 `edges` 추가(초기값 `detail.edges.map(toRFEdge)`) + `<ReactFlow edges={edges} edgeTypes={{ link: LinkEdge }} connectionMode={ConnectionMode.Loose} nodesConnectable={true} ...>`(기존 `nodesConnectable={false}` 교체). 기존 `onlyRenderVisibleElements`·`colorMode="light"`·노드 결선·뷰포트 유지.
- [X] T006 `frontend/src/components/board/PlotBoardCanvas.tsx` — detail 재시드 effect에 `setEdges(detail.edges.map(toRFEdge))` 추가(현재 `setNodes`만 — 에러 복구·재진입 reseed 시 엣지도 서버 진실로 화해).
- [X] T007 `frontend/src/lib/query/useBoards.ts` — `useCreateEdge`/`useDeleteEdge` 보존된 mutationFn 유지하되, 호출부가 `onSuccess`(실제 id)/`onError`(reseed) 콜백을 받아 처리하도록 검토(훅 자체는 무변경 가능 — RF 로컬 SoT, onError reseed는 캔버스 `reseedFromServer` 재사용). 변경 필요 시 최소 주석만.

**Checkpoint**: 기존 연결 데이터가 캔버스에 **무방향 선으로 렌더**(읽기 전용)된다. 잇기/끊기/하이라이트는 아직.

---

## Phase 3: User Story 1 - 카드 잇기 (Priority: P1) 🎯 MVP

**Goal**: 드래그·빈곳 drop 새카드·클릭-클릭으로 두 카드를 잇는다. 중복/자기연결은 무시.

**Independent Test**: 카드 2장 보드에서 연결점 드래그로 잇고 재진입 후 선 유지(quickstart US1 블록).

- [X] T008 [US1] `frontend/src/components/board/NodeCard.tsx` — `Handle`(source/target, Loose) 4방(또는 좌우) 추가 + 평상시 `opacity:0`·hover/선택 시 `opacity:1`(group-hover/selected). DOM엔 항상 존재(display:none 금지 — 연결 불가). 편집 textarea의 `nodrag`/`nowheel` 유지.
- [X] T009 [US1] `frontend/src/components/board/PlotBoardCanvas.tsx` — `isValidConnection={(c) => canLink(edges, c.source, c.target)}` 추가(드래그 중 유효 카드만 초록 강조·중복/자기연결 차단).
- [X] T010 [US1] `frontend/src/components/board/PlotBoardCanvas.tsx` — `onConnect`(유효 drop): `canLink` 재확인 → temp edge(`temp-edge-${n}`) 낙관 추가 → `useCreateEdge` `onSuccess`(temp→실제 `edge.id` 교체)/`onError`(temp 제거 + `setError("연결에 실패했습니다.")`).
- [X] T011 [US1] `frontend/src/components/board/PlotBoardCanvas.tsx` — `onConnectEnd(event, state)`: `state.toNode == null && state.fromNode != null`(빈곳 drop) → 출발 노드가 temp(미저장)면 무시, 아니면 `pendingEmptyDrop = { fromId, pos: screenToFlowPosition(event 좌표) }` 세팅(touch=`changedTouches[0]`).
- [X] T012 [US1] `frontend/src/components/board/PlotBoardCanvas.tsx` — 빈곳 drop 확인 모달 UI(`Panel` 또는 오버레이): "여기에 새 카드를 만들어 이을까요?" + "만들기"/"취소". 만들기 → `handleAddNode` 패턴으로 새 카드(`DEFAULT_KIND`) 생성, 생성 `onSuccess`에서 그 카드 id와 `fromId` 연결(`onConnect` 경로 재사용). 취소 → `pendingEmptyDrop=null`(새 카드·연결 0).
- [X] T013 [US1] `frontend/src/components/board/boardActions.ts` — `BoardActions`에 `startConnect: (nodeId) => void` 추가(클릭-클릭 잇기 모드 시작, NodeCard "잇기" 버튼이 호출).
- [X] T014 [US1] `frontend/src/components/board/NodeCard.tsx` — 선택(`selected`) 시 카드에 "잇기" 버튼 노출 → `useBoardActions().startConnect(Number(id))`. `nodrag`.
- [X] T015 [US1] `frontend/src/components/board/PlotBoardCanvas.tsx` — 클릭-클릭 모드: `connectFromId` 상태 + `startConnect` 구현(set) + 안내 바("이을 카드를 선택하세요", `Panel`) + `onNodeClick`(connectFromId 있으면 대상과 `canLink` 후 연결·모드종료) + ESC/`onPaneClick` 취소.

**Checkpoint**: US1 단독으로 "잇기"가 완전 동작(드래그·빈곳·클릭클릭·중복/자기연결 가드). MVP.

---

## Phase 4: User Story 2 - 연결 끊기 (Priority: P2)

**Goal**: 연결선 hover ✕(또는 선택 후 Delete)로 한 동작 끊기.

**Independent Test**: 이어진 두 카드 사이 선 hover→✕→끊김, 재진입 유지(quickstart US2).

- [X] T016 [US2] `frontend/src/components/board/LinkEdge.tsx` — `EdgeLabelRenderer`로 선 중앙에 hover 시 ✕ 버튼("연결 끊기" aria-label) 추가. hover 상태 시만 노출(`nodrag nopan`). 클릭 → `data.onDisconnect(edgeId)` 콜백(캔버스가 주입).
- [X] T017 [US2] `frontend/src/components/board/PlotBoardCanvas.tsx` — 끊기 처리: edge `data`에 `onDisconnect` 주입 → 낙관 제거(`setEdges` filter) → `useDeleteEdge` `onError`(reseed + `setError("연결 끊기에 실패했습니다.")`). `onEdgesDelete`(선택 후 Delete 보조 경로)도 동일 처리로 연결.

**Checkpoint**: US1 + US2 동작(잇기·끊기). 영속 복원.

---

## Phase 5: User Story 3 - 이웃 하이라이트 (Priority: P3)

**Goal**: 카드 선택 시 이어진 카드·선만 또렷, 나머지 dim. 빈곳 클릭 복원.

**Independent Test**: 여러 연결된 카드 선택→이웃만 또렷, 빈곳 클릭 복원(quickstart US3).

- [X] T018 [P] [US3] `frontend/src/components/board/linkGraph.test.ts` — RED 추가: `neighborNodeIds`(양방향 이웃 집합, 자신 제외)·`incidentEdgeIds`(nodeId 끝점 edge). 행위명: `should_collect_neighbors_both_directions`·`should_collect_incident_edges`.
- [X] T019 [US3] `frontend/src/components/board/linkGraph.ts` — GREEN: `neighborNodeIds`/`incidentEdgeIds` 구현. vitest GREEN.
- [X] T020 [US3] `frontend/src/components/board/PlotBoardCanvas.tsx` — `selectedNodeId` 상태(`onNodeClick` set / `onPaneClick` null, 클릭-클릭 모드와 충돌 없게 분기). `selectedNodeId != null`이면 `neighborNodeIds`/`incidentEdgeIds` 계산 → 각 node/edge에 `data.dimmed`(또는 className) 주입(이웃·선택·incident=또렷, 그 외=dim).
- [X] T021 [US3] `frontend/src/components/board/NodeCard.tsx` + `LinkEdge.tsx` — `data.dimmed` 반영(opacity↓). 하이라이트 중에도 본문 편집·드래그·끊기 정상(표시 계층만).

**Checkpoint**: 3개 US 모두 독립 동작.

---

## Phase 6: Polish & 검증 (Cross-Cutting)

- [X] T022 [P] `frontend/src/components/board/*` — 화면 문구 COPY 정합 점검(`잇기`·`연결 끊기`·`이을 카드를 선택하세요`·`여기에 새 카드를 만들어 이을까요?`·`만들기`·`취소`). UX worksheet §5 COPY 대비.
- [X] T023 [P] 어댑터 경계 grep — `node`/`edge` **화면 문구** 누출 0 확인(`grep -rn "node\|edge" frontend/src/components/board` 결과 중 사용자 노출 문자열 점검). 도메인 식별자(`NodeCard`·`board_nodes`) 유지는 트랙 A 정상(전면 rename=트랙 B).
- [X] T024 자동 게이트: `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build`(RSC 경계 검출 포함) GREEN.
- [X] T025 dogfooding 게이트: `quickstart.md` 전 시나리오(US1 잇기 4경로·중복/자기연결 가드·US2 끊기·US3 하이라이트·영속 복원·회귀 SC-007·라이트 고정). 로컬 풀스택 기동([[local-dogfooding-needs-backend]]).

---

## Dependencies & Execution Order

### Phase 의존
- **Setup(P1)**: 즉시 시작. T001·T002 병렬.
- **Foundational(P2)**: Setup 후. T003→T004(헬퍼 TDD), T005·T006(캔버스 렌더, 같은 파일이라 순차), T007. **모든 US 블록**.
- **US1(P3)**: Foundational 후. MVP.
- **US2(P4)**: Foundational 후(US1과 독립 — 끊을 대상 위해 실사용은 US1 뒤지만 코드 독립).
- **US3(P5)**: Foundational 후. T018→T019(헬퍼 TDD) 선행 후 T020·T021.
- **Polish(P6)**: 원하는 US 완료 후.

### 같은 파일 직렬화 주의
- `PlotBoardCanvas.tsx`: T005·T006·T009·T010·T011·T012·T015·T017·T020 — **동일 파일, 순차 편집**([P] 없음).
- `NodeCard.tsx`: T008·T014·T021 — 순차.
- `linkGraph.ts`: T004·T019 — 순차(테스트 T003·T018은 같은 파일 test라 순차).

### 병렬 기회
- T001 ∥ T002(다른 신규 파일).
- T003은 T001 후 단독. T018은 US3에서 단독.
- T022 ∥ T023(grep/문구, 읽기 위주).

---

## Implementation Strategy

### MVP (US1만)
1. Phase 1 Setup → 2. Phase 2 Foundational(엣지 렌더+가드 헬퍼) → 3. Phase 3 US1(잇기) → **STOP & dogfood**(quickstart US1) → 데모.

### 증분 배포 (FE 단독 — 배포 순서 무관)
1. Setup+Foundational → 연결 읽기 렌더
2. US1 잇기 → dogfood → (배포 가능)
3. US2 끊기 → dogfood
4. US3 하이라이트 → dogfood
5. Polish(게이트+회귀) → finish-work(develop merge·vault) + 회고

각 US는 이전 US를 깨지 않고 가치 추가. 전부 같은 `038-memo-plot-board` 브랜치.

---

## Notes
- [P] = 다른 파일·무의존. `PlotBoardCanvas.tsx` 집중 편집이라 US 내 대부분 순차.
- TDD: T003/T004(US1 가드)·T018/T019(US3 이웃)는 RED→GREEN. 캔버스 결선은 jsdom 미검증 → dogfooding(T025)이 게이트.
- 신규 백엔드 0. 보존된 엣지 API/훅 재사용 + onError reseed만.
- 커밋은 논리 그룹(Phase 또는 US) 단위 권장. 사용자 요청 시에만 push.
