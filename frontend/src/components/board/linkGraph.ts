import type { Edge, XYPosition } from "@xyflow/react";
import type { LinkResponse } from "@/lib/api/boards";

/** 카드 테두리 핸들 id(앵커). CardNode 의 HANDLE_DEFS 와 일치. */
export type HandleId = "top" | "right" | "bottom" | "left";

/**
 * 플롯 보드 연결(Link) 순수 헬퍼(039 트랙 A) — 어댑터·무방향 가드·이웃 계산.
 *
 * 어댑터 경계: `edge`/`source`/`target` 등 React Flow 용어는 본 파일·`PlotBoardCanvas`·`LinkEdge`
 * (캔버스 계층) 내부에서만. 백엔드는 순서쌍(source→target)으로 저장하지만 화면은 무방향이므로,
 * 백엔드가 막지 않는 양방향 중복((s,t)·(t,s))을 FE가 선제 차단한다.
 */

/**
 * 도메인 연결(Link) → React Flow 엣지(무방향: type="link", markerEnd 없음 → LinkEdge가 화살표 없이 렌더).
 * sourceHandle/targetHandle = 사용자가 고른 테두리 앵커(top/right/bottom/left). null이면 미지정(기본 핸들).
 */
export function toRFEdge(link: LinkResponse): Edge {
    return {
        id: String(link.id),
        source: String(link.sourceCardId),
        target: String(link.targetCardId),
        type: "link",
        sourceHandle: link.sourceHandle ?? undefined,
        targetHandle: link.targetHandle ?? undefined,
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

/** cardId에 직접 이어진 카드 id 집합(양방향, 자신 제외) — 이웃 하이라이트. */
export function neighborCardIds(edges: Edge[], cardId: string): Set<string> {
    const ids = new Set<string>();
    for (const e of edges) {
        if (e.source === cardId) ids.add(e.target);
        else if (e.target === cardId) ids.add(e.source);
    }
    ids.delete(cardId);
    return ids;
}

/** cardId가 끝점인 연결(엣지) id 집합 — 이웃 하이라이트(선 강조). */
export function incidentLinkIds(edges: Edge[], cardId: string): Set<string> {
    const ids = new Set<string>();
    for (const e of edges) {
        if (e.source === cardId || e.target === cardId) ids.add(e.id);
    }
    return ids;
}

/**
 * 두 카드 중심으로 서로 **마주보는 테두리 핸들 쌍**을 고른다 — 클릭-클릭 연결의 앵커.
 * 중심 delta(target - source)의 우세 축을 따른다(수평 |dx| ≥ 수직 |dy| 면 좌우, 아니면 상하).
 * 드래그 연결은 RF(Loose)가 커서 최근접 핸들을 직접 주므로 본 함수는 클릭-클릭 전용.
 */
export function nearestHandlePair(
    sourceCenter: XYPosition,
    targetCenter: XYPosition,
): { sourceHandle: HandleId; targetHandle: HandleId } {
    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0
            ? { sourceHandle: "right", targetHandle: "left" }
            : { sourceHandle: "left", targetHandle: "right" };
    }
    return dy >= 0
        ? { sourceHandle: "bottom", targetHandle: "top" }
        : { sourceHandle: "top", targetHandle: "bottom" };
}
