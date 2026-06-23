import type { DocumentResponse } from "@/types/api";

/**
 * 선택·정렬된 작품(projectId)을 본문(documentId) 배열로 변환(시리즈 합본 export).
 * fetchProjectDoc 은 시스템 경계(HTTP) 주입 — 호출부가 getProjectDocument 전달, 테스트는 mock.
 * orderedIds 순서 = projectIds 순서(작품 정렬 = 합본 장 순서).
 */
export async function collectSeriesOrderedIds(
    projectIds: number[],
    fetchProjectDoc: (projectId: number) => Promise<DocumentResponse>,
): Promise<number[]> {
    const docs = await Promise.all(projectIds.map(fetchProjectDoc));
    return docs.map((d) => d.id);
}
