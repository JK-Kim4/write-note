import { describe, expect, it } from "vitest";
import { createContentEditableAdapter } from "./contentEditableAdapter";
import type { EditIntent, InputHandlers, TextUpdate } from "./inputAdapter";

function setup() {
    const adapter = createContentEditableAdapter();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const updates: TextUpdate[] = [];
    const intents: EditIntent[] = [];
    const compEnds: Array<{ start: number; end: number }> = [];
    let compStarts = 0;
    const handlers: InputHandlers = {
        onTextUpdate: (u) => updates.push(u),
        onCompositionStart: () => {
            compStarts += 1;
        },
        onCompositionEnd: (start, end) => compEnds.push({ start, end }),
        onEdit: (i) => intents.push(i),
    };
    adapter.attach(host, handlers);
    const surface = host.querySelector<HTMLElement>('[contenteditable="true"]')!;
    return { adapter, host, surface, updates, intents, compEnds, getCompStarts: () => compStarts };
}

/** jsdom 의 InputEvent inputType/data 미충전 가능성에 대비해 수동 보강. */
function fireBeforeInput(surface: HTMLElement, inputType: string, data: string | null) {
    let ev: Event;
    try {
        ev = new InputEvent("beforeinput", { inputType, data: data ?? undefined, cancelable: true, bubbles: true });
    } catch {
        ev = new Event("beforeinput", { cancelable: true, bubbles: true });
    }
    if ((ev as InputEvent).inputType !== inputType) Object.defineProperty(ev, "inputType", { value: inputType });
    if (data != null && (ev as InputEvent).data !== data) Object.defineProperty(ev, "data", { value: data });
    surface.dispatchEvent(ev);
    return ev;
}

function fireCompositionEnd(surface: HTMLElement, data: string) {
    let ev: Event;
    try {
        ev = new CompositionEvent("compositionend", { data, bubbles: true });
    } catch {
        ev = new Event("compositionend", { bubbles: true });
    }
    if ((ev as CompositionEvent).data !== data) Object.defineProperty(ev, "data", { value: data });
    surface.dispatchEvent(ev);
    return ev;
}

describe("contentEditableAdapter", () => {
    it("insertText beforeinput 을 onTextUpdate 로 라우팅하고 caret 을 전진시킨다", () => {
        const { surface, updates, adapter } = setup();
        adapter.syncSelection(0, 0);
        fireBeforeInput(surface, "insertText", "a");
        expect(updates).toEqual([{ rangeStart: 0, rangeEnd: 0, text: "a", selectionStart: 1, selectionEnd: 1 }]);
        expect(adapter.getSelection()).toEqual({ start: 1, end: 1 });
        fireBeforeInput(surface, "insertText", "b");
        expect(updates[1]).toEqual({ rangeStart: 1, rangeEnd: 1, text: "b", selectionStart: 2, selectionEnd: 2 });
    });

    it("insertText beforeinput 은 preventDefault 한다(모델 단일 진실)", () => {
        const { surface } = setup();
        const ev = fireBeforeInput(surface, "insertText", "a");
        expect(ev.defaultPrevented).toBe(true);
    });

    it("insertCompositionText beforeinput 은 preventDefault 하지 않는다(IME 보호)", () => {
        const { surface } = setup();
        const ev = fireBeforeInput(surface, "insertCompositionText", "안");
        expect(ev.defaultPrevented).toBe(false);
    });

    it("구조 편집 inputType 을 EditIntent 로 매핑해 onEdit 으로 올린다", () => {
        const { surface, intents } = setup();
        fireBeforeInput(surface, "insertParagraph", null);
        fireBeforeInput(surface, "insertLineBreak", null);
        fireBeforeInput(surface, "deleteContentBackward", null);
        fireBeforeInput(surface, "deleteContentForward", null);
        expect(intents).toEqual(["splitBlock", "softBreak", "deleteBackward", "deleteForward"]);
    });

    it("compositionstart/end 로 조합 상태가 토글되고 확정 텍스트를 caret 위치에 삽입한다", () => {
        const { surface, updates, compEnds, adapter, getCompStarts } = setup();
        adapter.syncSelection(2, 2);
        surface.dispatchEvent(new Event("compositionstart"));
        expect(adapter.isComposing()).toBe(true);
        expect(getCompStarts()).toBe(1);

        fireCompositionEnd(surface, "안");
        expect(adapter.isComposing()).toBe(false);
        expect(updates).toEqual([{ rangeStart: 2, rangeEnd: 2, text: "안", selectionStart: 3, selectionEnd: 3 }]);
        expect(compEnds).toEqual([{ start: 3, end: 3 }]);
        expect(adapter.getSelection()).toEqual({ start: 3, end: 3 });
    });

    it("syncSelection 은 min/max 정규화, syncText 는 getText 로 반영된다", () => {
        const { adapter } = setup();
        adapter.syncSelection(5, 2);
        expect(adapter.getSelection()).toEqual({ start: 2, end: 5 });
        adapter.syncText("가나다");
        expect(adapter.getText()).toBe("가나다");
    });

    it("detach 후 입력 표면이 제거되고 beforeinput 이 더는 오지 않는다", () => {
        const { adapter, host, surface, updates } = setup();
        adapter.syncSelection(0, 0);
        adapter.detach();
        expect(host.querySelector('[contenteditable="true"]')).toBeNull();
        fireBeforeInput(surface, "insertText", "x");
        expect(updates).toEqual([]);
        expect(adapter.isComposing()).toBe(false);
    });
});
