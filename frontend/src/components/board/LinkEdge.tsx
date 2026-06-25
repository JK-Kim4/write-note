"use client";

import { useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";

/**
 * 플롯 보드 연결선(039 트랙 A) — 무방향 custom edge. 화살표(markerEnd) 없음.
 * 연결선은 사용자가 고른 테두리 핸들(top/right/bottom/left)에서 시작/종료한다(앵커 영속, 재진입 유지).
 * RF 가 핸들 위치로 sourceX/Y·targetX/Y·position 을 계산해 넘기므로 그대로 베지어로 그린다.
 * hover 시 가운데 "연결 끊기" ✕. 이웃 하이라이트 시 비이웃은 dim(data.dimmed). 어댑터 경계 안.
 */

export type LinkEdgeData = {
    /** 끊기 콜백(캔버스 주입). 없으면 ✕ 미노출(temp edge 등). */
    onDisconnect?: (edgeId: string) => void;
    /** 이웃 하이라이트에서 비이웃이면 true → 흐리게. */
    dimmed?: boolean;
};

export function LinkEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
}: EdgeProps) {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
    });
    const d = data as LinkEdgeData | undefined;
    const dimmed = d?.dimmed ?? false;
    const [hovered, setHovered] = useState(false);

    return (
        <>
            <BaseEdge
                id={id}
                path={edgePath}
                style={{ stroke: "var(--w-line, #9ca3af)", strokeWidth: 2, opacity: dimmed ? 0.12 : 1 }}
            />
            {/* 넓은 투명 hit area — hover 발견성 향상 */}
            <path
                d={edgePath}
                fill="none"
                stroke="transparent"
                strokeWidth={18}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            />
            {hovered && !dimmed && d?.onDisconnect && (
                <EdgeLabelRenderer>
                    <button
                        type="button"
                        aria-label="연결 끊기"
                        title="연결 끊기"
                        onClick={(e) => {
                            e.stopPropagation();
                            d.onDisconnect?.(id);
                        }}
                        onMouseEnter={() => setHovered(true)}
                        onMouseLeave={() => setHovered(false)}
                        className="nodrag nopan flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-sm text-gray-500 shadow-sm hover:border-terracotta-400 hover:text-terracotta-600"
                        style={{
                            position: "absolute",
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: "all",
                        }}
                    >
                        ×
                    </button>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
