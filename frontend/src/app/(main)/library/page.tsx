"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
    useArchiveProject,
    useArchivedProjects,
    useCreateProject,
    useDeleteProject,
    useProjectCards,
    useUnarchiveProject,
    useUpdateProject,
} from "@/lib/query/useProjects";
import { useCategories, useMoveProjectCategory } from "@/lib/query/useCategories";
import { LibraryBoard } from "@/components/library/LibraryBoard";
import { useModalDismiss } from "@/lib/useModalDismiss";
import { usePreferences } from "@/stores/preferences";
import { PAPER_PRESETS, PAPER_SIZE_ORDER, type PaperSize } from "@/components/editor/pageLayout";
import { PAPER_LABEL } from "@/components/custom-editor/geometry";
import type { CategoryResponse, LayoutMode } from "@/types/api";
import type { Project, ProjectCard } from "@/lib/types/domain";

/**
 * 작품 페이지(032) — 폴더형 모음 + 드릴인 보드(LibraryBoard) + 작품 생성/편집/보관/삭제 모달.
 * 모음 타일·드래그 분류·드릴인은 LibraryBoard 에 분리(메모이제이션 격리). 본 컴포넌트는 데이터 로드 + 모달 소유.
 */

/** 생성/편집 공용 폼 필드 상태 */
type ProjectFormState = {
    title: string;
    genre: string;
    targetLengthRaw: string;
    synopsis: string;
    toneNotes: string;
    worldNotes: string;
    nextScene: string;
    paperSize: PaperSize;
    /** 출판 방식 (031). 생성 시 null=미선택(강제 선택). 편집은 기존 작품 값. */
    layoutMode: LayoutMode | null;
    /** 소속 시리즈(032). null=미분류. 편집 모달에서만 변경 — 저장 시 moveProjectCategory 로 반영. */
    categoryId: number | null;
};

function emptyForm(defaultPaperSize: PaperSize): ProjectFormState {
    return { title: "", genre: "", targetLengthRaw: "", synopsis: "", toneNotes: "", worldNotes: "", nextScene: "", paperSize: defaultPaperSize, layoutMode: null, categoryId: null };
}

function fromProject(p: Project, defaultPaperSize: PaperSize): ProjectFormState {
    return {
        title: p.title,
        genre: p.genre ?? "",
        targetLengthRaw: p.targetLength != null ? String(p.targetLength) : "",
        synopsis: p.synopsis ?? "",
        toneNotes: p.toneNotes ?? "",
        worldNotes: p.worldNotes ?? "",
        nextScene: p.nextScene ?? "",
        paperSize: p.paperSize ?? defaultPaperSize,
        layoutMode: p.layoutMode,
        categoryId: p.categoryId,
    };
}

type ProjectFormProps = {
    formRef: React.RefObject<HTMLFormElement | null>;
    mode: "create" | "edit";
    form: ProjectFormState;
    setForm: React.Dispatch<React.SetStateAction<ProjectFormState>>;
    lengthError: string | null;
    setLengthError: (v: string | null) => void;
    /** 편집 모달의 시리즈 드롭다운 옵션(032). 생성 모달은 미사용. */
    categories: CategoryResponse[];
    isPending: boolean;
    isError: boolean;
    errorMessage: string;
    onSubmit: (e: FormEvent) => void;
    onCancel: () => void;
};

function ProjectFormModal({
    formRef,
    mode,
    form,
    setForm,
    lengthError,
    setLengthError,
    categories,
    isPending,
    isError,
    errorMessage,
    onSubmit,
    onCancel,
}: ProjectFormProps) {
    const title = mode === "create" ? "새 작품" : "작품 편집";
    const submitLabel = mode === "create" ? "만들기" : "저장";
    const pendingLabel = mode === "create" ? "만드는 중…" : "저장 중…";

    return (
        <form
            ref={formRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onSubmit={onSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
        >
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            {isError && (
                <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                    {errorMessage}
                </p>
            )}
            <label className="mt-4 block text-sm text-gray-600">
                제목
                <input
                    autoFocus
                    aria-required="true"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="작품 제목"
                    maxLength={120}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                />
            </label>
            {mode === "edit" && (
                <label className="mt-3 block text-sm text-gray-600">
                    시리즈
                    <select
                        value={form.categoryId ?? ""}
                        onChange={(e) =>
                            setForm((f) => ({ ...f, categoryId: e.target.value === "" ? null : Number(e.target.value) }))
                        }
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                    >
                        <option value="">분류 없음(미분류)</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            {mode === "create" && (
                <fieldset className="mt-4">
                    <legend className="text-sm text-gray-600">
                        출판 방식 <span className="text-red-500">*</span>
                    </legend>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                        {(
                            [
                                { value: "paper", label: "종이 출판", desc: "판형·페이지 분할" },
                                { value: "web", label: "웹 출판", desc: "연속 글쓰기·글자수" },
                            ] as const
                        ).map((opt) => {
                            const selected = form.layoutMode === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => setForm((f) => ({ ...f, layoutMode: opt.value }))}
                                    className={`rounded-md border px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1 ${
                                        selected
                                            ? "border-terracotta-500 bg-terracotta-50 text-terracotta-800"
                                            : "border-gray-300 text-gray-700 hover:bg-gray-50"
                                    }`}
                                >
                                    <span className="block font-medium">{opt.label}</span>
                                    <span className="block text-xs text-gray-500">{opt.desc}</span>
                                </button>
                            );
                        })}
                    </div>
                </fieldset>
            )}
            <label className="mt-3 block text-sm text-gray-600">
                장르 (선택)
                <input
                    value={form.genre}
                    onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))}
                    placeholder="예: 장편소설, 에세이"
                    maxLength={100}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                />
            </label>
            {form.layoutMode !== "web" && (
                <label className="mt-3 block text-sm text-gray-600">
                    용지 크기
                    <select
                        value={form.paperSize}
                        onChange={(e) => setForm((f) => ({ ...f, paperSize: e.target.value as PaperSize }))}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                    >
                        {PAPER_SIZE_ORDER.map((size) => (
                            <option key={size} value={size}>
                                {PAPER_LABEL[size]} ({PAPER_PRESETS[size].widthMm}×{PAPER_PRESETS[size].heightMm}mm)
                            </option>
                        ))}
                    </select>
                </label>
            )}
            <label className="mt-3 block text-sm text-gray-600">
                목표 분량 (선택)
                <input
                    type="number"
                    value={form.targetLengthRaw}
                    onChange={(e) => {
                        setForm((f) => ({ ...f, targetLengthRaw: e.target.value }));
                        if (lengthError) setLengthError(null);
                    }}
                    placeholder="예: 80000 (자)"
                    min={1}
                    max={100000000}
                    step={1}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                />
                {lengthError && <span className="mt-1 block text-xs text-red-600">{lengthError}</span>}
            </label>
            <label className="mt-3 block text-sm text-gray-600">
                줄거리 (선택)
                <textarea
                    value={form.synopsis}
                    onChange={(e) => setForm((f) => ({ ...f, synopsis: e.target.value }))}
                    maxLength={5000}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                />
            </label>
            <label className="mt-3 block text-sm text-gray-600">
                톤·문체 (선택)
                <textarea
                    value={form.toneNotes}
                    onChange={(e) => setForm((f) => ({ ...f, toneNotes: e.target.value }))}
                    maxLength={2000}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                />
            </label>
            <label className="mt-3 block text-sm text-gray-600">
                세계관 (선택)
                <textarea
                    value={form.worldNotes}
                    onChange={(e) => setForm((f) => ({ ...f, worldNotes: e.target.value }))}
                    maxLength={10000}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                />
            </label>
            <label className="mt-3 block text-sm text-gray-600">
                다음 장면 (선택)
                <input
                    value={form.nextScene}
                    onChange={(e) => setForm((f) => ({ ...f, nextScene: e.target.value }))}
                    placeholder="다음에 쓸 장면 한 줄"
                    maxLength={500}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                />
            </label>
            <div className="mt-5 flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isPending}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                    취소
                </button>
                <button
                    type="submit"
                    disabled={form.title.trim().length === 0 || form.layoutMode === null || isPending}
                    className="rounded-md bg-terracotta-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700 disabled:opacity-50"
                >
                    {isPending ? pendingLabel : submitLabel}
                </button>
            </div>
        </form>
    );
}

function parseTargetLength(raw: string): { value: number | null; error: string | null } {
    const trimmed = raw.trim();
    if (trimmed === "") return { value: null, error: null };
    const parsed = Math.trunc(Number(trimmed));
    if (!Number.isFinite(Number(trimmed)) || !Number.isInteger(Number(trimmed)) || parsed < 1 || parsed > 100_000_000) {
        return { value: null, error: "목표 분량은 1 이상 1억 이하의 정수로 입력해 주세요." };
    }
    return { value: parsed, error: null };
}

export default function BWorksPage() {
    const { data: cards, isLoading, isError, refetch } = useProjectCards();
    const createProject = useCreateProject();
    const updateProject = useUpdateProject();
    const deleteProject = useDeleteProject();
    const archiveProject = useArchiveProject();
    const unarchiveProject = useUnarchiveProject();
    const { data: categories } = useCategories();
    const moveProject = useMoveProjectCategory();

    const defaultPaperSize = usePreferences((s) => s.paperSize);

    // 생성 모달
    const [isCreating, setIsCreating] = useState(false);
    // 생성 시 자동 배정할 시리즈(시리즈 안에서 "새 작품"을 누른 경우). null = 미분류.
    const [createCategoryId, setCreateCategoryId] = useState<number | null>(null);
    const [createForm, setCreateForm] = useState<ProjectFormState>(() => emptyForm(defaultPaperSize));
    const [createLengthError, setCreateLengthError] = useState<string | null>(null);
    const [nextSceneWarning, setNextSceneWarning] = useState<string | null>(null);
    const createDialogRef = useRef<HTMLFormElement>(null);

    // 편집 모달
    const [editTarget, setEditTarget] = useState<ProjectCard | null>(null);
    const [editForm, setEditForm] = useState<ProjectFormState>(() => emptyForm(defaultPaperSize));
    const [editLengthError, setEditLengthError] = useState<string | null>(null);
    const editDialogRef = useRef<HTMLFormElement>(null);

    // 삭제 확인
    const [deleteTarget, setDeleteTarget] = useState<ProjectCard | null>(null);
    const deleteDialogRef = useRef<HTMLDivElement>(null);

    // 보관 목록 섹션
    const [showArchived, setShowArchived] = useState(false);
    const { data: archivedProjects, isLoading: isArchivedLoading } = useArchivedProjects(showArchived);

    // /library?new=1 진입 시 생성 모달 1회 자동 오픈
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get("new") !== "1") return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsCreating(true);
        window.history.replaceState(null, "", "/library");
    }, []);

    const closeCreate = useCallback(() => {
        setCreateForm(emptyForm(defaultPaperSize));
        setCreateLengthError(null);
        setCreateCategoryId(null);
        createProject.reset();
        setIsCreating(false);
    }, [defaultPaperSize, createProject]);

    // 새 작품 시작 — categoryId 가 있으면 생성 후 그 시리즈로 자동 배정(시리즈 안에서 시작한 경우).
    const openCreate = useCallback((categoryId: number | null) => {
        setCreateCategoryId(categoryId);
        setIsCreating(true);
    }, []);

    const closeEdit = useCallback(() => {
        setEditForm(emptyForm(defaultPaperSize));
        setEditLengthError(null);
        updateProject.reset();
        setEditTarget(null);
    }, [defaultPaperSize, updateProject]);

    const closeDelete = useCallback(() => {
        deleteProject.reset();
        setDeleteTarget(null);
    }, [deleteProject]);

    const openEdit = useCallback(
        (card: ProjectCard) => {
            setEditForm(fromProject(card, defaultPaperSize));
            setEditLengthError(null);
            updateProject.reset();
            setEditTarget(card);
        },
        [defaultPaperSize, updateProject],
    );

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed = createForm.title.trim();
        // 출판 방식 강제 선택(FR-001) — 미선택이면 생성 진행 불가(제출 버튼도 비활성)
        if (!trimmed || createForm.layoutMode === null || createProject.isPending) return;
        const { value: targetLength, error } = parseTargetLength(createForm.targetLengthRaw);
        if (error) { setCreateLengthError(error); return; }
        setCreateLengthError(null);
        setNextSceneWarning(null);
        let created: Awaited<ReturnType<typeof createProject.mutateAsync>>;
        try {
            created = await createProject.mutateAsync({
                title: trimmed,
                genre: createForm.genre.trim() || null,
                targetLength,
                paperSize: createForm.paperSize,
                layoutMode: createForm.layoutMode,
                synopsis: createForm.synopsis.trim() || null,
                toneNotes: createForm.toneNotes.trim() || null,
                worldNotes: createForm.worldNotes.trim() || null,
            });
        } catch {
            return;
        }
        const trimmedNextScene = createForm.nextScene.trim();
        if (trimmedNextScene) {
            try {
                await updateProject.mutateAsync({ id: created.project.id, patch: { nextScene: trimmedNextScene } });
            } catch {
                setNextSceneWarning("작품은 만들어졌지만 '다음 장면' 저장에 실패했어요. 작품을 열어 다시 입력해 주세요.");
            }
        }
        // 시리즈 안에서 시작했으면 그 시리즈로 자동 배정(미분류면 생략)
        if (createCategoryId != null) {
            try {
                await moveProject.mutateAsync({ projectId: created.project.id, categoryId: createCategoryId });
            } catch {
                // 자동 배정 실패 — 작품은 미분류로 남음(치명적 아님)
            }
        }
        setCreateForm(emptyForm(defaultPaperSize));
        setCreateCategoryId(null);
        setIsCreating(false);
    };

    const handleEdit = async (e: FormEvent) => {
        e.preventDefault();
        if (!editTarget || updateProject.isPending) return;
        const trimmed = editForm.title.trim();
        if (!trimmed) return;
        const { value: targetLength, error } = parseTargetLength(editForm.targetLengthRaw);
        if (error) { setEditLengthError(error); return; }
        setEditLengthError(null);
        try {
            await updateProject.mutateAsync({
                id: editTarget.id,
                patch: {
                    title: trimmed,
                    genre: editForm.genre.trim() || null,
                    targetLength,
                    paperSize: editForm.paperSize,
                    synopsis: editForm.synopsis.trim() || null,
                    toneNotes: editForm.toneNotes.trim() || null,
                    worldNotes: editForm.worldNotes.trim() || null,
                    nextScene: editForm.nextScene.trim(),
                },
            });
            // 시리즈 변경분은 전용 엔드포인트로 반영(메타 PATCH 는 categoryId 미처리 — ProjectService.moveCategory 분리)
            if (editForm.categoryId !== editTarget.categoryId) {
                await moveProject.mutateAsync({ projectId: editTarget.id, categoryId: editForm.categoryId });
            }
            setEditTarget(null);
        } catch {
            // 실패 — 모달 유지. updateProject.isError 로 에러 표시.
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget || deleteProject.isPending) return;
        try {
            await deleteProject.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
        } catch {
            // 실패 — 다이얼로그 유지.
        }
    };

    const handleArchive = useCallback(
        (id: number) => {
            if (archiveProject.isPending) return;
            archiveProject.mutate(id);
        },
        [archiveProject],
    );

    // ESC 닫기 + focus trap + 배경 스크롤 잠금
    useModalDismiss(
        createDialogRef,
        isCreating,
        useCallback(() => {
            if (!createProject.isPending) closeCreate();
        }, [createProject.isPending, closeCreate]),
    );
    useModalDismiss(
        editDialogRef,
        editTarget != null,
        useCallback(() => {
            if (!updateProject.isPending) closeEdit();
        }, [updateProject.isPending, closeEdit]),
    );
    useModalDismiss(
        deleteDialogRef,
        deleteTarget != null,
        useCallback(() => {
            if (!deleteProject.isPending) closeDelete();
        }, [deleteProject.isPending, closeDelete]),
    );

    return (
        <div>
            <div className="mb-6">
                {/* 작품 생성 진입점은 보드의 "+ 새 작품 시작하기" 하나로 통일 — 위치에 따라 미분류/시리즈 자동 배정 */}
                <h1 className="text-xl font-bold">내 작품</h1>
            </div>

            {nextSceneWarning && (
                <div className="mb-4 flex items-start justify-between gap-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    <span>{nextSceneWarning}</span>
                    <button
                        type="button"
                        aria-label="알림 닫기"
                        onClick={() => setNextSceneWarning(null)}
                        className="shrink-0 text-amber-500 hover:text-amber-700"
                    >
                        ×
                    </button>
                </div>
            )}

            {isLoading ? (
                <p className="py-12 text-center text-sm text-gray-400">불러오는 중…</p>
            ) : isError ? (
                <div className="py-12 text-center">
                    <p className="text-sm text-gray-500">작품을 불러올 수 없습니다.</p>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                        다시 시도
                    </button>
                </div>
            ) : (
                <LibraryBoard
                    cards={cards ?? []}
                    onNewWork={openCreate}
                    onEditWork={openEdit}
                    onDeleteWork={setDeleteTarget}
                    onArchiveWork={handleArchive}
                />
            )}

            {/* 보관한 작품 섹션 */}
            <div className="mt-8">
                <button
                    type="button"
                    onClick={() => setShowArchived((v) => !v)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                >
                    {showArchived ? "▲ 보관한 작품 접기" : "▼ 보관한 작품 보기"}
                </button>
                {showArchived && (
                    <div className="mt-3">
                        {isArchivedLoading ? (
                            <p className="text-sm text-gray-400">불러오는 중…</p>
                        ) : (archivedProjects ?? []).length === 0 ? (
                            <p className="text-sm text-gray-400">보관한 작품이 없습니다.</p>
                        ) : (
                            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                                {(archivedProjects ?? []).map((p) => (
                                    <li key={p.id} className="flex items-center justify-between px-4 py-3">
                                        <span className="text-sm text-gray-700">{p.title}</span>
                                        <button
                                            type="button"
                                            disabled={unarchiveProject.isPending}
                                            onClick={() => unarchiveProject.mutate(p.id)}
                                            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            {unarchiveProject.isPending ? "처리 중…" : "보관 해제"}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>

            {/* 생성 모달 */}
            {isCreating && (
                <div
                    className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4"
                    onClick={() => {
                        if (createProject.isPending) return;
                        closeCreate();
                    }}
                >
                    <ProjectFormModal
                        formRef={createDialogRef}
                        mode="create"
                        form={createForm}
                        setForm={setCreateForm}
                        lengthError={createLengthError}
                        setLengthError={setCreateLengthError}
                        categories={categories ?? []}
                        isPending={createProject.isPending || updateProject.isPending}
                        isError={createProject.isError}
                        errorMessage={
                            createProject.error instanceof Error
                                ? createProject.error.message
                                : "작품 생성에 실패했습니다. 다시 시도해 주세요."
                        }
                        onSubmit={handleCreate}
                        onCancel={closeCreate}
                    />
                </div>
            )}

            {/* 편집 모달 */}
            {editTarget != null && (
                <div
                    className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4"
                    onClick={() => {
                        if (updateProject.isPending) return;
                        closeEdit();
                    }}
                >
                    <ProjectFormModal
                        formRef={editDialogRef}
                        mode="edit"
                        form={editForm}
                        setForm={setEditForm}
                        lengthError={editLengthError}
                        setLengthError={setEditLengthError}
                        categories={categories ?? []}
                        isPending={updateProject.isPending || moveProject.isPending}
                        isError={updateProject.isError}
                        errorMessage={
                            updateProject.error instanceof Error
                                ? updateProject.error.message
                                : "저장에 실패했습니다. 다시 시도해 주세요."
                        }
                        onSubmit={handleEdit}
                        onCancel={closeEdit}
                    />
                </div>
            )}

            {/* 삭제 확인 모달 */}
            {deleteTarget && (
                <div
                    className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4"
                    onClick={() => !deleteProject.isPending && closeDelete()}
                >
                    <div
                        ref={deleteDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="작품 삭제"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
                    >
                        <h2 className="text-lg font-bold text-gray-900">작품 삭제</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            「{deleteTarget.title}」 을(를) 삭제할까요? 본문과 기록이 함께 사라집니다.
                        </p>
                        {deleteProject.isError && (
                            <p className="mt-2 text-sm text-red-600">삭제에 실패했습니다. 다시 시도해 주세요.</p>
                        )}
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeDelete}
                                disabled={deleteProject.isPending}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={deleteProject.isPending}
                                className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                                {deleteProject.isPending ? "삭제 중…" : "삭제"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
