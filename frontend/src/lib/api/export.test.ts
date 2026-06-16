import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportWord } from "./export";
import type { ExportDoc } from "@/lib/export/exportDoc";

const doc: ExportDoc = { paperSize: "A4", joinMode: "body-only", chapters: [{ title: "1장", blocks: [] }] };

describe("exportWord", () => {
    beforeEach(() => {
        vi.stubGlobal(
            "fetch",
            vi.fn(
                async () =>
                    new Response(new Blob(["x"]), {
                        status: 200,
                        headers: { "Content-Disposition": "attachment; filename*=UTF-8''export-9.docx" },
                    }),
            ),
        );
    });
    it("projectId·format 으로 POST 하고 blob·filename 을 반환한다", async () => {
        const { blob, filename } = await exportWord(9, "docx", doc);
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/export/9/docx"), expect.objectContaining({ method: "POST" }));
        expect(blob).toBeInstanceOf(Blob);
        expect(filename).toBe("export-9.docx");
    });
});
