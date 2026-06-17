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

/** 브라우저가 표면을 편집한 뒤 발화하는 input 을 흉내 — textContent 를 바꾸고 input dispatch. */
function setSurfaceAndInput(surface: HTMLElement, text: string) {
    surface.textContent = text;
    surface.dispatchEvent(new Event("input", { bubbles: true }));
}

function fireBeforeInput(surface: HTMLElement, inputType: string) {
    let ev: Event;
    try {
        ev = new InputEvent("beforeinput", { inputType, cancelable: true, bubbles: true });
    } catch {
        ev = new Event("beforeinput", { cancelable: true, bubbles: true });
    }
    if ((ev as InputEvent).inputType !== inputType) Object.defineProperty(ev, "inputType", { value: inputType });
    surface.dispatchEvent(ev);
    return ev;
}

describe("contentEditableAdapter", () => {
    it("표면 텍스트 변경(input)을 diff 해 onTextUpdate 로 올린다 — 단순 삽입", () => {
        const { surface, updates } = setup();
        setSurfaceAndInput(surface, "a");
        expect(updates[0]).toEqual({ rangeStart: 0, rangeEnd: 0, text: "a", selectionStart: 1, selectionEnd: 1 });
        setSurfaceAndInput(surface, "ab");
        expect(updates[1]).toEqual({ rangeStart: 1, rangeEnd: 1, text: "b", selectionStart: 2, selectionEnd: 2 });
    });

    it("iOS 한글 조합(이전 글자 치환)을 diff 로 정확히 반영한다 — ㅇ→아→안", () => {
        const { surface, updates } = setup();
        setSurfaceAndInput(surface, "ㅇ");
        expect(updates[0]).toEqual({ rangeStart: 0, rangeEnd: 0, text: "ㅇ", selectionStart: 1, selectionEnd: 1 });
        setSurfaceAndInput(surface, "아"); // ㅇ 을 아 로 치환
        expect(updates[1]).toEqual({ rangeStart: 0, rangeEnd: 1, text: "아", selectionStart: 1, selectionEnd: 1 });
        setSurfaceAndInput(surface, "안"); // 아 를 안 으로 치환
        expect(updates[2]).toEqual({ rangeStart: 0, rangeEnd: 1, text: "안", selectionStart: 1, selectionEnd: 1 });
        setSurfaceAndInput(surface, "안ㄴ"); // 다음 글자 시작(삽입)
        expect(updates[3]).toEqual({ rangeStart: 1, rangeEnd: 1, text: "ㄴ", selectionStart: 2, selectionEnd: 2 });
        setSurfaceAndInput(surface, "안녕"); // ㄴ→녕 치환
        expect(updates[4]).toEqual({ rangeStart: 1, rangeEnd: 2, text: "녕", selectionStart: 2, selectionEnd: 2 });
    });

    it("글자 삭제(Backspace)도 diff 로 반영한다", () => {
        const { surface, updates } = setup();
        setSurfaceAndInput(surface, "가나");
        setSurfaceAndInput(surface, "가"); // 끝 글자 삭제
        const last = updates[updates.length - 1];
        expect(last).toEqual({ rangeStart: 1, rangeEnd: 2, text: "", selectionStart: 1, selectionEnd: 1 });
    });

    it("구조 편집(insertParagraph/insertLineBreak) beforeinput 은 preventDefault + onEdit 으로 가로챈다", () => {
        const { surface, intents } = setup();
        const ev1 = fireBeforeInput(surface, "insertParagraph");
        const ev2 = fireBeforeInput(surface, "insertLineBreak");
        expect(intents).toEqual(["splitBlock", "softBreak"]);
        expect(ev1.defaultPrevented).toBe(true);
        expect(ev2.defaultPrevented).toBe(true);
    });

    it("compositionstart/end 로 조합 상태가 토글되고, 종료 시 표면을 diff 해 반영한다", () => {
        const { surface, updates, compEnds, adapter, getCompStarts } = setup();
        surface.dispatchEvent(new Event("compositionstart"));
        expect(adapter.isComposing()).toBe(true);
        expect(getCompStarts()).toBe(1);
        surface.textContent = "안"; // 조합 결과(브라우저가 표면에 남김)
        surface.dispatchEvent(new Event("compositionend"));
        expect(adapter.isComposing()).toBe(false);
        expect(updates[updates.length - 1]).toEqual({ rangeStart: 0, rangeEnd: 0, text: "안", selectionStart: 1, selectionEnd: 1 });
        expect(compEnds).toEqual([{ start: 1, end: 1 }]);
    });

    it("syncText 는 표면을 모델 텍스트로 동기하고 getText 로 반영(조합 중엔 표면 미변경)", () => {
        const { surface, adapter } = setup();
        adapter.syncText("가나다");
        expect(adapter.getText()).toBe("가나다");
        expect(surface.textContent).toBe("가나다");
        surface.dispatchEvent(new Event("compositionstart"));
        adapter.syncText("라마"); // 조합 중 — 표면 미변경
        expect(surface.textContent).toBe("가나다");
        expect(adapter.getText()).toBe("라마");
    });

    it("detach 후 표면이 제거되고 input 이 더는 오지 않는다", () => {
        const { adapter, host, surface, updates } = setup();
        adapter.detach();
        expect(host.querySelector('[contenteditable="true"]')).toBeNull();
        setSurfaceAndInput(surface, "x");
        expect(updates).toEqual([]);
        expect(adapter.isComposing()).toBe(false);
    });
});
