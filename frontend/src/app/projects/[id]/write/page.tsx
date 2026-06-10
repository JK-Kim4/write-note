"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { documentKeys, useProjectDocument } from "@/lib/query/useDocument";
import { useProject } from "@/lib/query/useProjects";
import { useProjectMemos, useRemoveLinkMemo, useSetPinMemo } from "@/lib/query/useMemos";
import { logKeys } from "@/lib/query/useLogs";
import { toDrawerMemoView } from "@/lib/memoView";
import type { ProjectDocument } from "@/lib/types/domain";
import { useDocumentSession } from "@/hooks/useDocumentSession";
import { useWorkSession } from "@/hooks/useWorkSession";
import { rememberLastProject } from "@/lib/lastProject";
import type { Editor } from "@tiptap/react";
import { Rail } from "@/components/workspace/Rail";
import { Titlebar } from "@/components/workspace/Titlebar";
import { StudioRightStack } from "@/components/workspace/StudioRightStack";
import { PaperEditor } from "@/components/editor/PaperEditor";
import { StudioOutline } from "@/components/editor/StudioOutline";
import { useEditorOutline } from "@/components/editor/useEditorOutline";
import { ConflictDialog } from "@/components/editor/ConflictDialog";

/**
 * 집필실 (015 US1 / 016) — desktop WriteStudioScreen 1:1 이식.
 * .app(Rail+main) 셸 + Titlebar + .studio > PaperEditor(desktop app.css 페이지 분할).
 * 자동저장(016 useDocumentSession — localStorage draft + 수정시각 버전 토큰). 충돌·복구 결선은 US2/US3.
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
    // editorKey: 복구/충돌 시 PaperEditor 강제 리마운트용(본문 교체 반영).
    const [editorKey, setEditorKey] = useState(0);
    const [lined, setLined] = useState(true);
    const [zoom, setZoom] = useState(1);
    // 3단 패널 — 진입 기본: 아웃라인만 펼침(좌 open / 우 닫힘). 좌·우 토글로 접고 펼침.
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(false);
    // 아웃라인이 쓰는 에디터 인스턴스 참조(PaperEditor 가 onEditorReady 로 올림).
    const [editor, setEditor] = useState<Editor | null>(null);
    const [endWorkOpen, setEndWorkOpen] = useState(false);
    const [endWorkBody, setEndWorkBody] = useState("");
    const [endingWork, setEndingWork] = useState(false);

    // 곁쪽지 서랍 — 이 작품에 연결된 곁쪽지(고정 포함).
    const now = useMemo(() => new Date(), []);
    const projectMemosQuery = useProjectMemos(projectId);
    const setPinMemo = useSetPinMemo();
    const removeLinkMemo = useRemoveLinkMemo();
    const drawerMemos = (projectMemosQuery.data ?? []).map((m) => toDrawerMemoView(m, now));

    // 작업 세션 — 집필실 진입 시작 / 라우트 이탈·탭 닫기 종료(R6). endWithLog 는 "작업 종료+기록".
    const { endWithLog } = useWorkSession(projectId);

    // Rail "집필" 네비가 돌아올 작품으로 기억(web 은 전역 활성작품이 없음).
    useEffect(() => {
        if (Number.isFinite(projectId)) rememberLastProject(projectId);
    }, [projectId]);

    const handleEndWork = async () => {
        const trimmed = endWorkBody.trim();
        if (!trimmed || endingWork) return;
        setEndingWork(true);
        try {
            await endWithLog(trimmed);
            await queryClient.invalidateQueries({ queryKey: logKeys.all });
            setEndWorkOpen(false);
            setEndWorkBody("");
            // desktop: 작업 종료 후 작품 벽으로 이동(세션 종료 신호). closedRef=true 라 이탈 시 이중 종료 없음.
            router.push("/");
        } catch {
            // 종료 실패 — 모달 유지(재시도 가능). closedRef 는 useWorkSession 이 복원.
        } finally {
            setEndingWork(false);
        }
    };

    const session = useDocumentSession({
        documentId: doc?.id ?? 0,
        projectId,
        serverBody: doc?.bodyJson ?? EMPTY_DOC,
        serverVersion: doc?.version ?? "",
        body: body ?? doc?.bodyJson ?? EMPTY_DOC,
        // 저장 성공마다 캐시를 서버 최신(version/wordCount/body)으로 갱신 → 재진입 시 stale 버전 재사용 방지.
        onSaved: (res) =>
            queryClient.setQueryData<ProjectDocument | undefined>(documentKeys.byProject(projectId), (old) =>
                old ? { ...old, version: res.version, wordCount: res.wordCount, bodyJson: res.body } : old,
            ),
    });

    // localStorage-first 자동 복원 — 미동기화 draft 가 있으면 에디터 초기 본문으로 즉시 복원(배너·대기 없음).
    const initialBody = body ?? session.restoredBody ?? doc?.bodyJson ?? null;

    // 복원 본문을 현재 편집 본문으로 채택 → 세션이 서버에도 재동기화(로컬은 이미 보존됨).
    useEffect(() => {
        if (session.restoredBody != null) setBody((b) => b ?? session.restoredBody);
    }, [session.restoredBody]);

    const handleChange = useCallback((change: { bodyJson: string }) => setBody(change.bodyJson), []);

    // 진짜 충돌(US3) — 다시 불러오기: 서버 최신본으로 교체 / 덮어쓰기: 내 본문 강제 저장.
    const handleReload = useCallback(
        (currentBody: string) => {
            const currentVersion = session.conflict?.currentVersion ?? doc?.version ?? "";
            queryClient.setQueryData<ProjectDocument | undefined>(documentKeys.byProject(projectId), (old) =>
                old ? { ...old, bodyJson: currentBody, version: currentVersion } : old,
            );
            setBody(currentBody);
            setEditorKey((k) => k + 1);
            session.dismissConflict();
        },
        [session, queryClient, projectId, doc?.version],
    );
    const handleOverwrite = useCallback((currentVersion: string) => session.overwrite(currentVersion), [session]);

    // 아웃라인 — 라이브 에디터에서 heading 목차 파생·현재 섹션·점프(017 US1).
    const outline = useEditorOutline(editor);

    const projectTitle = projectQuery.data?.title ?? "";
    // syncStatus → 기존 savestate 클래스/라벨 어휘로 매핑.
    const saveStateClass =
        session.syncStatus === "syncing" ? "saving" : session.syncStatus === "synced" ? "saved" : session.syncStatus;
    const saveLabel =
        session.syncStatus === "syncing"
            ? "저장 중…"
            : session.syncStatus === "error"
              ? "저장 실패"
              : session.syncStatus === "conflict"
                ? "충돌"
                : "저장됨";

    const right = (
        <>
            <span className={`savestate savestate--${saveStateClass}`} role="status" aria-live="polite">
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
            <button
                type="button"
                className="btn btn--secondary btn--compact"
                onClick={() => {
                    setEndWorkBody("");
                    setEndWorkOpen(true);
                }}
            >
                작업 종료
            </button>
            <button
                type="button"
                className={leftOpen ? "panel-toggle is-open" : "panel-toggle"}
                aria-pressed={leftOpen}
                aria-label="아웃라인"
                title="아웃라인"
                onClick={() => setLeftOpen((v) => !v)}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <line x1="9" y1="4" x2="9" y2="20" />
                </svg>
            </button>
            <button
                type="button"
                className={rightOpen ? "panel-toggle is-open" : "panel-toggle"}
                aria-pressed={rightOpen}
                aria-label="맥락 패널 (인물·곁쪽지)"
                title="맥락 패널 (인물·곁쪽지)"
                onClick={() => setRightOpen((v) => !v)}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <line x1="15" y1="4" x2="15" y2="20" />
                </svg>
            </button>
        </>
    );

    return (
        <div className="app">
            <Rail />
            <div className="main" style={{ ["--zoom"]: zoom } as CSSProperties}>
                <Titlebar title={projectTitle ? `${projectTitle} — 집필` : "집필"} right={right} />
                <div
                    className={`screen-body screen-body--studio${leftOpen ? "" : " no-left"}${rightOpen ? "" : " no-right"}`}
                >
                    {leftOpen && (
                        <StudioOutline
                            items={outline.items}
                            activeIndex={outline.activeIndex}
                            onSelect={outline.selectItem}
                        />
                    )}
                    <div className="studio">
                        {Number.isNaN(projectId) ? (
                            <p style={{ padding: "2rem" }}>잘못된 작품입니다.</p>
                        ) : isLoading ? (
                            <p style={{ padding: "2rem", opacity: 0.5 }}>문서 불러오는 중…</p>
                        ) : isError || !doc ? (
                            <div style={{ padding: "2rem" }}>
                                <p style={{ opacity: 0.6 }}>문서를 불러올 수 없습니다.</p>
                                <button type="button" className="btn btn--ghost" onClick={() => router.push("/library")}>
                                    작품 벽으로
                                </button>
                            </div>
                        ) : (
                            <PaperEditor
                                key={editorKey}
                                title={projectTitle}
                                initialBodyJson={initialBody ?? doc.bodyJson}
                                onChange={handleChange}
                                onDraftUpdate={session.flushDraft}
                                onEditorReady={setEditor}
                                lined={lined}
                                zoom={zoom}
                            />
                        )}
                    </div>
                    {rightOpen && (
                        <StudioRightStack
                            projectId={projectId}
                            memos={drawerMemos}
                            memosLoading={projectMemosQuery.isLoading}
                            onUnlink={(memoId) => removeLinkMemo.mutate({ memoId, projectId })}
                            onSetPin={(memoId, pinned) => setPinMemo.mutate({ memoId, projectId, pinned })}
                        />
                    )}
                </div>
                {session.conflict != null && (
                    <ConflictDialog conflict={session.conflict} onReload={handleReload} onOverwrite={handleOverwrite} />
                )}
            </div>

            {endWorkOpen && (
                <div className="modal-backdrop" onClick={() => !endingWork && setEndWorkOpen(false)}>
                    <div className="modal capture" role="dialog" aria-modal="true" aria-label="작업 종료" onClick={(e) => e.stopPropagation()}>
                        <div className="modal__head">
                            <h2 className="modal__title">작업 종료</h2>
                            <span className="modal__hint">오늘의 기록을 남겨보세요</span>
                        </div>
                        <textarea
                            autoFocus
                            className="capture__input"
                            placeholder="오늘의 기록을 남겨보세요…"
                            rows={4}
                            value={endWorkBody}
                            onChange={(e) => setEndWorkBody(e.target.value)}
                        />
                        <div className="modal__foot">
                            <button type="button" className="btn btn--ghost" onClick={() => setEndWorkOpen(false)} disabled={endingWork}>
                                취소
                            </button>
                            <button type="button" className="btn btn--primary" onClick={handleEndWork} disabled={endWorkBody.trim().length === 0 || endingWork}>
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
