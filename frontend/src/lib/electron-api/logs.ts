/**
 * webElectronApi.logs (015 US3) — desktop `electronAPI.logs` 의 web 구현체.
 *
 * listByProject 는 014 endpoint 직접. list(LogCard[])는 014 R6 대로 화면 집계를 front 가 조립한다:
 * 작품 목록 × (document → wordCount·마지막문장 파생) × logs/latest × work-sessions/total. 베타 N+1 수용.
 */
import { apiFetch } from "@/lib/api/client";
import { getProjectDocument } from "@/lib/api/document";
import { listProjects } from "@/lib/api/projects";
import { extractPlainText } from "@/components/editor/wordCountUtils";
import type { ProjectLogResponse, TotalDurationResponse } from "@/types/api";
import type { LogCard, ProjectLog } from "@/lib/types/domain";

function toProjectLog(r: ProjectLogResponse): ProjectLog {
    return { id: r.id, projectId: r.projectId, body: r.body, createdAt: r.createdAt };
}

export const logs = {
    /** 아코디언 펼침 시 그 작품의 누적 기록 전체(최신순, 014). */
    listByProject: async (projectId: number): Promise<ProjectLog[]> =>
        (await apiFetch<ProjectLogResponse[]>(`/api/projects/${projectId}/logs`, { method: "GET" })).map(toProjectLog),

    /**
     * 기록 화면 카드 집계. size:100 — 베타 한계(작품 소수 전제). 작품별 3 조회(document·latest·total)는 N+1.
     */
    list: async (): Promise<LogCard[]> => {
        const projects = (await listProjects({ size: 100 })).content;
        return Promise.all(
            projects.map(async (project) => {
                const [doc, latest, total] = await Promise.all([
                    getProjectDocument(project.id),
                    apiFetch<ProjectLogResponse | null>(`/api/projects/${project.id}/logs/latest`, { method: "GET" }),
                    apiFetch<TotalDurationResponse>(`/api/projects/${project.id}/work-sessions/total`, { method: "GET" }),
                ]);
                return {
                    project,
                    wordCount: doc.wordCount,
                    lastSentenceSource: extractPlainText(doc.body),
                    latestLog: latest ? toProjectLog(latest) : null,
                    totalDurationMs: total.totalDurationMs,
                };
            }),
        );
    },
};
