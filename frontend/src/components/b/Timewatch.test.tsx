import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Timewatch } from "./Timewatch";

const noop = () => {};

describe("Timewatch", () => {
    it("대기 상태: 시작 버튼만, 00:00:00", () => {
        render(<Timewatch status="idle" elapsedMs={0} onStart={noop} onPause={noop} onResume={noop} onRequestStop={noop} />);
        expect(screen.getByText("00:00:00")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /시작/ })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /일시정지/ })).not.toBeInTheDocument();
    });

    it("집필 중: 일시정지·집필 종료 버튼 + 경과시간 표시", () => {
        render(<Timewatch status="running" elapsedMs={767_000} onStart={noop} onPause={noop} onResume={noop} onRequestStop={noop} />);
        expect(screen.getByText("00:12:47")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /일시정지/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /집필 종료/ })).toBeInTheDocument();
    });

    it("일시정지: 다시 시작·집필 종료 버튼", () => {
        render(<Timewatch status="paused" elapsedMs={767_000} onStart={noop} onPause={noop} onResume={noop} onRequestStop={noop} />);
        expect(screen.getByRole("button", { name: /다시 시작/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /집필 종료/ })).toBeInTheDocument();
    });

    it("시작 버튼 클릭 시 onStart 호출", async () => {
        const onStart = vi.fn();
        render(<Timewatch status="idle" elapsedMs={0} onStart={onStart} onPause={noop} onResume={noop} onRequestStop={noop} />);
        await userEvent.click(screen.getByRole("button", { name: /시작/ }));
        expect(onStart).toHaveBeenCalledOnce();
    });

    it("집필 종료 클릭 시 onRequestStop 호출", async () => {
        const onRequestStop = vi.fn();
        render(<Timewatch status="running" elapsedMs={1000} onStart={noop} onPause={noop} onResume={noop} onRequestStop={onRequestStop} />);
        await userEvent.click(screen.getByRole("button", { name: /집필 종료/ }));
        expect(onRequestStop).toHaveBeenCalledOnce();
    });
});
