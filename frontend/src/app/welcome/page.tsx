import { cookies } from "next/headers";
import { LandingContent } from "@/components/landing/LandingContent";

/**
 * 공개 소개 페이지(`/welcome`).
 *
 * 로그인 여부와 무관하게 항상 노출한다 — 로그인 사용자도 소개 페이지를 직접 열어볼 수 있다.
 * 인증 쿠키(access_token) 보유 시 가입/로그인 CTA 대신 "내 작업실로"(`/`) 진입 버튼을 보인다([LandingContent]).
 *
 * 쿠키를 서버에서 읽으므로 본 라우트는 동적 렌더(추가 인증 round-trip 없이 즉시 렌더).
 */
export default async function LandingPage() {
    const hasSession = (await cookies()).has("access_token");
    return <LandingContent isAuthenticated={hasSession} />;
}
