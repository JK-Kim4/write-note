/**
 * "끌어서 잇기" 코치마크 위치 (045, 트랙 2) — 커서가 올라간 연결점(앵커) → 라벨 방향/캐럿.
 *
 * 라벨은 그 연결점에서 바깥으로 나오고, 캐럿이 카드(연결점)를 지목한다.
 * Tailwind 클래스는 JIT 안전을 위해 리터럴 문자열로 둔다(동적 보간 금지, cardKinds.ts 패턴).
 * 위치 기준 = 목업 docs/research/2026-06-27-board-coachmark-placement-mockup.html.
 */

/** 연결점 앵커(React Flow Handle id). */
export type HandleAnchor = "top" | "right" | "bottom" | "left";

export interface LinkHintPlacement {
    /** 캐럿 방향(카드를 지목하는 삼각형이 향하는 쪽). */
    caret: "up" | "down" | "left" | "right";
    /** 라벨 컨테이너 위치 Tailwind 클래스(카드 기준 absolute). */
    positionClass: string;
}

// 카드(div.relative) 기준 절대 위치. 라벨은 연결점 바깥으로, 캐럿은 카드를 향한다.
const PLACEMENTS: Record<HandleAnchor, LinkHintPlacement> = {
    top: { caret: "down", positionClass: "bottom-full left-1/2 -translate-x-1/2 mb-3" },
    right: { caret: "left", positionClass: "left-full top-1/2 -translate-y-1/2 ml-3" },
    bottom: { caret: "up", positionClass: "top-full left-1/2 -translate-x-1/2 mt-3" },
    left: { caret: "right", positionClass: "right-full top-1/2 -translate-y-1/2 mr-3" },
};

export function linkHintPlacement(anchor: HandleAnchor): LinkHintPlacement {
    return PLACEMENTS[anchor];
}
