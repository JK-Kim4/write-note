"use client";
import { useCallback } from "react";
import { collectChapters } from "./collectChapters";
import { getDocument } from "@/lib/api/document";
import { buildExportDoc } from "./exportDoc";
import { exportWord, downloadBlob } from "@/lib/api/export";
import type { PaperSize } from "@/components/editor/pageLayout";
import type { ExportRequest } from "@/components/export/ExportDialog";

/**
 * 워드(HWPX/DOCX) 내보내기 핸들러. A·B 집필실(작품당) + 시리즈 합본 공유.
 * [downloadName] 지정 시 BE 파일명 대신 `${downloadName}.${format}` 로 저장(시리즈명). 미지정 시 BE filename.
 */
export function useWordExport(projectId: number, paperSize: PaperSize, downloadName?: string) {
    return useCallback(
        async (format: "hwpx" | "docx", req: ExportRequest) => {
            const data = await collectChapters(req.orderedIds, getDocument);
            const doc = buildExportDoc(data, paperSize, req.joinMode);
            const { blob, filename } = await exportWord(projectId, format, doc);
            const safe = downloadName?.trim().replace(/[/\\?%*:|"<>]/g, "_");
            downloadBlob(blob, safe ? `${safe}.${format}` : filename);
        },
        [projectId, paperSize, downloadName],
    );
}

/**
 * 훅 밖에서 1회 호출하는 순수 Word 내보내기(시리즈 합본용 — 대표 projectId로 소유권, 파일명은 시리즈명).
 * 시리즈는 제출 시점에 대표 projectId가 정해져 훅(고정 projectId)으로 못 쓰므로 함수로 분리.
 */
export async function exportSeriesWord(
    projectId: number,
    paperSize: PaperSize,
    downloadName: string,
    format: "hwpx" | "docx",
    req: ExportRequest,
): Promise<void> {
    const data = await collectChapters(req.orderedIds, getDocument);
    const doc = buildExportDoc(data, paperSize, req.joinMode);
    const { blob } = await exportWord(projectId, format, doc);
    const safe = downloadName.trim().replace(/[/\\?%*:|"<>]/g, "_") || "series";
    downloadBlob(blob, `${safe}.${format}`);
}
