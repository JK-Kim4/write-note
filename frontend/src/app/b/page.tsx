"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useCreateProject, useDeleteProject, useProjectCards, useUpdateProject } from "@/lib/query/useProjects";
import { useModalDismiss } from "@/lib/useModalDismiss";
import type { ProjectCard } from "@/lib/types/domain";

/**
 * B타입 작품 목록 — fable-test WorksPage 이식. 카드 그리드 + 점선 "새 작품" 카드 + 생성 모달.
 * 데이터는 기존 useProjectCards/useCreateProject/useDeleteProject 재사용.
 */

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function WorkCard({ card, onDelete }: { card: ProjectCard; onDelete: (id: number) => void }) {
    return (
        <div className="group relative rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
            <Link href={`/b/works/${card.id}`} className="block">
                <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-bold text-gray-900">{card.title}</h2>
                    {card.genre && (
                        <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                            {card.genre}
                        </span>
                    )}
                </div>
                {card.synopsis && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{card.synopsis}</p>}
                {card.nextScene && (
                    <p className="mt-2 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700">
                        다음 장면 — {card.nextScene}
                    </p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                    <span>{card.wordCount.toLocaleString()}자</span>
                    <span>마지막 저장 {formatDate(card.docUpdatedAt)}</span>
                </div>
            </Link>
            <button
                type="button"
                aria-label={`${card.title} 삭제`}
                onClick={() => onDelete(card.id)}
                className="absolute right-3 bottom-3 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
                삭제
            </button>
        </div>
    );
}

export default function BWorksPage() {
    const { data: cards, isLoading, isError, refetch } = useProjectCards();
    const createProject = useCreateProject();
    const updateProject = useUpdateProject();
    const deleteProject = useDeleteProject();

    const [isCreating, setIsCreating] = useState(false);
    const [title, setTitle] = useState("");
    const [genre, setGenre] = useState("");
    const [targetLengthRaw, setTargetLengthRaw] = useState("");
    const [synopsis, setSynopsis] = useState("");
    const [toneNotes, setToneNotes] = useState("");
    const [worldNotes, setWorldNotes] = useState("");
    const [nextScene, setNextScene] = useState("");
    const [lengthError, setLengthError] = useState<string | null>(null);
    // 작품은 생성됐으나 '다음 장면'(nextScene) 저장 PATCH 만 실패했을 때의 경고. 모달 닫힌 뒤 목록 위에 노출.
    const [nextSceneWarning, setNextSceneWarning] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ProjectCard | null>(null);
    const createDialogRef = useRef<HTMLFormElement>(null);
    const deleteDialogRef = useRef<HTMLDivElement>(null);

    const resetCreateForm = useCallback(() => {
        setTitle("");
        setGenre("");
        setTargetLengthRaw("");
        setSynopsis("");
        setToneNotes("");
        setWorldNotes("");
        setNextScene("");
        setLengthError(null);
    }, []);

    const closeCreate = useCallback(() => {
        resetCreateForm();
        createProject.reset();
        setIsCreating(false);
    }, [resetCreateForm, createProject]);

    const closeDelete = useCallback(() => {
        deleteProject.reset();
        setDeleteTarget(null);
    }, [deleteProject]);

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed = title.trim();
        if (!trimmed || createProject.isPending) return;
        // 목표 분량: 빈 값 = null(선택). 입력했으면 정수 + 백엔드 @Min(1)/@Max(100_000_000) 범위만 허용.
        let targetLength: number | null = null;
        const raw = targetLengthRaw.trim();
        if (raw !== "") {
            const parsed = Math.trunc(Number(raw));
            if (!Number.isFinite(Number(raw)) || !Number.isInteger(Number(raw)) || parsed < 1 || parsed > 100_000_000) {
                setLengthError("목표 분량은 1 이상 1억 이하의 정수로 입력해 주세요.");
                return;
            }
            targetLength = parsed;
        }
        setLengthError(null);
        setNextSceneWarning(null);
        let created: Awaited<ReturnType<typeof createProject.mutateAsync>>;
        try {
            created = await createProject.mutateAsync({
                title: trimmed,
                genre: genre.trim() || null,
                targetLength,
                synopsis: synopsis.trim() || null,
                toneNotes: toneNotes.trim() || null,
                worldNotes: worldNotes.trim() || null,
            });
        } catch {
            // 작품 생성 자체 실패 — 입력·모달 유지. createProject.isError 로 에러 배너를 띄운다.
            return;
        }
        // 작품은 이미 생성됨. 백엔드 create 는 nextScene 미수용(CreateProjectRequest 에 필드 없음) → 생성 직후 PATCH 로 채운다.
        // PATCH 가 실패해도 모달은 닫고 폼은 리셋(중복 create 방지) — '다음 장면' 저장 실패만 별도 경고로 안내.
        const trimmedNextScene = nextScene.trim();
        if (trimmedNextScene) {
            try {
                await updateProject.mutateAsync({ id: created.project.id, patch: { nextScene: trimmedNextScene } });
            } catch {
                setNextSceneWarning("작품은 만들어졌지만 '다음 장면' 저장에 실패했어요. 작품을 열어 다시 입력해 주세요.");
            }
        }
        resetCreateForm();
        setIsCreating(false);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget || deleteProject.isPending) return;
        try {
            await deleteProject.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
        } catch {
            // 실패 — 다이얼로그 유지. deleteProject.isError 로 에러를 표시한다.
        }
    };

    // ESC 닫기 + focus trap + 배경 스크롤 잠금(진행 중이면 닫지 않음).
    useModalDismiss(
        createDialogRef,
        isCreating,
        useCallback(() => {
            if (!createProject.isPending) closeCreate();
        }, [createProject.isPending, closeCreate]),
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
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-xl font-bold">내 작품</h1>
                <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                    새 작품
                </button>
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {(cards ?? []).length === 0 && (
                        <p className="col-span-full py-4 text-center text-sm text-gray-400">
                            아직 작품이 없어요. 첫 작품을 시작해 보세요.
                        </p>
                    )}
                    {(cards ?? []).map((card) => (
                        <WorkCard key={card.id} card={card} onDelete={() => setDeleteTarget(card)} />
                    ))}
                    <button
                        type="button"
                        onClick={() => setIsCreating(true)}
                        className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600"
                    >
                        + 새 작품 시작하기
                    </button>
                </div>
            )}

            {isCreating && (
                <div
                    className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4"
                    onClick={() => {
                        if (createProject.isPending) return;
                        closeCreate();
                    }}
                >
                    <form
                        ref={createDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="새 작품"
                        onSubmit={handleCreate}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
                    >
                        <h2 className="text-lg font-bold text-gray-900">새 작품</h2>
                        {createProject.isError && (
                            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                                {createProject.error instanceof Error
                                    ? createProject.error.message
                                    : "작품 생성에 실패했습니다. 다시 시도해 주세요."}
                            </p>
                        )}
                        <label className="mt-4 block text-sm text-gray-600">
                            제목
                            <input
                                autoFocus
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="작품 제목"
                                maxLength={120}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                            />
                        </label>
                        <label className="mt-3 block text-sm text-gray-600">
                            장르 (선택)
                            <input
                                value={genre}
                                onChange={(e) => setGenre(e.target.value)}
                                placeholder="예: 장편소설, 에세이"
                                maxLength={100}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                            />
                        </label>
                        <label className="mt-3 block text-sm text-gray-600">
                            목표 분량 (선택)
                            <input
                                type="number"
                                value={targetLengthRaw}
                                onChange={(e) => {
                                    setTargetLengthRaw(e.target.value);
                                    if (lengthError) setLengthError(null);
                                }}
                                placeholder="예: 80000 (자)"
                                min={1}
                                max={100000000}
                                step={1}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                            />
                            {lengthError && <span className="mt-1 block text-xs text-red-600">{lengthError}</span>}
                        </label>
                        <label className="mt-3 block text-sm text-gray-600">
                            줄거리 (선택)
                            <textarea
                                value={synopsis}
                                onChange={(e) => setSynopsis(e.target.value)}
                                maxLength={5000}
                                rows={3}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                            />
                        </label>
                        <label className="mt-3 block text-sm text-gray-600">
                            톤·문체 (선택)
                            <textarea
                                value={toneNotes}
                                onChange={(e) => setToneNotes(e.target.value)}
                                maxLength={2000}
                                rows={3}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                            />
                        </label>
                        <label className="mt-3 block text-sm text-gray-600">
                            세계관 (선택)
                            <textarea
                                value={worldNotes}
                                onChange={(e) => setWorldNotes(e.target.value)}
                                maxLength={10000}
                                rows={3}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                            />
                        </label>
                        <label className="mt-3 block text-sm text-gray-600">
                            다음 장면 (선택)
                            <input
                                value={nextScene}
                                onChange={(e) => setNextScene(e.target.value)}
                                placeholder="다음에 쓸 장면 한 줄"
                                maxLength={500}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                            />
                        </label>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeCreate}
                                disabled={createProject.isPending}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={title.trim().length === 0 || createProject.isPending || updateProject.isPending}
                                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {createProject.isPending || updateProject.isPending ? "만드는 중…" : "만들기"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

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
