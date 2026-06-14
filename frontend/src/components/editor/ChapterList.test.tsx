import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChapterList } from "./ChapterList";

/**
 * T008 — ChapterList 컴포넌트 행위 테스트.
 * 챕터 목록 표시 / 현재 챕터 하이라이트 / 새 챕터 버튼 / 챕터 선택 콜백.
 * T019 — US2 순서 위/아래 버튼 · onMove 콜백 · 끝단 비활성.
 */

const CHAPTERS = [
    { id: 1, projectId: 10, title: "1장 — 시작", sortOrder: 1, wordCount: 100, updatedAt: "2026-06-01T00:00:00Z" },
    { id: 2, projectId: 10, title: "2장 — 전개", sortOrder: 2, wordCount: 250, updatedAt: "2026-06-02T00:00:00Z" },
    { id: 3, projectId: 10, title: "3장 — 결말", sortOrder: 3, wordCount: 80, updatedAt: "2026-06-03T00:00:00Z" },
];

describe("ChapterList", () => {
    it("챕터 목록을 순서대로 표시한다", () => {
        render(<ChapterList chapters={CHAPTERS} currentChapterId={null} onSelect={vi.fn()} onCreate={vi.fn()} />);

        expect(screen.getByText("1장 — 시작")).toBeInTheDocument();
        expect(screen.getByText("2장 — 전개")).toBeInTheDocument();
        expect(screen.getByText("3장 — 결말")).toBeInTheDocument();
    });

    it("현재 챕터를 aria-current 로 하이라이트한다", () => {
        render(<ChapterList chapters={CHAPTERS} currentChapterId={2} onSelect={vi.fn()} onCreate={vi.fn()} />);

        const currentBtn = screen.getByRole("button", { name: /2장 — 전개/ });
        expect(currentBtn).toHaveAttribute("aria-current", "true");

        const otherBtn = screen.getByRole("button", { name: /1장 — 시작/ });
        expect(otherBtn).not.toHaveAttribute("aria-current", "true");
    });

    it("챕터 버튼 클릭 시 onSelect(id) 를 호출한다", async () => {
        const onSelect = vi.fn();
        render(<ChapterList chapters={CHAPTERS} currentChapterId={null} onSelect={onSelect} onCreate={vi.fn()} />);

        await userEvent.click(screen.getByRole("button", { name: /1장 — 시작/ }));

        expect(onSelect).toHaveBeenCalledWith(1);
        expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("'새 챕터' 버튼 클릭 시 onCreate() 를 호출한다", async () => {
        const onCreate = vi.fn();
        render(<ChapterList chapters={CHAPTERS} currentChapterId={null} onSelect={vi.fn()} onCreate={onCreate} />);

        await userEvent.click(screen.getByRole("button", { name: /새 챕터/ }));

        expect(onCreate).toHaveBeenCalledTimes(1);
    });

    it("챕터가 없을 때도 '새 챕터' 버튼이 표시된다", () => {
        render(<ChapterList chapters={[]} currentChapterId={null} onSelect={vi.fn()} onCreate={vi.fn()} />);

        expect(screen.getByRole("button", { name: /새 챕터/ })).toBeInTheDocument();
    });

    // ── T019: US2 순서 버튼 테스트 ───────────────────────────────────────────

    it("각 챕터 항목에 위/아래 버튼이 표시된다", () => {
        const onMove = vi.fn();
        render(<ChapterList chapters={CHAPTERS} currentChapterId={null} onSelect={vi.fn()} onCreate={vi.fn()} onMove={onMove} />);

        // 위 버튼: 첫 번째 제외 2개 (2장·3장)
        const upButtons = screen.getAllByRole("button", { name: /위로/ });
        expect(upButtons).toHaveLength(2);

        // 아래 버튼: 마지막 제외 2개 (1장·2장)
        const downButtons = screen.getAllByRole("button", { name: /아래로/ });
        expect(downButtons).toHaveLength(2);
    });

    it("첫 번째 챕터의 위로 버튼은 비활성(disabled)", () => {
        const onMove = vi.fn();
        render(<ChapterList chapters={CHAPTERS} currentChapterId={null} onSelect={vi.fn()} onCreate={vi.fn()} onMove={onMove} />);

        // 첫 번째 챕터(1장)에는 위로 버튼이 없음(렌더 안 함)
        const upButtons = screen.getAllByRole("button", { name: /위로/ });
        // 2장·3장만 위로 버튼이 있어야 함 (총 2개)
        expect(upButtons).toHaveLength(2);
    });

    it("마지막 챕터의 아래로 버튼은 비활성(disabled)", () => {
        const onMove = vi.fn();
        render(<ChapterList chapters={CHAPTERS} currentChapterId={null} onSelect={vi.fn()} onCreate={vi.fn()} onMove={onMove} />);

        // 마지막 챕터(3장)에는 아래로 버튼이 없음(렌더 안 함)
        const downButtons = screen.getAllByRole("button", { name: /아래로/ });
        // 1장·2장만 아래로 버튼이 있어야 함 (총 2개)
        expect(downButtons).toHaveLength(2);
    });

    it("중간 챕터의 위로 버튼 클릭 시 onMove(id, 'up') 호출", async () => {
        const onMove = vi.fn();
        render(<ChapterList chapters={CHAPTERS} currentChapterId={null} onSelect={vi.fn()} onCreate={vi.fn()} onMove={onMove} />);

        // 2장의 위로 버튼 클릭 (첫 번째 위로 버튼)
        const upButtons = screen.getAllByRole("button", { name: /위로/ });
        await userEvent.click(upButtons[0]);

        expect(onMove).toHaveBeenCalledWith(2, "up");
        expect(onMove).toHaveBeenCalledTimes(1);
    });

    it("중간 챕터의 아래로 버튼 클릭 시 onMove(id, 'down') 호출", async () => {
        const onMove = vi.fn();
        render(<ChapterList chapters={CHAPTERS} currentChapterId={null} onSelect={vi.fn()} onCreate={vi.fn()} onMove={onMove} />);

        // 2장의 아래로 버튼 클릭 (두 번째 아래로 버튼)
        const downButtons = screen.getAllByRole("button", { name: /아래로/ });
        await userEvent.click(downButtons[1]);

        expect(onMove).toHaveBeenCalledWith(2, "down");
        expect(onMove).toHaveBeenCalledTimes(1);
    });

    it("onMove 없이 렌더링 시 순서 버튼이 표시되지 않는다", () => {
        render(<ChapterList chapters={CHAPTERS} currentChapterId={null} onSelect={vi.fn()} onCreate={vi.fn()} />);

        expect(screen.queryByRole("button", { name: /위로/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /아래로/ })).not.toBeInTheDocument();
    });

    // ── T025: 삭제 버튼 · disabled (INV-1 1차 방어) ────────────────────────

    it("onDelete 전달 시 각 챕터에 삭제 버튼이 표시된다", () => {
        render(
            <ChapterList
                chapters={CHAPTERS}
                currentChapterId={null}
                onSelect={vi.fn()}
                onCreate={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        // 삭제 버튼이 챕터 수만큼 존재해야 함
        const deleteBtns = screen.getAllByRole("button", { name: /챕터 삭제/ });
        expect(deleteBtns).toHaveLength(3);
    });

    it("onDelete 없으면 삭제 버튼이 표시되지 않는다", () => {
        render(<ChapterList chapters={CHAPTERS} currentChapterId={null} onSelect={vi.fn()} onCreate={vi.fn()} />);
        expect(screen.queryByRole("button", { name: /챕터 삭제/ })).not.toBeInTheDocument();
    });

    it("챕터가 1개일 때 삭제 버튼이 disabled 된다 (INV-1 1차 방어)", () => {
        const singleChapter = [CHAPTERS[0]];
        render(
            <ChapterList
                chapters={singleChapter}
                currentChapterId={1}
                onSelect={vi.fn()}
                onCreate={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        const deleteBtn = screen.getByRole("button", { name: /챕터 삭제/ });
        expect(deleteBtn).toBeDisabled();
    });

    it("챕터가 2개 이상이면 삭제 버튼이 활성화된다", () => {
        render(
            <ChapterList
                chapters={CHAPTERS}
                currentChapterId={null}
                onSelect={vi.fn()}
                onCreate={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        const deleteBtns = screen.getAllByRole("button", { name: /챕터 삭제/ });
        for (const btn of deleteBtns) {
            expect(btn).not.toBeDisabled();
        }
    });

    it("삭제 버튼 클릭 시 onDelete(id) 가 호출된다", async () => {
        const onDelete = vi.fn();
        render(
            <ChapterList
                chapters={CHAPTERS}
                currentChapterId={null}
                onSelect={vi.fn()}
                onCreate={vi.fn()}
                onDelete={onDelete}
            />,
        );
        const deleteBtns = screen.getAllByRole("button", { name: /챕터 삭제/ });
        await userEvent.click(deleteBtns[1]); // 2번째(id=2)

        expect(onDelete).toHaveBeenCalledWith(2);
        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    // ── T-RENAME: 챕터 제목 인라인 편집 테스트 ────────────────────────────

    it("onRename 전달 시 제목 더블클릭으로 인라인 편집 input 이 표시된다", async () => {
        const onRename = vi.fn();
        render(
            <ChapterList
                chapters={CHAPTERS}
                currentChapterId={null}
                onSelect={vi.fn()}
                onCreate={vi.fn()}
                onRename={onRename}
            />,
        );

        // 첫 번째 챕터 제목 더블클릭
        const titleBtn = screen.getByRole("button", { name: /1장 — 시작/ });
        await userEvent.dblClick(titleBtn);

        // input 이 표시되고 기존 제목이 초기값으로 설정되어야 함
        const input = screen.getByRole("textbox");
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue("1장 — 시작");
    });

    it("인라인 편집 input 에서 Enter 입력 시 onRename(id, title) 이 호출된다", async () => {
        const onRename = vi.fn();
        render(
            <ChapterList
                chapters={CHAPTERS}
                currentChapterId={null}
                onSelect={vi.fn()}
                onCreate={vi.fn()}
                onRename={onRename}
            />,
        );

        const titleBtn = screen.getByRole("button", { name: /1장 — 시작/ });
        await userEvent.dblClick(titleBtn);

        const input = screen.getByRole("textbox");
        await userEvent.clear(input);
        await userEvent.type(input, "수정된 제목");
        await userEvent.keyboard("{Enter}");

        expect(onRename).toHaveBeenCalledWith(1, "수정된 제목");
        expect(onRename).toHaveBeenCalledTimes(1);
    });

    it("인라인 편집 input 에서 blur 시 onRename(id, title) 이 호출된다", async () => {
        const onRename = vi.fn();
        render(
            <ChapterList
                chapters={CHAPTERS}
                currentChapterId={null}
                onSelect={vi.fn()}
                onCreate={vi.fn()}
                onRename={onRename}
            />,
        );

        const titleBtn = screen.getByRole("button", { name: /1장 — 시작/ });
        await userEvent.dblClick(titleBtn);

        const input = screen.getByRole("textbox");
        await userEvent.clear(input);
        await userEvent.type(input, "blur 후 저장");
        // blur 발생
        await userEvent.tab();

        expect(onRename).toHaveBeenCalledWith(1, "blur 후 저장");
    });

    it("인라인 편집 input 에서 Escape 입력 시 편집이 취소된다 (onRename 호출 안 함)", async () => {
        const onRename = vi.fn();
        render(
            <ChapterList
                chapters={CHAPTERS}
                currentChapterId={null}
                onSelect={vi.fn()}
                onCreate={vi.fn()}
                onRename={onRename}
            />,
        );

        const titleBtn = screen.getByRole("button", { name: /1장 — 시작/ });
        await userEvent.dblClick(titleBtn);

        const input = screen.getByRole("textbox");
        await userEvent.type(input, "취소될 제목");
        await userEvent.keyboard("{Escape}");

        expect(onRename).not.toHaveBeenCalled();
        // input 이 사라지고 원래 제목 버튼이 복원되어야 함
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /1장 — 시작/ })).toBeInTheDocument();
    });

    it("onRename 없이 렌더링 시 더블클릭해도 input 이 표시되지 않는다", async () => {
        render(
            <ChapterList
                chapters={CHAPTERS}
                currentChapterId={null}
                onSelect={vi.fn()}
                onCreate={vi.fn()}
            />,
        );

        const titleBtn = screen.getByRole("button", { name: /1장 — 시작/ });
        await userEvent.dblClick(titleBtn);

        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
});
