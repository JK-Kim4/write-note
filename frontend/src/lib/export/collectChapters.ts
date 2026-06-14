import type { DocumentResponse } from "@/types/api";

/** export 합본 한 챕터 — 본문 변환의 입력. */
export type CollectedChapter = { id: number; title: string; bodyJson: string };

/**
 * 선택한 챕터 id들을 orderedIds 순서 그대로 본문과 함께 모은다.
 * fetchDoc 은 시스템 경계(HTTP) 주입 — 호출부가 getDocument 전달, 테스트는 mock.
 */
export async function collectChapters(
	orderedIds: number[],
	fetchDoc: (id: number) => Promise<DocumentResponse>,
): Promise<CollectedChapter[]> {
	const docs = await Promise.all(orderedIds.map((id) => fetchDoc(id)));
	return docs.map((d) => ({ id: d.id, title: d.title, bodyJson: d.body }));
}
