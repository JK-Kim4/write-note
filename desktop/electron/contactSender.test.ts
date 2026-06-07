import { describe, expect, it, vi, afterEach } from "vitest";
import type { ContactMeta } from "./contactSender";
import { buildContactPayload, sendContact } from "./contactSender";

const META: ContactMeta = { appVersion: "1.2.3", os: "darwin", sentAt: "2026-06-08T00:00:00.000Z" };

function mockFetch(value: { ok: boolean; status: number; body: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: value.ok,
    status: value.status,
    json: async () => value.body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("buildContactPayload", () => {
  it("should_omit_email_when_blank_for_anonymous", () => {
    const payload = buildContactPayload({ email: "   ", body: "익명 의견" }, META);
    expect("email" in payload).toBe(false);
  });

  it("should_include_email_when_provided", () => {
    const payload = buildContactPayload({ email: "writer@example.com", body: "회신 원함" }, META);
    expect(payload.email).toBe("writer@example.com");
  });

  it("should_append_meta_footer_to_message", () => {
    const payload = buildContactPayload({ email: "", body: "본문입니다" }, META);
    expect(payload.message).toContain("본문입니다");
    expect(payload.message).toContain("1.2.3");
    expect(payload.message).toContain("darwin");
    expect(payload.message).toContain("2026-06-08T00:00:00.000Z");
  });

  it("should_fill_subject_and_captcha_constants", () => {
    const payload = buildContactPayload({ email: "", body: "x" }, META);
    expect(payload._subject).toBe("write-note 데스크탑 의견");
    expect(payload._captcha).toBe("false");
  });
});

describe("sendContact", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("should_return_ok_true_on_200_with_success_true_string", async () => {
    mockFetch({ ok: true, status: 200, body: { success: "true", message: "ok" } });
    const result = await sendContact({ email: "", body: "hi" }, META);
    expect(result.ok).toBe(true);
  });

  it("should_send_referer_and_accept_json_headers", async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, body: { success: "true" } });
    await sendContact({ email: "", body: "hi" }, META);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Referer).toBeTruthy();
    expect(headers.Accept).toBe("application/json");
  });
});
