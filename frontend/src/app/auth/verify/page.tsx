"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { verifyEmail } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { SuccessBlock } from "@/components/ui/SuccessBlock";

/**
 * 이메일 인증 링크 도착 페이지 (US5).
 *
 * 메일의 `{frontend}/auth/verify?token=...` 클릭 → token 으로 verifyEmail → 성공 시 verify-done 이동.
 * 실패(만료/무효/사용됨) 시 안내 + 재요청 경로.
 */

export default function VerifyPage() {
    return (
        <Suspense fallback={<p style={{ color: "var(--w-ink)", opacity: 0.6 }}>확인 중…</p>}>
            <VerifyInner />
        </Suspense>
    );
}

function VerifyInner() {
    const router = useRouter();
    const token = useSearchParams().get("token");
    const firedRef = useRef(false);

    const verifyMutation = useMutation({
        mutationFn: (t: string) => verifyEmail(t),
        onSuccess: () => router.replace("/auth/verify-done"),
    });

    useEffect(() => {
        if (token && !firedRef.current) {
            firedRef.current = true;
            verifyMutation.mutate(token);
        }
    }, [token, verifyMutation]);

    if (!token) {
        return (
            <SuccessBlock
                variant="info"
                title="잘못된 인증 링크입니다"
                description="메일의 인증 링크를 다시 확인해주세요."
            />
        );
    }

    if (verifyMutation.isError) {
        const message =
            verifyMutation.error instanceof ApiError
                ? "인증 링크가 만료되었거나 이미 사용되었습니다."
                : "인증 처리 중 문제가 발생했습니다.";
        return (
            <div className="flex flex-col items-center gap-6">
                <SuccessBlock variant="info" title="인증하지 못했습니다" description={message} />
                <Link
                    href="/auth/signup-email"
                    className="px-6 py-3 rounded-button-pill font-semibold"
                    style={{ backgroundColor: "var(--w-ink)", color: "var(--w-canvas)" }}
                >
                    다시 가입하기
                </Link>
            </div>
        );
    }

    return <p style={{ color: "var(--w-ink)", opacity: 0.6 }}>이메일을 인증하는 중…</p>;
}
