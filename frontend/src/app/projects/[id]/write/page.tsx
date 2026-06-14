"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { useCreateChapter, useDeleteChapter, useProjectChapters, useReorderChapters, useRestoreChapter } from "@/lib/query/useDocument";
import { useProject } from "@/lib/query/useProjects";
import { useProjectMemos, useRemoveLinkMemo, useSetPinMemo } from "@/lib/query/useMemos";
import { logKeys } from "@/lib/query/useLogs";
import { toDrawerMemoView } from "@/lib/memoView";
import { useWorkSession } from "@/hooks/useWorkSession";
import { rememberLastProject } from "@/lib/lastProject";
import type { Editor } from "@tiptap/react";
import { Toast } from "@/components/ui/Toast";
import { Rail } from "@/components/workspace/Rail";
import { Titlebar } from "@/components/workspace/Titlebar";
import { StudioRightStack } from "@/components/workspace/StudioRightStack";
import { StudioOutline } from "@/components/editor/StudioOutline";
import { ChapterList } from "@/components/editor/ChapterList";
import { ChapterEditor, type ChapterEditorSyncStatus } from "@/components/editor/ChapterEditor";
import { useEditorOutline } from "@/components/editor/useEditorOutline";

/**
 * 집필실 (015 US1 / 016 / 022 US1 T015) — A형 3단: [좌:ChapterList+StudioOutline | 원고 | 우].
 * 챕터 전환 = URL 쿼리 ?chapter={documentId}. 없으면 목록에서 가장 최근 수정 챕터로 진입.
 *
 * 방안 A (022 거짓 409 수정):
 * 에디터·세션을 ChapterEditor 로 분리하고 `key={currentChapterId}` 로 리마운트.
 * 챕터 전환 시 새 useDocumentSession 인스턴스가 생성 → versionRef 가 새 챕터 토큰으로 초기화.
 * 전환 직전 현재 챕터 본문을 flushDraft 로 flush 해 IME 조합 중 작성분 보존 (016).
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

    const [lined, setLined] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(false);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [endWorkOpen, setEndWorkOpen] = useState(false);
    const [endWorkBody, setEndWorkBody] = useState("");
    const [endingWork, setEndingWork] = useState(false);

    // ChapterEditor 로부터 받은 저장 상태 / flushDraft 참조
    const [syncStatus, setSyncStatus] = useState<ChapterEditorSyncStatus["syncStatus"]>("idle");
    const flushDraftRef = useRef<((body: string) => void) | null>(null);
    // 최신 본문 ref — flushDraft 호출 시 전달할 현재 본문.
    // ChapterEditor 의 onDraftUpdate 로 갱신되지만, page 레벨에서는 별도 추적이 어려우므로
    // ChapterEditor 의 언마운트 cleanup(pagehide) 와 handleChapterSelect 의 flushDraftRef 콜백으로 처리.
    // latestBodyRef 는 ChapterEditor 가 마지막으로 전달한 body 를 보존하는 용도.
    const latestBodyForFlushRef = useRef<string>(JSON.stringify({ type: "doc", content: [] }));

    const handleSyncStatus = useCallback(({ syncStatus: s, flushDraft }: ChapterEditorSyncStatus) => {
        setSyncStatus(s);
        flushDraftRef.current = flushDraft;
    }, []);

    // 메모 서랍
    const now = useMemo(() => new Date(), []);
    const projectMemosQuery = useProjectMemos(projectId);
    const setPinMemo = useSetPinMemo();
    const removeLinkMemo = useRemoveLinkMemo();
    const drawerMemos = (projectMemosQuery.data ?? []).map((m) => toDrawerMemoView(m, now));

    const { endWithLog } = useWorkSession(projectId);

    // 챕터 생성 mutation
    const createChapter = useCreateChapter(projectId);

    // 챕터 순서 이동 mutation (022 US2)
    const reorderChapters = useReorderChapters(projectId);

    // 챕터 삭제·복구 mutation (022 US3 T030)
    const deleteChapter = useDeleteChapter(projectId);
    const restoreChapter = useRestoreChapter(projectId);

    // 되돌리기 토스트 상태 — memos 패턴 (key=seq 로 Toast remount → 타이머 재시작)
    const [pendingDelete, setPendingDelete] = useState<{ ids: number[]; seq: number } | null>(null);

    useEffect(() => {
        if (Number.isFinite(projectId)) rememberLastProject(projectId);
    }, [projectId]);

    // 챕터 전환 핸들러 — 전환 직전 현재 초안 flush + URL 변경.
    // ChapterEditor 리마운트(key={currentChapterId})가 새 세션을 생성하므로 editorKey 증가 불필요.
    const handleChapterSelect = useCallback(
        (nextId: number) => {
            if (nextId === currentChapterId) return;
            // 전환 직전 현재 챕터 초안 즉시 기록 (IME 조합 중 작성분 보존 — 016).
            // ChapterEditor 가 flushDraft 콜백을 onSyncStatus 로 전달해 flushDraftRef 에 보관됨.
            flushDraftRef.current?.(latestBodyForFlushRef.current);
            // URL 쿼리 교체로 챕터 전환 → currentChapterId 변경 → ChapterEditor key 변경 → 리마운트.
            const url = `/projects/${projectId}/write?chapter=${nextId}`;
            router.replace(url, { scroll: false });
        },
        [currentChapterId, projectId, router],
    );

    // 챕터 삭제 핸들러 (022 US3 T030)
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

    // 챕터 순서 이동 핸들러 (022 US2)
    const handleMoveChapter = useCallback(
        (id: number, direction: "up" | "down") => {
            const idx = chapters.findIndex((c) => c.id === id);
            if (idx < 0) return;
            if (direction === "up" && idx === 0) return;
            if (direction === "down" && idx === chapters.length - 1) return;
            const swapIdx = direction === "up" ? idx - 1 : idx + 1;
            const newIds = chapters.map((c) => c.id);
            // 인접 항목과 교체
            [newIds[idx], newIds[swapIdx]] = [newIds[swapIdx], newIds[idx]];
            reorderChapters.mutate(newIds);
        },
        [chapters, reorderChapters],
    );

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
                                onMove={handleMoveChapter}
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
                        ) : chaptersQuery.isLoading ? (
                            <p style={{ padding: "2rem", opacity: 0.5 }}>문서 불러오는 중…</p>
                        ) : currentChapterId == null ? (
                            <p style={{ padding: "2rem", opacity: 0.5 }}>챕터를 선택하거나 생성해 주세요.</p>
                        ) : (
                            // key={currentChapterId} — 챕터 전환 시 ChapterEditor 리마운트.
                            // 새 useDocumentSession 인스턴스가 새 챕터의 version 으로 초기화 → 거짓 409 제거.
                            <ChapterEditor
                                key={currentChapterId}
                                documentId={currentChapterId}
                                projectId={projectId}
                                projectTitle={projectTitle}
                                lined={lined}
                                zoom={zoom}
                                onEditorReady={setEditor}
                                onSyncStatus={handleSyncStatus}
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
