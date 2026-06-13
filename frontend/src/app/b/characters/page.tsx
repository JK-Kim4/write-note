"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createCharacter,
    deleteCharacter,
    genderLabel,
    listCharacters,
    updateCharacter,
    type CreateCharacterInput,
    type Gender,
} from "@/lib/api/characters";
import { characterKeys } from "@/lib/query/useCharacters";
import { useProjectCards } from "@/lib/query/useProjects";
import { useModalDismiss } from "@/lib/useModalDismiss";
import type { CharacterResponse } from "@/types/api";

/**
 * B타입 인물 페이지 — fable-test CharactersPage 이식(작품 필터 + 카드 그리드).
 * 등장인물은 작품 소속이므로 상단 select 로 작품을 고르고 그 작품의 인물을 관리한다.
 * 공백 최소화: 그리드 첫 칸이 항상 "+ 인물 추가" 진입점.
 */

type FormValues = {
    name: string;
    age: string;
    gender: Gender | "";
    shortDescription: string;
    traits: string;
    notes: string;
};

const EMPTY_FORM: FormValues = { name: "", age: "", gender: "", shortDescription: "", traits: "", notes: "" };

function errorText(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

function toInput(values: FormValues): CreateCharacterInput {
    return {
        name: values.name.trim(),
        age: values.age.trim() || null,
        gender: values.gender === "" ? null : values.gender,
        shortDescription: values.shortDescription.trim() || null,
        traits: values.traits.trim() || null,
        notes: values.notes.trim() || null,
    };
}

function CharacterFormModal({
    title,
    initialValues,
    isSaving,
    errorMessage,
    onSubmit,
    onClose,
}: {
    title: string;
    initialValues: FormValues;
    isSaving: boolean;
    errorMessage?: string | null;
    onSubmit: (values: FormValues) => void;
    onClose: () => void;
}) {
    const [values, setValues] = useState<FormValues>(initialValues);
    const set = (patch: Partial<FormValues>) => setValues((v) => ({ ...v, ...patch }));
    const dialogRef = useRef<HTMLFormElement>(null);

    useModalDismiss(dialogRef, true, () => {
        if (!isSaving) onClose();
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (values.name.trim().length === 0 || isSaving) return;
        onSubmit(values);
    };

    const inputClass =
        "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";

    return (
        <div
            className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4"
            onClick={() => !isSaving && onClose()}
        >
            <form
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="character-form-title"
                onSubmit={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                className="max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
            >
                <h2 id="character-form-title" className="text-lg font-bold text-gray-900">
                    {title}
                </h2>
                <label className="mt-4 block text-sm text-gray-600">
                    이름
                    <input autoFocus value={values.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
                </label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="block text-sm text-gray-600">
                        나이
                        <input
                            value={values.age}
                            onChange={(e) => set({ age: e.target.value })}
                            placeholder="예: 27, 소년"
                            className={inputClass}
                        />
                    </label>
                    <label className="block text-sm text-gray-600">
                        성별
                        <select
                            value={values.gender}
                            onChange={(e) => set({ gender: e.target.value as Gender | "" })}
                            className={inputClass}
                        >
                            <option value="">비움</option>
                            <option value="MALE">남</option>
                            <option value="FEMALE">여</option>
                            <option value="OTHER">기타</option>
                        </select>
                    </label>
                </div>
                <label className="mt-3 block text-sm text-gray-600">
                    한 줄 소개
                    <input
                        value={values.shortDescription}
                        onChange={(e) => set({ shortDescription: e.target.value })}
                        className={inputClass}
                    />
                </label>
                <label className="mt-3 block text-sm text-gray-600">
                    특징
                    <input
                        value={values.traits}
                        onChange={(e) => set({ traits: e.target.value })}
                        placeholder="말버릇, 습관, 외형…"
                        className={inputClass}
                    />
                </label>
                <label className="mt-3 block text-sm text-gray-600">
                    노트
                    <textarea
                        value={values.notes}
                        onChange={(e) => set({ notes: e.target.value })}
                        rows={3}
                        className={`${inputClass} resize-none`}
                    />
                </label>
                {errorMessage && <p className="mt-3 text-sm text-red-600">{errorMessage}</p>}
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        disabled={values.name.trim().length === 0 || isSaving}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        저장
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function BCharactersPage() {
    const projectsQuery = useProjectCards();
    const queryClient = useQueryClient();
    const [projectId, setProjectId] = useState<number | null>(null);

    const projects = projectsQuery.data ?? [];

    // 작품 로드 후 첫 작품을 기본 선택 — 빈 화면 대신 바로 인물 목록이 보이게(공백 최소화).
    useEffect(() => {
        const first = projectsQuery.data?.[0];
        // 외부(쿼리)→state 1회 동기화 — 선택값이 없을 때만 기본값을 채운다.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (projectId == null && first) setProjectId(first.id);
    }, [projectId, projectsQuery.data]);

    const charactersQuery = useQuery({
        queryKey: characterKeys.byProject(projectId ?? 0),
        queryFn: async () => (await listCharacters(projectId ?? 0, { size: 100 })).content,
        enabled: projectId != null,
    });

    const invalidate = () => {
        if (projectId != null) {
            void queryClient.invalidateQueries({ queryKey: characterKeys.byProject(projectId) });
        }
    };
    const createMutation = useMutation({
        mutationFn: (input: CreateCharacterInput) => createCharacter(projectId ?? 0, input),
        onSuccess: invalidate,
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, input }: { id: number; input: CreateCharacterInput }) =>
            updateCharacter(projectId ?? 0, id, input),
        onSuccess: invalidate,
    });
    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteCharacter(projectId ?? 0, id),
        onSuccess: invalidate,
    });

    const [isCreating, setIsCreating] = useState(false);
    const [editTarget, setEditTarget] = useState<CharacterResponse | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CharacterResponse | null>(null);
    const deleteDialogRef = useRef<HTMLDivElement>(null);

    const closeCreate = () => {
        createMutation.reset();
        setIsCreating(false);
    };
    const closeEdit = () => {
        updateMutation.reset();
        setEditTarget(null);
    };
    const closeDelete = () => {
        deleteMutation.reset();
        setDeleteTarget(null);
    };

    // 삭제 다이얼로그 ESC 닫기 + focus trap + 배경 스크롤 잠금(삭제 진행 중이면 닫지 않음).
    useModalDismiss(deleteDialogRef, deleteTarget != null, () => {
        if (!deleteMutation.isPending) closeDelete();
    });

    const characters = charactersQuery.data ?? [];

    return (
        <div>
            <div className="mb-6 flex items-center justify-between gap-3">
                <h1 className="text-xl font-bold">인물</h1>
                <select
                    aria-label="작품 선택"
                    value={projectId == null ? "" : String(projectId)}
                    onChange={(e) => setProjectId(Number(e.target.value))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                    {projects.length === 0 && <option value="">작품 없음</option>}
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.title}
                        </option>
                    ))}
                </select>
            </div>

            {projectsQuery.isLoading || charactersQuery.isLoading ? (
                <p className="py-12 text-center text-sm text-gray-400">불러오는 중…</p>
            ) : projectsQuery.isError || charactersQuery.isError ? (
                <div className="py-12 text-center">
                    <p className="text-sm text-gray-500">
                        {projectsQuery.isError ? "작품 목록을 불러올 수 없습니다." : "인물을 불러올 수 없습니다."}
                    </p>
                    <button
                        type="button"
                        onClick={() => (projectsQuery.isError ? projectsQuery.refetch() : charactersQuery.refetch())}
                        className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                        다시 시도
                    </button>
                </div>
            ) : projects.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-500">먼저 작품을 만들어주세요.</p>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <button
                        type="button"
                        onClick={() => setIsCreating(true)}
                        className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600"
                    >
                        + 인물 추가
                    </button>
                    {characters.map((character) => {
                        const meta = [character.age, genderLabel(character.gender)].filter(Boolean).join(" · ");
                        return (
                            <div key={character.id} className="group min-w-0 rounded-xl border border-gray-200 bg-white p-4">
                                <div className="flex items-baseline justify-between gap-2">
                                    <h2 className="text-base font-bold text-gray-900">{character.name}</h2>
                                    {meta && <span className="shrink-0 text-xs text-gray-400">{meta}</span>}
                                </div>
                                {character.shortDescription && (
                                    <p className="mt-1 text-sm break-words text-gray-600">{character.shortDescription}</p>
                                )}
                                {character.traits && (
                                    <p className="mt-1.5 rounded-md bg-gray-50 px-2 py-1 text-xs break-words text-gray-500">
                                        {character.traits}
                                    </p>
                                )}
                                {character.notes && (
                                    <p className="mt-1.5 line-clamp-3 text-xs break-words whitespace-pre-wrap text-gray-400">
                                        {character.notes}
                                    </p>
                                )}
                                <div className="mt-3 flex items-center justify-end gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setEditTarget(character)}
                                        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                                    >
                                        수정
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeleteTarget(character)}
                                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                                    >
                                        삭제
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {characters.length === 0 && (
                        <p className="col-span-full py-8 text-center text-sm text-gray-400">
                            이 작품엔 아직 인물이 없어요. &lsquo;+ 인물 추가&rsquo;로 시작하세요.
                        </p>
                    )}
                </div>
            )}

            {isCreating && projectId != null && (
                <CharacterFormModal
                    title="인물 추가"
                    initialValues={EMPTY_FORM}
                    isSaving={createMutation.isPending}
                    errorMessage={createMutation.isError ? errorText(createMutation.error, "저장에 실패했습니다.") : null}
                    onClose={closeCreate}
                    onSubmit={(values) =>
                        createMutation.mutate(toInput(values), { onSuccess: () => setIsCreating(false) })
                    }
                />
            )}

            {editTarget && (
                <CharacterFormModal
                    title="인물 수정"
                    initialValues={{
                        name: editTarget.name,
                        age: editTarget.age ?? "",
                        gender: editTarget.gender ?? "",
                        shortDescription: editTarget.shortDescription ?? "",
                        traits: editTarget.traits ?? "",
                        notes: editTarget.notes ?? "",
                    }}
                    isSaving={updateMutation.isPending}
                    errorMessage={updateMutation.isError ? errorText(updateMutation.error, "저장에 실패했습니다.") : null}
                    onClose={closeEdit}
                    onSubmit={(values) =>
                        updateMutation.mutate(
                            { id: editTarget.id, input: toInput(values) },
                            { onSuccess: () => setEditTarget(null) },
                        )
                    }
                />
            )}

            {deleteTarget && (
                <div
                    className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4"
                    onClick={() => !deleteMutation.isPending && closeDelete()}
                >
                    <div
                        ref={deleteDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="인물 삭제"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
                    >
                        <h2 className="text-lg font-bold text-gray-900">인물 삭제</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            「{deleteTarget.name}」 을(를) 삭제할까요? 되돌릴 수 없습니다.
                        </p>
                        {deleteMutation.isError && (
                            <p className="mt-2 text-sm text-red-600">
                                {errorText(deleteMutation.error, "삭제에 실패했습니다.")}
                            </p>
                        )}
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeDelete}
                                disabled={deleteMutation.isPending}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
                                }
                                disabled={deleteMutation.isPending}
                                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
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
