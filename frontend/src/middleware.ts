import { NextResponse, type NextRequest } from "next/server";

/**
 * 임시 디버그 미들웨어 — document 저장(PUT)/조회(GET) 요청을 dev 서버 콘솔에 로깅.
 * 자동저장 거짓 충돌 원인 추적용(중복/동시 저장·refetch 패턴 관찰). 원인 규명 후 제거.
 * 로그만 남기고 요청은 그대로 통과(NextResponse.next()) — 프록시 동작 불변.
 */
export function middleware(req: NextRequest) {
    const p = req.nextUrl.pathname;
    if (p.startsWith("/api/documents") || p.endsWith("/document")) {
        // eslint-disable-next-line no-console
        console.log(`[DBG-DOC] ${req.method} ${p}${req.nextUrl.search} @ ${Date.now()}`);
    }
    return NextResponse.next();
}

export const config = {
    matcher: ["/api/documents/:path*", "/api/projects/:path*/document"],
};
