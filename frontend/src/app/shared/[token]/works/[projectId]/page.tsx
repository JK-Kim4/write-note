"use client";

import { useParams } from "next/navigation";
import { SharedWorkView } from "@/components/share/SharedWorkView";

/**
 * 공개 공유 본문(046 R5) — `/shared/{token}/works/{projectId}`. 비로그인 읽기 전용 + 회원 구간 댓글.
 * noindex 메타데이터는 `app/shared/layout.tsx` 가 상속 제공.
 */
export default function SharedWorkPage() {
    const params = useParams<{ token: string; projectId: string }>();
    return <SharedWorkView token={params.token ?? ""} projectId={Number(params.projectId)} />;
}
