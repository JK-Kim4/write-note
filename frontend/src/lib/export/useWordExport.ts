"use client";
import { useCallback } from "react";
import { collectChapters } from "./collectChapters";
import { getDocument } from "@/lib/api/document";
import { buildExportDoc } from "./exportDoc";
import { exportWord, downloadBlob } from "@/lib/api/export";
import type { PaperSize } from "@/components/editor/pageLayout";
import type { ExportRequest } from "@/components/export/ExportDialog";

/** 워드(HWPX/DOCX) 내보내기 핸들러. A·B 집필실 공유. */
export function useWordExport(projectId: number, paperSize: PaperSize) {
    return useCallback(
        async (format: "hwpx" | "docx", req: ExportRequest) => {
            const data = await collectChapters(req.orderedIds, getDocument);
            const doc = buildExportDoc(data, paperSize, req.joinMode);
            const { blob, filename } = await exportWord(projectId, format, doc);
            downloadBlob(blob, filename);
        },
        [projectId, paperSize],
    );
}
