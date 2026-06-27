# Phase 1 Data Model — 연결(Link) UI 트랙 A

> 트랙 A는 **데이터 모델 신규 0**. 보존된 백엔드 엣지 구조를 FE에서 재사용한다. 본 문서는 (1) 보존된 엔티티 (2) FE 어댑터·순수 헬퍼 시그니처(TDD 대상) (3) UI 상태 형태를 박는다.

## 1. 보존 엔티티 — 연결(Link / board_edges)

백엔드·DB·FE 타입 모두 보존(변경 0). 화면에서만 **무방향**으로 해석.

| 필드 | 타입 | 비고 |
|---|---|---|
| `id` | number | 엣지 PK |
| `sourceNodeId` | number | 출발 카드 id (저장은 방향, 화면 무방향) |
| `targetNodeId` | number | 도착 카드 id |

- FE 타입: `BoardEdgeResponse { id, sourceNodeId, targetNodeId }` (`lib/api/boards.ts`, 보존).
- 하이드레이션: `BoardDetail.edges: BoardEdgeResponse[]` (보존).
- 제약(백엔드, 보존): 자기연결 거부(400), 정확한 `(source,target)` 순서쌍 중복 거부(409). **무방향 중복은 백엔드가 안 막으므로 FE가 선제 차단**(§2 `isPairLinked`).

## 2. FE 순수 헬퍼 — `components/board/linkGraph.ts` (신규, TDD 대상)

> 모두 순수 함수. 캔버스 결선과 독립 → Vitest RED→GREEN.

```ts
// React Flow 어댑터 (도메인 → RF). 이 함수 안에서만 edge 형태 등장.
export function toRFEdge(edge: BoardEdgeResponse): Edge {
  return {
    id: String(edge.id),
    source: String(edge.sourceNodeId),
    target: String(edge.targetNodeId),
    type: "link",          // custom edge LinkEdge (화살표 없음)
  };
}

// 자기연결 차단
export function isSelfLink(a: string, b: string): boolean { return a === b; }

// 무방향 중복 차단 — (a,b) 또는 (b,a)가 이미 있으면 true
export function isPairLinked(edges: Edge[], a: string, b: string): boolean;

// 이웃 하이라이트 — nodeId에 직접 이어진 노드 id 집합(자신 제외)
export function neighborNodeIds(edges: Edge[], nodeId: string): Set<string>;

// 이웃 하이라이트 — nodeId가 끝점인 edge id 집합
export function incidentEdgeIds(edges: Edge[], nodeId: string): Set<string>;

// 연결 시도 유효성(자기연결·무방향 중복 통합) — isValidConnection / onConnect 가드 공용
export function canLink(edges: Edge[], source: string, target: string): boolean {
  return !isSelfLink(source, target) && !isPairLinked(edges, source, target);
}
```

**테스트 케이스(행위 단위)**:
- `should_treat_pair_as_linked_regardless_of_direction` — `[{s:1,t:2}]`에서 `isPairLinked(_, "2","1")===true`.
- `should_reject_self_link` — `canLink(_, "1","1")===false`.
- `should_allow_new_pair` — 미연결 쌍 `canLink===true`.
- `should_collect_neighbors_both_directions` — `1`이 source든 target이든 이웃에 포함.
- `should_collect_incident_edges` — `nodeId` 끝점 edge만.
- `toRFEdge`는 화살표 없는 `type:"link"`로 매핑(markerEnd 미설정 — 렌더는 LinkEdge가 담당).

## 3. UI 상태 (PlotBoardCanvas 로컬)

spec/UX worksheet `BoardUIState`의 트랙 A 관련분만:

| 상태 | 타입 | 용도 |
|---|---|---|
| `edges` | `Edge[]` (`useEdgesState`) | 낙관 SoT. 초기 = `detail.edges.map(toRFEdge)` |
| `selectedNodeId` | `string \| null` | 이웃 하이라이트 + 클릭-클릭 잇기 기준. `onNodeClick` set / `onPaneClick` null |
| `connectFromId` | `string \| null` | 클릭-클릭 "잇기" 모드 — 출발 카드. null이면 비활성 |
| `pendingEmptyDrop` | `{ fromId: string; pos: XYPosition } \| null` | 빈 곳 drop 확인 모달 대상(승낙 시 새 카드+연결, 취소 시 폐기) |
| `error` | `string \| null` | 기존 — 연결/끊기 실패 알림 재사용 |

- temp edge id 규약: `temp-edge-${n}` (노드 `temp-${n}`과 구분). `onSuccess`에서 실제 id 교체.
- 이웃 dim: `selectedNodeId != null`이면 `neighborNodeIds`/`incidentEdgeIds`로 또렷/흐림 분기. null이면 전부 또렷.

## 4. 어댑터 경계 (유비쿼터스 언어, 트랙 A 범위)

- `edge`/`node`/`Handle`/`Connection` 등 RF 용어는 `PlotBoardCanvas.tsx`·`LinkEdge.tsx`·`NodeCard.tsx`·`linkGraph.ts`(어댑터/캔버스 계층) 내부에서만.
- 화면 문구(작가 언어): "잇기", "연결 끊기", "이을 카드를 선택하세요", "여기에 새 카드를 만들어 이을까요?", "만들기", "취소".
- **트랙 A는 기존 `node` 도메인 식별자 유지**(`board_nodes`/`useCreateNode`/`NodeCard`). 전면 rename(`node→card`)은 트랙 B.
