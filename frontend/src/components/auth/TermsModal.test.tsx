import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TermsModal } from "./TermsModal";

describe("TermsModal", () => {
    it("제목과 본문을 dialog 로 렌더한다", () => {
        render(
            <TermsModal title="이용약관" onClose={vi.fn()}>
                <p>약관 본문입니다.</p>
            </TermsModal>,
        );
        const dialog = screen.getByRole("dialog", { name: "이용약관" });
        expect(dialog).toBeInTheDocument();
        expect(screen.getByText("약관 본문입니다.")).toBeInTheDocument();
    });

    it("닫기 버튼 클릭 시 onClose 를 호출한다", async () => {
        const onClose = vi.fn();
        render(
            <TermsModal title="이용약관" onClose={onClose}>
                <p>본문</p>
            </TermsModal>,
        );
        await userEvent.click(screen.getByRole("button", { name: "닫기" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("Escape 키 입력 시 onClose 를 호출한다", async () => {
        const onClose = vi.fn();
        render(
            <TermsModal title="이용약관" onClose={onClose}>
                <p>본문</p>
            </TermsModal>,
        );
        await userEvent.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
