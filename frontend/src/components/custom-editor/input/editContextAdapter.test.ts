import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEditContextAdapter } from "./editContextAdapter";
import type { InputHandlers, TextUpdate } from "./inputAdapter";

/**
 * 시스템 경계 mock — 브라우저 EditContext API(jsdom 미제공). updateText/updateSelection 이 실제처럼
 * text/selection 상태를 바꾸게 해 어댑터의 동기·매핑을 상태/반환으로 검증한다(내부 collaborator mock 아님).
 */
class FakeEditContext extends EventTarget {
    text = "";
    selectionStart = 0;
    selectionEnd = 0;
    updateText(start: number, end: number, t: string) {
        this.text = this.text.slice(0, start) + t + this.text.slice(end);
    }
    updateSelection(s: number, e: number) {
        this.selectionStart = s;
        this.selectionEnd = e;
    }
    updateControlBounds() {}
    updateSelectionBounds() {}
    updateCharacterBounds() {}
}

function makeHandlers() {
    const updates: TextUpdate[] = [];
    const compEnds: Array<{ start: number; end: number }> = [];
    let compStarts = 0;
    const handlers: InputHandlers = {
        onTextUpdate: (u) => updates.push(u),
        onCompositionStart: () => {
            compStarts += 1;
        },
        onCompositionEnd: (start, end) => compEnds.push({ start, end }),
        onEdit: () => {},
    };
    return { handlers, updates, compEnds, getCompStarts: () => compStarts };
}

describe("editContextAdapter", () => {
    beforeEach(() => {
        (globalThis as { EditContext?: unknown }).EditContext = FakeEditContext;
    });
    afterEach(() => {
        delete (globalThis as { EditContext?: unknown }).EditContext;
    });

    it("textupdate 이벤트를 TextUpdate 로 매핑해 onTextUpdate 로 올린다", () => {
        const adapter = createEditContextAdapter();
        const host = document.createElement("div");
        const { handlers, updates } = makeHandlers();
        adapter.attach(host, handlers);

        const ev = new Event("textupdate") as Event & Record<string, unknown>;
        ev.updateRangeStart = 0;
        ev.updateRangeEnd = 0;
        ev.text = "안";
        ev.selectionStart = 1;
        ev.selectionEnd = 1;
        (host.editContext as unknown as EventTarget).dispatchEvent(ev);

        expect(updates).toEqual([{ rangeStart: 0, rangeEnd: 0, text: "안", selectionStart: 1, selectionEnd: 1 }]);
    });

    it("compositionstart/end 로 isComposing 이 토글되고 onCompositionEnd 가 최종 선택을 넘긴다", () => {
        const adapter = createEditContextAdapter();
        const host = document.createElement("div");
        const { handlers, compEnds, getCompStarts } = makeHandlers();
        adapter.attach(host, handlers);
        const ctx = host.editContext as unknown as FakeEditContext;

        expect(adapter.isComposing()).toBe(false);
        ctx.dispatchEvent(new Event("compositionstart"));
        expect(adapter.isComposing()).toBe(true);
        expect(getCompStarts()).toBe(1);

        ctx.updateSelection(3, 3); // 조합 종료 시점 입력 소스의 최종 선택
        ctx.dispatchEvent(new Event("compositionend"));
        expect(adapter.isComposing()).toBe(false);
        expect(compEnds).toEqual([{ start: 3, end: 3 }]);
    });

    it("syncText 는 입력 소스 텍스트를 buffer 전체로 동기하고 getText 로 반영된다", () => {
        const adapter = createEditContextAdapter();
        const host = document.createElement("div");
        const { handlers } = makeHandlers();
        adapter.attach(host, handlers);

        adapter.syncText("가나다");
        expect(adapter.getText()).toBe("가나다");
        adapter.syncText("라마"); // 전체 치환(0..len)
        expect(adapter.getText()).toBe("라마");
    });

    it("syncSelection 은 start>end 여도 min/max 로 정규화한다", () => {
        const adapter = createEditContextAdapter();
        const host = document.createElement("div");
        const { handlers } = makeHandlers();
        adapter.attach(host, handlers);

        adapter.syncSelection(5, 2);
        expect(adapter.getSelection()).toEqual({ start: 2, end: 5 });
    });

    it("detach 후 textupdate 는 더 이상 올라오지 않고 editContext 가 분리된다", () => {
        const adapter = createEditContextAdapter();
        const host = document.createElement("div");
        const { handlers, updates } = makeHandlers();
        adapter.attach(host, handlers);
        const ctx = host.editContext as unknown as FakeEditContext;

        adapter.detach();
        const ev = new Event("textupdate") as Event & Record<string, unknown>;
        ev.updateRangeStart = 0;
        ev.updateRangeEnd = 0;
        ev.text = "x";
        ev.selectionStart = 1;
        ev.selectionEnd = 1;
        ctx.dispatchEvent(ev);

        expect(updates).toEqual([]);
        expect(host.editContext).toBeNull();
        expect(adapter.isComposing()).toBe(false);
    });
});
