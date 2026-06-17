"use client";

import type { ReactElement } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePreferences, useIsPreferencesHydrated, DESIGN_HOME } from "@/stores/preferences";

/**
 * 인증 쿠키 보유 사용자가 `/`(랜딩)에 도달했을 때 — 랜딩 마크업 대신 중립 로더를 보이고
 * 선택한 디자인의 홈으로 즉시 이동한다(랜딩 플래시 제거).
 *
 * 서버(app/page.tsx)가 access_token 쿠키 존재를 이미 확인했으므로 me 쿼리 없이 이동한다.
 * design 은 수화 완료 후에만 신뢰(미수화 시 기본값 오판 방지) — 그 전까지 로더 노출.
 */
export function PostLoginRedirect(): ReactElement {
    const router = useRouter();
    const design = usePreferences((state) => state.design);
    const hydrated = useIsPreferencesHydrated();

    useEffect(() => {
        if (!hydrated) return;
        router.replace(DESIGN_HOME[design]);
    }, [hydrated, design, router]);

    return (
        <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#6b7280", fontSize: 14 }}>불러오는 중…</p>
        </div>
    );
}
