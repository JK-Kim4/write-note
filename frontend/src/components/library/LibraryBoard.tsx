"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import {
    useCategories,
    useCreateCategory,
    useDeleteCategory,
    useMoveProjectCategory,
    useRenameCategory,
} from "@/lib/query/useCategories";
import { useMyShareLinks } from "@/lib/query/useShares";
import { DraggableWorkCard, workDragId } from "./DraggableWorkCard";
import { CategoryTile, categoryDropId, type CategoryUpdateInput } from "./CategoryTile";
import { InlineBoardList } from "@/components/board/InlineBoardList";
import { SeriesPublishFields } from "./SeriesPublishFields";
import { SeriesExportDialog, type SeriesExportSubmit } from "./SeriesExportDialog";
import { PrintOverlay } from "@/components/export/PrintOverlay";
import { usePdfExport } from "@/lib/export/usePdfExport";
import { exportSeriesWord } from "@/lib/export/useWordExport";
import { useTextExport } from "@/lib/export/useTextExport";
import { collectSeriesOrderedIds } from "@/lib/export/seriesExport";
import { getProjectDocument } from "@/lib/api/document";
import type { CreateCategoryInput } from "@/lib/api/categories";
import type { CategoryResponse, LayoutMode } from "@/types/api";
import type { PaperSize } from "@/components/editor/pageLayout";
import type { ProjectCard } from "@/lib/types/domain";

/** 경로 "내 작품" — 시리즈 안에서 카드를 여기로 드롭하면 미분류로 빠짐(droppable id="root"). */
function RootCrumb({ onClick }: { onClick: () => void }) {
    const { setNodeRef, isOver } = useDroppable({ id: "root" });
    return (
        <button
            ref={setNodeRef}
            type="button"
            onClick={onClick}
            className={`rounded-md px-2 py-1 text-sm font-semibold text-accent-text hover:bg-accent-soft ${
                isOver ? "bg-terracotta-100 ring-2 ring-terracotta-300" : ""
            }`}
        >
            내 작품
        </button>
    );
}

/** 드릴인 상태에서 카드를 끌어다 놓아 시리즈 밖(미분류=상위)으로 빼내는 드롭존. droppable id="uncat-zone". */
function DropToParent({ active }: { active: boolean }) {
    const { setNodeRef, isOver } = useDroppable({ id: "uncat-zone" });
    return (
        <div
            ref={setNodeRef}
            aria-label="시리즈에서 빼내기(내 작품으로)"
            className={`mb-4 flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors ${
                isOver
                    ? "border-terracotta-500 bg-terracotta-100 text-accent-text"
                    : active
                      ? "border-terracotta-300 bg-accent-soft text-accent-text"
                      : "border-border text-faint"
            }`}
        >
            <span aria-hidden>↑</span>
            여기로 끌어다 놓으면 미분류로 빼냅니다
        </div>
    );
}

type FlyingState = {
    card: ProjectCard;
    from: { left: number; top: number; width: number; height: number };
    to: { left: number; top: number; width: number; height: number };
};

/** 드롭 성공 시 카드가 타일 중심으로 빨려 들어가는 애니메이션(@dnd-kit 기본 snap-back 대체). */
function FlyingCard({ flying, onDone }: { flying: FlyingState; onDone: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const { from, to } = flying;
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        const raf = requestAnimationFrame(() => {
            el.style.transform = `translate(${dx}px, ${dy}px) scale(0.16) rotate(8deg)`;
            el.style.opacity = "0";
        });
        const t = setTimeout(onDone, 380);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(t);
        };
    }, [flying, onDone]);
    return (
        <div
            ref={ref}
            aria-hidden
            style={{
                position: "fixed",
                left: flying.from.left,
                top: flying.from.top,
                width: flying.from.width,
                zIndex: 60,
                pointerEvents: "none",
                transition: "transform .38s cubic-bezier(.22,1,.36,1), opacity .38s",
                borderRadius: 14,
                boxShadow: "0 20px 44px -12px rgba(42,38,32,.4)",
            }}
        >
            <DraggableWorkCard card={flying.card} overlay onDelete={() => {}} onEdit={() => {}} onArchive={() => {}} />
        </div>
    );
}

type LibraryBoardProps = {
    cards: ProjectCard[];
    /** 새 작품 시작 — categoryId 가 있으면 그 시리즈 안에서 생성(자동 배정), null 이면 미분류. */
    onNewWork: (categoryId: number | null) => void;
    onEditWork: (card: ProjectCard) => void;
    onDeleteWork: (card: ProjectCard) => void;
    onArchiveWork: (id: number) => void;
};

/**
 * 작품 페이지 보드(032) — 폴더형 "시리즈" + 드릴인 + 드래그 분류.
 * 루트=시리즈 타일(책등 스택)+미분류 작품, 시리즈 진입=경로+그 작품. 카드를 타일로 드래그하면 빨려 들어간다.
 * page.tsx 의 작품 생성/편집/보관/삭제 모달과 분리(메모이제이션 격리 + 비대화 방지).
 */
export function LibraryBoard({ cards, onNewWork, onEditWork, onDeleteWork, onArchiveWork }: LibraryBoardProps) {
    const { data: categories } = useCategories();
    // 공유 진입점(047) — 작품 카드·시리즈 타일의 "공유 중 · N" 배지·공유 버튼용. 호스트에서 1회 조회(SharePopover 와 같은 쿼리 → dedup).
    const { data: shareLinks } = useMyShareLinks();
    const createCategory = useCreateCategory();
    const renameCategory = useRenameCategory();
    const deleteCategory = useDeleteCategory();
    const moveProject = useMoveProjectCategory();

    const cats = categories ?? [];

    // 드릴인 폴더 상태 — URL ?folder=<id> 동기(뒤로가기·새로고침 보존)
    const [currentFolder, setCurrentFolder] = useState<number | null>(null);
    useEffect(() => {
        const read = () => {
            const f = new URLSearchParams(window.location.search).get("folder");
            setCurrentFolder(f ? Number(f) : null);
        };
        read();
        window.addEventListener("popstate", read);
        return () => window.removeEventListener("popstate", read);
    }, []);
    const navigateFolder = useCallback((id: number | null) => {
        setCurrentFolder(id);
        window.history.pushState(null, "", id == null ? "/library" : `/library?folder=${id}`);
    }, []);

    const [addingCat, setAddingCat] = useState(false);
    const [newCatName, setNewCatName] = useState("");
    // 신규 시리즈 메타(033) — 선택, 빈값=미설정(하위 작품 기본값 fallback).
    const [newCatGenre, setNewCatGenre] = useState("");
    const [newCatSynopsis, setNewCatSynopsis] = useState("");
    const [newCatPaperSize, setNewCatPaperSize] = useState<PaperSize | null>(null);
    const [newCatLayoutMode, setNewCatLayoutMode] = useState<LayoutMode | null>(null);
    const [newCatTargetLength, setNewCatTargetLength] = useState<number | null>(null);
    const [deleteCatTarget, setDeleteCatTarget] = useState<CategoryResponse | null>(null);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [flying, setFlying] = useState<FlyingState | null>(null);
    const [absorbId, setAbsorbId] = useState<string | null>(null);
    const clearFlying = useCallback(() => setFlying(null), []);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    // 존재하지 않는(삭제됨/잘못된 URL) 시리즈 진입은 루트로 간주 — effect 없이 렌더 파생
    const activeFolder = currentFolder != null && cats.some((c) => c.id === currentFolder) ? currentFolder : null;
    const currentCategory = activeFolder == null ? null : cats.find((c) => c.id === activeFolder) ?? null;
    const uncategorized = cards.filter((c) => c.categoryId == null);
    const folderCards = activeFolder == null ? [] : cards.filter((c) => c.categoryId === activeFolder);
    const activeCard = activeDragId ? cards.find((c) => workDragId(c.id) === activeDragId) ?? null : null;

    // 시리즈 내보내기(033)
    const [exportOpen, setExportOpen] = useState(false);
    const seriesPaper: PaperSize = currentCategory?.paperSize ?? "A4";
    const seriesName = currentCategory?.name ?? "시리즈";
    const { printModels, exportPdf, clearPrint } = usePdfExport();
    const exportText = useTextExport(seriesName);

    // React Compiler 가 auto-memo (이 파일의 다른 핸들러처럼 수동 useCallback 안 씀 — 수동 deps 는 컴파일러와 충돌)
    const handleSeriesExport = async (s: SeriesExportSubmit) => {
        setExportOpen(false);
        const orderedIds = await collectSeriesOrderedIds(s.orderedProjectIds, getProjectDocument);
        const req = { orderedIds, joinMode: s.joinMode };
        if (s.target.kind === "pdf") {
            exportPdf(req);
        } else if (s.target.kind === "text") {
            exportText(s.target.format, req);
        } else {
            await exportSeriesWord(s.orderedProjectIds[0], seriesPaper, seriesName, s.target.format, req);
        }
    };

    const handleDragStart = (e: DragStartEvent) => setActiveDragId(String(e.active.id));
    const handleDragEnd = (e: DragEndEvent) => {
        setActiveDragId(null);
        const { active, over } = e;
        if (!over) return;
        const projectId = Number(String(active.id).replace("work:", ""));
        const overId = String(over.id);
        const targetCat =
            overId === "root" || overId === "uncat-zone" ? null : overId.startsWith("cat:") ? Number(overId.slice(4)) : undefined;
        if (targetCat === undefined) return;
        // 빨려 들어가는 애니메이션 (모션 줄이기 존중)
        const card = cards.find((c) => workDragId(c.id) === String(active.id));
        const from = active.rect.current.translated;
        const to = over.rect;
        const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (card && from && to && !reduce) {
            setFlying({
                card,
                from: { left: from.left, top: from.top, width: from.width, height: from.height },
                to: { left: to.left, top: to.top, width: to.width, height: to.height },
            });
            if (targetCat != null) {
                setAbsorbId(overId);
                window.setTimeout(() => setAbsorbId(null), 340);
            }
        }
        moveProject.mutate({ projectId, categoryId: targetCat });
    };

    const resetNewCat = () => {
        setNewCatName("");
        setNewCatGenre("");
        setNewCatSynopsis("");
        setNewCatPaperSize(null);
        setNewCatLayoutMode(null);
        setNewCatTargetLength(null);
        setAddingCat(false);
    };
    const submitNewCat = () => {
        const trimmed = newCatName.trim();
        if (trimmed) {
            const input: CreateCategoryInput = {
                name: trimmed,
                genre: newCatGenre.trim() || null,
                synopsis: newCatSynopsis.trim() || null,
                paperSize: newCatPaperSize,
                layoutMode: newCatLayoutMode,
                targetLength: newCatTargetLength,
            };
            createCategory.mutate(input);
        }
        resetNewCat();
    };
    const handleUpdateCat = useCallback(
        (id: number, input: CategoryUpdateInput) => renameCategory.mutate({ id, input }),
        [renameCategory],
    );
    const handleConfirmDeleteCat = async () => {
        if (!deleteCatTarget || deleteCategory.isPending) return;
        try {
            await deleteCategory.mutateAsync(deleteCatTarget.id);
            if (currentFolder === deleteCatTarget.id) navigateFolder(null);
            setDeleteCatTarget(null);
        } catch {
            // 실패 — 다이얼로그 유지
        }
    };

    const renderCard = (card: ProjectCard) => (
        <DraggableWorkCard
            key={card.id}
            card={card}
            onDelete={() => onDeleteWork(card)}
            onEdit={onEditWork}
            onArchive={onArchiveWork}
            shareLinks={shareLinks ?? []}
        />
    );

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {activeFolder == null ? (
                <div className="space-y-8">
                    {/* 시리즈 타일 */}
                    <section>
                        <h2 className="mb-3 text-sm font-semibold text-muted">시리즈</h2>
                        <div className="grid grid-cols-2 items-start gap-4 sm:grid-cols-3 lg:grid-cols-4">
                            {cats.map((c) => (
                                <CategoryTile
                                    key={c.id}
                                    category={c}
                                    works={cards.filter((w) => w.categoryId === c.id)}
                                    onOpen={navigateFolder}
                                    onUpdate={handleUpdateCat}
                                    onDelete={setDeleteCatTarget}
                                    shareLinks={shareLinks ?? []}
                                    absorbing={absorbId === categoryDropId(c.id)}
                                />
                            ))}
                            {addingCat ? (
                                <div className="flex min-h-[150px] flex-col rounded-2xl border border-terracotta-400 bg-surface p-3.5">
                                    <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-border text-xs text-faint">
                                        새 시리즈
                                    </div>
                                    <input
                                        autoFocus
                                        value={newCatName}
                                        onChange={(e) => setNewCatName(e.target.value)}
                                        onKeyDown={(e) => {
                                            // 한글 IME 조합 중 Enter 이중 발화로 시리즈가 중복 생성되는 것 방지(조합 중이면 무시).
                                            if (e.key === "Enter" && !e.nativeEvent.isComposing) submitNewCat();
                                            if (e.key === "Escape") resetNewCat();
                                        }}
                                        placeholder="시리즈 이름"
                                        maxLength={60}
                                        aria-label="새 시리즈 이름"
                                        className="mt-2.5 w-full rounded-md border border-terracotta-300 px-2 py-1 text-sm font-bold focus:border-terracotta-500 focus:outline-none"
                                    />
                                    <p className="mt-1 text-[11px] text-faint">예: 잿빛 탑 연대기 · 여름 단편선</p>
                                    <SeriesPublishFields
                                        idPrefix="new-series"
                                        genre={newCatGenre}
                                        synopsis={newCatSynopsis}
                                        paperSize={newCatPaperSize}
                                        layoutMode={newCatLayoutMode}
                                        targetLength={newCatTargetLength}
                                        onGenreChange={setNewCatGenre}
                                        onSynopsisChange={setNewCatSynopsis}
                                        onPaperSizeChange={setNewCatPaperSize}
                                        onLayoutModeChange={setNewCatLayoutMode}
                                        onTargetLengthChange={setNewCatTargetLength}
                                    />
                                    <div className="mt-2 flex gap-1.5">
                                        <button
                                            type="button"
                                            onClick={submitNewCat}
                                            disabled={newCatName.trim() === ""}
                                            className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-accent-ink hover:bg-terracotta-700 disabled:opacity-50"
                                        >
                                            만들기
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetNewCat}
                                            className="rounded-md border border-border px-3 py-1 text-xs text-muted-strong hover:bg-surface-2"
                                        >
                                            취소
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    data-tour="new-series"
                                    onClick={() => setAddingCat(true)}
                                    className="flex min-h-[150px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border-strong text-sm text-muted hover:border-terracotta-400 hover:bg-accent-soft hover:text-accent-text"
                                >
                                    <span className="text-2xl leading-none">+</span>
                                    <span>새 시리즈</span>
                                </button>
                            )}
                        </div>
                        {cats.length === 0 && !addingCat && (
                            <p className="mt-2 text-xs text-faint">아직 만든 시리즈가 없어요. 작품을 묶을 시리즈를 만들어 보세요.</p>
                        )}
                    </section>

                    {/* 미분류 작품 */}
                    <section>
                        <h2 className="mb-3 text-sm font-semibold text-muted">미분류 작품</h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {uncategorized.map(renderCard)}
                            <button
                                type="button"
                                data-tour="new-work-root"
                                onClick={() => onNewWork(null)}
                                className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-border-strong text-sm text-muted hover:border-terracotta-400 hover:text-accent-text"
                            >
                                + 새 작품 시작하기
                            </button>
                        </div>
                        {uncategorized.length === 0 && (
                            <p className="mt-2 text-sm text-faint">
                                {cards.length === 0 ? "아직 작품이 없어요. 첫 작품을 시작해 보세요." : "모든 작품이 시리즈에 담겨 있어요."}
                            </p>
                        )}
                    </section>
                </div>
            ) : (
                <div>
                    <div className="mb-4 flex items-center gap-2">
                        <RootCrumb onClick={() => navigateFolder(null)} />
                        <span className="text-faint">/</span>
                        <span className="text-sm font-semibold text-ink">
                            {currentCategory?.name ?? "시리즈"} · {folderCards.length}편
                        </span>
                        {folderCards.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setExportOpen(true)}
                                className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm text-ink-2 hover:bg-accent-soft hover:text-accent-text"
                            >
                                내보내기
                            </button>
                        )}
                    </div>
                    {/* 상위(내 작품)로 빼내는 드롭존 — 드릴인 상태에서 카드를 끌어다 놓으면 미분류로 이동 */}
                    <DropToParent active={activeDragId != null} />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {folderCards.map(renderCard)}
                        <button
                            type="button"
                            onClick={() => onNewWork(activeFolder)}
                            className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-border-strong text-sm text-muted hover:border-terracotta-400 hover:text-accent-text"
                        >
                            + 새 작품 시작하기
                        </button>
                    </div>
                    {folderCards.length === 0 && (
                        <p className="mt-3 text-sm text-faint">
                            아직 이 시리즈에 작품이 없어요. 새로 시작하거나, 다른 작품을 끌어다 놓으세요.
                        </p>
                    )}

                    {/* 시리즈 보드(042 내부 탭) — 이 시리즈에 매달린 플롯 보드. 생성은 이 시리즈 소속 자동. */}
                    <section className="mt-8">
                        <h2 className="mb-3 text-sm font-semibold text-gray-500">시리즈 보드</h2>
                        <div className="max-w-md">
                            <InlineBoardList
                                ownerType="category"
                                ownerId={activeFolder}
                                emptyHint="아직 이 시리즈 보드가 없어요. 시리즈를 관통하는 인물·연표·떡밥을 보드로 펼쳐 보세요."
                            />
                        </div>
                    </section>
                </div>
            )}

            <DragOverlay dropAnimation={null}>
                {activeCard ? (
                    <DraggableWorkCard
                        card={activeCard}
                        overlay
                        onDelete={() => {}}
                        onEdit={() => {}}
                        onArchive={() => {}}
                    />
                ) : null}
            </DragOverlay>

            {flying && <FlyingCard flying={flying} onDone={clearFlying} />}

            {/* 조건부 마운트 — 열 때마다 현재 folderCards 로 다이얼로그 useState(order/selected) 초기화(항상 마운트 시 빈 works 로 고정되는 버그 방지) */}
            {exportOpen && (
                <SeriesExportDialog
                    open
                    works={folderCards}
                    seriesName={seriesName}
                    onSubmit={handleSeriesExport}
                    onClose={() => setExportOpen(false)}
                />
            )}
            {printModels && <PrintOverlay models={printModels} paperSize={seriesPaper} onDone={clearPrint} />}

            {/* 시리즈 삭제 확인 — 작품은 미분류로 보존 */}
            {deleteCatTarget && (
                <div
                    className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4"
                    onClick={() => !deleteCategory.isPending && setDeleteCatTarget(null)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="시리즈 삭제"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-lg"
                    >
                        <h2 className="text-lg font-bold text-ink">시리즈 삭제</h2>
                        <p className="mt-2 text-sm text-muted-strong">
                            「{deleteCatTarget.name}」 시리즈를 삭제할까요? 시리즈 안의 작품은 사라지지 않고 미분류로 이동합니다.
                        </p>
                        {deleteCategory.isError && (
                            <p className="mt-2 text-sm text-red-600">삭제에 실패했습니다. 다시 시도해 주세요.</p>
                        )}
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setDeleteCatTarget(null)}
                                disabled={deleteCategory.isPending}
                                className="rounded-md border border-border-strong px-4 py-2 text-sm text-muted-strong hover:bg-surface-2 disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteCat}
                                disabled={deleteCategory.isPending}
                                className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                                {deleteCategory.isPending ? "삭제 중…" : "삭제"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DndContext>
    );
}
