# Phase 0 Research — React Flow v12 연결 API (트랙 A)

> 추측 금지(CLAUDE.md 금지1): 아래는 설치된 `@xyflow/react@12.11.1` + `@xyflow/system@0.0.78`의 **실제 타입 정의를 직접 확인**한 결과다. 시그니처는 `node_modules/.pnpm/@xyflow+system@0.0.78/.../types/general.d.ts`·`handles.d.ts` 인용.

## D1. 무방향 연결 — `ConnectionMode.Loose`

- **Decision**: `<ReactFlow connectionMode={ConnectionMode.Loose}>` + `nodesConnectable={true}`.
- **Rationale**: `enum ConnectionMode { Strict="strict", Loose="loose" }`. Loose는 source/target 핸들 구분 없이 **어느 핸들에서나 시작·종료** 가능 → 무방향 그래프에 맞는다. NodeCard에 핸들을 두되 방향 역할을 사용자에게 노출하지 않는다.
- **Alternatives**: Strict(source→target 강제) = 방향 모드. brainstorming에서 무방향 선택으로 기각.

## D2. 유효 카드 drop → 연결 생성 — `onConnect`

- **Decision**: `onConnect: OnConnect = (connection: Connection) => {...}` 에서 `useCreateEdge` 호출.
- **시그니처**: `Connection = { source: string; target: string; sourceHandle: string|null; targetHandle: string|null }`. `OnConnect = (connection: Connection) => void`. **유효한 카드 위에 drop했을 때만 호출**된다.
- **적용**: `source`/`target`은 RF 노드 id(=문자열화된 카드 id). 가드 통과 시 `createEdge(boardId, Number(source), Number(target))`. 무방향이라 어느 쪽이 source든 의미 동일.

## D3. 빈 곳 drop → "새 카드 만들어 잇기" — `onConnectEnd`

- **Decision**: `onConnectEnd: OnConnectEnd = (event, connectionState: FinalConnectionState) => {...}`. `connectionState.toNode == null && connectionState.fromNode != null`이면 **빈 곳 drop**으로 분기 → 확인 모달 → 새 카드 생성 + 연결.
- **시그니처(확정)**: `OnConnectEnd = (event: MouseEvent|TouchEvent, connectionState: FinalConnectionState) => void`. `FinalConnectionState`는 `fromNode`(출발 노드)·`from`(시작 좌표)·`toNode: Node|null`·`isValid: boolean|null` 등을 가진다(`ConnectionInProgress`에서 `inProgress` 제거형). 빈 곳이면 `toNode === null`.
- **호출 순서 주의**: 유효 drop이면 `onConnect`가 호출되고 **이어서 `onConnectEnd`도 호출**된다. 따라서 빈 곳 생성은 `onConnectEnd`에서 **`toNode == null`일 때만** 분기(유효 drop은 onConnect가 이미 처리). 새 카드 위치 = `screenToFlowPosition({ x: event.clientX, y: event.clientY })`(touch는 `changedTouches[0]`).
- **출발 카드 식별**: `connectionState.fromNode.id`. 임시(미저장) 노드면 연결을 건너뛴다(spec Edge Case).
- **Alternatives**: `onConnectEnd`의 event.target DOM 검사로 빈 곳 판정 — `toNode` 필드가 더 견고해 기각.

## D4. 중복(무방향)·자기연결 선제 차단 — `isValidConnection` + 가드

- **Decision**: `<ReactFlow isValidConnection={fn}>`로 **드래그 중 유효성**을 막고(유효 카드 초록 강조도 이 결과 기반), `onConnect`/`onConnectEnd`에서도 동일 가드를 한 번 더(이중 안전).
- **시그니처**: `IsValidConnection = (edge: Edge | Connection) => boolean`. `false`면 그 카드 위에서 drop 불가(강조 안 됨).
- **가드 규칙(순수 헬퍼 `linkGraph`)**:
  - `isSelfLink(s, t)` = `s === t` → 무효(백엔드 400 BOARD_EDGE_INVALID 전에 차단).
  - `isPairLinked(edges, s, t)` = 기존 edges에 `(s,t)` **또는** `(t,s)` 존재 → 무효(백엔드는 정확순서쌍만 409로 막으므로 무방향 위해 FE가 양방향 차단).
- **Rationale**: 불필요한 400/409 응답·에러 토스트 방지 + 무방향 의미 보장.

## D5. 무방향 선 렌더 + hover "연결 끊기" ✕ — custom edge

- **Decision**: custom edge 컴포넌트 `LinkEdge`(`edgeTypes={{ link: LinkEdge }}`). `BaseEdge`(path) + `EdgeLabelRenderer`로 중앙에 hover 시 ✕ 버튼. **`markerEnd` 미설정 = 화살표 없음**(무방향).
- **Rationale**: v12 표준 custom edge 패턴. hover ✕가 발견성 높은 끊기 수단(spec FR-009). ✕ 클릭 → `useDeleteEdge`(낙관 제거 + 실패 reseed).
- **보조 경로**: 엣지 선택 후 Delete 키 = RF 기본 `onEdgesDelete`로도 동작(Assumptions의 보조 수단). `onEdgesDelete`에서 `deleteEdge` 호출.
- **Alternatives**: 기본 edge + 우클릭 메뉴 — 발견성 낮아 기각.

## D6. 이웃 하이라이트 — 선택 상태 + className/opacity

- **Decision**: `selectedNodeId` 상태(노드 클릭 시 set, 빈 곳 클릭 시 null) → `neighborNodeIds(edges, selectedNodeId)` 순수 계산 → 각 RF node/edge에 `className`(또는 style opacity) 조건부. 선택 노드·이웃·잇는 edge = 또렷, 나머지 = dim.
- **RF 훅**: 빈 곳 클릭 감지 = `onPaneClick`(→ selectedNodeId=null), 노드 클릭 = `onNodeClick`. 선택 자체는 RF `selected`와 별개로 우리 `selectedNodeId`로 관리(잇기 모드·하이라이트 통합).
- **Rationale**: 별도 패널 0(brainstorming). 순수 계산이라 TDD 가능.

## D7. 낙관/롤백·캐시 (노드 패턴 동형)

- **Decision**: RF 로컬 `useEdgesState`가 낙관 SoT. 연결 생성 = temp edge(`temp-edge-N`) 추가 → `onSuccess`에서 실제 `edge.id`로 교체, `onError`면 제거 + 에러 토스트. 끊기 = 낙관 제거 → `onError`면 reseed(detail invalidate). `useCreateEdge`/`useDeleteEdge`에 `onError` 무효화만 소폭 추가(현재 빈 mutation).
- **Rationale**: 노드(`handleAddNode`/`handleNodesDelete`)와 동일 패턴 — 일관성·검증된 흐름. `BoardSummary`에 edgeCount 없어 list 무효화 불필요. detail은 `refetchOnMount:"always"`로 재진입 시 하이드레이션.

## D8. Handle 노출 제어 (hover/선택 시만)

- **Decision**: NodeCard에 `Handle` 4방(또는 좌우 2방) 배치 + **평상시 CSS `opacity:0`, hover/선택 시 `opacity:1`**(`group-hover`/selected). 연결 시작은 핸들 위에서 가능.
- **Rationale**: spec FR-002(항상 떠 있지 않다). React Flow Handle은 DOM에 항상 있어야 연결 동작 → 시각만 숨김(display:none이면 연결 불가).
- **검증 한계**: hover 시 핸들 노출·드래그 제스처는 jsdom 미검증 → dogfooding.

## 검증 한계 요약 (생성물 테스트 한계, 룰 §14)

- 순수 헬퍼(`linkGraph`: 어댑터·가드·이웃집합)는 **Vitest 단위로 보장**.
- 캔버스 상호작용(핸들 hover 노출·드래그 선 따라옴·초록 강조·빈곳 drop 모달·잇기 모드·dim 시각·hover ✕)은 **React Flow 제스처라 jsdom 미검증 → dogfooding 게이트**(quickstart). 자동 게이트 GREEN을 시각/제스처 정합 증거로 단정하지 않는다.
