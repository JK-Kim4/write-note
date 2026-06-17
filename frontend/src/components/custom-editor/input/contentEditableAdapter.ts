/**
 * contenteditable 입력 어댑터 — iOS WebKit(EditContext 미지원).
 *
 * 정석(ProseMirror/CodeMirror) 방식: contenteditable 표면이 텍스트를 담고 브라우저가 자유롭게 편집
 * (한글 조합 포함)하게 둔 뒤, 변경 결과를 직전 텍스트와 diff 해 모델에 반영한다.
 *
 * 왜 이 방식인가(관찰로 확정): iOS Safari 는 한글 조합을 composition 이벤트 없이 `beforeinput insertText`
 * 로 조합 단계마다(ㅇ→아→안) 발화하고, 각 단계는 이전 글자를 *치환*한다. beforeinput 을 preventDefault
 * 해서 직접 삽입하면 치환이 안 돼 누적("ㅇ아안")으로 깨진다. → 브라우저가 표면을 편집하게 두고 `input`
 * 에서 diff 하면, 치환이 표면 안에서 처리되고 우리는 차이(rangeStart/rangeEnd/inserted)만 적용한다.
 *
 * 표면은 투명(글자·캐럿)이며 stage(원고) 전체를 덮어, 사용자가 보는 것은 그 아래 자체 렌더(페이지·스타일·
 * 페이지 분할)이고 iOS 키보드는 표면을 직접 탭해 뜬다.
 */

import type { EditIntent, InputAdapter, InputHandlers } from "./inputAdapter";

/** beforeinput inputType → 구조 편집 의도(블록 분할/소프트 줄바꿈만 가로챈다). */
function structuralIntentOf(inputType: string): EditIntent | null {
    switch (inputType) {
        case "insertParagraph":
            return "splitBlock";
        case "insertLineBreak":
            return "softBreak";
        default:
            return null;
    }
}

export function createContentEditableAdapter(): InputAdapter {
    let surface: HTMLDivElement | null = null;
    let host: HTMLElement | null = null;
    let composing = false;
    // 직전 표면 텍스트 — input 마다 이것과 diff 해 변경분(치환 범위 + 삽입 텍스트)을 모델에 올린다.
    let lastText = "";
    let selStart = 0;
    let selEnd = 0;
    let handlersRef: InputHandlers | null = null;

    let onBeforeInput: ((e: InputEvent) => void) | null = null;
    let onInput: (() => void) | null = null;
    let onCompositionStart: (() => void) | null = null;
    let onCompositionEnd: (() => void) | null = null;

    /** 표면 현재 텍스트 vs lastText diff → onTextUpdate(공통 prefix/suffix 제외한 가운데가 치환). */
    function emitDiff() {
        if (!surface || !handlersRef) return;
        const now = surface.textContent ?? "";
        if (now === lastText) return;
        let s = 0;
        const max = Math.min(lastText.length, now.length);
        while (s < max && lastText[s] === now[s]) s += 1;
        let ea = lastText.length;
        let eb = now.length;
        while (ea > s && eb > s && lastText[ea - 1] === now[eb - 1]) {
            ea -= 1;
            eb -= 1;
        }
        const inserted = now.slice(s, eb);
        const caret = s + inserted.length;
        handlersRef.onTextUpdate({ rangeStart: s, rangeEnd: ea, text: inserted, selectionStart: caret, selectionEnd: caret });
        lastText = now;
        selStart = caret;
        selEnd = caret;
    }

    return {
        attach(h: HTMLElement, handlers: InputHandlers) {
            host = h;
            handlersRef = handlers;
            const s = document.createElement("div");
            surface = s;
            s.setAttribute("contenteditable", "true");
            s.setAttribute("autocapitalize", "off");
            s.setAttribute("autocorrect", "off");
            s.spellcheck = false;
            // 전체 덮기 + 투명(글자·캐럿) — 입력 수집만, 표시는 자체 렌더. iOS 키보드는 표면 직접 탭으로 뜬다.
            s.style.cssText =
                "position:absolute;inset:0;width:100%;height:100%;padding:40px 48px;box-sizing:border-box;" +
                "outline:none;font:inherit;color:transparent;background:transparent;caret-color:transparent;" +
                "z-index:5;white-space:pre-wrap;overflow:hidden;-webkit-user-select:text;";
            if (!h.style.position) h.style.position = "relative";
            h.appendChild(s);

            onBeforeInput = (e: InputEvent) => {
                // 구조 편집(Enter/소프트 줄바꿈)만 가로채 모델 연산으로. 그 외(텍스트 입력·삭제·조합)는
                // 브라우저가 표면을 편집하게 두고 input 에서 diff(치환 자연 처리).
                const intent = structuralIntentOf(e.inputType);
                if (intent) {
                    e.preventDefault();
                    handlers.onEdit(intent);
                }
            };
            onInput = () => emitDiff();
            onCompositionStart = () => {
                composing = true;
                handlers.onCompositionStart();
            };
            onCompositionEnd = () => {
                composing = false;
                emitDiff();
                handlers.onCompositionEnd(selStart, selEnd);
            };
            s.addEventListener("beforeinput", onBeforeInput);
            s.addEventListener("input", onInput);
            s.addEventListener("compositionstart", onCompositionStart);
            s.addEventListener("compositionend", onCompositionEnd);
            s.focus();
        },

        detach() {
            if (surface) {
                if (onBeforeInput) surface.removeEventListener("beforeinput", onBeforeInput);
                if (onInput) surface.removeEventListener("input", onInput);
                if (onCompositionStart) surface.removeEventListener("compositionstart", onCompositionStart);
                if (onCompositionEnd) surface.removeEventListener("compositionend", onCompositionEnd);
                surface.remove();
            }
            surface = null;
            host = null;
            handlersRef = null;
            composing = false;
            lastText = "";
            onBeforeInput = null;
            onInput = null;
            onCompositionStart = null;
            onCompositionEnd = null;
        },

        syncText(fullText: string) {
            lastText = fullText;
            // 외부 모델 변경(undo/paste/구조편집)을 표면에 반영. 조합 중에는 표면을 건드리지 않는다(조합 보호).
            if (surface && !composing && surface.textContent !== fullText) {
                surface.textContent = fullText;
            }
        },

        syncSelection(start: number, end: number) {
            selStart = Math.min(start, end);
            selEnd = Math.max(start, end);
            // 모델 캐럿을 표면 DOM 선택에 반영 — splitBlock/undo/클릭 등으로 표면 텍스트·캐럿이 바뀐 뒤
            // 다음 입력이 맞는 위치에 들어가게. 조합 중에는 건드리지 않는다(IME 보호). 표면은 단일 텍스트 노드.
            if (surface && !composing) {
                const node = surface.firstChild;
                if (node && node.nodeType === 3) {
                    const len = (node.textContent ?? "").length;
                    try {
                        const dom = window.getSelection();
                        if (dom) {
                            const r = document.createRange();
                            r.setStart(node, Math.min(selStart, len));
                            r.setEnd(node, Math.min(selEnd, len));
                            dom.removeAllRanges();
                            dom.addRange(r);
                        }
                    } catch {
                        // 노드 변동 중 — 무시(다음 동기에서 회복).
                    }
                }
            }
        },

        getText() {
            return lastText;
        },

        getSelection() {
            return { start: selStart, end: selEnd };
        },

        isComposing() {
            return composing;
        },

        focusInput() {
            surface?.focus();
        },

        updateControlBounds() {
            // contenteditable 경로는 제어 영역 경계 불필요(EditContext 전용) — no-op.
        },
    };
}
