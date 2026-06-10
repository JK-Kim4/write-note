import { describe, expect, it } from "vitest";
import { extractPlainText } from "@/components/editor/wordCountUtils";
import { lastSentence } from "./lastSentence";

/**
 * 마지막 문장 파생 (대시보드 "이어서 쓰기" 타일 · 작품 벽 카드).
 * 핵심: extractPlainText 가 문단 경계를 \n 으로 보존하므로, 종결부호가 없어도 마지막 문단만 나온다.
 */

const doc = (paragraphs: string[]) =>
    JSON.stringify({
        type: "doc",
        content: paragraphs.map((t) => ({ type: "paragraph", content: t ? [{ type: "text", text: t }] : undefined })),
    });

describe("lastSentence", () => {
    it("종결부호로 나뉜 본문에서 마지막 문장만 반환한다", () => {
        expect(lastSentence("바다는 조용했다. 그녀는 떠났다.")).toBe("그녀는 떠났다.");
    });

    it("빈 본문이면 null", () => {
        expect(lastSentence("")).toBeNull();
    });

    it("종결부호가 없는 여러 문단이면 마지막 문단을 반환한다 (전체가 붙지 않음)", () => {
        const plain = extractPlainText(doc(["첫 문단입니다", "둘째 문단", "마지막 문단"]));
        expect(lastSentence(plain)).toBe("마지막 문단");
    });

    it("중간 빈 문단이 있어도 마지막 비어있지 않은 문단을 반환한다", () => {
        const plain = extractPlainText(doc(["처음", "", "끝"]));
        expect(lastSentence(plain)).toBe("끝");
    });
});
