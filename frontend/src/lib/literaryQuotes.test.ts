import { describe, expect, it } from "vitest";
import { LITERARY_QUOTES, pickRandom } from "./literaryQuotes";

describe("pickRandom", () => {
    const list = [
        { text: "a", author: "A" },
        { text: "b", author: "B" },
        { text: "c", author: "C" },
    ];

    it("rand 주입으로 결정적으로 항목을 고른다", () => {
        expect(pickRandom(list, () => 0)).toEqual({ text: "a", author: "A" });
        expect(pickRandom(list, () => 0.99)).toEqual({ text: "c", author: "C" });
    });

    it("빈 목록이면 null", () => {
        expect(pickRandom([], () => 0)).toBeNull();
    });
});

describe("LITERARY_QUOTES 데이터", () => {
    it("20개 이상이며 각 항목에 본문과 저자가 있다", () => {
        expect(LITERARY_QUOTES.length).toBeGreaterThanOrEqual(20);
        for (const q of LITERARY_QUOTES) {
            expect(q.text.length).toBeGreaterThan(0);
            expect(q.author.length).toBeGreaterThan(0);
        }
    });
});
