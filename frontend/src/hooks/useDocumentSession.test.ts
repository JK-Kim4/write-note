import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { server } from "@/test/msw/server";
import { readDraft, writeDraft } from "@/lib/draftStore";
import { useDocumentSession } from "./useDocumentSession";

/**
 * useDocumentSession 행위 테스트 (016 US1 / T013).
 *
 * 시스템 경계(HTTP)만 msw 로 mock. 세션이 version 토큰의 단독 소유자임을 검증한다.
 * - 진입 1회 로드(편집 없으면 PUT 0)
 * - 타자 → draft 즉시 dirty 기록
 * - 하이브리드 멈춤 트리거 → PUT 1회 → 200 시 세션 version 전진 + draft dirty:false
 * - 편집 중 serverVersion prop 이 stale 로 바뀌어도 세션 version 불변(거짓충돌 회귀)
 * - in-flight 저장 가드(겹친 저장 직렬화)
 *
 * version 은 불투명 토큰 — 서버는 임의 문자열을 발급한다(클라는 파싱·증감하지 않음).
 */

const ORIGIN = "http://localhost:3000";
const DOC_ID = 540;
const PROJECT_ID = 10;
const SERVER_BODY = JSON.stringify({ type: "doc", content: [] });
const SERVER_VERSION = "2026-06-09T00:00:00Z";

/** version 토큰을 추적하는 PUT 핸들러. 토큰 일치 시 새 토큰 발급(성공), 불일치 시 409. */
function trackingPutHandler() {
    let serverToken = SERVER_VERSION;
    let savedBody = SERVER_BODY;
    let n = 0;
    let callCount = 0;
    server.use(
        http.put(`${ORIGIN}/api/documents/${DOC_ID}`, async ({ request }) => {
            callCount += 1;
            const { body, version } = (await request.json()) as { body: string; version: string };
            if (version !== serverToken) {
                return HttpResponse.json(
                    {
                        success: false,
                        data: { code: "DOCUMENT_VERSION_CONFLICT", currentVersion: serverToken, currentBody: savedBody },
                        error: { code: "DOCUMENT_VERSION_CONFLICT", message: "충돌" },
                    },
                    { status: 409 },
                );
            }
            n += 1;
            serverToken = `t${n}`;
            savedBody = body;
            return HttpResponse.json({
                success: true,
                data: { id: DOC_ID, body, wordCount: body.length, version: serverToken, updatedAt: serverToken },
                error: null,
            });
        }),
    );
    return {
        get callCount() {
            return callCount;
        },
    };
}

const baseParams = {
    documentId: DOC_ID,
    projectId: PROJECT_ID,
    serverBody: SERVER_BODY,
    serverVersion: SERVER_VERSION,
    body: SERVER_BODY,
};

const FAST = { debounceMs: 5, maxIntervalMs: 50 };

describe("useDocumentSession", () => {
    afterEach(() => {
        if (typeof localStorage !== "undefined") localStorage.clear();
    });

    it("편집이 없으면 진입 시 서버 저장(PUT)을 호출하지 않는다", async () => {
        const tracker = trackingPutHandler();
        renderHook(() => useDocumentSession(baseParams, FAST));
        await new Promise((r) => setTimeout(r, 40));
        expect(tracker.callCount).toBe(0);
    });

    it("타자 시 draft 에 dirty 로 즉시 기록한다(baseVersion = 세션 토큰)", async () => {
        trackingPutHandler();
        const { rerender } = renderHook((props) => useDocumentSession(props, FAST), {
            initialProps: baseParams,
        });
        rerender({ ...baseParams, body: "EDITED-1" });
        await waitFor(() => expect(readDraft(DOC_ID)?.dirty).toBe(true));
        expect(readDraft(DOC_ID)?.body).toBe("EDITED-1");
        expect(readDraft(DOC_ID)?.baseVersion).toBe(SERVER_VERSION);
    });

    it("타자 멈춤 후 PUT 1회 + 200 시 세션 version 전진 + draft dirty:false", async () => {
        trackingPutHandler();
        const { result, rerender } = renderHook((props) => useDocumentSession(props, FAST), {
            initialProps: baseParams,
        });
        rerender({ ...baseParams, body: "EDITED-2" });

        await waitFor(() => expect(result.current.version).toBe("t1"));
        expect(result.current.syncStatus).toBe("synced");
        // 추가 입력 없이 깨끗이 동기화됨 → 로컬 draft 정리(서버가 최신).
        expect(readDraft(DOC_ID)).toBeNull();
    });

    it("편집 중 serverVersion prop 이 stale 로 바뀌어도 세션 version 을 되돌리지 않는다(거짓충돌 회귀)", async () => {
        trackingPutHandler();
        const { result, rerender } = renderHook((props) => useDocumentSession(props, FAST), {
            initialProps: baseParams,
        });

        // 1차 편집 → 저장 → 세션 토큰 t1
        rerender({ ...baseParams, body: "EDIT-A" });
        await waitFor(() => expect(result.current.version).toBe("t1"));

        // 끼어든 GET 모사: serverVersion prop 이 과거 토큰으로 재동기화됨
        rerender({ ...baseParams, serverVersion: SERVER_VERSION, body: "EDIT-A" });
        await new Promise((r) => setTimeout(r, 20));
        // 세션 version 은 t1 유지(과거 토큰으로 회귀 X)
        expect(result.current.version).toBe("t1");

        // 2차 편집 → 세션이 소유한 t1 로 저장 → 거짓충돌 없이 t2
        rerender({ ...baseParams, serverVersion: SERVER_VERSION, body: "EDIT-B" });
        await waitFor(() => expect(result.current.version).toBe("t2"));
        expect(result.current.syncStatus).toBe("synced");
    });

    it("in-flight 저장 가드 — 저장 중 추가 편집은 큐잉되어 직렬 저장되고 충돌하지 않는다", async () => {
        trackingPutHandler();
        const { result, rerender } = renderHook((props) => useDocumentSession(props, FAST), {
            initialProps: baseParams,
        });

        // 빠른 연속 편집 — 저장이 겹치면 stale version 으로 두 번째가 409 가 날 위험
        rerender({ ...baseParams, body: "Q-1" });
        rerender({ ...baseParams, body: "Q-2" });
        rerender({ ...baseParams, body: "Q-3" });

        // 최종적으로 세션 토큰이 전진하고 충돌 상태가 아니어야 한다(직렬 저장 성공)
        await waitFor(() => expect(result.current.version).not.toBe(SERVER_VERSION));
        expect(result.current.syncStatus).toBe("synced");
        // 최신 본문이 결국 동기화되어 draft 가 정리됨(미동기화 잔여 없음).
        await waitFor(() => expect(readDraft(DOC_ID)).toBeNull());
    });
});

describe("useDocumentSession — localStorage-first 자동 복원(US2)", () => {
    afterEach(() => {
        if (typeof localStorage !== "undefined") localStorage.clear();
    });

    it("진입 시 dirty draft(baseVersion 일치, 서버 본문과 다름)면 restoredBody 로 자동 복원한다", () => {
        writeDraft({
            documentId: DOC_ID,
            projectId: PROJECT_ID,
            body: "RESTORE-ME",
            baseVersion: SERVER_VERSION,
            dirty: true,
            updatedAt: 1,
        });
        // restoredBody 는 동기 계산 — 첫 렌더에서 즉시 사용 가능(에디터 마운트 시점 복원).
        const { result } = renderHook(() => useDocumentSession(baseParams, FAST));
        expect(result.current.restoredBody).toBe("RESTORE-ME");
    });

    it("baseVersion 이 서버 version 과 다르면 restoredBody 없음(충돌 경로)", () => {
        writeDraft({
            documentId: DOC_ID,
            projectId: PROJECT_ID,
            body: "STALE-DRAFT",
            baseVersion: "2020-01-01T00:00:00Z",
            dirty: true,
            updatedAt: 1,
        });
        const { result } = renderHook(() => useDocumentSession(baseParams, FAST));
        expect(result.current.restoredBody).toBeNull();
    });

    it("draft 본문이 서버 본문과 같으면 restoredBody 없음(복원 불필요)", () => {
        writeDraft({
            documentId: DOC_ID,
            projectId: PROJECT_ID,
            body: SERVER_BODY,
            baseVersion: SERVER_VERSION,
            dirty: true,
            updatedAt: 1,
        });
        const { result } = renderHook(() => useDocumentSession(baseParams, FAST));
        expect(result.current.restoredBody).toBeNull();
    });

    it("draft 가 없으면 restoredBody 없음", () => {
        const { result } = renderHook(() => useDocumentSession(baseParams, FAST));
        expect(result.current.restoredBody).toBeNull();
    });

    it("flushDraft 는 setState 없이 draft 를 즉시 기록한다(IME 조합 중·언마운트 보존)", () => {
        const { result } = renderHook(() => useDocumentSession(baseParams, FAST));
        act(() => result.current.flushDraft("조합중-한글"));
        expect(readDraft(DOC_ID)?.body).toBe("조합중-한글");
        expect(readDraft(DOC_ID)?.dirty).toBe(true);
        expect(readDraft(DOC_ID)?.baseVersion).toBe(SERVER_VERSION);
    });

    it("flushDraft 로 보존한 내용은 재진입 시 restoredBody 로 자동 복원된다(조합 중 이동 시나리오)", () => {
        // 1차 세션: 조합 중 내용을 flushDraft 로만 보존(onChange 차단 모사) 후 이탈.
        const first = renderHook(() => useDocumentSession(baseParams, FAST));
        act(() => first.result.current.flushDraft("조합중-한글"));
        first.unmount();
        // 2차 세션(재진입): draft 가 그대로 복원된다.
        const second = renderHook(() => useDocumentSession(baseParams, FAST));
        expect(second.result.current.restoredBody).toBe("조합중-한글");
    });

    it("추가 입력 없이 동기화 성공하면 draft 를 정리한다(서버가 최신)", async () => {
        trackingPutHandler();
        const { rerender } = renderHook((props) => useDocumentSession(props, FAST), {
            initialProps: baseParams,
        });
        rerender({ ...baseParams, body: "ONE-SHOT" });
        await waitFor(() => expect(readDraft(DOC_ID)).toBeNull());
    });
});

describe("useDocumentSession — 진짜 충돌(US3)", () => {
    afterEach(() => {
        if (typeof localStorage !== "undefined") localStorage.clear();
    });

    it("PUT 409 → conflict 상태 노출 + 미동기화 draft 보존(미삭제)", async () => {
        server.use(
            http.put(`${ORIGIN}/api/documents/${DOC_ID}`, () =>
                HttpResponse.json(
                    {
                        success: false,
                        data: { code: "DOCUMENT_VERSION_CONFLICT", currentVersion: "srv-latest", currentBody: "SERVER-LATEST" },
                        error: { code: "DOCUMENT_VERSION_CONFLICT", message: "충돌" },
                    },
                    { status: 409 },
                ),
            ),
        );
        const { result, rerender } = renderHook((props) => useDocumentSession(props, FAST), {
            initialProps: baseParams,
        });
        rerender({ ...baseParams, body: "MY-EDIT" });

        await waitFor(() => expect(result.current.syncStatus).toBe("conflict"));
        expect(result.current.conflict?.currentVersion).toBe("srv-latest");
        expect(result.current.conflict?.currentBody).toBe("SERVER-LATEST");
        // 미동기화 작성분 보존 — draft 가 dirty 로 남아있어야(유실 금지)
        expect(readDraft(DOC_ID)?.dirty).toBe(true);
        expect(readDraft(DOC_ID)?.body).toBe("MY-EDIT");
    });

    it("overwrite(currentVersion) → currentVersion 으로 재저장하여 성공", async () => {
        let serverToken = "srv-ahead";
        let n = 0;
        server.use(
            http.put(`${ORIGIN}/api/documents/${DOC_ID}`, async ({ request }) => {
                const { body, version } = (await request.json()) as { body: string; version: string };
                if (version !== serverToken) {
                    return HttpResponse.json(
                        {
                            success: false,
                            data: { code: "DOCUMENT_VERSION_CONFLICT", currentVersion: serverToken, currentBody: "SRV" },
                            error: { code: "DOCUMENT_VERSION_CONFLICT", message: "충돌" },
                        },
                        { status: 409 },
                    );
                }
                n += 1;
                serverToken = `ow${n}`;
                return HttpResponse.json({
                    success: true,
                    data: { id: DOC_ID, body, wordCount: 0, version: serverToken, updatedAt: serverToken },
                    error: null,
                });
            }),
        );
        const { result, rerender } = renderHook((props) => useDocumentSession(props, FAST), {
            initialProps: baseParams,
        });
        // 세션 토큰(SERVER_VERSION)이 서버(srv-ahead)와 불일치 → 409
        rerender({ ...baseParams, body: "MY-EDIT" });
        await waitFor(() => expect(result.current.syncStatus).toBe("conflict"));

        // 서버 최신 토큰으로 덮어쓰기 → 성공
        act(() => result.current.overwrite("srv-ahead"));
        await waitFor(() => expect(result.current.syncStatus).toBe("synced"));
        expect(result.current.version).toBe("ow1");
        expect(result.current.conflict).toBeNull();
    });

    it("reloadFromServer → 서버 토큰·본문 채택 후 다음 편집이 새 토큰으로 저장된다(재충돌 루프 회귀)", async () => {
        let serverToken = "srv-ahead";
        let conflictCount = 0;
        let n = 0;
        server.use(
            http.put(`${ORIGIN}/api/documents/${DOC_ID}`, async ({ request }) => {
                const { body, version } = (await request.json()) as { body: string; version: string };
                if (version !== serverToken) {
                    conflictCount += 1;
                    return HttpResponse.json(
                        {
                            success: false,
                            data: { code: "DOCUMENT_VERSION_CONFLICT", currentVersion: serverToken, currentBody: "SRV" },
                            error: { code: "DOCUMENT_VERSION_CONFLICT", message: "충돌" },
                        },
                        { status: 409 },
                    );
                }
                n += 1;
                serverToken = `rl${n}`;
                return HttpResponse.json({
                    success: true,
                    data: { id: DOC_ID, body, wordCount: 0, version: serverToken, updatedAt: serverToken },
                    error: null,
                });
            }),
        );
        const { result, rerender } = renderHook((props) => useDocumentSession(props, FAST), {
            initialProps: baseParams,
        });
        // 세션 토큰(SERVER_VERSION)이 서버(srv-ahead)와 불일치 → 409
        rerender({ ...baseParams, body: "MY-EDIT" });
        await waitFor(() => expect(result.current.syncStatus).toBe("conflict"));
        expect(conflictCount).toBe(1);

        // "서버 최신본 불러오기" — 호출자는 본문을 서버 최신으로 교체한다.
        act(() => result.current.reloadFromServer("srv-ahead", "SRV"));
        expect(result.current.conflict).toBeNull();
        expect(result.current.version).toBe("srv-ahead");
        // 내 작성분을 버리고 서버본을 채택했으므로 stale draft 는 정리(재진입 시 옛 본문 복원 방지).
        expect(readDraft(DOC_ID)).toBeNull();

        // 본문이 서버본과 같으므로(채택 직후) 추가 저장 없음 → 재충돌 없음
        rerender({ ...baseParams, body: "SRV" });
        await new Promise((r) => setTimeout(r, 30));
        expect(conflictCount).toBe(1);

        // 다음 편집은 채택한 토큰(srv-ahead)으로 저장 → 409 루프 없이 성공
        rerender({ ...baseParams, body: "AFTER-RELOAD" });
        await waitFor(() => expect(result.current.version).toBe("rl1"));
        expect(result.current.syncStatus).toBe("synced");
        expect(conflictCount).toBe(1);
    });

    it("dismissConflict → conflict 해제", async () => {
        server.use(
            http.put(`${ORIGIN}/api/documents/${DOC_ID}`, () =>
                HttpResponse.json(
                    {
                        success: false,
                        data: { code: "DOCUMENT_VERSION_CONFLICT", currentVersion: "srv-latest", currentBody: "SERVER-LATEST" },
                        error: { code: "DOCUMENT_VERSION_CONFLICT", message: "충돌" },
                    },
                    { status: 409 },
                ),
            ),
        );
        const { result, rerender } = renderHook((props) => useDocumentSession(props, FAST), {
            initialProps: baseParams,
        });
        rerender({ ...baseParams, body: "MY-EDIT" });
        await waitFor(() => expect(result.current.syncStatus).toBe("conflict"));

        act(() => result.current.dismissConflict());
        expect(result.current.conflict).toBeNull();
        expect(result.current.syncStatus).not.toBe("conflict");
    });
});

describe("useDocumentSession — 챕터 전환(방안 A: 리마운트) 거짓 409 회귀", () => {
    /**
     * 버그 재현: 챕터 A(documentId=10, serverVersion="vA")에서 B(documentId=20, serverVersion="vB")로
     * 전환할 때, initRef 가드로 인해 versionRef 가 A 의 토큰으로 남아 B 저장 시 거짓 409 발생.
     *
     * 방안 A 검증: 챕터 전환 = 세션 리마운트(unmount → 새 renderHook).
     * 새 인스턴스는 initRef.current = false → B 의 serverVersion 으로 올바르게 초기화.
     * B 에서 편집 후 PUT 에 "vB" 토큰이 나가야 한다(버그 시 "vA 토큰" → 409).
     */
    afterEach(() => {
        if (typeof localStorage !== "undefined") localStorage.clear();
    });

    it("챕터 A 에서 저장 후 챕터 B 세션을 새로 마운트하면 B 의 version 으로 저장된다(거짓 409 없음)", async () => {
        const DOC_A = 10;
        const DOC_B = 20;
        const VERSION_A = "2026-06-01T00:00:00Z";
        const VERSION_B = "2026-06-02T00:00:00Z";
        const BODY_A = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "챕터A" }] }] });
        const BODY_B = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "챕터B" }] }] });

        // 두 챕터 각각의 서버 토큰 추적
        let tokenA = VERSION_A;
        let tokenB = VERSION_B;
        const capturedVersions: { docId: number; version: string }[] = [];

        server.use(
            http.put(`${ORIGIN}/api/documents/${DOC_A}`, async ({ request }) => {
                const { body, version } = (await request.json()) as { body: string; version: string };
                capturedVersions.push({ docId: DOC_A, version });
                if (version !== tokenA) {
                    return HttpResponse.json(
                        { success: false, data: { code: "DOCUMENT_VERSION_CONFLICT", currentVersion: tokenA, currentBody: BODY_A }, error: { code: "DOCUMENT_VERSION_CONFLICT", message: "충돌" } },
                        { status: 409 },
                    );
                }
                tokenA = `tA-${capturedVersions.length}`;
                return HttpResponse.json({ success: true, data: { id: DOC_A, body, wordCount: 0, version: tokenA, updatedAt: tokenA }, error: null });
            }),
            http.put(`${ORIGIN}/api/documents/${DOC_B}`, async ({ request }) => {
                const { body, version } = (await request.json()) as { body: string; version: string };
                capturedVersions.push({ docId: DOC_B, version });
                if (version !== tokenB) {
                    return HttpResponse.json(
                        { success: false, data: { code: "DOCUMENT_VERSION_CONFLICT", currentVersion: tokenB, currentBody: BODY_B }, error: { code: "DOCUMENT_VERSION_CONFLICT", message: "충돌" } },
                        { status: 409 },
                    );
                }
                tokenB = `tB-${capturedVersions.length}`;
                return HttpResponse.json({ success: true, data: { id: DOC_B, body, wordCount: 0, version: tokenB, updatedAt: tokenB }, error: null });
            }),
        );

        // ── 챕터 A 세션 ──
        const sessionA = renderHook((props) => useDocumentSession(props, FAST), {
            initialProps: { documentId: DOC_A, projectId: PROJECT_ID, serverBody: BODY_A, serverVersion: VERSION_A, body: BODY_A },
        });
        // 챕터 A 에서 편집 → 저장 → 세션 토큰 전진
        sessionA.rerender({ documentId: DOC_A, projectId: PROJECT_ID, serverBody: BODY_A, serverVersion: VERSION_A, body: "챕터A-편집" });
        await waitFor(() => expect(sessionA.result.current.syncStatus).toBe("synced"));
        const advancedTokenA = sessionA.result.current.version;
        expect(advancedTokenA).not.toBe(VERSION_A); // A 토큰이 전진됨

        // 챕터 전환 전 flushDraft (IME 보존 — 방안 A 의 언마운트 직전 시나리오)
        act(() => sessionA.result.current.flushDraft("챕터A-편집"));
        // 챕터 A 세션 언마운트 (방안 A: key 교체로 리마운트 = 언마운트 + 새 마운트)
        sessionA.unmount();

        // ── 챕터 B 세션 (새 인스턴스 — 방안 A 의 핵심) ──
        const sessionB = renderHook((props) => useDocumentSession(props, FAST), {
            initialProps: { documentId: DOC_B, projectId: PROJECT_ID, serverBody: BODY_B, serverVersion: VERSION_B, body: BODY_B },
        });
        // 챕터 B 에서 편집 → 저장
        sessionB.rerender({ documentId: DOC_B, projectId: PROJECT_ID, serverBody: BODY_B, serverVersion: VERSION_B, body: "챕터B-편집" });
        await waitFor(() => expect(sessionB.result.current.syncStatus).toBe("synced"));

        // 검증: B 에 저장된 version 이 B 의 초기 토큰(VERSION_B)이어야 한다.
        // 버그 시: A 의 전진된 토큰(advancedTokenA)이 B 저장에 사용 → 서버가 VERSION_B 기대 → 409.
        const bSaveVersions = capturedVersions.filter((v) => v.docId === DOC_B).map((v) => v.version);
        expect(bSaveVersions.length).toBeGreaterThan(0);
        // 첫 번째 B 저장의 version 은 반드시 VERSION_B 여야 한다(방안 A 정상 경로).
        // 버그 경로라면 advancedTokenA 가 나와서 409 → conflict 상태.
        expect(bSaveVersions[0]).toBe(VERSION_B);
        expect(sessionB.result.current.syncStatus).toBe("synced");
        expect(sessionB.result.current.conflict).toBeNull();

        sessionB.unmount();
    });

    it("같은 세션 인스턴스에서 documentId 만 바꾸면(re-render — 버그 경로) B 저장 시 A 토큰이 나가 409 가 된다", async () => {
        /**
         * 이 테스트는 기존 버그(initRef 가드로 인한 stale versionRef)를 재현한다.
         * 방안 A 이전의 page.tsx 동작: 같은 useDocumentSession 인스턴스에 documentId prop 만 변경.
         * 이 테스트는 "버그가 실재함"을 RED로 확인하는 테스트다.
         * 방안 A 구현 후에도 이 테스트 자체는 여전히 "같은 훅 인스턴스에서는 버그가 있음"을 보여준다.
         * (방안 A 는 리마운트로 이 경로를 아예 피함)
         */
        const DOC_A = 10;
        const DOC_B = 20;
        const VERSION_A = "2026-06-01T00:00:00Z";
        const VERSION_B = "2026-06-02T00:00:00Z";
        const BODY_A = JSON.stringify({ type: "doc", content: [] });
        const BODY_B = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

        let tokenA = VERSION_A;
        let tokenB = VERSION_B;
        const bSaveVersions: string[] = [];

        server.use(
            http.put(`${ORIGIN}/api/documents/${DOC_A}`, async ({ request }) => {
                const { body, version } = (await request.json()) as { body: string; version: string };
                if (version !== tokenA) {
                    return HttpResponse.json({ success: false, data: { code: "DOCUMENT_VERSION_CONFLICT", currentVersion: tokenA, currentBody: BODY_A }, error: { code: "DOCUMENT_VERSION_CONFLICT", message: "충돌" } }, { status: 409 });
                }
                tokenA = "tA1";
                return HttpResponse.json({ success: true, data: { id: DOC_A, body, wordCount: 0, version: tokenA, updatedAt: tokenA }, error: null });
            }),
            http.put(`${ORIGIN}/api/documents/${DOC_B}`, async ({ request }) => {
                const { body, version } = (await request.json()) as { body: string; version: string };
                bSaveVersions.push(version);
                if (version !== tokenB) {
                    return HttpResponse.json({ success: false, data: { code: "DOCUMENT_VERSION_CONFLICT", currentVersion: tokenB, currentBody: BODY_B }, error: { code: "DOCUMENT_VERSION_CONFLICT", message: "충돌" } }, { status: 409 });
                }
                tokenB = "tB1";
                return HttpResponse.json({ success: true, data: { id: DOC_B, body, wordCount: 0, version: tokenB, updatedAt: tokenB }, error: null });
            }),
        );

        // 같은 훅 인스턴스에서 A 로 시작
        const { result, rerender } = renderHook((props) => useDocumentSession(props, FAST), {
            initialProps: { documentId: DOC_A, projectId: PROJECT_ID, serverBody: BODY_A, serverVersion: VERSION_A, body: BODY_A },
        });
        // A 에서 편집 → 저장(A 토큰 전진)
        rerender({ documentId: DOC_A, projectId: PROJECT_ID, serverBody: BODY_A, serverVersion: VERSION_A, body: "A-편집" });
        await waitFor(() => expect(result.current.version).toBe("tA1"));

        // 같은 인스턴스로 documentId 만 B 로 변경 (기존 버그 경로)
        // serverVersion = VERSION_B, serverBody = BODY_B 로 변경 + body 도 B 로 변경해 dirty 발생
        rerender({ documentId: DOC_B, projectId: PROJECT_ID, serverBody: BODY_B, serverVersion: VERSION_B, body: "B-편집" });

        // 버그 분석:
        // - initRef.current = true → initEffect 에서 early return → versionRef 재초기화 안 됨
        // - 그런데 body = "B-편집" ≠ baselineBodyRef(BODY_A) 이므로 dirty
        // - but documentId 가 바뀌면 initRef.current 가 true 여서 body effect 도 early return(if (!initRef.current) return)
        // - 따라서 B 에 편집이 있어도 setTimeout 이 스케줄되지 않아 저장 자체가 안 일어남
        // - page.tsx 에서는 PaperEditor key={editorKey++} 로 에디터만 리마운트 + body setState(null)→(B본문)
        //   → useDocumentSession 은 같은 인스턴스 + body prop 이 변경되어 effect 재실행
        //   → initRef.current = true 이므로 latestBodyRef 는 갱신되지 않음
        //   → 그 뒤 다시 body prop 이 들어와도 latestBodyRef 가 stale A 본문
        // 실제 page.tsx 동작을 모사: body 가 null→B 으로 바뀌는 흐름을 rerender 로 재현
        rerender({ documentId: DOC_B, projectId: PROJECT_ID, serverBody: BODY_B, serverVersion: VERSION_B, body: BODY_B });
        await new Promise((r) => setTimeout(r, 10)); // initRef effect 처리 대기
        // 이제 B 에서 실제 편집
        rerender({ documentId: DOC_B, projectId: PROJECT_ID, serverBody: BODY_B, serverVersion: VERSION_B, body: "B-편집2" });

        await waitFor(() => bSaveVersions.length > 0, { timeout: 200 });

        // 버그: initRef.current = true → B serverVersion(VERSION_B)으로 재초기화 안 됨
        // → versionRef = "tA1"(A 의 전진된 토큰)로 B 저장 → 서버 B 는 VERSION_B 기대 → 409
        // 이 테스트는 버그 경로를 문서화한다.
        // bSaveVersions[0] 이 "tA1"(A 토큰)이면 버그 확인, VERSION_B 이면 의도치 않게 고쳐진 것.
        expect(bSaveVersions[0]).toBe("tA1"); // 버그: A 의 토큰이 B 에 나감
    });
});
