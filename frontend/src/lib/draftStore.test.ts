import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDraft, readDraft, writeDraft, type Draft } from "./draftStore";

/**
 * draftStore 단위 테스트 (016 US1 / T012).
 *
 * localStorage 작품별 draft CRUD 순수 모듈. 시스템 경계(localStorage)만 실제 사용,
 * SSR 가드·손상 JSON 방어·용량 초과 삼킴·작품별 키 분리를 검증한다.
 */

const newDraft = (overrides: Partial<Draft> = {}): Draft => ({
    documentId: 1,
    projectId: 10,
    body: JSON.stringify({ type: "doc", content: [] }),
    baseVersion: "2026-06-09T00:00:00Z",
    dirty: true,
    updatedAt: 1_700_000_000_000,
    ...overrides,
});

describe("draftStore", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        if (typeof localStorage !== "undefined") localStorage.clear();
    });

    it("기록한 draft 를 그대로 읽어온다", () => {
        const draft = newDraft();
        writeDraft(draft);
        expect(readDraft(1)).toEqual(draft);
    });

    it("draft 가 없으면 null 을 반환한다", () => {
        expect(readDraft(999)).toBeNull();
    });

    it("clearDraft 후에는 null 을 반환한다", () => {
        writeDraft(newDraft());
        clearDraft(1);
        expect(readDraft(1)).toBeNull();
    });

    it("작품(documentId)별로 draft 키가 분리된다", () => {
        writeDraft(newDraft({ documentId: 1, body: "A" }));
        writeDraft(newDraft({ documentId: 2, body: "B" }));
        expect(readDraft(1)?.body).toBe("A");
        expect(readDraft(2)?.body).toBe("B");
        clearDraft(1);
        expect(readDraft(1)).toBeNull();
        expect(readDraft(2)?.body).toBe("B");
    });

    it("손상된 JSON 이 저장돼 있으면 null 로 간주한다", () => {
        localStorage.setItem("wn:draft:doc:1", "{not valid json");
        expect(readDraft(1)).toBeNull();
    });

    it("localStorage 가 없으면(SSR) read 는 null, write/clear 는 throw 하지 않는다", () => {
        vi.stubGlobal("localStorage", undefined);
        expect(readDraft(1)).toBeNull();
        expect(() => writeDraft(newDraft())).not.toThrow();
        expect(() => clearDraft(1)).not.toThrow();
    });

    it("localStorage 쓰기 실패(용량 초과 등)는 삼키고 throw 하지 않는다", () => {
        vi.stubGlobal("localStorage", {
            setItem: () => {
                throw new DOMException("QuotaExceededError");
            },
            getItem: () => null,
            removeItem: () => undefined,
        });
        expect(() => writeDraft(newDraft())).not.toThrow();
    });
});
