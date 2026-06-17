"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { useCreateChapter, useDeleteChapter, useProjectChapters, useReorderChapters, useRestoreChapter, useUpdateChapterTitle } from "@/lib/query/useDocument";
import { useProject } from "@/lib/query/useProjects";
import { useProjectMemos, useRemoveLinkMemo, useSetPinMemo } from "@/lib/query/useMemos";
import { logKeys } from "@/lib/query/useLogs";
import { toDrawerMemoView } from "@/lib/memoView";
import { useWorkSession } from "@/hooks/useWorkSession";
import { rememberLastProject } from "@/lib/lastProject";
import { Toast } from "@/components/ui/Toast";
import { Rail } from "@/components/workspace/Rail";
import { Titlebar } from "@/components/workspace/Titlebar";
import { StudioRightStack } from "@/components/workspace/StudioRightStack";
import { StudioOutline } from "@/components/editor/StudioOutline";
import { ChapterList } from "@/components/editor/ChapterList";
import { ConflictDialog } from "@/components/editor/ConflictDialog";
import type { BChapterEditorConflictHandlers, BChapterEditorSyncStatus } from "@/components/custom-editor/types";
import { BCustomChapterEditor } from "@/components/custom-editor/BCustomChapterEditor";
import type { CustomEditorRef } from "@/components/custom-editor/CustomEditor";
import { useCustomOutline } from "@/components/custom-editor/useCustomOutline";
import type { OutlineItem } from "@/lib/editor/outline";
import type { PaperSize } from "@/components/editor/pageLayout";
import { ExportDialog } from "@/components/export/ExportDialog";
import { PrintOverlay } from "@/components/export/PrintOverlay";
import { usePdfExport } from "@/lib/export/usePdfExport";
import { useWordExport } from "@/lib/export/useWordExport";

/**
 * 집필실 (A형 3단: [좌:ChapterList+StudioOutline | 원고 | 우]) — 024 R5 에서 TipTap → 자체 엔진 교체.
 * 챕터 전환 = URL 쿼리 ?chapter={documentId}. 없으면 가장 최근 수정 챕터로 진입.
 *
 * 에디터 코어는 B형과 동일한 BCustomChapterEditor(자체 엔진 + useDocumentSession)를 재사용.
 * - 아웃라인: useCustomOutline(DOM 파생, .custom-editor-scroll).
 * - 충돌(409): BCustomChapterEditor 가 onConflict 로 올린 핸들러로 ConflictDialog 를 렌더.
 * - 챕터 전환 시 key={currentChapterId} 리마운트 → 새 세션 → 거짓 409 제거(022 방안 A).
 *
 * 줄노트(괘선)·페이지 줌은 자체 엔진 내장 기능으로 이관 — A형 상단 컨트롤에서는 제거.
 */

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

    // URL ?chapter 쿼리에서 현재 챕터 ID 결정. 없으면 가장 최근 수정 챕터.
    const chapterIdFromUrl = Number(searchParams.get("chapter") ?? "") || null;
    const currentChapterId = useMemo<number | null>(() => {
        if (chapterIdFromUrl != null && chapters.some((c) => c.id === chapterIdFromUrl)) {
            return chapterIdFromUrl;
        }
        if (chapters.length === 0) return null;
        return chapters.reduce((latest, c) => (c.updatedAt > latest.updatedAt ? c : latest)).id;
    }, [chapterIdFromUrl, chapters]);

    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(false);
    const [endWorkOpen, setEndWorkOpen] = useState(false);
    const [endWorkBody, setEndWorkBody] = useState("");
    const [endingWork, setEndingWork] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const { printModels, lined, exportPdf, clearPrint } = usePdfExport();

    // BCustomChapterEditor 로부터 받은 저장 상태 / flushDraft / 충돌 핸들러
    const [syncStatus, setSyncStatus] = useState<BChapterEditorSyncStatus["syncStatus"]>("idle");
    const flushDraftRef = useRef<((body: string) => void) | null>(null);
    const latestBodyForFlushRef = useRef<string>(JSON.stringify({ type: "doc", content: [] }));
    const [conflictHandlers, setConflictHandlers] = useState<BChapterEditorConflictHandlers>({ conflict: null, reload: () => {}, overwrite: () => {} });

    const handleSyncStatus = useCallback(({ syncStatus: s, flushDraft }: BChapterEditorSyncStatus) => {
        setSyncStatus(s);
        flushDraftRef.current = flushDraft;
    }, []);

    const handleConflict = useCallback((handlers: BChapterEditorConflictHandlers) => {
        setConflictHandlers(handlers);
    }, []);

    // 메모 서랍
    const now = useMemo(() => new Date(), []);
    const projectMemosQuery = useProjectMemos(projectId);
    const setPinMemo = useSetPinMemo();
    const removeLinkMemo = useRemoveLinkMemo();
    const drawerMemos = (projectMemosQuery.data ?? []).map((m) => toDrawerMemoView(m, now));

    const { endWithLog } = useWorkSession(projectId);
    const createChapter = useCreateChapter(projectId);
    const reorderChapters = useReorderChapters(projectId);
    const deleteChapter = useDeleteChapter(projectId);
    const restoreChapter = useRestoreChapter(projectId);
    const updateChapterTitle = useUpdateChapterTitle(projectId);

    const [pendingDelete, setPendingDelete] = useState<{ ids: number[]; seq: number } | null>(null);

    useEffect(() => {
        if (Number.isFinite(projectId)) rememberLastProject(projectId);
    }, [projectId]);

    // 챕터 전환 — 전환 직전 현재 초안 flush + URL 변경. key 리마운트로 새 세션(거짓 409 제거).
    const handleChapterSelect = useCallback(
        (nextId: number) => {
            if (nextId === currentChapterId) return;
            flushDraftRef.current?.(latestBodyForFlushRef.current);
            router.replace(`/projects/${projectId}/write?chapter=${nextId}`, { scroll: false });
        },
        [currentChapterId, projectId, router],
    );

    const handleDeleteChapter = useCallback(
        (deletedId: number) => {
            if (deletedId === currentChapterId && chapters.length > 1) {
                const idx = chapters.findIndex((c) => c.id === deletedId);
                const nextChapter = idx > 0 ? chapters[idx - 1] : chapters[idx + 1];
                if (nextChapter != null) handleChapterSelect(nextChapter.id);
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

    const handleCreateChapter = useCallback(async () => {
        try {
            const newDoc = await createChapter.mutateAsync(undefined);
            handleChapterSelect(newDoc.id);
        } catch {
            // 생성 실패 — 조용히 처리
        }
    }, [createChapter, handleChapterSelect]);

    const handleMoveChapter = useCallback(
        (id: number, direction: "up" | "down") => {
            const idx = chapters.findIndex((c) => c.id === id);
            if (idx < 0) return;
            if (direction === "up" && idx === 0) return;
            if (direction === "down" && idx === chapters.length - 1) return;
            const swapIdx = direction === "up" ? idx - 1 : idx + 1;
            const newIds = chapters.map((c) => c.id);
            [newIds[idx], newIds[swapIdx]] = [newIds[swapIdx], newIds[idx]];
            reorderChapters.mutate(newIds);
        },
        [chapters, reorderChapters],
    );

    const handleRenameChapter = useCallback(
        (documentId: number, title: string) => {
            updateChapterTitle.mutate({ documentId, title });
        },
        [updateChapterTitle],
    );

    // DOM 파생 아웃라인 — CustomEditor 스크롤 컨테이너의 [data-heading-level] 스캔.
    const outline = useCustomOutline(".custom-editor-scroll");
    // 목차 클릭 → 에디터 caret 점프(heading 끝). selectItem 은 activeIndex 만 갱신(스크롤·포커스는 에디터 주도).
    const editorRef = useRef<CustomEditorRef>(null);
    const handleOutlineSelect = useCallback(
        (item: OutlineItem) => {
            editorRef.current?.jumpToHeading(item.index);
            outline.selectItem(item);
        },
        [outline],
    );

    const handleEndWork = async () => {
        const trimmed = endWorkBody.trim();
        if (!trimmed || endingWork) return;
        setEndingWork(true);
        try {
            await endWithLog(trimmed);
            await queryClient.invalidateQueries({ queryKey: logKeys.all });
            setEndWorkOpen(false);
            setEndWorkBody("");
            router.push("/home");
        } catch {
            // 종료 실패 — 모달 유지(재시도 가능).
        } finally {
            setEndingWork(false);
        }
    };

    const projectTitle = projectQuery.data?.title ?? "";
    const paperSize: PaperSize = projectQuery.data?.paperSize ?? "A4";
    const exportWord = useWordExport(projectId, paperSize);
    const saveStateClass =
        syncStatus === "syncing" ? "saving" : syncStatus === "synced" ? "saved" : syncStatus;
    const saveLabel =
        syncStatus === "syncing"
            ? "저장 중…"
            : syncStatus === "error"
              ? "저장 실패"
              : syncStatus === "conflict"
                ? "충돌"
                : "저장됨";

    const right = (
        <>
            <span className={`savestate savestate--${saveStateClass}`} role="status" aria-live="polite">
                {saveLabel}
            </span>
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
            <div className="main">
                <Titlebar title={projectTitle ? `${projectTitle} — 집필` : "집필"} right={right} />
                <div className={`screen-body screen-body--studio${leftOpen ? "" : " no-left"}${rightOpen ? "" : " no-right"}`}>
                    {leftOpen && (
                        <div className="studio-left-panel">
                            <ChapterList
                                chapters={chapters}
                                currentChapterId={currentChapterId}
                                onSelect={handleChapterSelect}
                                onCreate={handleCreateChapter}
                                onMove={handleMoveChapter}
                                onDelete={handleDeleteChapter}
                                onRename={handleRenameChapter}
                                onExport={() => setExportOpen(true)}
                            />
                            <StudioOutline
                                items={outline.items}
                                activeIndex={outline.activeIndex}
                                onSelect={handleOutlineSelect}
                            />
                        </div>
                    )}
                    <div className="studio">
                        {Number.isNaN(projectId) ? (
                            <p style={{ padding: "2rem" }}>잘못된 작품입니다.</p>
                        ) : projectQuery.isLoading || chaptersQuery.isLoading ? (
                            <p style={{ padding: "2rem", opacity: 0.5 }}>문서 불러오는 중…</p>
                        ) : projectQuery.isError || projectQuery.data == null ? (
                            <p style={{ padding: "2rem", opacity: 0.5 }}>작품을 찾을 수 없습니다.</p>
                        ) : currentChapterId == null ? (
                            <p style={{ padding: "2rem", opacity: 0.5 }}>챕터를 선택하거나 생성해 주세요.</p>
                        ) : (
                            // key={currentChapterId} — 챕터 전환 시 리마운트(새 세션 → 거짓 409 제거).
                            <BCustomChapterEditor
                                key={currentChapterId}
                                ref={editorRef}
                                currentChapterId={currentChapterId}
                                projectId={projectId}
                                paperSize={paperSize}
                                chapterTitle={chapters.find((c) => c.id === currentChapterId)?.title}
                                onChapterRename={(title) => handleRenameChapter(currentChapterId, title)}
                                onSyncStatus={handleSyncStatus}
                                onConflict={handleConflict}
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
            {conflictHandlers.conflict != null && (
                <ConflictDialog
                    conflict={conflictHandlers.conflict}
                    onReload={() => conflictHandlers.reload()}
                    onOverwrite={() => conflictHandlers.overwrite()}
                />
            )}
            {exportOpen && (
                <ExportDialog
                    open
                    chapters={chapters}
                    paperSize={paperSize}
                    onExportPdf={(req) => { setExportOpen(false); exportPdf(req); }}
                    onExportWord={(format, req) => { setExportOpen(false); exportWord(format, req); }}
                    onClose={() => setExportOpen(false)}
                />
            )}
            {printModels && <PrintOverlay models={printModels} paperSize={paperSize} lined={lined} onDone={clearPrint} />}
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
