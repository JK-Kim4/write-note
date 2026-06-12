import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Rail } from "./Rail";

/**
 * Rail 작품 종속 네비(집필·인물) 회귀 테스트 (019 버그픽스 A·B).
 * A: 현재 경로의 작품 컨텍스트(/projects/{id}/...)를 최우선으로 쓰고, 없으면 lastProject, 그것도 없으면 fallback.
 * B: 작품 상세(/projects/{id})·메타 편집(/edit)에서 "작품" 하이라이트가 켜진다(집필/인물 경로는 각자 항목).
 */

const push = vi.fn();
let pathname = "/";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push, replace: vi.fn() }),
    usePathname: () => pathname,
}));

vi.mock("@/components/QuickCapture", () => ({
    QuickCapture: () => null,
}));

describe("Rail 집필·인물 네비 (버그 A)", () => {
    beforeEach(() => {
        push.mockClear();
        localStorage.clear();
    });

    it("작품 상세에 있으면 집필 클릭 시 그 작품의 집필실로 간다", async () => {
        pathname = "/projects/5";
        const user = userEvent.setup();
        render(<Rail />);

        await user.click(screen.getByRole("button", { name: "집필" }));
        expect(push).toHaveBeenCalledWith("/projects/5/write");
    });

    it("작품 상세에 있으면 인물 클릭 시 그 작품의 인물 페이지로 간다", async () => {
        pathname = "/projects/5";
        const user = userEvent.setup();
        render(<Rail />);

        await user.click(screen.getByRole("button", { name: "인물" }));
        expect(push).toHaveBeenCalledWith("/projects/5/characters");
    });

    it("작품 컨텍스트 밖에서는 lastProject 로 간다", async () => {
        pathname = "/memos";
        localStorage.setItem("wn:lastProjectId", "7");
        const user = userEvent.setup();
        render(<Rail />);

        await user.click(screen.getByRole("button", { name: "집필" }));
        expect(push).toHaveBeenCalledWith("/projects/7/write");
    });

    it("작품 컨텍스트도 lastProject 도 없으면 이동하지 않고 안내 토스트를 띄운다", async () => {
        pathname = "/memos";
        const user = userEvent.setup();
        render(<Rail />);

        await user.click(screen.getByRole("button", { name: "집필" }));
        expect(push).not.toHaveBeenCalled();
        expect(screen.getByText("집필할 작품이 아직 없어요.")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "인물" }));
        expect(push).not.toHaveBeenCalled();
        expect(screen.getByText("인물을 둘 작품이 아직 없어요.")).toBeInTheDocument();
    });

    it("빈 컨텍스트 안내 토스트의 '작품 벽으로' 액션은 작품 벽으로 보낸다", async () => {
        pathname = "/memos";
        const user = userEvent.setup();
        render(<Rail />);

        await user.click(screen.getByRole("button", { name: "집필" }));
        await user.click(screen.getByRole("button", { name: "작품 벽으로" }));
        expect(push).toHaveBeenCalledWith("/library");
    });

    it("현재 경로의 작품이 lastProject 보다 우선한다", async () => {
        pathname = "/projects/5/characters";
        localStorage.setItem("wn:lastProjectId", "7");
        const user = userEvent.setup();
        render(<Rail />);

        await user.click(screen.getByRole("button", { name: "집필" }));
        expect(push).toHaveBeenCalledWith("/projects/5/write");
    });
});

describe("Rail 하이라이트 (버그 B)", () => {
    it("작품 상세에서 '작품' 항목이 켜진다", () => {
        pathname = "/projects/5";
        render(<Rail />);
        expect(screen.getByRole("button", { name: "작품" })).toHaveAttribute("aria-current", "page");
    });

    it("작품 메타 편집에서 '작품' 항목이 켜진다", () => {
        pathname = "/projects/5/edit";
        render(<Rail />);
        expect(screen.getByRole("button", { name: "작품" })).toHaveAttribute("aria-current", "page");
    });

    it("집필실에서는 '집필'만 켜지고 '작품'은 꺼진다", () => {
        pathname = "/projects/5/write";
        render(<Rail />);
        expect(screen.getByRole("button", { name: "집필" })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("button", { name: "작품" })).not.toHaveAttribute("aria-current");
    });

    it("인물 페이지에서는 '인물'만 켜지고 '작품'은 꺼진다", () => {
        pathname = "/projects/5/characters";
        render(<Rail />);
        expect(screen.getByRole("button", { name: "인물" })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("button", { name: "작품" })).not.toHaveAttribute("aria-current");
    });
});

describe("Rail 설정 진입점", () => {
    beforeEach(() => push.mockClear());

    it("설정 항목 클릭 시 설정 페이지로 간다", async () => {
        pathname = "/";
        const user = userEvent.setup();
        render(<Rail />);

        await user.click(screen.getByRole("button", { name: "설정" }));
        expect(push).toHaveBeenCalledWith("/settings");
    });

    it("설정 페이지에서 설정 항목이 켜진다", () => {
        pathname = "/settings";
        render(<Rail />);
        expect(screen.getByRole("button", { name: "설정" })).toHaveAttribute("aria-current", "page");
    });
});
