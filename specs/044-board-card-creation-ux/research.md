# Research: 보드 카드 만들기 UX 보완

**Phase 0** — 모든 NEEDS CLARIFICATION 해소. 추측 영역(React Flow API)을 설치본 소스로 실측 확정(룰 §1).

## R1. React Flow 빈 곳 더블클릭 감지

- **Decision**: wrapper `<div>`에 네이티브 `onDoubleClick` 부착 + `(e.target as HTMLElement).classList.contains('react-flow__pane')`로 빈 곳 판정 → `screenToFlowPosition`으로 좌표 변환 후 생성.
- **Rationale**: `@xyflow/react` **12.11.1에 `onPaneDoubleClick` prop 없음**(실측: pane 핸들러 = `onPaneClick`/`onPaneContextMenu`/`onPaneMouseEnter`/`onPaneMouseLeave`/`onPaneMouseMove`/`onPaneScroll`). pane 요소 클래스 `.react-flow__pane` 확인됨. `screenToFlowPosition`는 이미 `handleAddCard`·`handleConnectEnd`에서 사용 중.
- **Alternatives considered**: (a) `onPaneClick` 두 번을 직접 더블클릭으로 합성 → 타이밍·오탐 위험, 폐기. (b) 카드 위 더블클릭과 충돌 → target classList 판정으로 pane 한정해 회피(카드는 `.react-flow__node`).

## R2. 더블클릭 줌 비활성화 (줌 수단 보존)

- **Decision**: `zoomOnDoubleClick={false}` 설정. 줌은 휠·핀치·"한눈에 보기"(fitView)로 제공.
- **Rationale**: React Flow 기본값(설치본 소스 실측) `zoomOnDoubleClick = true` → 더블클릭이 줌인. 카드 생성으로 용도 변경하려면 꺼야 함. 현 캔버스는 zoom 관련 prop을 **하나도 명시하지 않아 전부 기본값**(`zoomOnScroll=true`·`zoomOnPinch=true`·`panOnScroll=false`·`panOnDrag=true`) → 휠/핀치 줌은 이미 동작 중이며 더블클릭만 끄면 보존됨.
- **Alternatives considered**: 더블클릭 줌 유지 + 다른 제스처로 생성(예: 우클릭 메뉴) → worksheet TASK-1 ③("빈 곳 더블클릭 → 생성")과 불일치, 폐기.

## R3. 자동 편집(autoEdit) 진입 타이밍 — 키 입력 유실 방지

- **Decision**: 생성 = 낙관적 temp 노드 추가 → `createCard.mutate`. **onSuccess(실제 id 확정) 직후 `setAutoEditCardId(realId)`**. `CardNode`가 `autoEditCardId===id`면 편집 진입+consume.
- **Rationale**: 현 코드는 onSuccess에서 temp→real id 스왑(`setNodes(... n.id===tempId ? {...n, id:String(card.id)} : n)`). React Flow는 노드를 id로 식별하므로 id 변경은 해당 노드 컴포넌트 리마운트를 유발할 수 있다. temp 노드에 즉시 포커스를 주면 스왑 리마운트 시 입력 중 텍스트가 유실될 race가 생긴다. **확정 후 진입**하면 타이핑이 스왑 이후 안정 노드에서만 시작돼 유실 위험 0.
- **Trade-off**: 생성~확정 사이 짧은 지연(로컬 < 수백 ms) 후 포커스. worksheet "생성 직후 바로 타이핑" 체감은 dogfooding에서 확인, 지연이 거슬리면 temp 즉시 포커스 + 스왑 시 재포커스로 보강(후속).
- **Alternatives considered**: (a) editingCardId를 캔버스로 끌어올려 draft 텍스트까지 리프트 → 변경 광범위, YAGNI(§2) 위배. (b) temp 즉시 포커스 → 위 race 위험.

## R4. 빈 보드 안내 노출 조건 / 위치

- **Decision**: `CanvasInner` 내부에서 `nodes.length === 0`이면 캔버스 위 중앙 오버레이(`BoardEmptyGuide`) 렌더. 보드 캔버스가 렌더되는 두 화면(`/boards/[boardId]` + `BoardReferencePanel`)에 자동 적용.
- **Rationale**: `nodes`(React Flow 로컬 상태)는 낙관적 temp 추가 시 즉시 1이 되어 안내가 사라짐(첫 카드 생성 즉시 캔버스 노출). 오버레이가 빈 격자를 덮어 "빈 캔버스 노출 금지"(FR-001) 충족. `CanvasInner` 공통 위치라 두 화면 특별처리 불필요(FR-010).
- **Alternatives considered**: 페이지 레벨에서 detail.cards.length로 분기 → 참조 패널 중복 분기 필요 + 낙관적 생성 직후 동기화 갭. 캔버스 내부 `nodes` 기준이 단일 진실.

## 결론

NEEDS CLARIFICATION 0. 모든 API·동작이 실측·결정 확정. Phase 1 진행 가능.
