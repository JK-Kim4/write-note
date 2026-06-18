"use client";

import type { ReactElement } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 인증 쿠키 보유 사용자가 `/welcome`(랜딩)에 도달했을 때 — 랜딩 마크업 대신 중립 로더를 보이고
 * 앱 홈(/)으로 즉시 이동한다(랜딩 플래시 제거).
 *
 * 서버(app/welcome/page.tsx)가 access_token 쿠키 존재를 이미 확인했으므로 me 쿼리 없이 이동한다.
 */
export function PostLoginRedirect(): ReactElement {
    const router = useRouter();

    useEffect(() => {
        router.replace("/");
    }, [router]);

    return (
        <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#6b7280", fontSize: 14 }}>불러오는 중…</p>
        </div>
    );
}
