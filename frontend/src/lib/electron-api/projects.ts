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
import { extractPlainText } from "@/components/editor/wordCountUtils";
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
     * 작품 벽/홈 카드 집계(018) — 카드 endpoint 1회(글자수·문서 저장 시각·누적 작업시간 동봉)
     * + 작품별 문서 병렬 조회(마지막 문장 파생 원료만 — 본문 텍스트 파생은 클라 책임).
     * 한 조회라도 실패하면 전체 reject — 반쪽 데이터로 그리지 않는다(화면은 에러+재시도).
     */
    listCards: async (): Promise<ProjectCard[]> => {
        const cards = await listProjectCards();
        return Promise.all(
            cards.map(async (card) => {
                const doc = await getProjectDocument(card.id);
                return {
                    ...card,
                    docUpdatedAt: card.documentUpdatedAt,
                    lastSentenceSource: extractPlainText(doc.body),
                };
            }),
        );
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
