"use client";

import { useAuthGuard } from "@/lib/auth/guard";
import { ShareLinkManager } from "@/components/share/ShareLinkManager";

/**
 * 공유 관리 허브(047 US2) — 헤더 최상위 "공유" 진입점(`/shares`).
 * 마이페이지 하위(`/mypage/shares`)에서 승격(redirect 보존). 받은 피드백 + 작품/시리즈별 링크(1:N).
 */
export default function SharesPage() {
    useAuthGuard("requireAuth");
    return <ShareLinkManager />;
}
