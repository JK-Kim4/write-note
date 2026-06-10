import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProjectCard } from "@/lib/types/domain";
import { ResumeCard } from "./ResumeCard";

/** ResumeCard(018 US1 ②) 행위 — 표시 전용(props만), 데이터·이동은 부모 책임. */

function card(over: Partial<ProjectCard> = {}): ProjectCard {
    return {
        id: 1,
        title: "여름의 끝, 우리가 머물던 곳",
        genre: null,
        targetLength: null,
        toneNotes: null,
        synopsis: null,
        worldNotes: null,
        nextScene: "은하가 등대지기를 처음 만나는 장면",
        archivedAt: null,
        createdAt: "2026-06-01T00:00:00Z",
        updatedAt: "2026-06-01T00:00:00Z",
        lastSentenceSource: "여름이 끝났다. 계절이 바뀌는 것은 기억이 옅어지는 과정일지도 모른다.",
        wordCount: 42500,
        docUpdatedAt: "2026-06-10T02:00:00Z",
        totalDurationMs: 12_000_000,
        ...over,
    };
}

describe("ResumeCard", () => {
    it("제목·본문 마지막 문장·다음 장면·메타(글자수·누적 작업시간)를 표시한다", () => {
        render(<ResumeCard card={card()} onOpen={() => {}} />);

        expect(screen.getByText("여름의 끝, 우리가 머물던 곳")).toBeInTheDocument();
        expect(screen.getByText(/기억이 옅어지는 과정일지도 모른다\./)).toBeInTheDocument();
        expect(screen.getByText(/은하가 등대지기를 처음 만나는 장면/)).toBeInTheDocument();
        expect(screen.getByText(/42,500자/)).toBeInTheDocument();
        expect(screen.queryByText(/총 /)).not.toBeInTheDocument(); // v4 — 누적 총시간은 집필 리듬 카드 소관
    });

    it("본문이 비면 마지막 문장 자리에 placeholder 카피를 보여준다", () => {
        render(<ResumeCard card={card({ lastSentenceSource: "" })} onOpen={() => {}} />);

        expect(screen.getByText("아직 첫 문장을 기다리는 중")).toBeInTheDocument();
    });

    it("다음 장면이 빈 문자열이면 그 줄을 숨긴다", () => {
        render(<ResumeCard card={card({ nextScene: "" })} onOpen={() => {}} />);

        expect(screen.queryByText(/다음 장면/)).not.toBeInTheDocument();
    });

    it("[이어서 쓰기] 버튼 클릭 시 onOpen 을 호출한다", async () => {
        const onOpen = vi.fn();
        render(<ResumeCard card={card()} onOpen={onOpen} />);

        await userEvent.click(screen.getByRole("button", { name: /이어서 쓰기/ }));

        expect(onOpen).toHaveBeenCalledTimes(1);
    });
});
