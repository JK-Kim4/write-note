import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useWordExport } from "./useWordExport";

const exportWordMock = vi.fn();
const downloadBlobMock = vi.fn();
vi.mock("@/lib/api/export", () => ({
    exportWord: (...args: unknown[]) => exportWordMock(...args),
    downloadBlob: (...args: unknown[]) => downloadBlobMock(...args),
}));
vi.mock("@/lib/api/document", () => ({
    getDocument: (id: number) => Promise.resolve({ id, projectId: 1, title: "t", body: '{"type":"doc","content":[]}', wordCount: 0, version: "v", updatedAt: "v" }),
}));

describe("useWordExport — downloadName override", () => {
    beforeEach(() => { exportWordMock.mockReset(); downloadBlobMock.mockReset(); exportWordMock.mockResolvedValue({ blob: new Blob(["x"]), filename: "be-name.docx" }); });

    it("downloadName 있으면 시리즈명으로 다운로드한다", async () => {
        const { result } = renderHook(() => useWordExport(7, "A4", "나의 시리즈"));
        await result.current("docx", { orderedIds: [101], joinMode: "page-title" });
        expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), "나의 시리즈.docx");
    });

    it("downloadName 없으면 BE filename 유지", async () => {
        const { result } = renderHook(() => useWordExport(7, "A4"));
        await result.current("docx", { orderedIds: [101], joinMode: "page-title" });
        expect(downloadBlobMock).toHaveBeenCalledWith(expect.any(Blob), "be-name.docx");
    });
});
