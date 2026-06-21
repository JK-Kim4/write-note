import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PrintOverlay } from "./PrintOverlay";
import type { DocModel } from "@/components/custom-editor/model";

const models: DocModel[] = [{ buffer: "본문", blockAttrs: [{ type: "paragraph" }], markRuns: [[{ len: 2, mask: 0 }]] }];

// jsdom 은 Range.prototype.getBoundingClientRect 를 미구현 → PrintDocument 의 relayout 이 죽는다.
// PrintDocument.test.tsx 와 동일하게 0-rect 스텁 설치(픽셀 정합은 PoC dogfooding).
const STUB_RECT: DOMRect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
let _origGetBCR: (() => DOMRect) | undefined;
beforeEach(() => {
  _origGetBCR = Range.prototype.getBoundingClientRect;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Range.prototype as any).getBoundingClientRect = () => STUB_RECT;
  window.print = vi.fn();
});
afterEach(() => {
  if (_origGetBCR !== undefined) Range.prototype.getBoundingClientRect = _origGetBCR;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  else delete (Range.prototype as any).getBoundingClientRect;
});

describe("PrintOverlay", () => {
  it("마운트 시 window.print 를 호출한다", () => {
    render(<PrintOverlay models={models} paperSize="A4" onDone={vi.fn()} />);
    expect(window.print).toHaveBeenCalledTimes(1);
  });
  it("본문을 렌더한다", () => {
    render(<PrintOverlay models={models} paperSize="A4" onDone={vi.fn()} />);
    expect(screen.getByText("본문")).toBeInTheDocument();
  });
});
