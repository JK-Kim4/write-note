import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { webElectronApi } from "@/lib/electron-api";
import ContactPage from "./page";

/**
 * 문의 페이지 행위 테스트 — 문의 유형(카테고리) select (031).
 * 외부 전송(webElectronApi.contact.send)은 시스템 경계라 mock.
 */
vi.mock("@/lib/electron-api", () => ({
    webElectronApi: { contact: { send: vi.fn().mockResolvedValue({ ok: true }) } },
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const sendMock = vi.mocked(webElectronApi.contact.send);

describe("ContactPage 문의 유형", () => {
    beforeEach(() => sendMock.mockClear());

    it("문의 유형 select 와 5개 카테고리 옵션을 렌더한다", () => {
        render(<ContactPage />);
        const select = screen.getByLabelText(/문의 유형/) as HTMLSelectElement;
        expect(select).toBeInTheDocument();
        const labels = Array.from(select.options).map((o) => o.text);
        ["버그 신고", "개선 제안", "기능 제안", "사용 후기", "기타"].forEach((c) =>
            expect(labels).toContain(c),
        );
    });

    it("카테고리 선택 후 보내면 send 에 category 가 전달되고 성공 안내가 뜬다", async () => {
        render(<ContactPage />);
        await userEvent.selectOptions(screen.getByLabelText(/문의 유형/), "버그 신고");
        await userEvent.type(screen.getByLabelText("의견"), "버그가 있어요");
        await userEvent.click(screen.getByRole("button", { name: "보내기" }));
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({ category: "버그 신고", body: "버그가 있어요" }),
        );
        expect(await screen.findByText("보내주셔서 감사합니다.")).toBeInTheDocument();
    });
});

describe("ContactPage 카카오 채널 링크", () => {
    it("카카오톡으로 문의 클릭 시 소설비 채널 채팅 URL 을 새 창으로 연다", async () => {
        const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
        render(<ContactPage />);
        await userEvent.click(screen.getByRole("button", { name: "카카오톡으로 문의" }));
        expect(openSpy).toHaveBeenCalledWith("https://pf.kakao.com/_xcuxhxfX/chat", "_blank");
        openSpy.mockRestore();
    });
});
