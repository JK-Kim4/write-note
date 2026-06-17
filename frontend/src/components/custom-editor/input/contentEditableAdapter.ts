/**
 * contenteditable 입력 어댑터 — iOS WebKit(EditContext 미지원).
 *
 * 리서치(w3c EditContext explainer / CodeMirror6 domobserver / w3c input-events)에 근거한 방향:
 * - 조합(IME)은 브라우저에 맡기고, 조합 글자가 *보이는* 입력 표면에서 진행하게 한다(완전 투명/오프스크린은
 *   한글 받침 재조합에서 깨질 위험 → 비권장). 조합 중에는 모델→DOM 동기를 하지 않고 compositionend 후 1회 반영.
 * - `insertCompositionText` inputType 은 cancelable 이 아니라 preventDefault 가 IME 를 깨뜨릴 수 있어 막지 않는다.
 * - 평상시 텍스트(insertText)·구조 편집(Enter/Backspace 등)은 beforeinput 을 preventDefault 하고 모델로 라우팅
 *   해 모델이 단일 진실이 되게 한다.
 *
 * 입력 표면 = 별도의 작은 contenteditable div(조합 전용). 텍스트의 진실은 우리 모델/자체 렌더이며, 이 표면은
 * 평상시 비어 있고 조합 중에만 글자를 담는다. (첫 PoC: 표면을 stage 좌상단에 고정. 캐럿 위치 정렬은 후속.)
 */

import type { EditIntent, InputAdapter, InputHandlers } from "./inputAdapter";

/** beforeinput inputType → 구조 편집 의도(텍스트 삽입은 별도 처리). */
function intentOf(inputType: string): EditIntent | null {
    switch (inputType) {
        case "insertParagraph":
            return "splitBlock";
        case "insertLineBreak":
            return "softBreak";
        case "deleteContentBackward":
            return "deleteBackward";
        case "deleteContentForward":
            return "deleteForward";
        default:
            return null;
    }
}

export function createContentEditableAdapter(): InputAdapter {
    let surface: HTMLDivElement | null = null;
    let host: HTMLElement | null = null;
    let composing = false;
    // 모델 텍스트·선택의 미러 — CustomEditor 가 syncText/syncSelection 으로 갱신(어댑터는 텍스트 SoT 아님).
    // selStart/End 는 다음 삽입 위치. 삽입 후 어댑터가 자체 전진시키고, 화살표/클릭은 CustomEditor 가 syncSelection.
    let modelText = "";
    let selStart = 0;
    let selEnd = 0;

    let onBeforeInput: ((e: InputEvent) => void) | null = null;
    let onCompositionStart: (() => void) | null = null;
    let onCompositionEnd: ((e: CompositionEvent) => void) | null = null;

    return {
        attach(h: HTMLElement, handlers: InputHandlers) {
            host = h;
            const s = document.createElement("div");
            surface = s;
            s.setAttribute("contenteditable", "true");
            s.setAttribute("autocapitalize", "off");
            s.setAttribute("autocorrect", "off");
            s.spellcheck = false;
            // 조합(IME) 글자가 보이도록 표면을 가시화. 첫 PoC: stage 좌상단 고정(캐럿 정렬은 후속 T010).
            s.style.cssText =
                "position:absolute;top:4px;left:4px;min-width:1px;min-height:1.4em;padding:0 2px;" +
                "outline:none;font:inherit;color:#111;background:rgba(255,255,255,0.92);" +
                "border-radius:4px;z-index:5;white-space:pre;";
            if (!h.style.position) h.style.position = "relative";
            h.appendChild(s);

            onBeforeInput = (e: InputEvent) => {
                const t = e.inputType;
                // 조합 텍스트 — 막지 않는다(cancelable 아님, IME 깨짐). composition 이벤트로 처리.
                if (t === "insertCompositionText") return;
                e.preventDefault();
                // 평상시 텍스트 삽입(영문/숫자/붙는 입력) → 모델로 라우팅 + 삽입 위치 전진.
                if (t === "insertText" && e.data != null) {
                    const caret = selStart + e.data.length;
                    handlers.onTextUpdate({ rangeStart: selStart, rangeEnd: selEnd, text: e.data, selectionStart: caret, selectionEnd: caret });
                    selStart = caret;
                    selEnd = caret;
                    return;
                }
                // 구조 편집(Enter/Backspace 등) → CustomEditor 의 model 연산으로(onEdit).
                const intent = intentOf(t);
                if (intent) handlers.onEdit(intent);
            };
            onCompositionStart = () => {
                composing = true;
                s.textContent = ""; // 조합 표면 초기화 — 브라우저가 조합 글자를 여기 채운다.
                handlers.onCompositionStart();
            };
            onCompositionEnd = (e: CompositionEvent) => {
                composing = false;
                s.textContent = ""; // 확정 후 표면 비움 — 텍스트는 모델/자체 렌더가 표시.
                const text = e.data ?? "";
                const caret = selStart + text.length;
                if (text) {
                    handlers.onTextUpdate({ rangeStart: selStart, rangeEnd: selEnd, text, selectionStart: caret, selectionEnd: caret });
                    selStart = caret;
                    selEnd = caret;
                }
                handlers.onCompositionEnd(caret, caret);
            };
            s.addEventListener("beforeinput", onBeforeInput);
            s.addEventListener("compositionstart", onCompositionStart);
            s.addEventListener("compositionend", onCompositionEnd);
            s.focus();
        },

        detach() {
            if (surface) {
                if (onBeforeInput) surface.removeEventListener("beforeinput", onBeforeInput);
                if (onCompositionStart) surface.removeEventListener("compositionstart", onCompositionStart);
                if (onCompositionEnd) surface.removeEventListener("compositionend", onCompositionEnd);
                surface.remove();
            }
            surface = null;
            host = null;
            composing = false;
            onBeforeInput = null;
            onCompositionStart = null;
            onCompositionEnd = null;
        },

        syncText(fullText: string) {
            modelText = fullText;
        },

        syncSelection(start: number, end: number) {
            selStart = Math.min(start, end);
            selEnd = Math.max(start, end);
        },

        getText() {
            return modelText;
        },

        getSelection() {
            return { start: selStart, end: selEnd };
        },

        isComposing() {
            return composing;
        },

        updateControlBounds() {
            // contenteditable 경로는 제어 영역 경계가 불필요(EditContext 전용) — no-op.
        },
    };
}
