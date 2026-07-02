"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { fetchMe } from "@/lib/api/auth";
import { saveReturnTo } from "@/lib/share/returnTo";

/**
 * 공유 페이지 헤더 로그인 진입점(050 US2) — `app/shared/layout.tsx` 는 `metadata` export 때문에
 * server component 로 남아야 해서, 인증 상태 확인(hook)이 필요한 이 버튼만 별도 client component 로 분리.
 *
 * 로그인 회원이면 아무것도 렌더하지 않는다(비로그인 방문자 전용 진입점, FR-007). 클릭 시 현재 공유 페이지
 * 경로를 저장(`saveReturnTo`)한 뒤 `/auth/login` 으로 이동 — 로그인 후 `/entering` 이 이 경로로 복귀시킨다.
 */
export function ShareLoginButton() {
    const router = useRouter();
    const pathname = usePathname();
    const me = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe, retry: false });
    const isMember = me.data !== undefined && !me.isError;

    if (me.isPending || isMember) return null;

    const handleLogin = () => {
        saveReturnTo(pathname ?? "");
        router.push("/auth/login");
    };

    return (
        <button
            type="button"
            onClick={handleLogin}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
        >
            로그인
        </button>
    );
}
