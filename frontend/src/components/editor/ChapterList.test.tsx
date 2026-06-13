import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChapterList } from "./ChapterList";

/**
 * T008 — ChapterList 컴포넌트 행위 테스트.
 * 챕터 목록 표시 / 현재 챕터 하이라이트 / 새 챕터 버튼 / 챕터 선택 콜백.
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
});
