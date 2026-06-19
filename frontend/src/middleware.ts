import { NextResponse, type NextRequest } from "next/server";

/**
 * 루트(`/`) 랜딩 가드 — 비로그인 첫 방문자를 공개 랜딩(`/welcome`)으로 보낸다.
 *
 * 028 reconcile 에서 루트를 B형 앱(`requireAuth`)으로 승격하고 랜딩을 `/welcome` 으로 이전하면서,
 * 비로그인 방문자가 루트에서 로그인 폼으로 직행하던 동선을 복원한다. 로그인 사용자(access_token 쿠키 보유)는
 * 그대로 앱 홈으로 진입한다. 세션 판정은 [welcome/page.tsx] 와 동일하게 access_token 쿠키 존재로 한다.
 */
export function middleware(req: NextRequest): NextResponse {
    if (!req.cookies.has("access_token")) {
        const url = req.nextUrl.clone();
        url.pathname = "/welcome";
        return NextResponse.redirect(url);
    }
    return NextResponse.next();
}

export const config = { matcher: "/" };
