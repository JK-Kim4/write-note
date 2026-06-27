import { describe, expect, it } from "vitest";
import { linkHintPlacement, type HandleAnchor } from "./linkHintPlacement";

/**
 * 045 "끌어서 잇기" 코치마크 — 커서가 올라간 연결점(앵커) → 라벨 방향/캐럿(순수).
 * 라벨은 그 연결점에서 바깥으로, 캐럿이 카드를 지목한다.
 */
describe("linkHintPlacement", () => {
    it("top 연결점 → 라벨 위, 캐럿 아래(down)로 카드 지목", () => {
        expect(linkHintPlacement("top").caret).toBe("down");
    });

    it("right 연결점 → 라벨 오른쪽, 캐럿 왼쪽(left)", () => {
        expect(linkHintPlacement("right").caret).toBe("left");
    });

    it("bottom 연결점 → 라벨 아래, 캐럿 위(up)", () => {
        expect(linkHintPlacement("bottom").caret).toBe("up");
    });

    it("left 연결점 → 라벨 왼쪽, 캐럿 오른쪽(right)", () => {
        expect(linkHintPlacement("left").caret).toBe("right");
    });

    it("각 앵커는 비어있지 않은 고유 positionClass 를 가진다", () => {
        const anchors: HandleAnchor[] = ["top", "right", "bottom", "left"];
        const classes = anchors.map((a) => linkHintPlacement(a).positionClass);
        classes.forEach((c) => expect(c.length).toBeGreaterThan(0));
        expect(new Set(classes).size).toBe(4);
    });
});
