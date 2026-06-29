import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BoardOwnerPicker } from "./BoardOwnerPicker";

// 훅은 idea(기본) 모드 테스트엔 미사용 — 빈 데이터로 모킹해 QueryClient 없이 렌더.
vi.mock("@/lib/query/useProjects", () => ({ useProjectCards: () => ({ data: [] }) }));
vi.mock("@/lib/query/useCategories", () => ({ useCategories: () => ({ data: [] }) }));

describe("BoardOwnerPicker — IME 조합 Enter 이중 제출 방지", () => {
    const baseProps = {
        title: "새 보드",
        withName: true,
        confirmLabel: "만들기",
        onCancel: () => {},
    };

    it("한글 조합 중(isComposing=true) Enter 는 onConfirm 을 호출하지 않는다", () => {
        const onConfirm = vi.fn();
        render(<BoardOwnerPicker {...baseProps} onConfirm={onConfirm} />);
        const input = screen.getByPlaceholderText(/보드 이름/);
        fireEvent.change(input, { target: { value: "단독시리즈" } });
        fireEvent.keyDown(input, { key: "Enter", isComposing: true });
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it("조합이 끝난(isComposing=false) Enter 는 onConfirm 을 1번 호출한다", () => {
        const onConfirm = vi.fn();
        render(<BoardOwnerPicker {...baseProps} onConfirm={onConfirm} />);
        const input = screen.getByPlaceholderText(/보드 이름/);
        fireEvent.change(input, { target: { value: "단독시리즈" } });
        fireEvent.keyDown(input, { key: "Enter", isComposing: false });
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
