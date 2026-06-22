"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useProjectDocument } from "@/lib/query/useDocument";
import { useProject, useUpdateProject } from "@/lib/query/useProjects";
import { PAPER_PRESETS, type PaperSize } from "@/components/editor/pageLayout";
import { PAPER_LABEL, FONT_SCALE_ORDER, FONT_SCALE_LABEL } from "@/components/custom-editor/geometry";
import type { FontScale, LayoutMode } from "@/types/api";
import { StudioSkeleton } from "./StudioSkeleton";
import { logKeys } from "@/lib/query/useLogs";
import { useWorkSession } from "@/hooks/useWorkSession";
import { rememberLastProject } from "@/lib/lastProject";
import type { OutlineItem } from "@/lib/editor/outline";
import { BWorkSidePanel } from "@/components/b/BWorkSidePanel";
import { ExportDialog } from "@/components/export/ExportDialog";
import { PrintOverlay } from "@/components/export/PrintOverlay";
import { usePdfExport } from "@/lib/export/usePdfExport";
import { useWordExport } from "@/lib/export/useWordExport";
import { useTextExport } from "@/lib/export/useTextExport";
import type { BChapterEditorConflictHandlers, BChapterEditorSyncStatus } from "@/components/custom-editor/types";

/**
 * B형 집필실 셸 (024 US1) — 세션 / drawer / 충돌·종료 모달 / 3패널 레이아웃을
 * 에디터 코어·아웃라인 소스에 독립적으로 캡슐화한다.
 *
 * 033: 챕터 제거 — 작품 1개 = 본문 1개. 좌패널은 작품 설정 + 목차(모델 파생)만.
 *
 * 주입 슬롯 2개:
 * - `renderEditor` — 에디터 코어(자체엔진 BCustomChapterEditor)를 셸에 끼운다.
 *   셸이 제공하는 `onSyncStatus`(flushDraft 수집) / `onConflict`(충돌 다이얼로그 결선)를 결선한다.
 * - `outline` — 목차 소스. 자체엔진 라우트가 엔진 파생 아웃라인을 주입한다.
 *
 * 에디터는 `key={documentId}` 리마운트로 세션을 documentId 단위로 격리(016 거짓 409 제거).
 */

/** 에디터 슬롯에 셸이 넘기는 인자 — 본문 id / 작품 / 용지 + 상태·충돌 결선 콜백. */
export interface BStudioEditorSlotArgs {
    /** 작품의 단일 본문 id (BCustomChapterEditor 의 currentChapterId 결선 호환). */
    currentChapterId: number;
    projectId: number;
    paperSize: PaperSize;
    /** 작품별 글자 크기 5단(031 US5) — 판형 기본 위 덮어쓰기. */
    fontScale: FontScale;
    /** 출판 방식(031). web=연속 렌더(판형·페이지 분할 없음). */
    layoutMode: LayoutMode;
    /** 실시간 글자수 보고(031 분량 지표) — 에디터가 본문 변경 시 셸로 올림. */
    onWordCountChange: (count: number) => void;
    /** 저장 상태 / flushDraft 를 셸로 전달. */
    onSyncStatus: (status: BChapterEditorSyncStatus) => void;
    /** 충돌 상태 / 해결 핸들러를 셸로 전달 — 셸이 충돌 다이얼로그를 렌더. */
    onConflict: (handlers: BChapterEditorConflictHandlers) => void;
}

/** 아웃라인 소스 — 에디터 파생 목차(items)·현재 섹션(activeIndex)·점프(selectItem). */
export interface BStudioOutlineSource {
    items: OutlineItem[];
    activeIndex: number | null;
    selectItem: (item: OutlineItem) => void;
}

interface BStudioShellProps {
    /** 에디터 슬롯 — 셸이 본문 id·결선 콜백을 넘기면 에디터 코어를 반환한다. */
    renderEditor: (args: BStudioEditorSlotArgs) => ReactNode;
    /** 아웃라인 소스 — 에디터 코어에서 파생한 목차를 주입. */
    outline: BStudioOutlineSource;
}

export function BStudioShell({ renderEditor, outline }: BStudioShellProps) {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const projectId = Number(params.id);
    const queryClient = useQueryClient();

    const projectQuery = useProject(projectId);

    // 작품의 단일 본문 로드 (033 — 챕터 제거).
    const documentQuery = useProjectDocument(projectId);
    const documentId = documentQuery.data?.id ?? null;

    // 집필실 진입 시 스켈레톤 → 에디터 크로스페이드. 에디터가 준비되면 스켈레톤 오버레이를
    // 에디터 위에 겹쳐 fade-out 시킨다(겹침 전환). projectId 변경(작품 전환) 시 다시 재생.
    const editorReady =
        !Number.isNaN(projectId) &&
        !projectQuery.isLoading &&
        !documentQuery.isLoading &&
        !projectQuery.isError &&
        projectQuery.data != null &&
        documentId != null;
    const [showCrossfade, setShowCrossfade] = useState(false);
    const crossfadeDoneRef = useRef(false);
    useEffect(() => {
        crossfadeDoneRef.current = false;
        setShowCrossfade(false);
    }, [projectId]);
    useEffect(() => {
        if (editorReady && !crossfadeDoneRef.current) {
            crossfadeDoneRef.current = true;
            setShowCrossfade(true);
        }
    }, [editorReady]);

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
    // 내보내기 다이얼로그(023 Round 3 진입점).
    const [exportOpen, setExportOpen] = useState(false);
    const { printModels, exportPdf, clearPrint } = usePdfExport();

    // 에디터 코어로부터 받은 저장 상태 / 충돌 핸들러
    const [conflictHandlers, setConflictHandlers] = useState<BChapterEditorConflictHandlers>({ conflict: null, reload: () => {}, overwrite: () => {} });
    // 자동저장 상태 — 헤더 배지 표시용.
    const [syncStatus, setSyncStatus] = useState<BChapterEditorSyncStatus["syncStatus"]>("idle");

    const handleSyncStatus = useCallback(({ syncStatus: status }: BChapterEditorSyncStatus) => {
        setSyncStatus(status);
    }, []);

    const handleConflict = useCallback((handlers: BChapterEditorConflictHandlers) => {
        setConflictHandlers(handlers);
    }, []);

    const { endWithLog } = useWorkSession(projectId);
    const updateProject = useUpdateProject();

    // 판형·출판방식은 시리즈 종속(033 R2) — 작품 단위 개별 설정 불가(FR-007). BE 가 시리즈값 or 기본값으로
    // 해석한 effective 값을 그대로 쓴다. 변경은 시리즈(라이브러리)에서만 한다.
    const paperSize: PaperSize = projectQuery.data?.effectivePaperSize ?? "A4";
    const layoutMode: LayoutMode = projectQuery.data?.effectiveLayoutMode ?? "paper";
    const fontScale: FontScale = projectQuery.data?.fontScale ?? "m";
    // 분량 지표(031) — 에디터가 보고하는 실시간 글자수(미보고 시 저장값 fallback). 종이=원고지 매수, 웹=글자수.
    const savedWordCount = documentQuery.data?.wordCount ?? 0;
    const [liveWordCount, setLiveWordCount] = useState<number | null>(null);
    const displayWordCount = liveWordCount ?? savedWordCount;
    const totalWordCount = displayWordCount;
    const targetLength = projectQuery.data?.targetLength ?? null;
    const exportWord = useWordExport(projectId, paperSize);
    const handleFontScaleChange = (next: FontScale) => {
        if (next === fontScale) return;
        updateProject.mutate({ id: projectId, patch: { fontScale: next } });
    };

    useEffect(() => {
        if (Number.isFinite(projectId)) rememberLastProject(projectId);
    }, [projectId]);

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
            router.push("/library");
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

    const projectTitle = projectQuery.data?.title ?? "";
    const exportText = useTextExport(projectTitle);

    /** 목차 패널 내용 — 좁은 폭 drawer 와 넓은 폭 inline 모두 동일 마크업 공유. */
    const outlinePanel = (
        <>
            <div className="border-b border-gray-200 p-3">
                <Link href="/library" className="text-xs text-gray-400 hover:text-terracotta-600">
                    ← 작품 목록
                </Link>
                <h1 className="mt-1 truncate text-base font-bold text-gray-900" title={projectTitle}>
                    {projectTitle || "집필"}
                </h1>
                {projectQuery.data?.nextScene && (
                    <p className="mt-2 rounded-md bg-olive-50 px-2 py-1.5 text-xs text-olive-700">
                        다음 장면 — {projectQuery.data.nextScene}
                    </p>
                )}
                {/* 판형·출판방식은 시리즈에서 설정(033 R2 / FR-007). 집필실은 effective 값 표시만. */}
                <p className="mt-2 text-xs text-gray-400">
                    {layoutMode === "web"
                        ? "웹 출판 (연속·글자수)"
                        : `종이 출판 · ${PAPER_LABEL[paperSize]} (${PAPER_PRESETS[paperSize].widthMm}×${PAPER_PRESETS[paperSize].heightMm}mm)`}
                    <span className="ml-1 text-gray-300">· 시리즈 설정</span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                    <label htmlFor="b-font-scale" className="shrink-0 text-xs text-gray-400">
                        글자 크기
                    </label>
                    <select
                        id="b-font-scale"
                        value={fontScale}
                        onChange={(e) => handleFontScaleChange(e.target.value as FontScale)}
                        disabled={updateProject.isPending || projectQuery.data == null}
                        className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1 disabled:opacity-50"
                    >
                        {FONT_SCALE_ORDER.map((scale) => (
                            <option key={scale} value={scale}>
                                {FONT_SCALE_LABEL[scale]}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {/* 내보내기 */}
            <div className="border-b border-gray-200 px-3 py-2">
                <button
                    type="button"
                    onClick={() => {
                        setExportOpen(true);
                        setLeftDrawerOpen(false);
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                    내보내기
                </button>
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
                                    ? "bg-terracotta-50 font-medium text-terracotta-700"
                                    : "text-gray-600 hover:bg-gray-50"
                            } ${item.level === 2 ? "pl-5" : item.level === 3 ? "pl-9" : ""}`}
                        >
                            {item.text || "(제목 없음)"}
                        </button>
                    ))
                )}
            </div>
            {/* 자동저장 상태 배지 */}
            <div
                aria-live="polite"
                aria-atomic="true"
                className="border-t border-gray-200 px-3 py-1.5"
            >
                {syncStatus === "syncing" && (
                    <p className="text-xs text-gray-400">저장 중…</p>
                )}
                {syncStatus === "synced" && (
                    <p className="text-xs text-green-600">저장됨</p>
                )}
                {syncStatus === "error" && (
                    <p className="text-xs text-red-500">저장 실패</p>
                )}
                {syncStatus === "conflict" && (
                    <p className="text-xs text-amber-600">저장 충돌</p>
                )}
                {(syncStatus === "idle" || !syncStatus) && (
                    <p className="text-xs text-gray-300">동기화됨</p>
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
            <div className="hidden min-[880px]:flex w-60 shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
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
                        wordCount={totalWordCount}
                        targetLength={targetLength}
                    />
                </div>
            </div>

            {/* 에디터 영역 — renderEditor 슬롯. 본문 단위 리마운트 책임은 슬롯 구현이 진다. */}
            {Number.isNaN(projectId) ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white">
                    <p className="text-sm text-gray-500">잘못된 작품입니다.</p>
                </div>
            ) : projectQuery.isLoading || documentQuery.isLoading ? (
                <StudioSkeleton />
            ) : projectQuery.isError || projectQuery.data == null ? (
                // 작품 자체가 없음(잘못된 URL/삭제됨) — 명확히 안내.
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white">
                    <p className="text-sm text-gray-500">작품을 찾을 수 없습니다.</p>
                    <Link href="/library" className="text-sm font-medium text-terracotta-600 hover:underline">
                        작품 목록으로
                    </Link>
                </div>
            ) : documentId == null ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white">
                    <p className="text-sm text-gray-400">본문을 불러올 수 없습니다.</p>
                    <Link href="/library" className="text-xs text-terracotta-600 hover:underline">
                        작품 목록으로
                    </Link>
                </div>
            ) : (
                <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                    {renderEditor({
                        currentChapterId: documentId,
                        projectId,
                        paperSize,
                        fontScale,
                        layoutMode,
                        onWordCountChange: setLiveWordCount,
                        onSyncStatus: handleSyncStatus,
                        onConflict: handleConflict,
                    })}
                    {showCrossfade && (
                        <div
                            className="studio-crossfade-overlay"
                            aria-hidden="true"
                            onAnimationEnd={() => setShowCrossfade(false)}
                        >
                            <StudioSkeleton />
                        </div>
                    )}
                </div>
            )}

            {/* 넓은 폭 inline 우측 패널 */}
            <div className="hidden min-[880px]:contents">
                <BWorkSidePanel
                    projectId={projectId}
                    isOpen={panelOpen}
                    onOpenChange={setPanelOpen}
                    tab={panelTab}
                    onTabChange={setPanelTab}
                    wordCount={totalWordCount}
                    targetLength={targetLength}
                />
            </div>

            {exportOpen && documentQuery.data != null && (
                <ExportDialog
                    open
                    document={{ id: documentQuery.data.id, title: documentQuery.data.title, wordCount: savedWordCount }}
                    paperSize={paperSize}
                    onExportPdf={(req) => { setExportOpen(false); exportPdf(req); }}
                    onExportWord={(format, req) => { setExportOpen(false); exportWord(format, req); }}
                    onExportText={(format, req) => { setExportOpen(false); exportText(format, req); }}
                    onClose={() => setExportOpen(false)}
                />
            )}

            {printModels && <PrintOverlay models={printModels} paperSize={paperSize} onDone={clearPrint} />}

            {/* 충돌 다이얼로그 — 에디터 슬롯이 콜백으로 올린 conflict / 해결 핸들러 사용 */}
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
                                className="rounded-md bg-terracotta-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700"
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
                            className="mt-3 w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
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
                                className="rounded-md bg-terracotta-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700 disabled:opacity-50"
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
