import { fireEvent, render, screen } from "@testing-library/react";
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

    // 자체 에디터(EditContext) 포커스 유지 — 버튼 mousedown 의 기본 동작(포커스 이동)을 막아야
    // 스톱워치 조작 후에도 본문 타이핑이 끊기지 않는다(keepEditorFocus). 회귀 시 이어쓰기 불가 재발.
    it("버튼 mousedown 은 기본 동작(포커스 이동)을 막는다 — 에디터 포커스 유지", () => {
        render(<Timewatch status="running" elapsedMs={1000} onStart={noop} onPause={noop} onResume={noop} onRequestStop={noop} />);
        const prevented = !fireEvent.mouseDown(screen.getByRole("button", { name: /일시정지/ }));
        expect(prevented).toBe(true);
    });
});
