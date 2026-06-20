import { describe, it, expect, vi } from "vitest";
import { collectChapters } from "./collectChapters";

describe("collectChapters", () => {
	it("주어진 순서대로 챕터 본문을 모은다", async () => {
		const fetchDoc = vi.fn(async (id: number) => ({
			id,
			projectId: 1,
			title: `챕터${id}`,
			body: `{"id":${id}}`,
			wordCount: 0,
			version: "v",
			updatedAt: "2026-01-01T00:00:00Z",
		}));
		const result = await collectChapters([3, 1, 2], fetchDoc);
		expect(result.map((c) => c.id)).toEqual([3, 1, 2]);
		expect(result.map((c) => c.title)).toEqual(["챕터3", "챕터1", "챕터2"]);
		expect(result[0].bodyJson).toBe('{"id":3}');
	});

	it("빈 선택이면 빈 배열을 반환한다", async () => {
		const fetchDoc = vi.fn();
		expect(await collectChapters([], fetchDoc)).toEqual([]);
	});
});
