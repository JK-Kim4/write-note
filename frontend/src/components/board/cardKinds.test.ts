import { describe, expect, it } from "vitest";
import { CARD_KINDS, kindOf } from "./cardKinds";

describe("cardKinds (트랙 D — 4종 + 무지정)", () => {
    it("CARD_KINDS = 칩용 4종(인물·장소·사건·테마) 순서", () => {
        expect(CARD_KINDS.map((k) => k.id)).toEqual(["character", "place", "event", "theme"]);
    });

    it("kindOf — 4종 id 를 해당 종류로 매핑", () => {
        expect(kindOf("character").label).toBe("인물");
        expect(kindOf("place").label).toBe("장소");
        expect(kindOf("event").label).toBe("사건");
        expect(kindOf("theme").label).toBe("테마");
    });

    it("kindOf — null/undefined/미지정은 무지정(종류 없음)", () => {
        expect(kindOf(null).label).toBe("종류 없음");
        expect(kindOf(undefined).label).toBe("종류 없음");
    });

    it("kindOf — 폐기된 값(plot·note)도 무지정으로 폴백", () => {
        expect(kindOf("plot").label).toBe("종류 없음");
        expect(kindOf("note").label).toBe("종류 없음");
    });
});
