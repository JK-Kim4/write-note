"use client";
import { useCallback } from "react";
import { collectChapters } from "./collectChapters";
import { getDocument } from "@/lib/api/document";
import { buildPlainText, buildExportJson } from "./textExport";
import { downloadBlob } from "@/lib/api/export";
import type { ExportRequest } from "@/components/export/ExportDialog";

/** txt·json 내보내기 핸들러(031) — 백엔드 없이 클라이언트에서 생성·다운로드. */
export function useTextExport(projectTitle: string) {
    return useCallback(
        async (format: "txt" | "json", req: ExportRequest) => {
            const data = await collectChapters(req.orderedIds, getDocument);
            const safeTitle = (projectTitle.trim() || "export").replace(/[/\\?%*:|"<>]/g, "_");
            if (format === "txt") {
                const text = buildPlainText(data, req.joinMode);
                downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${safeTitle}.txt`);
            } else {
                const json = buildExportJson(data);
                downloadBlob(new Blob([json], { type: "application/json;charset=utf-8" }), `${safeTitle}.json`);
            }
        },
        [projectTitle],
    );
}
