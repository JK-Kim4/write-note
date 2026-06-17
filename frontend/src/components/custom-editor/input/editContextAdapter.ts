/**
 * EditContext 입력 어댑터 — 데스크탑·안드 Chromium(121+).
 *
 * `CustomEditor.tsx` 마운트 effect 의 EditContext 결합부(new EditContext / host.editContext /
 * textupdate / compositionstart·end / updateText·updateSelection·updateControlBounds)를 이동해
 * InputAdapter 를 구현한다. 동작 보존(무회귀) — 기존 EditContext 동작과 1:1.
 *
 * 책임: 텍스트 입력(textupdate)·IME 조합(compositionstart/end)만. copy/cut/paste·keydown(Enter/
 * Backspace/화살표)은 CustomEditor 가 host 이벤트로 직접 처리(어댑터 무관).
 */

import type { InputAdapter, InputHandlers } from "./inputAdapter";

export function createEditContextAdapter(): InputAdapter {
    let ec: EditContext | null = null;
    let host: HTMLElement | null = null;
    // 조합(IME) 상태 — compositionstart/end 로 추적(keydown e.isComposing 은 EditContext 에서 미설정).
    let composing = false;
    let onText: ((e: Event) => void) | null = null;
    let onCompositionStart: (() => void) | null = null;
    let onCompositionEnd: (() => void) | null = null;

    return {
        attach(h, handlers: InputHandlers) {
            host = h;
            const ctx = new EditContext();
            ec = ctx;
            h.editContext = ctx;

            onText = (e: Event) => {
                const te = e as TextUpdateEvent;
                handlers.onTextUpdate({
                    rangeStart: te.updateRangeStart,
                    rangeEnd: te.updateRangeEnd,
                    text: te.text,
                    selectionStart: te.selectionStart,
                    selectionEnd: te.selectionEnd,
                });
            };
            onCompositionStart = () => {
                composing = true;
                handlers.onCompositionStart();
            };
            onCompositionEnd = () => {
                composing = false;
                handlers.onCompositionEnd(ctx.selectionStart, ctx.selectionEnd);
            };
            ctx.addEventListener("textupdate", onText);
            ctx.addEventListener("compositionstart", onCompositionStart);
            ctx.addEventListener("compositionend", onCompositionEnd);
        },

        detach() {
            if (ec) {
                if (onText) ec.removeEventListener("textupdate", onText);
                if (onCompositionStart) ec.removeEventListener("compositionstart", onCompositionStart);
                if (onCompositionEnd) ec.removeEventListener("compositionend", onCompositionEnd);
            }
            if (host) host.editContext = null;
            ec = null;
            host = null;
            composing = false;
            onText = null;
            onCompositionStart = null;
            onCompositionEnd = null;
        },

        syncText(fullText: string) {
            if (ec) ec.updateText(0, ec.text.length, fullText);
        },

        syncSelection(start: number, end: number) {
            if (ec) ec.updateSelection(Math.min(start, end), Math.max(start, end));
        },

        getText() {
            return ec?.text ?? "";
        },

        getSelection() {
            return { start: ec?.selectionStart ?? 0, end: ec?.selectionEnd ?? 0 };
        },

        isComposing() {
            return composing;
        },

        updateControlBounds(bounds: DOMRect) {
            if (ec) ec.updateControlBounds(bounds);
        },
    };
}
