import { cookies } from "next/headers";
import { LandingContent } from "@/components/landing/LandingContent";
import { PostLoginRedirect } from "@/components/landing/PostLoginRedirect";

/**
 * 공개 소개 페이지(`/`).
 *
 * 인증 쿠키(access_token) 보유 시 — 랜딩을 렌더하지 않고 [PostLoginRedirect]가 디자인별 홈으로 즉시 이동
 * (로그인/OAuth 후 랜딩이 잠깐 노출되는 플래시 제거). 비로그인(쿠키 없음)이면 랜딩을 그대로 노출.
 *
 * 쿠키를 서버에서 읽으므로 본 라우트는 동적 렌더(비로그인 방문자에겐 추가 인증 round-trip 없이 즉시 랜딩).
 */
export default async function LandingPage() {
    const hasSession = (await cookies()).has("access_token");
    if (hasSession) {
        return <PostLoginRedirect />;
    }
    return <LandingContent />;
}
