"use client";
import { useEffect } from "react";
import { PrintDocument } from "./PrintDocument";
import type { PaperSize as LayoutPaperSize } from "@/components/editor/pageLayout";
import type { DocModel } from "@/components/custom-editor/model";

type Props = { models: DocModel[]; paperSize: LayoutPaperSize; lined: boolean; onDone: () => void };

/** 인쇄 문서를 마운트하고 즉시 window.print() 를 띄운 뒤, afterprint 에서 onDone(언마운트)을 호출. */
export function PrintOverlay({ models, paperSize, lined, onDone }: Props) {
  useEffect(() => {
    const after = () => onDone();
    window.addEventListener("afterprint", after);
    window.print();
    return () => window.removeEventListener("afterprint", after);
  }, [onDone]);

  return <PrintDocument models={models} paperSize={paperSize} lined={lined} />;
}
