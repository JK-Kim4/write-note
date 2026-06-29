"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLoader } from "@/components/ui/BrandLoader";

/**
 * `/entering` — 로그인 중 트랜지션 인터스티셜.
 *
 * 이미 세션(access_token 쿠키) 보유 사용자가 `/auth/login` 재진입 시 middleware 가 폼을 건너뛰고
 * 이 라우트로 보낸다([middleware.ts]). 0.5초 "로그인 중" 효과([BrandLoader])를 보여준 뒤 짧은 페이드로
 * 앱 홈(`/`)으로 `replace` — 히스토리에 안 남아 뒤로가기로 로그인 화면이 다시 나오지 않는다.
 *
 * `auth/layout`(requireAnon) 밖의 top-level 라우트여야 세션 보유자가 와도 즉시 튕기지 않아 효과가 보인다.
 * 효과 자체는 공용 [BrandLoader] 로 분리(서비스 전역 재사용). 본 라우트는 hold·fade·replace 타이밍만 담당.
 */

const HOLD_MS = 500;
const FADE_MS = 220;

export default function EnteringPage() {
    const router = useRouter();
    const [leaving, setLeaving] = useState(false);

    useEffect(() => {
        const fade = setTimeout(() => setLeaving(true), HOLD_MS);
        const go = setTimeout(() => router.replace("/"), HOLD_MS + FADE_MS);
        return () => {
            clearTimeout(fade);
            clearTimeout(go);
        };
    }, [router]);

    return (
        <div style={{ opacity: leaving ? 0 : 1, transition: `opacity ${FADE_MS}ms ease` }}>
            <BrandLoader fullscreen />
        </div>
    );
}
