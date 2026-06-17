"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api/auth";
import { usePreferences, useIsPreferencesHydrated, DESIGN_HOME } from "@/stores/preferences";

/**
 * 공개 랜딩(`/`)에 마운트 — 이미 로그인한 사용자는 자신의 작업실 홈으로 보낸다.
 * 인증 판단원 = React Query `['auth','me']`(guard.ts와 동일 key). 비로그인이면 no-op(소개 노출).
 * design 은 수화 완료 후에만 신뢰(미수화 시 기본값 'b' 오판 방지).
 */
export function LandingAuthRedirect(): null {
    const router = useRouter();
    const design = usePreferences((state) => state.design);
    const hydrated = useIsPreferencesHydrated();
    const { data, isError, isLoading } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: fetchMe,
        retry: false,
    });
    const isAuthed = data !== undefined && !isError;

    useEffect(() => {
        if (isLoading || !hydrated) return;
        if (isAuthed) router.replace(DESIGN_HOME[design]);
    }, [isAuthed, isLoading, hydrated, design, router]);

    return null;
}
