"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PrintDocument } from "./PrintDocument";
import type { PaperSize as LayoutPaperSize } from "@/components/editor/pageLayout";
import type { DocModel } from "@/components/custom-editor/model";

type Props = { models: DocModel[]; paperSize: LayoutPaperSize; lined: boolean; onDone: () => void };

/**
 * 인쇄 문서를 마운트하고 즉시 window.print() 를 띄운 뒤, afterprint 에서 onDone(언마운트)을 호출.
 *
 * createPortal 로 document.body 직속 렌더 — globals.css 의
 * `@media print { body > *:not(.print-root) { display:none } }` 는 print-root 가 body 직속일 때만 산다.
 * 컴포넌트 트리 안(body > #__next > …)에 두면 인쇄 시 루트 div 가 숨겨지며 print-root 도 함께 사라져
 * 빈 페이지가 된다(2026-06-16 dogfooding).
 */
export function PrintOverlay({ models, paperSize, lined, onDone }: Props) {
  // print 는 1회만 — dev StrictMode 이중 effect 로 window.print() 가 두 번 호출돼
  // 취소 시 인쇄창이 또 뜨는 것 방지(2026-06-16 dogfooding). 리스너는 매 effect 정상 관리.
  const printedRef = useRef(false);
  useEffect(() => {
    const after = () => onDone();
    window.addEventListener("afterprint", after);
    if (!printedRef.current) {
      printedRef.current = true;
      window.print();
    }
    return () => window.removeEventListener("afterprint", after);
  }, [onDone]);

  return createPortal(
    <PrintDocument models={models} paperSize={paperSize} lined={lined} />,
    document.body,
  );
}
