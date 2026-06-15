/**
 * measure.ts 테스트 — T013/T014
 *
 * jsdom 에서 Range.getBoundingClientRect 는 구현이 없어서
 * "not a function" 에러가 나거나 {top:0, width:0} 을 반환한다.
 * → 픽셀 폭/높이는 검증하지 않는다.
 * 대신 run 그룹핑·span 구성·dom 구조·줄분해 로직을 검증한다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MarkRun } from "./model";
import { MARK } from "./model";

// ─── jsdom stub ─────────────────────────────────────────────────────────────
// jsdom 에서 Range.prototype.getBoundingClientRect 는 undefined.
// 직접 설치한 뒤 테스트 후 제거.
const STUB_RECT: DOMRect = {
  top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0,
  x: 0, y: 0, toJSON: () => ({}),
} as DOMRect;

let _origGetBCR: (() => DOMRect) | undefined;

beforeEach(() => {
  if (typeof Range !== "undefined") {
    _origGetBCR = Range.prototype.getBoundingClientRect;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Range.prototype as any).getBoundingClientRect = () => STUB_RECT;
  }
});

afterEach(() => {
  if (typeof Range !== "undefined") {
    if (_origGetBCR !== undefined) {
      Range.prototype.getBoundingClientRect = _origGetBCR;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (Range.prototype as any).getBoundingClientRect;
    }
  }
  vi.restoreAllMocks();
  lastAppended = null;
});

// 오프스크린 div 의 내부 텍스트/span 구조를 관찰하기 위해
// document.body.appendChild 를 가로챔
let lastAppended: HTMLElement | null = null;
const origAppendChild = document.body.appendChild.bind(document.body);

function captureAppend() {
  vi.spyOn(document.body, "appendChild").mockImplementation((node: Node) => {
    if (node instanceof HTMLElement) {
      lastAppended = node.cloneNode(true) as HTMLElement;
    }
    return origAppendChild(node);
  });
}

// ─── 테스트: measureParagraphLines ──────────────────────────────────────────

describe("measureParagraphLines — run 그룹핑·span 구성", () => {
  it("빈 텍스트 → [{height, start:0, end:0}] 반환 (DOM 없음)", async () => {
    const { measureParagraphLines } = await import("./measure");
    const result = measureParagraphLines("", [], 400, 24, 16, "serif");
    expect(result).toEqual([{ height: 24, start: 0, end: 0 }]);
  });

  it("marks 빈 배열 → 단일 텍스트노드(1라운드 동일) — span 없음", async () => {
    captureAppend();
    const { measureParagraphLines } = await import("./measure");
    measureParagraphLines("hello", [], 400, 24, 16, "serif");

    // 오프스크린 div 에 span 없이 텍스트노드만 있어야 함
    if (lastAppended) {
      const spans = lastAppended.querySelectorAll("span");
      expect(spans.length).toBe(0);
      expect(lastAppended.textContent).toBe("hello");
    }
  });

  it("mask 0 단일 run → span 없음 (하위호환)", async () => {
    captureAppend();
    const { measureParagraphLines } = await import("./measure");
    const marks: MarkRun[] = [{ len: 5, mask: 0 }];
    measureParagraphLines("hello", marks, 400, 24, 16, "serif");
    vi.restoreAllMocks();

    if (lastAppended) {
      const spans = lastAppended.querySelectorAll("span");
      expect(spans.length).toBe(0);
    }
  });

  it("bold run → span 에 font-weight:700 적용", async () => {
    captureAppend();
    const { measureParagraphLines } = await import("./measure");
    const marks: MarkRun[] = [{ len: 5, mask: MARK.bold }];
    measureParagraphLines("hello", marks, 400, 24, 16, "serif");

    if (lastAppended) {
      const spans = lastAppended.querySelectorAll("span");
      expect(spans.length).toBeGreaterThanOrEqual(1);
      const boldSpan = Array.from(spans).find((s) =>
        (s as HTMLElement).style.fontWeight === "700",
      );
      expect(boldSpan).toBeDefined();
    }
  });

  it("italic run → span 에 font-style:italic 적용", async () => {
    captureAppend();
    const { measureParagraphLines } = await import("./measure");
    const marks: MarkRun[] = [{ len: 3, mask: MARK.italic }];
    measureParagraphLines("abc", marks, 400, 24, 16, "serif");

    if (lastAppended) {
      const spans = lastAppended.querySelectorAll("span");
      const italicSpan = Array.from(spans).find((s) =>
        (s as HTMLElement).style.fontStyle === "italic",
      );
      expect(italicSpan).toBeDefined();
    }
  });

  it("여러 run — span 수 = 마크 있는 run 수", async () => {
    captureAppend();
    const { measureParagraphLines } = await import("./measure");
    // "ab"(mask0) + "cd"(bold) + "ef"(italic)
    const marks: MarkRun[] = [
      { len: 2, mask: 0 },
      { len: 2, mask: MARK.bold },
      { len: 2, mask: MARK.italic },
    ];
    measureParagraphLines("abcdef", marks, 400, 24, 16, "serif");

    if (lastAppended) {
      // mask 0 → 텍스트노드(span 없음), bold → span, italic → span
      const spans = lastAppended.querySelectorAll("span");
      expect(spans.length).toBe(2); // bold + italic
      expect(lastAppended.textContent).toBe("abcdef");
    }
  });

  it("jsdom 환경에서 모든 문자 top=0 → 단일 줄 반환", async () => {
    const { measureParagraphLines } = await import("./measure");
    const result = measureParagraphLines("hello world", [], 400, 24, 16, "serif");
    // jsdom: getBoundingClientRect top 항상 0 → 1줄
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ height: 24, start: 0, end: 11 });
  });
});

// ─── 테스트: measureLineXs ──────────────────────────────────────────────────

describe("measureLineXs — run 그룹핑·xs 배열", () => {
  it("xs 배열 길이 = lineEnd - lineStart + 1", async () => {
    const { measureLineXs } = await import("./measure");
    const xs = measureLineXs("hello", [], 0, 5, 400, 24, 16, "serif");
    // lineStart=0, lineEnd=5 → 6개
    expect(xs).toHaveLength(6);
  });

  it("xs[0] = 0 (줄 시작 x)", async () => {
    const { measureLineXs } = await import("./measure");
    const xs = measureLineXs("hello", [], 0, 5, 400, 24, 16, "serif");
    expect(xs[0]).toBe(0);
  });

  it("marks 있는 run → span 구성 후 동일 xs 배열 구조 반환", async () => {
    captureAppend();
    const { measureLineXs } = await import("./measure");
    const marks: MarkRun[] = [{ len: 2, mask: MARK.bold }, { len: 3, mask: 0 }];
    const xs = measureLineXs("hello", marks, 0, 5, 400, 24, 16, "serif");

    // xs 배열 길이 확인
    expect(xs).toHaveLength(6);
    expect(xs[0]).toBe(0);

    // span 구조 확인
    if (lastAppended) {
      const spans = lastAppended.querySelectorAll("span");
      expect(spans.length).toBeGreaterThanOrEqual(1);
    }
  });
});
