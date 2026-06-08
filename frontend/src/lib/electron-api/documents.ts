/**
 * webElectronApi.documents (015 T012) — desktop `electronAPI.documents` 의 web 구현체.
 * 기존 lib/api/document(006)를 어댑터로 재사용. 자동저장 충돌(409)은 client.ts ConflictError 로 전파.
 */
import { getProjectDocument, saveDocument } from "@/lib/api/document";
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
    /** 활성 작품 문서 열기. */
    getByProject: async (projectId: number): Promise<ProjectDocument> => toDocument(await getProjectDocument(projectId)),

    /**
     * 본문 저장(낙관적 버전). 자동저장은 useAutoSave(006)가 saveDocument 를 직접 debounce 호출하므로
     * 본 메서드는 명시 저장/계약 완결용. 409 시 client.ts 가 ConflictError throw.
     */
    update: (id: number, patch: { bodyJson: string; version: number }): Promise<DocumentSaveResponse> =>
        saveDocument(id, { body: patch.bodyJson, version: patch.version }),
};
