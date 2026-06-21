import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "./PasswordInput";

describe("PasswordInput", () => {
    it("기본은 마스킹(type=password)이고 토글 버튼으로 평문(text)과 전환된다", async () => {
        render(<PasswordInput name="password" label="비밀번호" />);

        const input = screen.getByLabelText("비밀번호");
        expect(input).toHaveAttribute("type", "password");

        const toggle = screen.getByRole("button", { name: "비밀번호 표시" });
        expect(toggle).toHaveAttribute("aria-pressed", "false");

        await userEvent.click(toggle);
        expect(input).toHaveAttribute("type", "text");
        const hideToggle = screen.getByRole("button", { name: "비밀번호 숨기기" });
        expect(hideToggle).toHaveAttribute("aria-pressed", "true");

        await userEvent.click(hideToggle);
        expect(screen.getByLabelText("비밀번호")).toHaveAttribute("type", "password");
    });

    it("토글 버튼은 type=button 이라 폼을 제출하지 않는다", async () => {
        let submitted = false;
        render(
            <form onSubmit={() => { submitted = true; }}>
                <PasswordInput name="password" label="비밀번호" />
            </form>,
        );
        await userEvent.click(screen.getByRole("button", { name: "비밀번호 표시" }));
        expect(submitted).toBe(false);
    });
});
