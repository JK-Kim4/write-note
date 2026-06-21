import { describe, expect, it } from "vitest";
import { applyMarkdown } from "./markdownToolbar";

describe("applyMarkdown", () => {
    it("선택영역을 볼드로 감싼다", () => {
        const r = applyMarkdown("abc", 0, 3, "bold");
        expect(r.text).toBe("**abc**");
        expect([r.selStart, r.selEnd]).toEqual([2, 5]);
    });

    it("빈 커서에서 볼드는 ** ** 삽입 후 가운데 커서", () => {
        const r = applyMarkdown("", 0, 0, "bold");
        expect(r.text).toBe("****");
        expect([r.selStart, r.selEnd]).toEqual([2, 2]);
    });

    it("h2 는 현재 줄 앞에 '## ' 삽입", () => {
        const r = applyMarkdown("제목", 0, 0, "h2");
        expect(r.text).toBe("## 제목");
    });

    it("h3 는 현재 줄 앞에 '### ' 삽입(줄 중간 커서도 줄 시작에)", () => {
        const r = applyMarkdown("ab\ncd", 4, 4, "h3");
        expect(r.text).toBe("ab\n### cd");
    });

    it("글머리표는 선택된 각 줄 앞에 '- ' 삽입", () => {
        const r = applyMarkdown("a\nb", 0, 3, "bullet");
        expect(r.text).toBe("- a\n- b");
    });
});
