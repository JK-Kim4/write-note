"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api/auth";

/**
 * Auth route guard — `GET /api/auth/me` (쿠키 인증) 결과로 판단 (005 R-7, FR-025).
 *
 * 인증 상태 단일 판단원 = React Query key `['auth','me']` (200=로그인 / 401=비로그인).
 *
 * mode:
 *   - 'requireAuth': 비로그인 → `/auth/login` redirect
 *   - 'requireAnon': 로그인 상태 → `/` redirect (로그인/회원가입 화면에 이미 인증된 사용자 진입 시)
 *
 * 로딩 중에는 redirect 보류 (인증 확인 전 깜빡임 방지).
 */

export type GuardMode = "requireAuth" | "requireAnon";

export function useAuthGuard(mode: GuardMode): void {
    const router = useRouter();
    const { data, isError, isLoading } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: fetchMe,
        retry: false,
    });
    const isAuthed = data !== undefined && !isError;

    useEffect(() => {
        if (isLoading) {
            return;
        }
        if (mode === "requireAuth" && !isAuthed) {
            router.replace("/auth/login");
            return;
        }
        if (mode === "requireAnon" && isAuthed) {
            router.replace("/");
        }
    }, [mode, isAuthed, isLoading, router]);
}
