/**
 * textarea 입력 프록시 어댑터 — iOS WebKit(EditContext 미지원) 전용.
 *
 * 배경(2026-06-18 deep research + 실기기 확정): iOS 한글 IME 에서 "투명 contenteditable 오버레이 +
 * textContent diff + 구조편집 시 DOM 재구성" 방식은 실패한다 — iOS 가 조합 이벤트(compositionstart/end)를
 * 안 쏘면서 내부 IME 상태를 유지하는데, 우리가 DOM 을 재구성하면 그 상태가 orphan 돼 자모 중복·줄바꿈 소실이
 * 난다. 해법은 CodeMirror/Monaco 가 검증한 hidden textarea 입력 프록시: textarea 가 IME·Enter 를
 * 네이티브로 처리하고(우리가 DOM 을 재구성하지 않음) value diff 로 모델에 반영한다.
 *
 * 핵심 정합:
 *  - textarea.value === model.buffer (둘 다 '\n' 으로 줄 구분) → offset 1:1, 캐럿 매핑 단순.
 *  - Enter 는 textarea 가 value 에 '\n' 을 자연 삽입 → input diff → onTextUpdate → insertText 가
 *    blockAttrs 까지 분할(model.ts INV-1). 별도 splitBlock 라우팅 불필요(onEdit 미사용).
 *  - 캐럿/화살표/탭 이동은 textarea 네이티브 → selectionchange 로 읽어 onSelectionChange 로 보고.
 *  - 표면은 투명·전체 덮기(글자/캐럿 안 보임) — 표시는 자체 렌더 엔진. host keydown(onKey) 이중처리
 *    방지를 위해 textarea 에서 키 이벤트를 stopPropagation 한다(textarea 가 입력 전담).
 */

import type { InputAdapter, InputHandlers } from "./inputAdapter";

export function createTextareaAdapter(): InputAdapter {
    let ta: HTMLTextAreaElement | null = null;
    let host: HTMLElement | null = null;
    let composing = false;
    let lastText = "";
    let selStart = 0;
    let selEnd = 0;
    let handlersRef: InputHandlers | null = null;
    let pollId: number | null = null;

    let onInput: (() => void) | null = null;
    let onKeyDown: ((e: KeyboardEvent) => void) | null = null;
    let onCompositionStart: (() => void) | null = null;
    let onCompositionEnd: (() => void) | null = null;
    let onSelChange: (() => void) | null = null;

    /** value diff → onTextUpdate. 공통 prefix/suffix 를 뺀 가운데가 치환분. 캐럿은 textarea.selectionStart. */
    function emitDiff() {
        if (!ta || !handlersRef) return;
        const now = ta.value;
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
        const caret = ta.selectionStart;
        handlersRef.onTextUpdate({ rangeStart: s, rangeEnd: ea, text: inserted, selectionStart: caret, selectionEnd: ta.selectionEnd });
        lastText = now;
        selStart = caret;
        selEnd = ta.selectionEnd;
    }

    /** 텍스트 변경 없는 캐럿 이동(화살표·탭)을 onSelectionChange 로 보고. 조합 중·value 변경 중엔 무시. */
    function emitSelection() {
        if (!ta || !handlersRef || composing) return;
        if (ta.value !== lastText) return; // 텍스트 변경은 emitDiff 가 처리
        if (ta.selectionStart === selStart && ta.selectionEnd === selEnd) return;
        selStart = ta.selectionStart;
        selEnd = ta.selectionEnd;
        handlersRef.onSelectionChange(selStart, selEnd);
    }

    return {
        attach(h: HTMLElement, handlers: InputHandlers) {
            host = h;
            handlersRef = handlers;
            const t = document.createElement("textarea");
            ta = t;
            t.setAttribute("autocapitalize", "off");
            t.setAttribute("autocorrect", "off");
            t.setAttribute("autocomplete", "off");
            t.spellcheck = false;
            // 전체 덮기 + 투명(글자·캐럿) — 입력 수집만, 표시는 자체 렌더. iOS 키보드는 표면 직접 탭으로 뜬다.
            t.style.cssText =
                "position:absolute;inset:0;width:100%;height:100%;margin:0;padding:40px 48px;box-sizing:border-box;" +
                "border:none;outline:none;resize:none;font:inherit;line-height:inherit;letter-spacing:inherit;" +
                "color:transparent;background:transparent;caret-color:transparent;-webkit-text-fill-color:transparent;" +
                "z-index:5;white-space:pre-wrap;overflow:hidden;-webkit-user-select:text;";
            if (!h.style.position) h.style.position = "relative";
            h.appendChild(t);

            onInput = () => emitDiff();
            // textarea 가 Enter/Backspace/화살표를 네이티브로 처리 → host onKey(EditContext용) 로 버블링돼
            // 이중처리되지 않게 stopPropagation. 텍스트/캐럿은 input·selectionchange 로 읽는다.
            onKeyDown = (e: KeyboardEvent) => {
                e.stopPropagation();
            };
            onCompositionStart = () => {
                composing = true;
                handlers.onCompositionStart();
            };
            onCompositionEnd = () => {
                composing = false;
                emitDiff();
                handlers.onCompositionEnd(selStart, selEnd);
            };
            onSelChange = () => {
                if (document.activeElement === ta) emitSelection();
            };
            t.addEventListener("input", onInput);
            t.addEventListener("keydown", onKeyDown);
            t.addEventListener("compositionstart", onCompositionStart);
            t.addEventListener("compositionend", onCompositionEnd);
            document.addEventListener("selectionchange", onSelChange);
            // 폴링 안전망 — iOS 가 일부 IME 입력에 input 을 안 쏠 수 있어(CodeMirror 전략) 포커스 중 value 동기.
            pollId = window.setInterval(() => {
                if (ta && document.activeElement === ta) emitDiff();
            }, 150);
            t.focus();
        },

        detach() {
            if (ta) {
                if (onInput) ta.removeEventListener("input", onInput);
                if (onKeyDown) ta.removeEventListener("keydown", onKeyDown);
                if (onCompositionStart) ta.removeEventListener("compositionstart", onCompositionStart);
                if (onCompositionEnd) ta.removeEventListener("compositionend", onCompositionEnd);
                ta.remove();
            }
            if (onSelChange) document.removeEventListener("selectionchange", onSelChange);
            if (pollId !== null) window.clearInterval(pollId);
            ta = null;
            host = null;
            handlersRef = null;
            composing = false;
            lastText = "";
            pollId = null;
            onInput = null;
            onKeyDown = null;
            onCompositionStart = null;
            onCompositionEnd = null;
            onSelChange = null;
        },

        syncText(fullText: string) {
            lastText = fullText;
            // 외부 모델 변경(undo/paste 등)을 textarea 에 반영. 조합 중에는 건드리지 않는다(IME 보호).
            if (ta && !composing && ta.value !== fullText) {
                ta.value = fullText;
            }
        },

        syncSelection(start: number, end: number) {
            selStart = Math.min(start, end);
            selEnd = Math.max(start, end);
            if (ta && !composing) {
                const len = ta.value.length;
                try {
                    ta.setSelectionRange(Math.min(selStart, len), Math.min(selEnd, len));
                } catch {
                    // 값 변동 중 — 무시(다음 동기에서 회복).
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
            ta?.focus();
        },

        updateControlBounds() {
            // textarea 경로는 제어 영역 경계 불필요(EditContext 전용) — no-op.
        },
    };
}
