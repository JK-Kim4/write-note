import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { server } from "@/test/msw/server";
import { useAutoSave } from "./useAutoSave";

/**
 * useAutoSave 행위 테스트 (006 T008).
 *
 * - debounceMs=0 주입으로 fake timer 없이 즉시 트리거
 * - 성공 시 version/wordCount 동기화
 * - 409 시 ConflictError → conflict 상태 노출 (자동 덮어쓰기 금지)
 *
 * debounce 800ms 자체 검증은 단위 테스트 특성상 0ms 주입으로 대체.
 * 실제 800ms 동작은 통합/E2E 레벨에서 검증.
 */

const ORIGIN = "http://localhost:3000";
const DOC_ID = 1;
const BODY = JSON.stringify({ type: "doc", content: [] });

describe("useAutoSave", () => {
    it("마운트 후 PUT 을 호출하고 status 가 saved 가 된다", async () => {
        let called = false;
        server.use(
            http.put(`${ORIGIN}/api/documents/${DOC_ID}`, () => {
                called = true;
                return HttpResponse.json({
                    success: true,
                    data: { id: DOC_ID, body: BODY, wordCount: 0, version: 2, updatedAt: "2024-01-01T00:00:00Z" },
                    error: null,
                });
            }),
        );

        const { result } = renderHook(() =>
            useAutoSave({ documentId: DOC_ID, body: BODY, version: 1 }, 0),
        );

        await waitFor(() => expect(called).toBe(true));
        expect(result.current.status).toBe("saved");
    });

    it("저장 성공 시 syncedVersion 이 응답 version 으로 업데이트된다", async () => {
        server.use(
            http.put(`${ORIGIN}/api/documents/${DOC_ID}`, () =>
                HttpResponse.json({
                    success: true,
                    data: { id: DOC_ID, body: BODY, wordCount: 5, version: 3, updatedAt: "2024-01-01T00:00:00Z" },
                    error: null,
                }),
            ),
        );

        const { result } = renderHook(() =>
            useAutoSave({ documentId: DOC_ID, body: BODY, version: 2 }, 0),
        );

        await waitFor(() => expect(result.current.syncedVersion).toBe(3));
        expect(result.current.wordCount).toBe(5);
    });

    it("409 응답 시 status 가 conflict 가 되고 conflict 데이터를 노출한다", async () => {
        let callCount = 0;
        server.use(
            http.put(`${ORIGIN}/api/documents/${DOC_ID}`, () => {
                callCount += 1;
                return HttpResponse.json(
                    {
                        success: false,
                        data: { code: "DOCUMENT_VERSION_CONFLICT", currentVersion: 5, currentBody: BODY },
                        error: { code: "DOCUMENT_VERSION_CONFLICT", message: "충돌" },
                    },
                    { status: 409 },
                );
            }),
        );

        const { result } = renderHook(() =>
            useAutoSave({ documentId: DOC_ID, body: BODY, version: 1 }, 0),
        );

        await waitFor(() => expect(result.current.status).toBe("conflict"));

        // conflict 중에는 debounce 재트리거 X (body 변경 없으므로 추가 호출 X)
        expect(callCount).toBe(1);
        expect(result.current.conflict?.currentVersion).toBe(5);
        expect(result.current.conflict?.currentBody).toBe(BODY);
    });

    it("409 후 dismissConflict 호출 시 conflict 가 해제된다", async () => {
        server.use(
            http.put(`${ORIGIN}/api/documents/${DOC_ID}`, () =>
                HttpResponse.json(
                    {
                        success: false,
                        data: { code: "DOCUMENT_VERSION_CONFLICT", currentVersion: 5, currentBody: BODY },
                        error: { code: "DOCUMENT_VERSION_CONFLICT", message: "충돌" },
                    },
                    { status: 409 },
                ),
            ),
        );

        const { result } = renderHook(() =>
            useAutoSave({ documentId: DOC_ID, body: BODY, version: 1 }, 0),
        );

        await waitFor(() => expect(result.current.status).toBe("conflict"));

        act(() => {
            result.current.dismissConflict();
        });

        expect(result.current.status).toBe("idle");
        expect(result.current.conflict).toBeNull();
    });
});
