"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useCreateProject, useDeleteProject, useProjectCards } from "@/lib/query/useProjects";
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
    const deleteProject = useDeleteProject();

    const [isCreating, setIsCreating] = useState(false);
    const [title, setTitle] = useState("");
    const [genre, setGenre] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<ProjectCard | null>(null);

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed = title.trim();
        if (!trimmed || createProject.isPending) return;
        await createProject.mutateAsync({ title: trimmed, genre: genre.trim() || null });
        setTitle("");
        setGenre("");
        setIsCreating(false);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget || deleteProject.isPending) return;
        await deleteProject.mutateAsync(deleteTarget.id);
        setDeleteTarget(null);
    };

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
                    onClick={() => !createProject.isPending && setIsCreating(false)}
                >
                    <form
                        onSubmit={handleCreate}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
                    >
                        <h2 className="text-lg font-bold text-gray-900">새 작품</h2>
                        <label className="mt-4 block text-sm text-gray-600">
                            제목
                            <input
                                autoFocus
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="작품 제목"
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                            />
                        </label>
                        <label className="mt-3 block text-sm text-gray-600">
                            장르 (선택)
                            <input
                                value={genre}
                                onChange={(e) => setGenre(e.target.value)}
                                placeholder="예: 장편소설, 에세이"
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                            />
                        </label>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                disabled={createProject.isPending}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={title.trim().length === 0 || createProject.isPending}
                                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                                만들기
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {deleteTarget && (
                <div
                    className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4"
                    onClick={() => !deleteProject.isPending && setDeleteTarget(null)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
                    >
                        <h2 className="text-lg font-bold text-gray-900">작품 삭제</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            「{deleteTarget.title}」 을(를) 삭제할까요? 본문과 기록이 함께 사라집니다.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setDeleteTarget(null)}
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
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
