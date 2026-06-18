import { describe, expect, it } from "vitest";
import { createTextareaAdapter } from "./textareaAdapter";
import type { InputHandlers, TextUpdate } from "./inputAdapter";

function setup() {
    const adapter = createTextareaAdapter();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const updates: TextUpdate[] = [];
    const selChanges: Array<{ start: number; end: number }> = [];
    const handlers: InputHandlers = {
        onTextUpdate: (u) => updates.push(u),
        onCompositionStart: () => {},
        onCompositionEnd: () => {},
        onEdit: () => {},
        onSelectionChange: (start, end) => selChanges.push({ start, end }),
    };
    adapter.attach(host, handlers);
    const ta = host.querySelector("textarea")!;
    return { adapter, host, ta, updates, selChanges };
}

/** 브라우저가 textarea 를 편집한 뒤 발화하는 input 흉내 — value/selection 설정 후 input dispatch. */
function setValueAndInput(ta: HTMLTextAreaElement, value: string, caret: number) {
    ta.value = value;
    ta.setSelectionRange(caret, caret);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("textareaAdapter", () => {
    it("attach 는 host 에 textarea 를 만든다", () => {
        const { host } = setup();
        expect(host.querySelector("textarea")).not.toBeNull();
    });

    it("타이핑(value 변경)을 diff 해 onTextUpdate 로 올린다 — 단순 삽입", () => {
        const { ta, updates } = setup();
        setValueAndInput(ta, "a", 1);
        expect(updates[0]).toEqual({ rangeStart: 0, rangeEnd: 0, text: "a", selectionStart: 1, selectionEnd: 1 });
        setValueAndInput(ta, "ab", 2);
        expect(updates[1]).toEqual({ rangeStart: 1, rangeEnd: 1, text: "b", selectionStart: 2, selectionEnd: 2 });
    });

    it("한글 IME 치환(ㅇ→아→안)을 diff 로 정확히 반영한다", () => {
        const { ta, updates } = setup();
        setValueAndInput(ta, "ㅇ", 1);
        expect(updates[0]).toEqual({ rangeStart: 0, rangeEnd: 0, text: "ㅇ", selectionStart: 1, selectionEnd: 1 });
        setValueAndInput(ta, "아", 1); // ㅇ→아 치환
        expect(updates[1]).toEqual({ rangeStart: 0, rangeEnd: 1, text: "아", selectionStart: 1, selectionEnd: 1 });
        setValueAndInput(ta, "안", 1); // 아→안 치환
        expect(updates[2]).toEqual({ rangeStart: 0, rangeEnd: 1, text: "안", selectionStart: 1, selectionEnd: 1 });
    });

    it("Enter(\\n) 도 value diff 로 자연히 흐른다 — 별도 onEdit 없이 \\n 삽입", () => {
        const { ta, updates } = setup();
        setValueAndInput(ta, "가나", 2);
        setValueAndInput(ta, "가나\n", 3); // Enter → textarea value 에 \n
        expect(updates[updates.length - 1]).toEqual({ rangeStart: 2, rangeEnd: 2, text: "\n", selectionStart: 3, selectionEnd: 3 });
    });

    it("줄바꿈 뒤 입력도 정확한 offset 에 — value/offset 1:1 (phantom 없음)", () => {
        const { ta, updates } = setup();
        setValueAndInput(ta, "가\n", 2);
        setValueAndInput(ta, "가\n나", 3); // 2번째 줄에 "나"
        expect(updates[updates.length - 1]).toEqual({ rangeStart: 2, rangeEnd: 2, text: "나", selectionStart: 3, selectionEnd: 3 });
    });

    it("Backspace(끝 글자 삭제)도 diff 로 반영", () => {
        const { ta, updates } = setup();
        setValueAndInput(ta, "가나", 2);
        setValueAndInput(ta, "가", 1);
        expect(updates[updates.length - 1]).toEqual({ rangeStart: 1, rangeEnd: 2, text: "", selectionStart: 1, selectionEnd: 1 });
    });

    it("syncText 는 textarea.value 를 모델 텍스트로 동기(조합 중엔 미변경)", () => {
        const { ta, adapter } = setup();
        adapter.syncText("가나다\n라");
        expect(ta.value).toBe("가나다\n라");
        expect(adapter.getText()).toBe("가나다\n라");
    });

    it("syncSelection 은 textarea 선택을 설정한다", () => {
        const { ta, adapter } = setup();
        adapter.syncText("가나다");
        adapter.syncSelection(1, 2);
        expect(ta.selectionStart).toBe(1);
        expect(ta.selectionEnd).toBe(2);
        expect(adapter.getSelection()).toEqual({ start: 1, end: 2 });
    });

    it("selectionchange(텍스트 변경 없는 캐럿 이동)는 onSelectionChange 로 보고", () => {
        const { ta, adapter, selChanges } = setup();
        adapter.syncText("가나다");
        ta.setSelectionRange(2, 2);
        document.dispatchEvent(new Event("selectionchange"));
        expect(selChanges[selChanges.length - 1]).toEqual({ start: 2, end: 2 });
    });

    it("detach 후 textarea 제거 + input 무반응", () => {
        const { adapter, host, ta, updates } = setup();
        adapter.detach();
        expect(host.querySelector("textarea")).toBeNull();
        setValueAndInput(ta, "x", 1);
        expect(updates).toEqual([]);
    });
});
