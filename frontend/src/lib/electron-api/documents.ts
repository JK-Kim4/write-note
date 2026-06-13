/**
 * webElectronApi.documents (015 T012 + 022 US1 T013) — desktop `electronAPI.documents` 의 web 구현체.
 * 기존 lib/api/document(006)를 어댑터로 재사용. 자동저장 충돌(409)은 client.ts ConflictError 로 전파.
 * 022 US1: 챕터 목록(list) / 챕터 생성(create) / 단건 조회(get) 추가.
 */
import { createChapter, getDocument, getProjectDocument, listChapters, saveDocument } from "@/lib/api/document";
import type { ChapterMetaResponse, DocumentResponse, DocumentSaveResponse } from "@/types/api";
import type { ChapterMeta, ProjectDocument } from "@/lib/types/domain";

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

function toChapterMeta(d: ChapterMetaResponse): ChapterMeta {
    return {
        id: d.id,
        projectId: d.projectId,
        title: d.title,
        sortOrder: d.sortOrder,
        wordCount: d.wordCount,
        updatedAt: d.updatedAt,
    };
}

export const documents = {
    /**
     * 챕터 목록 (본문 제외 메타) — GET /api/projects/{projectId}/documents.
     * 022 US1 T013: 집필실 좌패널 ChapterList 에 전달.
     */
    list: async (projectId: number): Promise<ChapterMeta[]> =>
        (await listChapters(projectId)).map(toChapterMeta),

    /**
     * 챕터 생성 — POST /api/projects/{projectId}/documents.
     * title 미전달 시 서버가 "새 챕터" 채움. 본문 포함 응답(ProjectDocument).
     * 022 US1 T013: "새 챕터" 버튼 → 생성 → 해당 챕터로 전환.
     */
    create: async (projectId: number, title?: string): Promise<ProjectDocument> =>
        toDocument(await createChapter(projectId, title != null ? { title } : {})),

    /**
     * 단건 본문 포함 조회 — GET /api/documents/{id}.
     * 022 US1 T013: 챕터 전환 시 선택된 documentId 의 본문 로드.
     * staleTime:Infinity 정책은 useChapterDocument 훅에서 적용.
     */
    get: async (documentId: number): Promise<ProjectDocument> => toDocument(await getDocument(documentId)),

    /** 활성 작품 문서 열기(레거시, 단수). 기존 호출부 유지. */
    getByProject: async (projectId: number): Promise<ProjectDocument> => toDocument(await getProjectDocument(projectId)),

    /**
     * 본문 저장(낙관적 버전). 자동저장은 useDocumentSession(016)이 saveDocument 를 직접 호출하므로
     * 본 메서드는 명시 저장/계약 완결용. 409 시 client.ts 가 ConflictError throw.
     */
    update: (id: number, patch: { bodyJson: string; version: string }): Promise<DocumentSaveResponse> =>
        saveDocument(id, { body: patch.bodyJson, version: patch.version }),
};
