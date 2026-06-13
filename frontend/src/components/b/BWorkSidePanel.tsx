"use client";

import { useState, type FormEvent } from "react";
import { genderLabel } from "@/lib/api/characters";
import { useCreateCharacter, useProjectCharacters } from "@/lib/query/useCharacters";
import { useCaptureMemo, useProjectMemos, useRemoveLinkMemo, useSetPinMemo } from "@/lib/query/useMemos";

/**
 * B타입 집필 보조 패널 — fable-test WorkSidePanel 이식 (w-80, 메모/인물 탭, ◀▶ 접이식).
 * 메모 탭 = 이 작품에 연결된 곁쪽지(고정 우선) + 인라인 캡처. 인물 탭 = 목록 + 빠른 추가.
 * 공백 최소화: 목록·입력을 패널 전체 높이에 채우고 빈 상태에도 바로 쓸 수 있는 입력을 둔다.
 */

type Tab = "memos" | "characters";

function MemosTab({ projectId }: { projectId: number }) {
    const memosQuery = useProjectMemos(projectId);
    const captureMemo = useCaptureMemo();
    const setPinMemo = useSetPinMemo();
    const removeLinkMemo = useRemoveLinkMemo();
    const [body, setBody] = useState("");

    const handleCapture = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed = body.trim();
        if (!trimmed || captureMemo.isPending) return;
        await captureMemo.mutateAsync({ body: trimmed, linkProjectId: projectId });
        setBody("");
    };

    const memos = memosQuery.data ?? [];
    const actionFailed = setPinMemo.isError || removeLinkMemo.isError;

    return (
        <div className="flex h-full flex-col">
            <form onSubmit={handleCapture} className="border-b border-gray-200 p-3">
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="이 작품에 곁쪽지 남기기…"
                    rows={2}
                    className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <button
                    type="submit"
                    disabled={body.trim().length === 0 || captureMemo.isPending}
                    className="mt-1.5 w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                    붙이기
                </button>
            </form>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {actionFailed && (
                    <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-600">
                        곁쪽지 작업에 실패했습니다. 다시 시도해 주세요.
                    </p>
                )}
                {memosQuery.isLoading ? (
                    <p className="text-xs text-gray-400">불러오는 중…</p>
                ) : memosQuery.isError ? (
                    <div>
                        <p className="text-xs text-gray-500">곁쪽지를 불러오지 못했습니다.</p>
                        <button
                            type="button"
                            onClick={() => memosQuery.refetch()}
                            className="mt-1.5 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                            다시 시도
                        </button>
                    </div>
                ) : memos.length === 0 ? (
                    <p className="text-xs text-gray-400">아직 연결된 곁쪽지가 없습니다.</p>
                ) : (
                    memos.map((memo) => (
                        <div key={memo.id} className="rounded-md border border-gray-200 bg-white p-2.5">
                            <p className="text-sm whitespace-pre-wrap text-gray-700">{memo.body}</p>
                            <div className="mt-1.5 flex items-center gap-1.5">
                                <button
                                    type="button"
                                    disabled={setPinMemo.isPending}
                                    onClick={() =>
                                        setPinMemo.mutate({ memoId: memo.id, projectId, pinned: !memo.pinned })
                                    }
                                    className={
                                        memo.pinned
                                            ? "rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 disabled:opacity-50"
                                            : "rounded-full px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                                    }
                                >
                                    {memo.pinned ? "고정됨" : "고정"}
                                </button>
                                <button
                                    type="button"
                                    disabled={removeLinkMemo.isPending}
                                    onClick={() => removeLinkMemo.mutate({ memoId: memo.id, projectId })}
                                    className="rounded-full px-2 py-0.5 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                >
                                    연결 해제
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function CharactersTab({ projectId }: { projectId: number }) {
    const charactersQuery = useProjectCharacters(projectId);
    const createCharacter = useCreateCharacter();
    const [name, setName] = useState("");
    const [shortDescription, setShortDescription] = useState("");

    const handleAdd = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed || createCharacter.isPending) return;
        try {
            await createCharacter.mutateAsync({
                projectId,
                input: { name: trimmed, shortDescription: shortDescription.trim() || null },
            });
            setName("");
            setShortDescription("");
        } catch {
            // 실패 — 입력 유지. createCharacter.isError 로 폼 하단에 에러를 표시한다.
        }
    };

    const characters = charactersQuery.data ?? [];

    return (
        <div className="flex h-full flex-col">
            <form onSubmit={handleAdd} className="space-y-1.5 border-b border-gray-200 p-3">
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="인물 이름"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <input
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="한 줄 소개 (선택)"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <button
                    type="submit"
                    disabled={name.trim().length === 0 || createCharacter.isPending}
                    className="w-full rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-50"
                >
                    + 인물 추가
                </button>
                {createCharacter.isError && (
                    <p className="text-xs text-red-600">인물 추가에 실패했습니다. 다시 시도해 주세요.</p>
                )}
            </form>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {charactersQuery.isLoading ? (
                    <p className="text-xs text-gray-400">불러오는 중…</p>
                ) : charactersQuery.isError ? (
                    <div>
                        <p className="text-xs text-gray-500">인물을 불러오지 못했습니다.</p>
                        <button
                            type="button"
                            onClick={() => charactersQuery.refetch()}
                            className="mt-1.5 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                            다시 시도
                        </button>
                    </div>
                ) : characters.length === 0 ? (
                    <p className="text-xs text-gray-400">아직 등록된 인물이 없습니다.</p>
                ) : (
                    characters.map((character) => {
                        const meta = [character.age, genderLabel(character.gender)].filter(Boolean).join(" · ");
                        return (
                            <div key={character.id} className="rounded-md border border-gray-200 bg-white p-2.5">
                                <div className="flex items-baseline justify-between gap-2">
                                    <p className="text-sm font-semibold text-gray-900">{character.name}</p>
                                    {meta && <span className="text-xs text-gray-400">{meta}</span>}
                                </div>
                                {character.shortDescription && (
                                    <p className="mt-0.5 text-xs text-gray-600">{character.shortDescription}</p>
                                )}
                                {character.traits && (
                                    <p className="mt-1 text-xs text-gray-400">{character.traits}</p>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

type SidePanelProps = {
    projectId: number;
    /** controlled 접기·탭 상태 — 두 인스턴스(inline·drawer)가 부모 state 를 공유해 일관 유지. 미전달 시 비제어(로컬 state). */
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    tab?: Tab;
    onTabChange?: (tab: Tab) => void;
    /** 접기 토글(▶) 노출 여부. drawer 인스턴스(false)는 항상 펼친 상태 — 좁은 폭에서 8px strip 잔존 방지. */
    collapsible?: boolean;
};

export function BWorkSidePanel({
    projectId,
    isOpen: isOpenProp,
    onOpenChange,
    tab: tabProp,
    onTabChange,
    collapsible = true,
}: SidePanelProps) {
    const [isOpenLocal, setIsOpenLocal] = useState(true);
    const [tabLocal, setTabLocal] = useState<Tab>("memos");
    // collapsible=false 면 공유 panelOpen 무시하고 항상 펼침(drawer 는 자체 ✕ 로만 닫는다).
    const isOpen = collapsible ? (isOpenProp ?? isOpenLocal) : true;
    const setIsOpen = (open: boolean) => (onOpenChange ? onOpenChange(open) : setIsOpenLocal(open));
    const tab = tabProp ?? tabLocal;
    const setTab = (next: Tab) => (onTabChange ? onTabChange(next) : setTabLocal(next));

    if (!isOpen) {
        return (
            <div className="flex w-8 shrink-0 flex-col items-center rounded-xl border border-gray-200 bg-gray-50 py-2">
                <button
                    type="button"
                    aria-label="보조 패널 펼치기"
                    onClick={() => setIsOpen(true)}
                    className="rounded-md px-1 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                    ◀
                </button>
            </div>
        );
    }

    return (
        <div className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            <div className="flex items-center border-b border-gray-200">
                <button
                    type="button"
                    onClick={() => setTab("memos")}
                    className={
                        tab === "memos"
                            ? "flex-1 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700"
                            : "flex-1 px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
                    }
                >
                    메모
                </button>
                <button
                    type="button"
                    onClick={() => setTab("characters")}
                    className={
                        tab === "characters"
                            ? "flex-1 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700"
                            : "flex-1 px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
                    }
                >
                    인물
                </button>
                {collapsible && (
                    <button
                        type="button"
                        aria-label="보조 패널 접기"
                        onClick={() => setIsOpen(false)}
                        className="px-2 py-2 text-sm text-gray-400 hover:text-gray-600"
                    >
                        ▶
                    </button>
                )}
            </div>
            <div className="min-h-0 flex-1">
                {tab === "memos" ? <MemosTab projectId={projectId} /> : <CharactersTab projectId={projectId} />}
            </div>
        </div>
    );
}
