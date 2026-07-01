"use client";

/**
 * 공유 링크(046 R4) React Query 훅. 키 컨벤션은 boards/projects 훅과 동형.
 *
 * 목록 조회 + 생성·끄기·공개작품선택 mutation. mutation 성공 시 ["shares"] 무효화로 목록 갱신.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createShareLink,
    deleteShareLink,
    getAuthorFeedback,
    getSharedView,
    getSharedWork,
    listMyShareLinks,
    setPublicWorks,
    setShareLinkActive,
} from "@/lib/api/share";
import type { ShareTargetType } from "@/lib/api/share";

export const shareKeys = {
    all: ["shares"] as const,
    mine: () => [...shareKeys.all, "mine"] as const,
    /** 작가 맥락 뷰(050 US1) — 링크·스냅샷 단위. `mine()` 과 별개 prefix 라 읽음 처리 시 선택적 무효화 가능. */
    authorFeedback: (linkId: number, projectId: number) => [...shareKeys.all, "authorFeedback", linkId, projectId] as const,
};

/** 공개 열람(R5) 쿼리 키 — 토큰 단위 진입 목록 + 작품 단위 본문(댓글 동봉). */
export const publicShareKeys = {
    all: ["sharedPublic"] as const,
    view: (token: string) => [...publicShareKeys.all, "view", token] as const,
    work: (token: string, projectId: number) => [...publicShareKeys.all, "work", token, projectId] as const,
};

/** 내 공유 링크 목록 — 진입마다 최신 하이드레이션(생성·끄기 직후 반영). */
export function useMyShareLinks() {
    return useQuery({
        queryKey: shareKeys.mine(),
        queryFn: () => listMyShareLinks(),
        refetchOnMount: "always",
    });
}

export function useCreateShareLink() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ targetType, targetId }: { targetType: ShareTargetType; targetId: number }) =>
            createShareLink(targetType, targetId),
        onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.all }),
    });
}

/** 공유 링크 끄기/다시 켜기 — 성공 시 목록 무효화(공유 중 상태·개수 갱신). */
export function useSetShareLinkActive() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => setShareLinkActive(id, isActive),
        onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.all }),
    });
}

/** 공유 링크 영구 삭제(047) — 성공 시 목록 무효화(개수·슬롯 회수 갱신). */
export function useDeleteShareLink() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => deleteShareLink(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.all }),
    });
}

/** 시리즈 공개 작품 선택 — 성공 시 목록 무효화(snapshots 갱신). */
export function useSetPublicWorks() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, projectIds }: { id: number; projectIds: number[] }) => setPublicWorks(id, projectIds),
        onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.all }),
    });
}

// ─── 공개 열람(R5) — 비로그인 200, retry:false(없는 토큰 404 즉시 표면화) ──────────

/** 공개 열람 진입(작품/시리즈 목록). enabled=토큰 존재 시. */
export function useSharedView(token: string) {
    return useQuery({
        queryKey: publicShareKeys.view(token),
        queryFn: () => getSharedView(token),
        enabled: token.length > 0,
        retry: false,
    });
}

/** 공개 본문 단건(댓글 동봉) — 진입마다 최신 하이드레이션(댓글 작성·삭제 직후 반영). */
export function useSharedWork(token: string, projectId: number) {
    return useQuery({
        queryKey: publicShareKeys.work(token, projectId),
        queryFn: () => getSharedWork(token, projectId),
        enabled: token.length > 0 && Number.isFinite(projectId) && projectId > 0,
        retry: false,
        refetchOnMount: "always",
    });
}

// ─── 작가 맥락 뷰(050 US1) ────────────────────────────────────────────────────

/** 작가 맥락 뷰 — 한 공유 링크(스냅샷)의 전문+전체 피드백+반응 집계. 소유 작가만(타인 403). */
export function useAuthorFeedback(linkId: number, projectId: number) {
    return useQuery({
        queryKey: shareKeys.authorFeedback(linkId, projectId),
        queryFn: () => getAuthorFeedback(linkId, projectId),
        enabled: Number.isFinite(linkId) && Number.isFinite(projectId),
        retry: false,
        refetchOnMount: "always",
    });
}
