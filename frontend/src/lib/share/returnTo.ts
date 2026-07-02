/**
 * 비로그인 방문자 로그인 복귀(050 US2) — 순수 저장/소비 로직.
 *
 * 로그인 진입 직전 현재 공유 페이지 경로를 `localStorage` 에 저장해 두었다가, 로그인 성공 후(`/entering`)
 * 소비해 그 페이지로 `router.replace` 한다(research D5). 같은 origin 이라 카카오 OAuth 왕복(외부 도메인
 * 경유 후 복귀)에도 생존한다. BE 변경 없음(FE-only).
 *
 * open-redirect 차단(FR-009): 저장·소비 모두 `/shared/` prefix 만 허용 — 그 외 값은 저장하지 않거나(save)
 * null 로 무시한다(consume, 직접 조작된 localStorage 값 대비).
 */
const RETURN_TO_KEY = "writenote.share.returnTo.v1";
const SHARED_PREFIX = "/shared/";

function isSafeSharePath(path: string): boolean {
    // `/shared/` prefix + `..`(인코딩 `%2e` 포함) traversal 거부. 외부(`//`·스킴)는 prefix 로 이미 차단.
    return path.startsWith(SHARED_PREFIX) && !path.includes("..") && !/%2e/i.test(path);
}

/** 로그인 진입 직전 현재 경로 저장. `/shared/` 로 시작하지 않으면 저장하지 않는다. */
export function saveReturnTo(path: string): void {
    if (typeof window === "undefined") return;
    if (!isSafeSharePath(path)) return;
    window.localStorage.setItem(RETURN_TO_KEY, path);
}

/** 저장된 복귀 경로를 1회 소비(제거)한다. 없거나 안전 prefix 밖이면 null. */
export function consumeReturnTo(): string | null {
    if (typeof window === "undefined") return null;
    const saved = window.localStorage.getItem(RETURN_TO_KEY);
    window.localStorage.removeItem(RETURN_TO_KEY);
    if (!saved || !isSafeSharePath(saved)) return null;
    return saved;
}
