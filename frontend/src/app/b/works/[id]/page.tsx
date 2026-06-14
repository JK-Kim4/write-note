"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import { useCreateChapter, useDeleteChapter, useProjectChapters, useReorderChapters, useRestoreChapter, useUpdateChapterTitle } from "@/lib/query/useDocument";
import { useProject, useUpdateProject } from "@/lib/query/useProjects";
import { PAPER_PRESETS, type PaperSize } from "@/components/editor/pageLayout";
import { logKeys } from "@/lib/query/useLogs";
import { useWorkSession } from "@/hooks/useWorkSession";
import { rememberLastProject } from "@/lib/lastProject";
import { useEditorOutline } from "@/components/editor/useEditorOutline";
import { Toast } from "@/components/ui/Toast";
import { BWorkSidePanel } from "@/components/b/BWorkSidePanel";
import { BChapterEditor, type BChapterEditorConflictHandlers, type BChapterEditorSyncStatus } from "@/components/b/BChapterEditor";
import { ChapterList } from "@/components/editor/ChapterList";

/**
 * B타입 집필 화면 — fable-test WorkDetailPage 3패널: [목차 w-64 | 에디터 | 메모·인물 w-80].
 * 에디터는 BEditor(흰 배경 + 상단 서식 메뉴바 + 줄노트 라인 + 상태바) — 사용자 확정 디자인.
 * 자동저장 결선(useDocumentSession — localStorage draft·버전 토큰·충돌)과 작업 세션(useWorkSession)은
 * A 집필실과 동일 규약.
 *
 * 방안 A (022 거짓 409 수정):
 * 에디터·세션을 BChapterEditor 로 분리하고 `key={currentChapterId}` 로 리마운트.
 * 챕터 전환 시 새 useDocumentSession 인스턴스 → versionRef 새 챕터 토큰 초기화 → 거짓 409 제거.
 */

export default function BWorkDetailPage() {
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

    const [editor, setEditor] = useState<Editor | null>(null);
    const [endWorkOpen, setEndWorkOpen] = useState(false);
    const [endWorkBody, setEndWorkBody] = useState("");
    const [endWorkError, setEndWorkError] = useState<string | null>(null);
    const [isEndingWork, setIsEndingWork] = useState(false);
    // 좁은 폭 drawer 열림 상태 — 기본 닫힘. 880px 이상에서는 상태값 무관(항상 inline 3패널).
    const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
    const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
    const leftDrawerRef = useRef<HTMLDivElement>(null);
    const rightDrawerRef = useRef<HTMLDivElement>(null);
    const conflictModalRef = useRef<HTMLDivElement>(null);
    const endWorkModalRef = useRef<HTMLDivElement>(null);
    // 보조 패널 접기·탭 상태
    const [panelOpen, setPanelOpen] = useState(true);
    const [panelTab, setPanelTab] = useState<"memos" | "characters">("memos");

    // BChapterEditor 로부터 받은 저장 상태 / flushDraft / 충돌 핸들러
    const flushDraftRef = useRef<((body: string) => void) | null>(null);
    const latestBodyForFlushRef = useRef<string>(JSON.stringify({ type: "doc", content: [] }));
    const [conflictHandlers, setConflictHandlers] = useState<BChapterEditorConflictHandlers>({ conflict: null, reload: () => {}, overwrite: () => {} });

    const handleSyncStatus = useCallback(({ flushDraft }: BChapterEditorSyncStatus) => {
        flushDraftRef.current = flushDraft;
    }, []);

    const handleConflict = useCallback((handlers: BChapterEditorConflictHandlers) => {
        setConflictHandlers(handlers);
    }, []);

    const { endWithLog } = useWorkSession(projectId);
    const updateProject = useUpdateProject();
    const createChapter = useCreateChapter(projectId);

    // 챕터 순서 이동 mutation (022 US2)
    const reorderChapters = useReorderChapters(projectId);

    // 챕터 삭제·복구 mutation (022 US3 T030)
    const deleteChapter = useDeleteChapter(projectId);
    const restoreChapter = useRestoreChapter(projectId);
    const [pendingDelete, setPendingDelete] = useState<{ ids: number[]; seq: number } | null>(null);

    // 챕터 제목 변경 mutation (022 dogfooding T-RENAME)
    const updateChapterTitle = useUpdateChapterTitle(projectId);

    // 용지 크기는 작품 속성 — 변경 시 PATCH → 비율 즉시 반영.
    const paperSize: PaperSize = projectQuery.data?.paperSize ?? "A4";
    const handlePaperSizeChange = (next: PaperSize) => {
        if (next === paperSize) return;
        updateProject.mutate({ id: projectId, patch: { paperSize: next } });
    };

    useEffect(() => {
        if (Number.isFinite(projectId)) rememberLastProject(projectId);
    }, [projectId]);

    // 챕터 전환 핸들러 — 전환 직전 현재 초안 flush + URL 변경.
    // BChapterEditor key={currentChapterId} 리마운트가 새 세션 생성 → 거짓 409 제거.
    const handleChapterSelect = useCallback(
        (nextId: number) => {
            if (nextId === currentChapterId) return;
            // 전환 직전 현재 챕터 초안 즉시 기록 (IME 조합 중 작성분 보존 — 016).
            flushDraftRef.current?.(latestBodyForFlushRef.current);
            const url = `/b/works/${projectId}?chapter=${nextId}`;
            router.replace(url, { scroll: false });
        },
        [currentChapterId, projectId, router],
    );

    // 챕터 삭제 핸들러 (022 US3 T030)
    const handleDeleteChapter = useCallback(
        (deletedId: number) => {
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

    // 챕터 생성 핸들러
    const handleCreateChapter = useCallback(async () => {
        try {
            const newDoc = await createChapter.mutateAsync(undefined);
            handleChapterSelect(newDoc.id);
        } catch {
            // 생성 실패 — 조용히 처리
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
            [newIds[idx], newIds[swapIdx]] = [newIds[swapIdx], newIds[idx]];
            reorderChapters.mutate(newIds);
        },
        [chapters, reorderChapters],
    );

    // 챕터 제목 변경 핸들러 (022 dogfooding T-RENAME)
    const handleRenameChapter = useCallback(
        (documentId: number, title: string) => {
            updateChapterTitle.mutate({ documentId, title });
        },
        [updateChapterTitle],
    );

    const handleEndWork = async () => {
        const trimmed = endWorkBody.trim();
        if (!trimmed || isEndingWork) return;
        setIsEndingWork(true);
        setEndWorkError(null);
        try {
            await endWithLog(trimmed);
            await queryClient.invalidateQueries({ queryKey: logKeys.all });
            setEndWorkOpen(false);
            setEndWorkBody("");
            router.push("/b/library");
        } catch {
            setEndWorkError("기록 저장에 실패했습니다. 다시 시도해 주세요.");
        } finally {
            setIsEndingWork(false);
        }
    };

    // ESC 키로 열린 drawer·종료 모달 닫기
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (leftDrawerOpen) setLeftDrawerOpen(false);
            if (rightDrawerOpen) setRightDrawerOpen(false);
            if (endWorkOpen && !isEndingWork) setEndWorkOpen(false);
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [leftDrawerOpen, rightDrawerOpen, endWorkOpen, isEndingWork]);

    // Tab focus trap
    useEffect(() => {
        const activeContainer = (): HTMLElement | null => {
            if (conflictHandlers.conflict != null) return conflictModalRef.current;
            if (endWorkOpen) return endWorkModalRef.current;
            if (rightDrawerOpen) return rightDrawerRef.current;
            if (leftDrawerOpen) return leftDrawerRef.current;
            return null;
        };
        const root = activeContainer();
        if (!root) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return;
            const items = Array.from(
                root.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), textarea, input:not([disabled]), [href], select:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ),
            );
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [leftDrawerOpen, rightDrawerOpen, endWorkOpen, conflictHandlers.conflict]);

    const outline = useEditorOutline(editor, ".b-editor-scroll");
    const projectTitle = projectQuery.data?.title ?? "";

    /** 목차 패널 내용 — 좁은 폭 drawer 와 넓은 폭 inline 모두 동일 마크업 공유. */
    const outlinePanel = (
        <>
            <div className="border-b border-gray-200 p-3">
                <Link href="/b/library" className="text-xs text-gray-400 hover:text-indigo-600">
                    ← 작품 목록
                </Link>
                <h1 className="mt-1 truncate text-base font-bold text-gray-900" title={projectTitle}>
                    {projectTitle || "집필"}
                </h1>
                {projectQuery.data?.nextScene && (
                    <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
                        다음 장면 — {projectQuery.data.nextScene}
                    </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                    <label htmlFor="b-paper-size" className="shrink-0 text-xs text-gray-400">
                        용지
                    </label>
                    <select
                        id="b-paper-size"
                        value={paperSize}
                        onChange={(e) => handlePaperSizeChange(e.target.value as PaperSize)}
                        disabled={updateProject.isPending || projectQuery.data == null}
                        className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                    >
                        {(["A4", "A3", "A2", "B4"] as const).map((size) => (
                            <option key={size} value={size}>
                                {size} ({PAPER_PRESETS[size].widthMm}×{PAPER_PRESETS[size].heightMm}mm)
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {/* 챕터 목록 */}
            <div className="border-b border-gray-200 px-2 py-2">
                <ChapterList
                    chapters={chapters}
                    currentChapterId={currentChapterId}
                    onSelect={(id) => {
                        handleChapterSelect(id);
                        setLeftDrawerOpen(false);
                    }}
                    onCreate={handleCreateChapter}
                    onMove={handleMoveChapter}
                    onDelete={handleDeleteChapter}
                    onRename={handleRenameChapter}
                />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                <p className="px-2 py-1 text-xs font-medium text-gray-400">목차</p>
                {outline.items.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-gray-400">
                        본문에 제목(H1~H3)을 넣으면 목차가 생깁니다.
                    </p>
                ) : (
                    outline.items.map((item, i) => (
                        <button
                            key={`${item.index}-${item.text}`}
                            type="button"
                            onClick={() => {
                                outline.selectItem(item);
                                setLeftDrawerOpen(false);
                            }}
                            className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-sm ${
                                outline.activeIndex === i
                                    ? "bg-indigo-50 font-medium text-indigo-700"
                                    : "text-gray-600 hover:bg-gray-50"
                            } ${item.level === 2 ? "pl-5" : item.level === 3 ? "pl-9" : ""}`}
                        >
                            {item.text || "(제목 없음)"}
                        </button>
                    ))
                )}
            </div>
            <div className="border-t border-gray-200 p-3">
                <button
                    type="button"
                    onClick={() => {
                        setEndWorkBody("");
                        setEndWorkError(null);
                        setEndWorkOpen(true);
                        setLeftDrawerOpen(false);
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                    작업 종료
                </button>
            </div>
        </>
    );

    return (
        <div className="relative flex h-[calc(100vh-6.5rem)] gap-4">
            {/* ── 넓은 폭(≥880px): inline 목차 패널 ── */}
            <div className="hidden min-[880px]:flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
                {outlinePanel}
            </div>

            {/* ── 좁은 폭(<880px): 토글 버튼 row + 백드롭 + drawer ── */}
            <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center gap-2 px-2 pt-1.5 min-[880px]:hidden">
                <button
                    type="button"
                    aria-label="목차 패널 열기"
                    onClick={() => setLeftDrawerOpen(true)}
                    className="pointer-events-auto rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 shadow-sm hover:bg-gray-50"
                >
                    목차
                </button>
                <button
                    type="button"
                    aria-label="쪽지·인물 패널 열기"
                    onClick={() => setRightDrawerOpen(true)}
                    className="pointer-events-auto rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 shadow-sm hover:bg-gray-50"
                >
                    쪽지·인물
                </button>
            </div>

            {/* 좁은 폭 좌측 drawer 백드롭 */}
            {leftDrawerOpen && (
                <div
                    aria-hidden="true"
                    className="fixed inset-0 z-20 bg-gray-900/40 min-[880px]:hidden"
                    onClick={() => setLeftDrawerOpen(false)}
                />
            )}
            {/* 좁은 폭 좌측 drawer */}
            <div
                ref={leftDrawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="목차"
                inert={!leftDrawerOpen || undefined}
                className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col overflow-hidden bg-white shadow-xl transition-transform duration-200 min-[880px]:hidden ${
                    leftDrawerOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
                    <span className="text-sm font-medium text-gray-700">목차</span>
                    <button
                        type="button"
                        aria-label="목차 패널 닫기"
                        onClick={() => setLeftDrawerOpen(false)}
                        className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex flex-1 flex-col overflow-hidden">{outlinePanel}</div>
            </div>

            {/* 좁은 폭 우측 drawer 백드롭 */}
            {rightDrawerOpen && (
                <div
                    aria-hidden="true"
                    className="fixed inset-0 z-20 bg-gray-900/40 min-[880px]:hidden"
                    onClick={() => setRightDrawerOpen(false)}
                />
            )}
            {/* 좁은 폭 우측 drawer */}
            <div
                ref={rightDrawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="쪽지·인물"
                inert={!rightDrawerOpen || undefined}
                className={`fixed inset-y-0 right-0 z-30 flex w-80 flex-col overflow-hidden bg-gray-50 shadow-xl transition-transform duration-200 min-[880px]:hidden ${
                    rightDrawerOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
                <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2">
                    <span className="text-sm font-medium text-gray-700">쪽지·인물</span>
                    <button
                        type="button"
                        aria-label="쪽지·인물 패널 닫기"
                        onClick={() => setRightDrawerOpen(false)}
                        className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex flex-1 flex-col overflow-hidden">
                    <BWorkSidePanel
                        projectId={projectId}
                        collapsible={false}
                        tab={panelTab}
                        onTabChange={setPanelTab}
                    />
                </div>
            </div>

            {/* 에디터 영역 — BChapterEditor key={currentChapterId} 로 챕터 전환 시 리마운트 */}
            {Number.isNaN(projectId) ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white">
                    <p className="text-sm text-gray-500">잘못된 작품입니다.</p>
                </div>
            ) : chaptersQuery.isLoading ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white">
                    <p className="text-sm text-gray-400">문서 불러오는 중…</p>
                </div>
            ) : currentChapterId == null ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white">
                    <p className="text-sm text-gray-400">챕터를 선택하거나 생성해 주세요.</p>
                    <Link href="/b/library" className="text-xs text-indigo-600 hover:underline">
                        작품 목록으로
                    </Link>
                </div>
            ) : (
                <BChapterEditor
                    key={currentChapterId}
                    documentId={currentChapterId}
                    projectId={projectId}
                    paperSize={paperSize}
                    chapterTitle={chapters.find((c) => c.id === currentChapterId)?.title}
                    onChapterRename={currentChapterId != null ? (title) => handleRenameChapter(currentChapterId, title) : undefined}
                    onSyncStatus={handleSyncStatus}
                    onConflict={handleConflict}
                    onEditorReady={setEditor}
                />
            )}

            {/* 넓은 폭 inline 우측 패널 */}
            <div className="hidden min-[880px]:contents">
                <BWorkSidePanel
                    projectId={projectId}
                    isOpen={panelOpen}
                    onOpenChange={setPanelOpen}
                    tab={panelTab}
                    onTabChange={setPanelTab}
                />
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

            {/* 충돌 다이얼로그 — BChapterEditor 가 콜백으로 올린 conflict / 해결 핸들러 사용 */}
            {conflictHandlers.conflict != null && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/40 p-4">
                    <div
                        ref={conflictModalRef}
                        role="dialog"
                        aria-modal="true"
                        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
                    >
                        <h2 className="text-lg font-bold text-gray-900">저장 충돌</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            다른 기기(또는 탭)에서 이 문서를 수정했습니다. 어느 쪽을 남길까요?
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={conflictHandlers.reload}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                            >
                                서버 최신본 불러오기
                            </button>
                            <button
                                type="button"
                                onClick={conflictHandlers.overwrite}
                                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                            >
                                내 본문으로 덮어쓰기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {endWorkOpen && (
                <div
                    className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4"
                    onClick={() => !isEndingWork && setEndWorkOpen(false)}
                >
                    <div
                        ref={endWorkModalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="작업 종료"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
                    >
                        <h2 className="text-lg font-bold text-gray-900">작업 종료</h2>
                        <p className="mt-1 text-sm text-gray-500">오늘의 기록을 남겨보세요</p>
                        <textarea
                            autoFocus
                            value={endWorkBody}
                            onChange={(e) => setEndWorkBody(e.target.value)}
                            placeholder="오늘의 기록을 남겨보세요…"
                            rows={4}
                            maxLength={2000}
                            className="mt-3 w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                        <div className="mt-1 flex items-center justify-between">
                            {endWorkError ? (
                                <span className="text-xs text-red-600">{endWorkError}</span>
                            ) : (
                                <span />
                            )}
                            <span className="text-xs text-gray-400">{endWorkBody.length}/2000</span>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setEndWorkOpen(false)}
                                disabled={isEndingWork}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleEndWork}
                                disabled={endWorkBody.trim().length === 0 || isEndingWork}
                                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
