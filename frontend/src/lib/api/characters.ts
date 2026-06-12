import { apiFetch } from "./client";
import type { CharacterResponse, Page } from "@/types/api";

/**
 * 등장인물 API (US4, contracts/proxy-and-client.md §4).
 *
 * 모든 endpoint 는 `/api/projects/{projectId}/characters` 하위. reorder 는 새 순서 목록을 반환.
 */

export interface ListCharactersParams {
    page?: number;
    size?: number;
}

/** 성별 코드 — 비움(null) 허용. FE 표시는 남/여/기타. */
export type Gender = "MALE" | "FEMALE" | "OTHER";

/** 성별 코드 → 한글 표시. 비움(null)이면 null(미표시). */
export function genderLabel(gender: Gender | null): string | null {
    switch (gender) {
        case "MALE":
            return "남";
        case "FEMALE":
            return "여";
        case "OTHER":
            return "기타";
        default:
            return null;
    }
}

export interface CreateCharacterInput {
    name: string;
    shortDescription?: string | null;
    notes?: string | null;
    age?: string | null;
    gender?: Gender | null;
    traits?: string | null;
    displayOrder?: number | null;
}

export type UpdateCharacterInput = Partial<CreateCharacterInput>;

const buildQuery = (params: ListCharactersParams): string => {
    const search = new URLSearchParams();
    if (params.page !== undefined) search.set("page", String(params.page));
    if (params.size !== undefined) search.set("size", String(params.size));
    const qs = search.toString();
    return qs ? `?${qs}` : "";
};

export function listCharacters(projectId: number, params: ListCharactersParams = {}): Promise<Page<CharacterResponse>> {
    return apiFetch<Page<CharacterResponse>>(`/api/projects/${projectId}/characters${buildQuery(params)}`, {
        method: "GET",
    });
}

export function getCharacter(projectId: number, id: number): Promise<CharacterResponse> {
    return apiFetch<CharacterResponse>(`/api/projects/${projectId}/characters/${id}`, { method: "GET" });
}

export function createCharacter(projectId: number, input: CreateCharacterInput): Promise<CharacterResponse> {
    return apiFetch<CharacterResponse>(`/api/projects/${projectId}/characters`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function updateCharacter(
    projectId: number,
    id: number,
    input: UpdateCharacterInput,
): Promise<CharacterResponse> {
    return apiFetch<CharacterResponse>(`/api/projects/${projectId}/characters/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

export function reorderCharacters(projectId: number, characterIds: number[]): Promise<Page<CharacterResponse>> {
    return apiFetch<Page<CharacterResponse>>(`/api/projects/${projectId}/characters/reorder`, {
        method: "PUT",
        body: JSON.stringify({ characterIds }),
    });
}

export function deleteCharacter(projectId: number, id: number): Promise<void> {
    return apiFetch<void>(`/api/projects/${projectId}/characters/${id}`, { method: "DELETE" });
}
