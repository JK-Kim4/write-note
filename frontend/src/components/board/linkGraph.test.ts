import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import { canLink, incidentLinkIds, isPairLinked, isSelfLink, nearestHandlePair, neighborCardIds, toRFEdge } from "./linkGraph";
import type { LinkResponse } from "@/lib/api/boards";

const lk = (
    id: number,
    s: number,
    t: number,
    sh: string | null = null,
    th: string | null = null,
): LinkResponse => ({
    id,
    sourceCardId: s,
    targetCardId: t,
    sourceHandle: sh,
    targetHandle: th,
});
const rf = (id: string, s: string, t: string): Edge => ({ id, source: s, target: t });

describe("linkGraph 어댑터·가드·이웃 (트랙 A)", () => {
    describe("toRFEdge", () => {
        it("should_map_link_to_undirected_rf_edge", () => {
            const edge = toRFEdge(lk(10, 1, 2));
            expect(edge.id).toBe("10");
            expect(edge.source).toBe("1");
            expect(edge.target).toBe("2");
            expect(edge.type).toBe("link");
            // 무방향 — 화살표 마커 없음
            expect(edge.markerEnd).toBeUndefined();
        });
        it("should_restore_handle_anchors", () => {
            const edge = toRFEdge(lk(10, 1, 2, "right", "left"));
            expect(edge.sourceHandle).toBe("right");
            expect(edge.targetHandle).toBe("left");
        });
        it("should_leave_null_anchors_undefined", () => {
            const edge = toRFEdge(lk(10, 1, 2));
            expect(edge.sourceHandle).toBeUndefined();
            expect(edge.targetHandle).toBeUndefined();
        });
    });

    describe("isSelfLink", () => {
        it("should_reject_self_link", () => {
            expect(isSelfLink("1", "1")).toBe(true);
        });
        it("should_allow_distinct_cards", () => {
            expect(isSelfLink("1", "2")).toBe(false);
        });
    });

    describe("isPairLinked", () => {
        it("should_treat_pair_as_linked_regardless_of_direction", () => {
            const edges = [rf("e1", "1", "2")];
            expect(isPairLinked(edges, "1", "2")).toBe(true);
            expect(isPairLinked(edges, "2", "1")).toBe(true);
        });
        it("should_report_unlinked_pair_as_false", () => {
            expect(isPairLinked([rf("e1", "1", "2")], "1", "3")).toBe(false);
        });
    });

    describe("canLink", () => {
        it("should_reject_self_link", () => {
            expect(canLink([], "1", "1")).toBe(false);
        });
        it("should_reject_existing_pair_either_direction", () => {
            const edges = [rf("e1", "1", "2")];
            expect(canLink(edges, "1", "2")).toBe(false);
            expect(canLink(edges, "2", "1")).toBe(false);
        });
        it("should_allow_new_pair", () => {
            expect(canLink([rf("e1", "1", "2")], "1", "3")).toBe(true);
        });
    });

    describe("neighborCardIds", () => {
        it("should_collect_neighbors_both_directions_excluding_self", () => {
            const edges = [rf("e1", "1", "2"), rf("e2", "3", "1"), rf("e3", "2", "3")];
            const n = neighborCardIds(edges, "1");
            expect(n).toEqual(new Set(["2", "3"]));
            expect(n.has("1")).toBe(false);
        });
        it("should_return_empty_for_isolated_card", () => {
            expect(neighborCardIds([rf("e1", "1", "2")], "9")).toEqual(new Set());
        });
    });

    describe("incidentLinkIds", () => {
        it("should_collect_links_with_card_as_endpoint", () => {
            const edges = [rf("e1", "1", "2"), rf("e2", "3", "1"), rf("e3", "2", "3")];
            expect(incidentLinkIds(edges, "1")).toEqual(new Set(["e1", "e2"]));
        });
    });

    // 클릭-클릭 연결 시 두 카드 중심으로 마주보는 테두리 핸들 쌍을 고른다(우세 축).
    describe("nearestHandlePair", () => {
        it("should_face_right_left_when_target_is_to_the_right", () => {
            expect(nearestHandlePair({ x: 0, y: 0 }, { x: 300, y: 10 })).toEqual({
                sourceHandle: "right",
                targetHandle: "left",
            });
        });
        it("should_face_left_right_when_target_is_to_the_left", () => {
            expect(nearestHandlePair({ x: 300, y: 0 }, { x: 0, y: 10 })).toEqual({
                sourceHandle: "left",
                targetHandle: "right",
            });
        });
        it("should_face_bottom_top_when_target_is_below", () => {
            expect(nearestHandlePair({ x: 0, y: 0 }, { x: 10, y: 300 })).toEqual({
                sourceHandle: "bottom",
                targetHandle: "top",
            });
        });
        it("should_face_top_bottom_when_target_is_above", () => {
            expect(nearestHandlePair({ x: 0, y: 300 }, { x: 10, y: 0 })).toEqual({
                sourceHandle: "top",
                targetHandle: "bottom",
            });
        });
        it("should_prefer_horizontal_on_tie", () => {
            // |dx| === |dy| → 수평 우선
            expect(nearestHandlePair({ x: 0, y: 0 }, { x: 100, y: 100 })).toEqual({
                sourceHandle: "right",
                targetHandle: "left",
            });
        });
    });
});
