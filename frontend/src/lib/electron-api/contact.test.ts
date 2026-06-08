import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { contact, FORMSUBMIT_ENDPOINT } from "./contact";

/**
 * webElectronApi.contact 매핑 테스트(015 T034) — desktop contactSender 의 web 판본.
 * Formsubmit ajax 로 POST + web 메타(navigator·빌드버전)를 메시지 푸터로 첨부. fetch 는 시스템 경계(msw mock).
 */
describe("webElectronApi.contact", () => {
    it("send — 본문 + 메타 푸터를 message 로, 회신 이메일을 email 로 보낸다", async () => {
        let payload: { _subject?: string; _captcha?: string; message?: string; email?: string } = {};
        server.use(
            http.post(FORMSUBMIT_ENDPOINT, async ({ request }) => {
                payload = (await request.json()) as typeof payload;
                return HttpResponse.json({ success: "true" });
            }),
        );

        const result = await contact.send({ email: "me@example.com", body: "불편했던 점" });

        expect(result.ok).toBe(true);
        expect(payload._subject).toBeTruthy();
        expect(payload._captcha).toBe("false");
        expect(payload.message).toContain("불편했던 점");
        expect(payload.email).toBe("me@example.com");
    });

    it("send — 회신 이메일이 비면 email 키를 생략한다(익명)", async () => {
        let payload: { email?: string } = {};
        server.use(
            http.post(FORMSUBMIT_ENDPOINT, async ({ request }) => {
                payload = (await request.json()) as typeof payload;
                return HttpResponse.json({ success: "true" });
            }),
        );

        await contact.send({ email: "  ", body: "익명 의견" });

        expect(payload.email).toBeUndefined();
    });

    it("send — success!=='true' 또는 비정상 응답이면 ok:false", async () => {
        server.use(http.post(FORMSUBMIT_ENDPOINT, () => HttpResponse.json({ success: "false" })));

        expect((await contact.send({ email: "", body: "x" })).ok).toBe(false);
    });

    it("send — HTTP 오류면 ok:false", async () => {
        server.use(http.post(FORMSUBMIT_ENDPOINT, () => new HttpResponse(null, { status: 500 })));

        expect((await contact.send({ email: "", body: "x" })).ok).toBe(false);
    });
});
