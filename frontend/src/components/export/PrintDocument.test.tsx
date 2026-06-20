import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PrintDocument } from "./PrintDocument";
import type { DocModel } from "@/components/custom-editor/model";

const model: DocModel = { buffer: "안녕하세요", blockAttrs: [{ type: "paragraph" }], markRuns: [[{ len: 5, mask: 0 }]] };

// jsdom 은 Range.prototype.getBoundingClientRect 를 미구현 → relayout(measureParagraphLines)이
// "not a function" 으로 죽는다. measure.test.ts 와 동일하게 0-rect 스텁을 설치(픽셀 정합은 PoC dogfooding).
const STUB_RECT: DOMRect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
let _origGetBCR: (() => DOMRect) | undefined;
beforeEach(() => {
  _origGetBCR = Range.prototype.getBoundingClientRect;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Range.prototype as any).getBoundingClientRect = () => STUB_RECT;
});
afterEach(() => {
  if (_origGetBCR !== undefined) Range.prototype.getBoundingClientRect = _origGetBCR;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  else delete (Range.prototype as any).getBoundingClientRect;
});

describe("PrintDocument", () => {
  it("DocModel 의 본문 텍스트를 렌더한다", () => {
    render(<PrintDocument models={[model]} paperSize="A4" lined={false} />);
    expect(screen.getByText("안녕하세요")).toBeInTheDocument();
  });

  it("print-root 컨테이너로 감싼다", () => {
    const { container } = render(<PrintDocument models={[model]} paperSize="A4" lined={false} />);
    expect(container.querySelector(".print-root")).not.toBeNull();
  });
});
