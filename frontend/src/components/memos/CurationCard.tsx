"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listProjects } from "@/lib/api/projects";
import { listCharacters } from "@/lib/api/characters";
import { curateMemo } from "@/lib/api/memo";
import type { MemoResponse } from "@/types/api";

/**
 * 큐레이션 카드 (006 US4 T059).
 *
 * 메모 하나를 큐레이션하는 패널:
 * - 여러 프로젝트 선택 (체크박스)
 * - 선택된 프로젝트들의 등장인물 합집합에서 인물 선택
 * - 자유 태그 입력 (쉼표 / Enter 구분)
 * - "왜 적었나" 이유(reasonNote) 텍스트
 * - 저장(PUT curation) → 800ms 슬라이드/페이드 후 ['memos'] invalidate
 *
 * RSC 경계: 이벤트 핸들러 + hook 사용 → 'use client' 의무
 */

interface CurationCardProps {
    memo: MemoResponse;
    /** 저장 성공 후 닫기 콜백 */
    onClose: () => void;
}

function useProjectsList() {
    return useQuery({
        queryKey: ["projects", { page: 0, size: 100 }],
        queryFn: () => listProjects({ page: 0, size: 100 }),
        retry: false,
    });
}

function useCharactersForProjects(projectIds: ReadonlyArray<number>) {
    // 선택된 프로젝트들의 인물을 병렬 조회
    const queries = useQuery({
        queryKey: ["characters-multi", projectIds],
        queryFn: async () => {
            if (projectIds.length === 0) return [];
            const results = await Promise.all(
                projectIds.map((pid) => listCharacters(pid, { page: 0, size: 100 })),
            );
            // 합집합 — characterId 기준 deduplicate
            const seen = new Set<number>();
            const merged: Array<{ characterId: number; projectId: number; name: string }> = [];
            for (let i = 0; i < projectIds.length; i++) {
                const pid = projectIds[i];
                const chars = results[i]?.content ?? [];
                for (const c of chars) {
                    if (!seen.has(c.id)) {
                        seen.add(c.id);
                        merged.push({ characterId: c.id, projectId: pid, name: c.name });
                    }
                }
            }
            return merged;
        },
        enabled: projectIds.length > 0,
    });
    return queries;
}

export function CurationCard({ memo, onClose }: CurationCardProps) {
    const queryClient = useQueryClient();

    // 초기 상태 = memo 의 현재 연결에서 추출
    const initialProjectIds = memo.projects.map((p) => p.projectId);
    const initialCharacterIds = memo.projects.flatMap((p) => p.characters.map((c) => c.characterId));

    const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>(initialProjectIds);
    const [selectedCharacterIds, setSelectedCharacterIds] = useState<number[]>(initialCharacterIds);
    const [tags, setTags] = useState<string[]>(memo.tags);
    const [tagInput, setTagInput] = useState("");
    const [reasonNote, setReasonNote] = useState(memo.reasonNote ?? "");
    const [isSaving, setIsSaving] = useState(false);
    const [isFadingOut, setIsFadingOut] = useState(false);

    const projectsQuery = useProjectsList();
    const charactersQuery = useCharactersForProjects(selectedProjectIds);

    // 프로젝트 선택 해제 시 해당 프로젝트 인물 선택도 해제
    const handleProjectToggle = useCallback(
        (projectId: number) => {
            setSelectedProjectIds((prev) => {
                const next = prev.includes(projectId)
                    ? prev.filter((id) => id !== projectId)
                    : [...prev, projectId];
                // 제거된 프로젝트의 인물을 characterIds 에서 제거
                if (!next.includes(projectId)) {
                    const removedProject = memo.projects.find((p) => p.projectId === projectId);
                    if (removedProject) {
                        const removedCharIds = new Set(removedProject.characters.map((c) => c.characterId));
                        setSelectedCharacterIds((chars) => chars.filter((cid) => !removedCharIds.has(cid)));
                    }
                }
                return next;
            });
        },
        [memo.projects],
    );

    const handleCharacterToggle = useCallback((characterId: number) => {
        setSelectedCharacterIds((prev) =>
            prev.includes(characterId) ? prev.filter((id) => id !== characterId) : [...prev, characterId],
        );
    }, []);

    const commitTagInput = useCallback(() => {
        const raw = tagInput.trim();
        if (!raw) return;
        const newTags = raw
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
        setTags((prev) => {
            const existing = new Set(prev);
            const added = newTags.filter((t) => !existing.has(t));
            return [...prev, ...added];
        });
        setTagInput("");
    }, [tagInput]);

    const handleTagKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
                e.preventDefault();
                commitTagInput();
            }
        },
        [commitTagInput],
    );

    const removeTag = useCallback((tag: string) => {
        setTags((prev) => prev.filter((t) => t !== tag));
    }, []);

    const mutation = useMutation({
        mutationFn: () => {
            // characters 합집합에서 선택된 인물을 프로젝트별로 매핑
            const allChars = charactersQuery.data ?? [];
            const projectConnections = selectedProjectIds.map((pid) => {
                const projectCharIds = allChars
                    .filter((c) => c.projectId === pid && selectedCharacterIds.includes(c.characterId))
                    .map((c) => c.characterId);
                return { projectId: pid, characterIds: projectCharIds };
            });
            return curateMemo(memo.id, {
                projectConnections,
                tags,
                reasonNote: reasonNote.trim() || null,
            });
        },
        onSuccess: () => {
            setIsSaving(true);
            setIsFadingOut(true);
            setTimeout(() => {
                void queryClient.invalidateQueries({ queryKey: ["memos"] });
                onClose();
            }, 800);
        },
    });

    const handleSubmit = useCallback(
        (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (isSaving) return;
            // 태그 입력창에 남은 내용 커밋
            if (tagInput.trim()) {
                commitTagInput();
                return; // 다음 렌더에서 submit 가능 (사용자가 다시 저장 클릭)
            }
            mutation.mutate();
        },
        [isSaving, tagInput, commitTagInput, mutation],
    );

    const projects = projectsQuery.data?.content ?? [];
    const availableCharacters = charactersQuery.data ?? [];

    return (
        <div
            className="rounded-card-memo p-5 mt-1"
            style={{
                backgroundColor: "var(--w-parchment)",
                border: "1px solid var(--w-hairline)",
                opacity: isFadingOut ? 0 : 1,
                transform: isFadingOut ? "translateY(-8px)" : "translateY(0)",
                transition: "opacity 0.8s ease, transform 0.8s ease",
            }}
        >
            <form onSubmit={handleSubmit}>
                {/* 프로젝트 선택 */}
                <section className="mb-4">
                    <h3
                        className="text-sm font-semibold mb-2"
                        style={{ color: "var(--w-ink)", opacity: 0.7 }}
                    >
                        프로젝트 연결
                    </h3>
                    {projectsQuery.isLoading && (
                        <p className="text-sm" style={{ color: "var(--w-ink)", opacity: 0.4 }}>
                            불러오는 중…
                        </p>
                    )}
                    {projects.length === 0 && !projectsQuery.isLoading && (
                        <p className="text-sm" style={{ color: "var(--w-ink)", opacity: 0.4 }}>
                            연결할 프로젝트가 없습니다.
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        {projects.map((p) => {
                            const isSelected = selectedProjectIds.includes(p.id);
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleProjectToggle(p.id)}
                                    className="px-3 py-1 rounded-button-pill text-sm"
                                    style={{
                                        backgroundColor: isSelected ? "var(--w-ink)" : "var(--w-canvas)",
                                        color: isSelected ? "var(--w-canvas)" : "var(--w-ink)",
                                        border: "1px solid var(--w-hairline)",
                                        cursor: "pointer",
                                    }}
                                >
                                    {p.title}
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* 등장인물 선택 — 선택된 프로젝트들의 합집합 */}
                {selectedProjectIds.length > 0 && availableCharacters.length > 0 && (
                    <section className="mb-4">
                        <h3
                            className="text-sm font-semibold mb-2"
                            style={{ color: "var(--w-ink)", opacity: 0.7 }}
                        >
                            등장인물
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {availableCharacters.map((c) => {
                                const isSelected = selectedCharacterIds.includes(c.characterId);
                                return (
                                    <button
                                        key={c.characterId}
                                        type="button"
                                        onClick={() => handleCharacterToggle(c.characterId)}
                                        className="px-3 py-1 rounded-button-pill text-sm"
                                        style={{
                                            backgroundColor: isSelected ? "var(--w-accent)" : "var(--w-canvas)",
                                            color: isSelected ? "var(--w-canvas)" : "var(--w-ink)",
                                            border: "1px solid var(--w-hairline)",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {c.name}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* 태그 */}
                <section className="mb-4">
                    <h3
                        className="text-sm font-semibold mb-2"
                        style={{ color: "var(--w-ink)", opacity: 0.7 }}
                    >
                        태그
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {tags.map((tag) => (
                            <span
                                key={tag}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-button-pill text-sm"
                                style={{
                                    backgroundColor: "var(--w-canvas)",
                                    border: "1px solid var(--w-hairline)",
                                    color: "var(--w-ink)",
                                }}
                            >
                                #{tag}
                                <button
                                    type="button"
                                    onClick={() => removeTag(tag)}
                                    style={{
                                        color: "var(--w-ink)",
                                        opacity: 0.5,
                                        cursor: "pointer",
                                        background: "none",
                                        border: "none",
                                        padding: 0,
                                        lineHeight: 1,
                                    }}
                                    aria-label={`${tag} 태그 제거`}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                    <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        onBlur={commitTagInput}
                        placeholder="태그 입력 후 Enter 또는 쉼표"
                        className="w-full rounded px-3 py-1.5 text-sm"
                        style={{
                            backgroundColor: "var(--w-canvas)",
                            border: "1px solid var(--w-hairline)",
                            color: "var(--w-ink)",
                            outline: "none",
                        }}
                    />
                </section>

                {/* 이유 (reasonNote) */}
                <section className="mb-4">
                    <h3
                        className="text-sm font-semibold mb-2"
                        style={{ color: "var(--w-ink)", opacity: 0.7 }}
                    >
                        왜 적었나
                    </h3>
                    <textarea
                        value={reasonNote}
                        onChange={(e) => setReasonNote(e.target.value)}
                        placeholder="이 메모를 남긴 이유나 맥락을 적어두면 나중에 도움이 됩니다."
                        rows={3}
                        className="w-full resize-none rounded px-3 py-2 text-sm"
                        style={{
                            backgroundColor: "var(--w-canvas)",
                            border: "1px solid var(--w-hairline)",
                            color: "var(--w-ink)",
                            outline: "none",
                        }}
                    />
                </section>

                {mutation.isError && (
                    <p className="mb-3 text-sm" style={{ color: "var(--w-error)" }}>
                        저장에 실패했습니다. 다시 시도해 주세요.
                    </p>
                )}

                {/* 버튼 */}
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-button-pill text-sm"
                        style={{
                            backgroundColor: "var(--w-canvas)",
                            border: "1px solid var(--w-hairline)",
                            color: "var(--w-ink)",
                            cursor: "pointer",
                        }}
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        disabled={mutation.isPending || isSaving}
                        className="px-4 py-2 rounded-button-pill text-sm font-semibold"
                        style={{
                            backgroundColor: "var(--w-ink)",
                            color: "var(--w-canvas)",
                            opacity: mutation.isPending || isSaving ? 0.5 : 1,
                            cursor: mutation.isPending || isSaving ? "not-allowed" : "pointer",
                        }}
                    >
                        {mutation.isPending || isSaving ? "저장 중…" : "저장"}
                    </button>
                </div>
            </form>
        </div>
    );
}
