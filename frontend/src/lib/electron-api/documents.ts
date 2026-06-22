/**
 * webElectronApi.documents (015 T012) — desktop `electronAPI.documents` 의 web 구현체.
 * 기존 lib/api/document(006)를 어댑터로 재사용. 자동저장 충돌(409)은 client.ts ConflictError 로 전파.
 * 033: 챕터 제거 — 작품 1개 = 본문 1개. 단일 본문 조회·저장만 남김.
 */
import { getDocument, getProjectDocument, saveDocument } from "@/lib/api/document";
import type { DocumentResponse, DocumentSaveResponse } from "@/types/api";
import type { ProjectDocument } from "@/lib/types/domain";

function toDocument(d: DocumentResponse): ProjectDocument {
    return {
        id: d.id,
        projectId: d.projectId,
        title: d.title,
        bodyJson: d.body,
        wordCount: d.wordCount,
        version: d.version,
        updatedAt: d.updatedAt,
    };
}

export const documents = {
    /** 작품의 단일 본문 메타·본문 조회 — GET /api/projects/{projectId}/document. */
    getByProject: async (projectId: number): Promise<ProjectDocument> =>
        toDocument(await getProjectDocument(projectId)),

    /** 단건 본문 포함 조회 — GET /api/documents/{id}. 편집 세션이 version 단독 소유. */
    get: async (documentId: number): Promise<ProjectDocument> => toDocument(await getDocument(documentId)),

    /**
     * 본문 저장(낙관적 버전). 자동저장은 useDocumentSession(016)이 saveDocument 를 직접 호출하므로
     * 본 메서드는 명시 저장/계약 완결용. 409 시 client.ts 가 ConflictError throw.
     */
    update: (id: number, patch: { bodyJson: string; version: string }): Promise<DocumentSaveResponse> =>
        saveDocument(id, { body: patch.bodyJson, version: patch.version }),
};
