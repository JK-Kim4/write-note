import { afterEach, describe, expect, it } from "vitest";
import { consumeReturnTo, saveReturnTo } from "./returnTo";

const KEY = "writenote.share.returnTo.v1";

describe("returnTo — 비로그인 로그인 복귀(050 US2)", () => {
    afterEach(() => {
        window.localStorage.clear();
    });

    it("/shared/ 로 시작하는 경로를 저장하면 그대로 소비된다", () => {
        saveReturnTo("/shared/abc123/works/12");
        expect(consumeReturnTo()).toBe("/shared/abc123/works/12");
    });

    it("소비 후에는 저장소에서 제거되어 재소비 시 null 이다", () => {
        saveReturnTo("/shared/abc123");
        consumeReturnTo();
        expect(consumeReturnTo()).toBeNull();
    });

    it("/shared/ 로 시작하지 않는 경로는 저장하지 않는다(open-redirect 차단)", () => {
        saveReturnTo("/auth/login");
        expect(consumeReturnTo()).toBeNull();
    });

    it("외부 절대 URL 은 저장하지 않는다(open-redirect 차단)", () => {
        saveReturnTo("https://evil.example.com/phish");
        expect(consumeReturnTo()).toBeNull();
    });

    it("조작(직접 localStorage 기입)된 비-/shared/ 값도 소비 시 null 로 처리한다", () => {
        window.localStorage.setItem(KEY, "//evil.example.com");
        expect(consumeReturnTo()).toBeNull();
    });

    it("`..` 트래버설 경로는 저장/소비하지 않는다(내부 우회 차단)", () => {
        saveReturnTo("/shared/../admin");
        expect(consumeReturnTo()).toBeNull();
        window.localStorage.setItem(KEY, "/shared/../../mypage");
        expect(consumeReturnTo()).toBeNull();
    });

    it("인코딩된 점(`%2e%2e`) 트래버설도 차단한다", () => {
        window.localStorage.setItem(KEY, "/shared/%2e%2e/mypage");
        expect(consumeReturnTo()).toBeNull();
        window.localStorage.setItem(KEY, "/shared/%2E%2E/admin");
        expect(consumeReturnTo()).toBeNull();
    });

    it("저장된 값이 없으면 null 이다", () => {
        expect(consumeReturnTo()).toBeNull();
    });
});
