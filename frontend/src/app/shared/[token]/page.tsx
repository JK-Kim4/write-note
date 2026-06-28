"use client";

import { useParams } from "next/navigation";
import { SharedTokenView } from "@/components/share/SharedTokenView";

/**
 * 공개 공유 진입(046 R5) — `/shared/{token}`. 비로그인 열람(인증벽은 상위 /shared 레이아웃 밖).
 * noindex 메타데이터는 `app/shared/layout.tsx` 가 상속 제공.
 */
export default function SharedTokenPage() {
    const params = useParams<{ token: string }>();
    return <SharedTokenView token={params.token ?? ""} />;
}
