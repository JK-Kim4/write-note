/**
 * 임시 — EditContext API 최소 타입 선언. TS lib.dom 에 아직 미포함(Chromium 121+ 전용).
 * TODO(024): lib.dom 에 EditContext 정식 편입되면 본 파일 제거.
 */

interface TextUpdateEvent extends Event {
    readonly updateRangeStart: number;
    readonly updateRangeEnd: number;
    readonly text: string;
    readonly selectionStart: number;
    readonly selectionEnd: number;
}

interface CharacterBoundsUpdateEvent extends Event {
    readonly rangeStart: number;
    readonly rangeEnd: number;
}

interface EditContextInit {
    text?: string;
    selectionStart?: number;
    selectionEnd?: number;
}

declare class EditContext extends EventTarget {
    constructor(options?: EditContextInit);
    readonly text: string;
    readonly selectionStart: number;
    readonly selectionEnd: number;
    updateText(rangeStart: number, rangeEnd: number, text: string): void;
    updateSelection(start: number, end: number): void;
    updateControlBounds(controlBounds: DOMRect): void;
    updateSelectionBounds(selectionBounds: DOMRect): void;
    updateCharacterBounds(rangeStart: number, characterBounds: DOMRect[]): void;
}

interface HTMLElement {
    editContext: EditContext | null;
}
