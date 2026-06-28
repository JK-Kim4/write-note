import { describe, expect, it } from "vitest";
import { formatCommentAnchor } from "./commentLocation";

describe("formatCommentAnchor", () => {
    it("0-base 앵커를 1-base 한국어 위치 라벨로 변환한다", () => {
        expect(formatCommentAnchor(0, 0, 5)).toBe("1번째 문단 · 1번째 글자부터 5자");
    });

    it("블록·시작 오프셋이 모두 1씩 올라간다", () => {
        expect(formatCommentAnchor(2, 7, 12)).toBe("3번째 문단 · 8번째 글자부터 12자");
    });
});
