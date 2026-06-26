import { describe, expect, it } from "vitest";
import { isPaneHit } from "./boardCanvasHelpers";

/**
 * 빈 곳 더블클릭 판별(044) — 더블클릭 대상이 React Flow pane(빈 캔버스)인지.
 * 카드(.react-flow__node)·컨트롤·핸들 위 더블클릭은 카드 생성에서 제외해야 한다(회귀 가드).
 */
describe("isPaneHit", () => {
    it("pane 요소(.react-flow__pane)면 true", () => {
        const el = document.createElement("div");
        el.classList.add("react-flow__pane");
        expect(isPaneHit(el)).toBe(true);
    });

    it("카드 노드(.react-flow__node)면 false", () => {
        const el = document.createElement("div");
        el.classList.add("react-flow__node");
        expect(isPaneHit(el)).toBe(false);
    });

    it("pane 클래스 없는 일반 요소면 false", () => {
        const el = document.createElement("button");
        expect(isPaneHit(el)).toBe(false);
    });

    it("null 이면 false", () => {
        expect(isPaneHit(null)).toBe(false);
    });

    it("HTMLElement 아닌 이벤트 타겟이면 false", () => {
        expect(isPaneHit(document.createTextNode("x") as unknown as EventTarget)).toBe(false);
    });
});
