"use client";
import { useState, useCallback } from "react";
import { collectChapters } from "./collectChapters";
import { getDocument } from "@/lib/api/document";
import { mergeChaptersForPrint } from "./mergeChapters";
import type { DocModel } from "@/components/custom-editor/model";
import type { ExportRequest } from "@/components/export/ExportDialog";

/** PDF 내보내기 상태·동작. 두 집필실(A형·B형)이 공유. */
export function usePdfExport() {
  const [printModels, setPrintModels] = useState<DocModel[] | null>(null);

  const exportPdf = useCallback(async (req: ExportRequest) => {
    const data = await collectChapters(req.orderedIds, getDocument);
    setPrintModels(mergeChaptersForPrint(data, req.joinMode));
  }, []);

  const clearPrint = useCallback(() => setPrintModels(null), []);

  return { printModels, exportPdf, clearPrint };
}
