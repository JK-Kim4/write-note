import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InlineEditableTitle } from "./InlineEditableTitle";

/**
 * InlineEditableTitle — 본문 상단 챕터 제목 인라인 편집 컴포넌트 테스트.
 * 더블클릭 → input 진입 → Enter/blur 저장 · Escape 취소.
 * committedRef 정책·빈 제목 guard·무변경 guard 동일.
 */

describe("InlineEditableTitle", () => {
    it("title prop 이 표시된다", () => {
        render(<InlineEditableTitle title="1장 — 시작" onRename={vi.fn()} />);
        expect(screen.getByText("1장 — 시작")).toBeInTheDocument();
    });

    it("더블클릭 시 input 이 표시되고 기존 제목이 초기값이다", async () => {
        render(<InlineEditableTitle title="1장 — 시작" onRename={vi.fn()} />);

        await userEvent.dblClick(screen.getByText("1장 — 시작"));

        const input = screen.getByRole("textbox");
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue("1장 — 시작");
    });

    it("입력 후 Enter 시 onRename(새제목) 이 호출된다", async () => {
        const onRename = vi.fn();
        render(<InlineEditableTitle title="1장 — 시작" onRename={onRename} />);

        await userEvent.dblClick(screen.getByText("1장 — 시작"));

        const input = screen.getByRole("textbox");
        await userEvent.clear(input);
        await userEvent.type(input, "새 제목");
        await userEvent.keyboard("{Enter}");

        expect(onRename).toHaveBeenCalledWith("새 제목");
        expect(onRename).toHaveBeenCalledTimes(1);
    });

    it("입력 후 blur 시 onRename(새제목) 이 호출된다", async () => {
        const onRename = vi.fn();
        render(<InlineEditableTitle title="1장 — 시작" onRename={onRename} />);

        await userEvent.dblClick(screen.getByText("1장 — 시작"));

        const input = screen.getByRole("textbox");
        await userEvent.clear(input);
        await userEvent.type(input, "blur 저장");
        await userEvent.tab();

        expect(onRename).toHaveBeenCalledWith("blur 저장");
        expect(onRename).toHaveBeenCalledTimes(1);
    });

    it("Escape 시 편집 취소 — onRename 호출 안 함, 원래 제목 복원", async () => {
        const onRename = vi.fn();
        render(<InlineEditableTitle title="1장 — 시작" onRename={onRename} />);

        await userEvent.dblClick(screen.getByText("1장 — 시작"));
        await userEvent.type(screen.getByRole("textbox"), "취소될 제목");
        await userEvent.keyboard("{Escape}");

        expect(onRename).not.toHaveBeenCalled();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        expect(screen.getByText("1장 — 시작")).toBeInTheDocument();
    });

    it("빈 제목으로 Enter 시 onRename 호출 안 함 (빈 제목 guard)", async () => {
        const onRename = vi.fn();
        render(<InlineEditableTitle title="1장 — 시작" onRename={onRename} />);

        await userEvent.dblClick(screen.getByText("1장 — 시작"));

        const input = screen.getByRole("textbox");
        await userEvent.clear(input);
        // 빈 값으로 Enter
        await userEvent.keyboard("{Enter}");

        expect(onRename).not.toHaveBeenCalled();
    });

    it("공백만 입력 후 Enter 시 onRename 호출 안 함 (trim guard)", async () => {
        const onRename = vi.fn();
        render(<InlineEditableTitle title="1장 — 시작" onRename={onRename} />);

        await userEvent.dblClick(screen.getByText("1장 — 시작"));

        const input = screen.getByRole("textbox");
        await userEvent.clear(input);
        await userEvent.type(input, "   ");
        await userEvent.keyboard("{Enter}");

        expect(onRename).not.toHaveBeenCalled();
    });

    it("변경 없이 Enter 시 onRename 호출 안 함 (무변경 guard)", async () => {
        const onRename = vi.fn();
        render(<InlineEditableTitle title="1장 — 시작" onRename={onRename} />);

        await userEvent.dblClick(screen.getByText("1장 — 시작"));
        // 값 변경 없이 바로 Enter
        await userEvent.keyboard("{Enter}");

        expect(onRename).not.toHaveBeenCalled();
    });

    it("Enter 후 blur 에서 onRename 중복 호출 안 함 (committedRef 방어)", async () => {
        const onRename = vi.fn();
        render(<InlineEditableTitle title="1장 — 시작" onRename={onRename} />);

        await userEvent.dblClick(screen.getByText("1장 — 시작"));

        const input = screen.getByRole("textbox");
        await userEvent.clear(input);
        await userEvent.type(input, "새 제목");
        // Enter 후 blur 순서로 발생 — 1회만 호출이어야 함
        await userEvent.keyboard("{Enter}");

        expect(onRename).toHaveBeenCalledTimes(1);
    });

    it("onRename prop 없으면 더블클릭해도 input 표시 안 함", async () => {
        render(<InlineEditableTitle title="1장 — 시작" />);

        await userEvent.dblClick(screen.getByText("1장 — 시작"));

        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("빈 제목일 때 placeholder 표시", () => {
        render(<InlineEditableTitle title="" placeholder="새 챕터" onRename={vi.fn()} />);
        expect(screen.getByText("새 챕터")).toBeInTheDocument();
    });

    it("빈 제목 챕터도 더블클릭으로 편집 진입 가능", async () => {
        render(<InlineEditableTitle title="" placeholder="새 챕터" onRename={vi.fn()} />);

        await userEvent.dblClick(screen.getByText("새 챕터"));

        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
});
