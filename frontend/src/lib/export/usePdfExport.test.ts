import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { usePdfExport } from "./usePdfExport";

vi.mock("@/lib/api/document", () => ({
  getDocument: vi.fn(async (id: number) => ({
    id, projectId: 9, title: `${id}장`,
    body: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "본문" }] }] }),
    wordCount: 2, version: "v", updatedAt: "2026-06-16T00:00:00Z",
  })),
}));

describe("usePdfExport", () => {
  it("exportPdf 호출 시 수집·합본해 printModels 를 채운다", async () => {
    const { result } = renderHook(() => usePdfExport());
    expect(result.current.printModels).toBeNull();
    await act(async () => { await result.current.exportPdf({ orderedIds: [1], lined: true, joinMode: "page-title" }); });
    await waitFor(() => expect(result.current.printModels).not.toBeNull());
    expect(result.current.printModels).toHaveLength(1);
    expect(result.current.lined).toBe(true);
    act(() => result.current.clearPrint());
    expect(result.current.printModels).toBeNull();
  });
});
