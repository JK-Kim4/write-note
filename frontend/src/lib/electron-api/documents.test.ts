import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { ConflictError } from "@/lib/api/client";
import { documents } from "./documents";

/** webElectronApi.documents 매핑 — HTTP 경계만 msw mock. */
const ORIGIN = "http://localhost:3000";

describe("webElectronApi.documents", () => {
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

        await expect(documents.update(70, { bodyJson: '{"type":"doc"}', version: "3" })).rejects.toBeInstanceOf(ConflictError);
    });
});
