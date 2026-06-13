"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { documentKeys, useChapterDocument, useCreateChapter, useDeleteChapter, useProjectChapters, useRestoreChapter } from "@/lib/query/useDocument";
import { useProject } from "@/lib/query/useProjects";
import { useProjectMemos, useRemoveLinkMemo, useSetPinMemo } from "@/lib/query/useMemos";
import { logKeys } from "@/lib/query/useLogs";
import { toDrawerMemoView } from "@/lib/memoView";
import type { ProjectDocument } from "@/lib/types/domain";
import { useDocumentSession } from "@/hooks/useDocumentSession";
import { useWorkSession } from "@/hooks/useWorkSession";
import { rememberLastProject } from "@/lib/lastProject";
import type { Editor } from "@tiptap/react";
import { Toast } from "@/components/ui/Toast";
import { Rail } from "@/components/workspace/Rail";
import { Titlebar } from "@/components/workspace/Titlebar";
import { StudioRightStack } from "@/components/workspace/StudioRightStack";
import { PaperEditor } from "@/components/editor/PaperEditor";
import { StudioOutline } from "@/components/editor/StudioOutline";
import { ChapterList } from "@/components/editor/ChapterList";
import { useEditorOutline } from "@/components/editor/useEditorOutline";
import { ConflictDialog } from "@/components/editor/ConflictDialog";

/**
 * 집필실 (015 US1 / 016 / 022 US1 T015) — A형 3단: [좌:ChapterList+StudioOutline | 원고 | 우].
 * 챕터 전환 = URL 쿼리 ?chapter={documentId}. 없으면 목록에서 가장 최근 수정 챕터로 진입.
 * 전환 직전 현재 챕터 초안 flush (016 IME 유실 방지). editorKey 증가로 PaperEditor 재마운트.
 */
const EMPTY_DOC = JSON.stringify({ type: "doc", content: [] });

export default function ProjectWritePage() {
    useAuthGuard("requireAuth");
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const projectId = Number(params.id);
    const queryClient = useQueryClient();

    const projectQuery = useProject(projectId);

    // 챕터 목록 로드
    const chaptersQuery = useProjectChapters(projectId);
    const chapters = useMemo(() => chaptersQuery.data ?? [], [chaptersQuery.data]);

    // URL ?chapter 쿼리에서 현재 챕터 ID 결정.
    // 없으면 가장 최근 수정(updatedAt 최대) 챕터를 선택.
    const chapterIdFromUrl = Number(searchParams.get("chapter") ?? "") || null;
    const currentChapterId = useMemo<number | null>(() => {
        if (chapterIdFromUrl != null && chapters.some((c) => c.id === chapterIdFromUrl)) {
            return chapterIdFromUrl;
        }
        if (chapters.length === 0) return null;
        // 가장 최근 수정 챕터
        return chapters.reduce((latest, c) => (c.updatedAt > latest.updatedAt ? c : latest)).id;
    }, [chapterIdFromUrl, chapters]);

    // 현재 챕터 본문 로드
    const { data: doc, isLoading, isError } = useChapterDocument(currentChapterId ?? 0);

    const [body, setBody] = useState<string | null>(null);
    // editorKey: 챕터 전환 / 복구 / 충돌 시 PaperEditor 강제 리마운트용.
    const [editorKey, setEditorKey] = useState(0);
    const [lined, setLined] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(false);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [endWorkOpen, setEndWorkOpen] = useState(false);
    const [endWorkBody, setEndWorkBody] = useState("");
    const [endingWork, setEndingWork] = useState(false);

    // 메모 서랍
    const now = useMemo(() => new Date(), []);
    const projectMemosQuery = useProjectMemos(projectId);
    const setPinMemo = useSetPinMemo();
    const removeLinkMemo = useRemoveLinkMemo();
    const drawerMemos = (projectMemosQuery.data ?? []).map((m) => toDrawerMemoView(m, now));

    const { endWithLog } = useWorkSession(projectId);

    // 챕터 생성 mutation
    const createChapter = useCreateChapter(projectId);

    // 챕터 삭제·복구 mutation (022 US3 T030)
    const deleteChapter = useDeleteChapter(projectId);
    const restoreChapter = useRestoreChapter(projectId);

    // 되돌리기 토스트 상태 — memos 패턴 (key=seq 로 Toast remount → 타이머 재시작)
    const [pendingDelete, setPendingDelete] = useState<{ ids: number[]; seq: number } | null>(null);

    useEffect(() => {
        if (Number.isFinite(projectId)) rememberLastProject(projectId);
    }, [projectId]);

    // 챕터 전환 직전 flush 를 위한 ref — session.flushDraft 를 챕터 선택 핸들러에서 호출.
    const flushDraftRef = useRef<((body: string) => void) | null>(null);
    const latestBodyRef = useRef<string>(EMPTY_DOC);

    const session = useDocumentSession({
        documentId: doc?.id ?? 0,
        projectId,
        serverBody: doc?.bodyJson ?? EMPTY_DOC,
        serverVersion: doc?.version ?? "",
        body: body ?? doc?.bodyJson ?? EMPTY_DOC,
        onSaved: (res) =>
            queryClient.setQueryData<ProjectDocument | undefined>(documentKeys.chapter(doc?.id ?? 0), (old) =>
                old ? { ...old, version: res.version, wordCount: res.wordCount, bodyJson: res.body } : old,
            ),
    });

    // flushDraftRef 와 latestBodyRef 를 session 과 body 최신 값으로 유지.
    useEffect(() => {
        flushDraftRef.current = session.flushDraft;
    }, [session.flushDraft]);
    useEffect(() => {
        latestBodyRef.current = body ?? doc?.bodyJson ?? EMPTY_DOC;
    }, [body, doc?.bodyJson]);

    // 챕터 전환 핸들러 — 전환 직전 현재 초안 flush + URL 변경 + 에디터 재마운트.
    const handleChapterSelect = useCallback(
        (nextId: number) => {
            if (nextId === currentChapterId) return;
            // 전환 직전 현재 챕터 초안 즉시 기록 (IME 조합 중 작성분 보존 — 016).
            flushDraftRef.current?.(latestBodyRef.current);
            setBody(null);
            setEditorKey((k) => k + 1);
            // URL 쿼리 교체로 챕터 전환
            const url = `/projects/${projectId}/write?chapter=${nextId}`;
            router.replace(url, { scroll: false });
        },
        [currentChapterId, projectId, router],
    );

    // 챕터 삭제 핸들러 (022 US3 T030)
    // - 낙관적으로 목록에서 제거 (useDeleteChapter.onMutate)
    // - 현재 챕터 삭제 시 바로 앞 챕터(맨 앞이면 다음)로 자동 전환
    // - 되돌리기 토스트 표시
    const handleDeleteChapter = useCallback(
        (deletedId: number) => {
            // 현재 챕터 삭제 시 전환 대상 결정 (낙관적 제거 전 현재 chapters 기준)
            if (deletedId === currentChapterId && chapters.length > 1) {
                const idx = chapters.findIndex((c) => c.id === deletedId);
                const nextChapter = idx > 0 ? chapters[idx - 1] : chapters[idx + 1];
                if (nextChapter != null) {
                    handleChapterSelect(nextChapter.id);
                }
            }
            setPendingDelete((prev) => ({ ids: [...(prev?.ids ?? []), deletedId], seq: (prev?.seq ?? 0) + 1 }));
            deleteChapter.mutate(deletedId);
        },
        [chapters, currentChapterId, deleteChapter, handleChapterSelect],
    );

    const handleRestoreChapter = useCallback(() => {
        if (!pendingDelete) return;
        for (const id of pendingDelete.ids) restoreChapter.mutate(id);
        setPendingDelete(null);
    }, [pendingDelete, restoreChapter]);

    const dismissDeleteToast = useCallback(() => setPendingDelete(null), []);

    // 새 챕터 생성 핸들러
    const handleCreateChapter = useCallback(async () => {
        try {
            const newDoc = await createChapter.mutateAsync(undefined);
            handleChapterSelect(newDoc.id);
        } catch {
            // 생성 실패 — 사용자에게 별도 알림 없이 조용히 처리(목록은 그대로).
        }
    }, [createChapter, handleChapterSelect]);

    // localStorage-first 자동 복원
    const initialBody = body ?? session.restoredBody ?? doc?.bodyJson ?? null;

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (session.restoredBody != null) setBody((b) => b ?? session.restoredBody);
    }, [session.restoredBody]);

    // 챕터 전환 시(currentChapterId 변경) body 초기화 — 새 챕터 본문으로 시작.
    // handleChapterSelect 도 setBody(null) 하지만, 브라우저 뒤로가기·앞으로가기 등
    // URL 이 외부에서 직접 바뀌어 currentChapterId 가 handleChapterSelect 를 거치지 않고
    // 변경되는 경우를 방어한다. 두 경로의 이중 호출은 null→null 로 무해하다.
    const prevChapterIdRef = useRef<number | null>(null);
    useEffect(() => {
        if (prevChapterIdRef.current !== null && prevChapterIdRef.current !== currentChapterId) {
            setBody(null);
        }
        prevChapterIdRef.current = currentChapterId;
    }, [currentChapterId]);

    const handleChange = useCallback((change: { bodyJson: string }) => setBody(change.bodyJson), []);

    const handleReload = useCallback(
        (currentBody: string) => {
            const currentVersion = session.conflict?.currentVersion ?? doc?.version ?? "";
            queryClient.setQueryData<ProjectDocument | undefined>(documentKeys.chapter(doc?.id ?? 0), (old) =>
                old ? { ...old, bodyJson: currentBody, version: currentVersion } : old,
            );
            setBody(currentBody);
            setEditorKey((k) => k + 1);
            session.reloadFromServer(currentVersion, currentBody);
        },
        [session, queryClient, doc?.id, doc?.version],
    );
    const handleOverwrite = useCallback((currentVersion: string) => session.overwrite(currentVersion), [session]);

    const outline = useEditorOutline(editor);

    const handleEndWork = async () => {
        const trimmed = endWorkBody.trim();
        if (!trimmed || endingWork) return;
        setEndingWork(true);
        try {
            await endWithLog(trimmed);
            await queryClient.invalidateQueries({ queryKey: logKeys.all });
            setEndWorkOpen(false);
            setEndWorkBody("");
            router.push("/");
        } catch {
            // 종료 실패 — 모달 유지(재시도 가능).
        } finally {
            setEndingWork(false);
        }
    };

    const projectTitle = projectQuery.data?.title ?? "";
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
                aria-label="맥락 패널 (인물·메모)"
                title="맥락 패널 (인물·메모)"
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
                        <div className="studio-left-panel">
                            <ChapterList
                                chapters={chapters}
                                currentChapterId={currentChapterId}
                                onSelect={handleChapterSelect}
                                onCreate={handleCreateChapter}
                                onDelete={handleDeleteChapter}
                            />
                            <StudioOutline
                                items={outline.items}
                                activeIndex={outline.activeIndex}
                                onSelect={outline.selectItem}
                            />
                        </div>
                    )}
                    <div className="studio">
                        {Number.isNaN(projectId) ? (
                            <p style={{ padding: "2rem" }}>잘못된 작품입니다.</p>
                        ) : isLoading || chaptersQuery.isLoading ? (
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

            {pendingDelete && (
                <Toast
                    key={pendingDelete.seq}
                    message="챕터를 삭제했어요."
                    actionLabel="되돌리기"
                    onAction={handleRestoreChapter}
                    onDismiss={dismissDeleteToast}
                />
            )}
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
