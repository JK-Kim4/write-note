import { describe, expect, it } from "vitest";
import { collectSeriesOrderedIds } from "./seriesExport";
import type { DocumentResponse } from "@/types/api";

function doc(projectId: number, docId: number): DocumentResponse {
    return {
        id: docId, projectId, title: `작품${projectId}`, body: '{"type":"doc","content":[]}',
        wordCount: 0, version: "2026-06-23T00:00:00Z", updatedAt: "2026-06-23T00:00:00Z",
    };
}

describe("collectSeriesOrderedIds", () => {
    it("projectId 순서 그대로 documentId 배열로 변환한다", async () => {
        const docs: Record<number, DocumentResponse> = { 11: doc(11, 101), 22: doc(22, 202), 33: doc(33, 303) };
        const orderedIds = await collectSeriesOrderedIds([33, 11, 22], (pid) => Promise.resolve(docs[pid]));
        expect(orderedIds).toEqual([303, 101, 202]);
    });

    it("빈 선택이면 빈 배열", async () => {
        const orderedIds = await collectSeriesOrderedIds([], () => Promise.reject(new Error("불려선 안 됨")));
        expect(orderedIds).toEqual([]);
    });
});
