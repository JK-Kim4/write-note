"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import {
    type CreateCharacterInput,
    createCharacter,
    deleteCharacter,
    listCharacters,
    reorderCharacters,
    updateCharacter,
} from "@/lib/api/characters";
import { ApiError } from "@/lib/api/client";
import type { CharacterResponse, Page } from "@/types/api";
import { CharacterForm } from "@/components/projects/CharacterForm";
import { CharacterList } from "@/components/projects/CharacterList";
import { TopBar } from "@/components/shell/TopBar";

/**
 * 등장인물 관리 (US4, contracts/screen-data-flow.md §4).
 *
 * 목록 + 생성(name 필수) + 편집 + 삭제 + 재정렬. reorder 는 응답 목록으로 캐시 갱신(별도 GET 불필요).
 */

const CHARACTERS_PAGE_SIZE = 100;

export default function CharactersPage() {
    useAuthGuard("requireAuth");
    const params = useParams<{ id: string }>();
    const projectId = Number(params.id);
    const queryClient = useQueryClient();
    const queryKey = ["characters", projectId];

    const [editing, setEditing] = useState<CharacterResponse | null>(null);

    const charactersQuery = useQuery({
        queryKey,
        queryFn: () => listCharacters(projectId, { page: 0, size: CHARACTERS_PAGE_SIZE }),
        retry: false,
    });
    const characters = charactersQuery.data?.content ?? [];

    const invalidate = () => queryClient.invalidateQueries({ queryKey });

    const createMutation = useMutation({
        mutationFn: (input: CreateCharacterInput) => createCharacter(projectId, input),
        onSuccess: async () => {
            await invalidate();
        },
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, input }: { id: number; input: CreateCharacterInput }) =>
            updateCharacter(projectId, id, input),
        onSuccess: async () => {
            await invalidate();
            setEditing(null);
        },
    });
    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteCharacter(projectId, id),
        onSuccess: async () => {
            await invalidate();
        },
    });
    const reorderMutation = useMutation({
        mutationFn: (characterIds: number[]) => reorderCharacters(projectId, characterIds),
        onSuccess: (page: Page<CharacterResponse>) => {
            queryClient.setQueryData(queryKey, page);
        },
    });

    const submitForm = (input: CreateCharacterInput) => {
        if (editing) {
            updateMutation.mutate({ id: editing.id, input });
        } else {
            createMutation.mutate(input);
        }
    };

    const move = (index: number, direction: "up" | "down") => {
        const target = direction === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= characters.length) {
            return;
        }
        const ids = characters.map((c) => c.id);
        [ids[index], ids[target]] = [ids[target], ids[index]];
        reorderMutation.mutate(ids);
    };

    const activeMutation = editing ? updateMutation : createMutation;
    const formError = activeMutation.isError
        ? activeMutation.error instanceof ApiError
            ? activeMutation.error.message
            : "저장하지 못했습니다."
        : null;

    return (
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--w-parchment)" }}>
            <TopBar title="등장인물" />
            <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-10 flex flex-col gap-6">
                <Link href={`/projects/${projectId}`} style={{ color: "var(--w-accent)", fontSize: "14px" }}>
                    ← 프로젝트로
                </Link>

                <CharacterForm
                    key={editing?.id ?? "new"}
                    initial={editing}
                    onSubmit={submitForm}
                    onCancel={() => setEditing(null)}
                    pending={activeMutation.isPending}
                    error={formError}
                />

                {characters.length > 0 ? (
                    <CharacterList
                        characters={characters}
                        onMoveUp={(index) => move(index, "up")}
                        onMoveDown={(index) => move(index, "down")}
                        onEdit={setEditing}
                        onDelete={(id) => deleteMutation.mutate(id)}
                    />
                ) : (
                    <p style={{ color: "var(--w-ink)", opacity: 0.5, fontSize: "15px" }}>
                        아직 등장인물이 없습니다. 위에서 추가해 보세요.
                    </p>
                )}
            </main>
        </div>
    );
}
