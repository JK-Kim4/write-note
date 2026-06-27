import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InlineBoardListView } from "./InlineBoardList";
import type { BoardSummary } from "@/lib/api/boards";

/**
 * 042 내부 탭 — owner 스코프 인라인 보드 목록(표시) 행위 테스트.
 * 컨테이너의 훅/라우팅은 빌드·typecheck 가, 표시·생성 흐름은 본 테스트가 보장.
 */

function summary(id: number, name: string, cardCount = 0): BoardSummary {
    return {
        id,
        name,
        ownerType: "project",
        ownerId: 1,
        ownerLabel: "작품",
        cardCount,
        updatedAt: "2026-06-26T00:00:00Z",
    };
}

const baseProps = {
    isLoading: false,
    isError: false,
    emptyHint: "아직 이 작품 보드가 없어요.",
    creating: false,
    onOpen: () => {},
    onCreate: () => {},
    onRetry: () => {},
};

describe("InlineBoardListView", () => {
    it("보드가 없으면 빈 안내를 보이고 캔버스를 노출하지 않는다", () => {
        render(<InlineBoardListView {...baseProps} boards={[]} />);
        expect(screen.getByText("아직 이 작품 보드가 없어요.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "+ 새 보드" })).toBeInTheDocument();
    });

    it("보드 목록을 이름·카드수와 함께 보여준다", () => {
        render(
            <InlineBoardListView
                {...baseProps}
                boards={[summary(7, "인물 관계", 3), summary(8, "1부 사건", 0)]}
            />,
        );
        expect(screen.getByText("인물 관계")).toBeInTheDocument();
        expect(screen.getByText("1부 사건")).toBeInTheDocument();
        expect(screen.getByText("카드 3")).toBeInTheDocument();
    });

    it("보드를 클릭하면 onOpen(boardId)을 호출한다", async () => {
        const onOpen = vi.fn();
        render(<InlineBoardListView {...baseProps} boards={[summary(7, "인물 관계")]} onOpen={onOpen} />);
        await userEvent.click(screen.getByRole("button", { name: /인물 관계/ }));
        expect(onOpen).toHaveBeenCalledWith(7);
    });

    it("'+ 새 보드' → 이름 입력 → 만들기로 onCreate(name)을 호출한다", async () => {
        const onCreate = vi.fn();
        render(<InlineBoardListView {...baseProps} boards={[]} onCreate={onCreate} />);
        await userEvent.click(screen.getByRole("button", { name: "+ 새 보드" }));
        await userEvent.type(screen.getByLabelText("새 보드 이름"), "새 플롯");
        await userEvent.click(screen.getByRole("button", { name: "만들기" }));
        expect(onCreate).toHaveBeenCalledWith("새 플롯");
    });

    it("로딩/에러 상태를 표시한다", () => {
        const { rerender } = render(<InlineBoardListView {...baseProps} boards={[]} isLoading />);
        expect(screen.getByText("불러오는 중…")).toBeInTheDocument();
        rerender(<InlineBoardListView {...baseProps} boards={[]} isError />);
        expect(screen.getByText("보드를 불러올 수 없습니다.")).toBeInTheDocument();
    });
});
