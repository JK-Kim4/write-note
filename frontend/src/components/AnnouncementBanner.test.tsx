import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AnnouncementBanner } from "./AnnouncementBanner";

const { mockUseHome } = vi.hoisted(() => ({ mockUseHome: vi.fn() }));
vi.mock("@/lib/query/useAnnouncements", () => ({ useHomeAnnouncements: mockUseHome }));

const pinned = { id: 12, title: "고정 공지 제목", publishedAt: "2026-06-20T09:00:00Z" };
const latest = { id: 31, title: "최신 공지 제목", publishedAt: "2026-06-30T02:00:00Z" };

describe("AnnouncementBanner", () => {
    beforeEach(() => mockUseHome.mockReset());

    it("고정·최신 둘 다면 배너 2개를 각 상세 링크로 렌더한다", () => {
        mockUseHome.mockReturnValue({ data: { pinned, latest } });
        render(<AnnouncementBanner />);

        const links = screen.getAllByRole("link");
        expect(links).toHaveLength(2);
        expect(screen.getByText("고정 공지 제목").closest("a")).toHaveAttribute("href", "/notice/12");
        expect(screen.getByText("최신 공지 제목").closest("a")).toHaveAttribute("href", "/notice/31");
        // 고정/최신 배지로 구분
        expect(screen.getByText("고정")).toBeInTheDocument();
        expect(screen.getByText("공지")).toBeInTheDocument();
    });

    it("고정만 있으면 고정 배너 1개만 렌더한다", () => {
        mockUseHome.mockReturnValue({ data: { pinned, latest: null } });
        render(<AnnouncementBanner />);

        expect(screen.getAllByRole("link")).toHaveLength(1);
        expect(screen.getByText("고정 공지 제목")).toBeInTheDocument();
        expect(screen.getByText("고정")).toBeInTheDocument();
        expect(screen.queryByText("공지")).not.toBeInTheDocument();
    });

    it("최신만 있으면 최신 배너 1개만 렌더한다", () => {
        mockUseHome.mockReturnValue({ data: { pinned: null, latest } });
        render(<AnnouncementBanner />);

        expect(screen.getAllByRole("link")).toHaveLength(1);
        expect(screen.getByText("최신 공지 제목").closest("a")).toHaveAttribute("href", "/notice/31");
        expect(screen.getByText("공지")).toBeInTheDocument();
        expect(screen.queryByText("고정")).not.toBeInTheDocument();
    });

    it("둘 다 없으면 아무것도 렌더하지 않는다", () => {
        mockUseHome.mockReturnValue({ data: { pinned: null, latest: null } });
        const { container } = render(<AnnouncementBanner />);
        expect(container).toBeEmptyDOMElement();
    });

    it("데이터 로딩 전(undefined)에는 아무것도 렌더하지 않는다", () => {
        mockUseHome.mockReturnValue({ data: undefined });
        const { container } = render(<AnnouncementBanner />);
        expect(container).toBeEmptyDOMElement();
    });
});
