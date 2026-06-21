import { describe, it, expect } from "vitest";
import { countChars } from "./charCount";

const U2028 = String.fromCharCode(0x2028);

describe("countChars — 본문 글자수(031 분량 지표)", () => {
    it("빈 본문은 0", () => {
        expect(countChars("")).toBe(0);
    });

    it("블록 구분(\\n)은 글자수에서 제외", () => {
        expect(countChars("가나\n다\n")).toBe(3);
    });

    it("소프트 줄바꿈(U+2028)도 제외", () => {
        expect(countChars(`가${U2028}나`)).toBe(2);
    });

    it("일반 공백은 글자수에 포함", () => {
        expect(countChars("가 나")).toBe(3);
    });

    it("한글 음절·자모를 코드포인트 단위로 1글자씩", () => {
        expect(countChars("가나다")).toBe(3);
        expect(countChars("ㄱㅏ")).toBe(2);
    });
});
