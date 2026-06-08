"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { documentKeys, useProjectDocument } from "@/lib/query/useDocument";
import { useProject } from "@/lib/query/useProjects";
import type { ProjectDocument } from "@/lib/types/domain";
import { useAutoSave } from "@/hooks/useAutoSave";
import { Rail } from "@/components/workspace/Rail";
import { Titlebar } from "@/components/workspace/Titlebar";
import { PaperEditor } from "@/components/editor/PaperEditor";
import { ConflictDialog } from "@/components/editor/ConflictDialog";

/**
 * 집필실 (015 US1) — desktop WriteStudioScreen 1:1 이식.
 * .app(Rail+main) 셸 + Titlebar + .studio > PaperEditor(desktop app.css 페이지 분할).
 * 자동저장(006 useAutoSave 재사용) + 409 ConflictDialog. 곁쪽지 서랍·작업종료는 US2/US3.
 */
const EMPTY_DOC = JSON.stringify({ type: "doc", content: [] });

export default function ProjectWritePage() {
    useAuthGuard("requireAuth");
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const projectId = Number(params.id);
    const queryClient = useQueryClient();

    const projectQuery = useProject(projectId);
    const { data: doc, isLoading, isError } = useProjectDocument(projectId);

    const [body, setBody] = useState<string | null>(null);
    const [editorKey, setEditorKey] = useState(0);
    const [lined, setLined] = useState(true);
    const [zoom, setZoom] = useState(1);

    const initialBody = body ?? doc?.bodyJson ?? null;

    const autoSave = useAutoSave({
        documentId: doc?.id ?? 0,
        body: initialBody ?? EMPTY_DOC,
        version: doc?.version ?? 0,
    });

    const handleChange = useCallback((change: { bodyJson: string }) => setBody(change.bodyJson), []);
    const handleReload = useCallback(
        (currentBody: string) => {
            const currentVersion = autoSave.conflict?.currentVersion ?? doc?.version ?? 0;
            queryClient.setQueryData<ProjectDocument | undefined>(documentKeys.byProject(projectId), (old) =>
                old ? { ...old, bodyJson: currentBody, version: currentVersion } : old,
            );
            setBody(currentBody);
            setEditorKey((k) => k + 1);
            autoSave.dismissConflict();
        },
        [autoSave, queryClient, projectId, doc?.version],
    );
    const handleOverwrite = useCallback((currentVersion: number) => autoSave.overwrite(currentVersion), [autoSave]);

    const projectTitle = projectQuery.data?.title ?? "";
    const saveLabel =
        autoSave.status === "saving"
            ? "저장 중…"
            : autoSave.status === "error"
              ? "저장 실패"
              : autoSave.status === "conflict"
                ? "충돌"
                : "저장됨";

    const right = (
        <>
            <span className={`savestate savestate--${autoSave.status}`} role="status" aria-live="polite">
                {saveLabel}
            </span>
            <label className="view-menu__row" style={{ fontSize: 12 }}>
                <input type="checkbox" checked={lined} onChange={(e) => setLined(e.target.checked)} /> 줄노트
            </label>
            <button type="button" className="btn btn--secondary btn--compact" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}>
                −
            </button>
            <span style={{ fontSize: 12, minWidth: 38, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button type="button" className="btn btn--secondary btn--compact" onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}>
                +
            </button>
        </>
    );

    return (
        <div className="app">
            <Rail />
            <div className="main" style={{ ["--zoom"]: zoom } as CSSProperties}>
                <Titlebar title={projectTitle ? `${projectTitle} — 집필` : "집필"} right={right} />
                <div className="screen-body screen-body--solo">
                    <div className="studio">
                        {Number.isNaN(projectId) ? (
                            <p style={{ padding: "2rem" }}>잘못된 작품입니다.</p>
                        ) : isLoading ? (
                            <p style={{ padding: "2rem", opacity: 0.5 }}>문서 불러오는 중…</p>
                        ) : isError || !doc ? (
                            <div style={{ padding: "2rem" }}>
                                <p style={{ opacity: 0.6 }}>문서를 불러올 수 없습니다.</p>
                                <button type="button" className="btn btn--ghost" onClick={() => router.push("/")}>
                                    작품 벽으로
                                </button>
                            </div>
                        ) : (
                            <PaperEditor
                                key={editorKey}
                                title={projectTitle}
                                initialBodyJson={initialBody ?? doc.bodyJson}
                                onChange={handleChange}
                                lined={lined}
                                zoom={zoom}
                            />
                        )}
                    </div>
                </div>
                {autoSave.status === "conflict" && autoSave.conflict != null && (
                    <ConflictDialog conflict={autoSave.conflict} onReload={handleReload} onOverwrite={handleOverwrite} />
                )}
            </div>
        </div>
    );
}
