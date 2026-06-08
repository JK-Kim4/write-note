import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { ConflictError } from "@/lib/api/client";
import { documents } from "./documents";

/** webElectronApi.documents 매핑 — HTTP 경계만 msw mock. */
const ORIGIN = "http://localhost:3000";

describe("webElectronApi.documents", () => {
    it("getByProject — body 를 bodyJson 으로 매핑해 반환한다", async () => {
        server.use(
            http.get(`${ORIGIN}/api/projects/7/document`, () =>
                HttpResponse.json({
                    success: true,
                    data: { id: 70, projectId: 7, title: "초고", body: '{"type":"doc"}', wordCount: 12, version: 3, updatedAt: "2026-06-08T00:00:00Z" },
                    error: null,
                }),
            ),
        );

        const doc = await documents.getByProject(7);

        expect(doc.id).toBe(70);
        expect(doc.bodyJson).toBe('{"type":"doc"}');
        expect(doc.version).toBe(3);
    });

    it("update — 저장 충돌(409 DOCUMENT_VERSION_CONFLICT)은 ConflictError 로 전파된다", async () => {
        server.use(
            http.put(`${ORIGIN}/api/documents/70`, () =>
                HttpResponse.json(
                    {
                        success: false,
                        data: { currentVersion: 5, currentBody: '{"type":"doc","v":5}' },
                        error: { code: "DOCUMENT_VERSION_CONFLICT", message: "충돌" },
                    },
                    { status: 409 },
                ),
            ),
        );

        await expect(documents.update(70, { bodyJson: '{"type":"doc"}', version: 3 })).rejects.toBeInstanceOf(ConflictError);
    });
});
