// EditContext API 최소 ambient 선언 (TS 5.9 lib.dom 미포함). PoC 용도.
interface TextUpdateEvent extends Event {
  readonly text: string;
  readonly updateRangeStart: number;
  readonly updateRangeEnd: number;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

interface TextFormat {
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly underlineStyle: string;
  readonly underlineThickness: string;
}

interface TextFormatUpdateEvent extends Event {
  getTextFormats(): TextFormat[];
}

interface CharacterBoundsUpdateEvent extends Event {
  readonly rangeStart: number;
  readonly rangeEnd: number;
}

interface EditContextEventMap {
  textupdate: TextUpdateEvent;
  textformatupdate: TextFormatUpdateEvent;
  characterboundsupdate: CharacterBoundsUpdateEvent;
  compositionstart: Event;
  compositionend: Event;
}

declare class EditContext extends EventTarget {
  constructor(options?: { text?: string; selectionStart?: number; selectionEnd?: number });
  text: string;
  selectionStart: number;
  selectionEnd: number;
  updateText(rangeStart: number, rangeEnd: number, text: string): void;
  updateSelection(start: number, end: number): void;
  updateControlBounds(rect: DOMRect): void;
  updateSelectionBounds(rect: DOMRect): void;
  updateCharacterBounds(rangeStart: number, bounds: DOMRect[]): void;
  addEventListener<K extends keyof EditContextEventMap>(
    type: K,
    listener: (ev: EditContextEventMap[K]) => void,
  ): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

interface HTMLElement {
  editContext?: EditContext | null;
}
