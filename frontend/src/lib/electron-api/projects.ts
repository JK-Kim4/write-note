/**
 * webElectronApi.projects (015 T006) — desktop `electronAPI.projects` 의 web 구현체.
 *
 * 설계 §3: 화면은 동일 인터페이스로 호출하고 구현(fetch)을 모른다. 기존 lib/api/projects(005/006)를
 * 어댑터로 재사용하고 014 계약(contracts/web-electron-api.md)에 매핑한다. projects 가 Foundational 의
 * worked example — documents/memos/logs/sessions/contact 는 각 US 단계에서 동일 패턴으로 추가.
 */
import { createProject, deleteProject, getProject, listProjectCards, listProjects, updateProject } from "@/lib/api/projects";
import type { CreateProjectInput, UpdateProjectInput } from "@/lib/api/projects";
import { getProjectDocument } from "@/lib/api/document";
import type { DocumentResponse } from "@/types/api";
import type { Project, ProjectCard, ProjectDocument } from "@/lib/types/domain";

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

export const projects = {
    /**
     * 활성 작품 목록(작품 벽).
     * size:100 — 베타 한계(작가 작품 수 소수 전제). 100 초과 시 누락 → 규모 증가 시 페이지네이션/무한수집 도입(US1+ 재검토).
     */
    list: async (): Promise<Project[]> => (await listProjects({ size: 100 })).content,

    /**
     * 작품 벽/홈 카드 집계(018/022) — 카드 endpoint 1회.
     * lastSentenceSource 는 BE 가 최근 수정 활성 챕터 body plainText 를 동봉(022 US4) — FE 별도 조회 제거.
     * N+1 해소: 카드별 getProjectDocument 호출 제거.
     */
    listCards: async (): Promise<ProjectCard[]> => {
        const cards = await listProjectCards();
        return cards.map((card) => ({
            ...card,
            docUpdatedAt: card.documentUpdatedAt,
            lastSentenceSource: card.lastSentenceSource,
        }));
    },

    get: (id: number): Promise<Project> => getProject(id),

    /** desktop create 는 {project, document} 반환 — 014 는 작품 생성 시 빈 문서 1:1 자동 생성. */
    create: async (input: CreateProjectInput): Promise<{ project: Project; document: ProjectDocument }> => {
        const project = await createProject(input);
        const document = toDocument(await getProjectDocument(project.id));
        return { project, document };
    },

    update: (id: number, patch: UpdateProjectInput): Promise<Project> => updateProject(id, patch),

    delete: async (id: number): Promise<boolean> => {
        await deleteProject(id);
        return true;
    },
};
