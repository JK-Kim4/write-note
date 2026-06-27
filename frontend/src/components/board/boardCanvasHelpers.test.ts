import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { isNotFoundError, isPaneHit } from "./boardCanvasHelpers";

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

/**
 * 링크 삭제가 "이미 없음(404 NOT_FOUND)"인지 — 연결된 카드 삭제 시 백엔드 cascade 로 링크가 먼저
 * 사라진 뒤 FE 의 중복 링크 삭제가 404 나는 케이스를 거짓 에러로 토스트하지 않게 멱등 취급(044 버그픽스).
 */
describe("isNotFoundError", () => {
    it("ApiError code=NOT_FOUND 면 true", () => {
        expect(isNotFoundError(new ApiError("NOT_FOUND", "Link not found"))).toBe(true);
    });

    it("다른 ApiError 코드면 false", () => {
        expect(isNotFoundError(new ApiError("BOARD_LINK_DUPLICATE", "중복"))).toBe(false);
    });

    it("일반 Error 면 false", () => {
        expect(isNotFoundError(new Error("NOT_FOUND"))).toBe(false);
    });

    it("null / 문자열 등 비-에러면 false", () => {
        expect(isNotFoundError(null)).toBe(false);
        expect(isNotFoundError("NOT_FOUND")).toBe(false);
    });
});
