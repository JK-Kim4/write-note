import type { Edge } from "@xyflow/react";
import type { BoardEdgeResponse } from "@/lib/api/boards";

/**
 * 플롯 보드 연결(Link) 순수 헬퍼(039 트랙 A) — 어댑터·무방향 가드·이웃 계산.
 *
 * 어댑터 경계: `edge`/`source`/`target` 등 React Flow 용어는 본 파일·`PlotBoardCanvas`·`LinkEdge`
 * (캔버스 계층) 내부에서만. 백엔드는 방향(source→target)으로 저장하지만 화면은 무방향이므로,
 * 백엔드가 막지 않는 양방향 중복((s,t)·(t,s))을 FE가 선제 차단한다.
 */

/**
 * 도메인 연결 → React Flow 엣지(무방향: type="link", markerEnd 없음 → LinkEdge가 화살표 없이 렌더).
 * sourceHandle/targetHandle = 사용자가 고른 테두리 앵커(top/right/bottom/left). null이면 미지정(기본 핸들).
 */
export function toRFEdge(edge: BoardEdgeResponse): Edge {
    return {
        id: String(edge.id),
        source: String(edge.sourceNodeId),
        target: String(edge.targetNodeId),
        type: "link",
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
    };
}

/** 자기 연결(같은 카드)인가. */
export function isSelfLink(a: string, b: string): boolean {
    return a === b;
}

/** 두 카드가 이미 이어졌는가 — 무방향((a,b) 또는 (b,a) 존재). */
export function isPairLinked(edges: Edge[], a: string, b: string): boolean {
    return edges.some(
        (e) => (e.source === a && e.target === b) || (e.source === b && e.target === a),
    );
}

/** 연결을 맺어도 되는가 — 자기연결·무방향 중복이 아니면 true. isValidConnection/onConnect 가드 공용. */
export function canLink(edges: Edge[], source: string, target: string): boolean {
    return !isSelfLink(source, target) && !isPairLinked(edges, source, target);
}

/** nodeId에 직접 이어진 카드 id 집합(양방향, 자신 제외) — 이웃 하이라이트. */
export function neighborNodeIds(edges: Edge[], nodeId: string): Set<string> {
    const ids = new Set<string>();
    for (const e of edges) {
        if (e.source === nodeId) ids.add(e.target);
        else if (e.target === nodeId) ids.add(e.source);
    }
    ids.delete(nodeId);
    return ids;
}

/** nodeId가 끝점인 엣지 id 집합 — 이웃 하이라이트(선 강조). */
export function incidentEdgeIds(edges: Edge[], nodeId: string): Set<string> {
    const ids = new Set<string>();
    for (const e of edges) {
        if (e.source === nodeId || e.target === nodeId) ids.add(e.id);
    }
    return ids;
}
