"use client";

/**
 * characters React Query 훅 (017 US2) — 집필실 인물 노트 패널용 보기 + 빠른 추가.
 * 기존 src/lib/api/characters 의 listCharacters/createCharacter 재사용. 동기화는 invalidate(useMemos 패턴 일관).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createCharacter, listCharacters, type CreateCharacterInput } from "@/lib/api/characters";
import type { CharacterResponse } from "@/types/api";

export const characterKeys = {
    all: ["characters"] as const,
    byProject: (projectId: number) => [...characterKeys.all, "project", projectId] as const,
};

/** 작품 등장인물 목록(빠른 추가 패널용). 작품당 인물 수가 적어 한 페이지로 충분히 크게 조회. */
export function useProjectCharacters(projectId: number) {
    return useQuery({
        queryKey: characterKeys.byProject(projectId),
        queryFn: async (): Promise<CharacterResponse[]> => {
            const page = await listCharacters(projectId, { size: 100 });
            return page.content;
        },
        enabled: Number.isFinite(projectId),
    });
}

/** 인물 빠른 추가. 성공 시 그 작품 인물 목록만 무효화 → 자동 갱신. */
export function useCreateCharacter() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ projectId, input }: { projectId: number; input: CreateCharacterInput }) =>
            createCharacter(projectId, input),
        onSuccess: (_data, { projectId }) =>
            qc.invalidateQueries({ queryKey: characterKeys.byProject(projectId) }),
    });
}
