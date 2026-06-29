import { NextResponse, type NextRequest } from "next/server";

/**
 * 진입 가드 middleware — 라우트 렌더 전 쿠키 분기로 어색한 동선·깜빡임을 제거한다.
 *
 * - 루트(`/`): 비로그인(access_token 쿠키 없음) 첫 방문자를 공개 랜딩(`/welcome`)으로 보낸다.
 *   로그인 사용자는 앱 홈으로 그대로 진입한다(028 reconcile).
 * - 로그인 페이지(`/auth/login`): 이미 세션(access_token 쿠키) 보유 시 폼 렌더 전에 짧은 트랜지션
 *   라우트(`/entering`)로 redirect 한다. 클라 `useAuthGuard("requireAnon")` 가 `/api/auth/me` 응답으로
 *   늦게 판단해 폼이 깜빡이던 것을 진입 전으로 앞당긴 것. `/entering` 은 0.5초 "로그인 중" 효과 뒤 앱
 *   홈(`/`)으로 보낸다([entering/page.tsx]). requireAnon 가드는 그대로 두어, 만료 토큰(존재하나 무효)
 *   으로 `/` 핑퐁이 나도 결국 로그인 폼으로 수렴하는 유효성 2차 보정을 맡긴다.
 *
 * 세션 판정은 [welcome/page.tsx] 와 동일하게 access_token 쿠키 "존재" 로 한다(유효성 검증 아님 —
 * httpOnly JWT 내용은 미들웨어에서 검증하지 않는다).
 */
export function middleware(req: NextRequest): NextResponse {
    const hasSession = req.cookies.has("access_token");
    const url = req.nextUrl.clone();

    // 로그인 페이지: 이미 세션 있으면 진입 전에 트랜지션 라우트(/entering)로 — 거기서 0.5초 효과 뒤 앱 홈.
    if (req.nextUrl.pathname === "/auth/login") {
        if (hasSession) {
            url.pathname = "/entering";
            return NextResponse.redirect(url);
        }
        return NextResponse.next();
    }

    // 루트: 비로그인 첫 방문자를 공개 랜딩으로.
    if (!hasSession) {
        url.pathname = "/welcome";
        return NextResponse.redirect(url);
    }
    return NextResponse.next();
}

export const config = { matcher: ["/", "/auth/login"] };
