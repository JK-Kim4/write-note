"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { requestPasswordReset } from "@/lib/api/auth";
import { FormInput } from "@/components/ui/FormInput";
import { FormError } from "@/components/ui/FormError";
import { PanelLink } from "@/components/auth/PanelLink";

/**
 * ResetRequestForm — 비밀번호 재설정 요청 (US5, contracts/screen-data-flow.md §5).
 *
 * 성공 → 발송 안내(`/auth/reset-sent`). 미가입 이메일도 200(정보 노출 회피) 이라 항상 안내로 이동.
 */
export function ResetRequestForm() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);

    const requestMutation = useMutation({
        mutationFn: () => requestPasswordReset(email.trim()),
        onSuccess: () => router.push("/auth/reset-sent"),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            setLocalError("이메일을 입력해주세요.");
            return;
        }
        setLocalError(null);
        requestMutation.mutate();
    };

    const pending = requestMutation.isPending;

    return (
        <form
            className="flex flex-col gap-4"
            style={{ opacity: pending ? 0.6 : 1, pointerEvents: pending ? "none" : "auto" }}
            onSubmit={handleSubmit}
        >
            <h2 className="font-display font-semibold" style={{ fontSize: "20px", color: "var(--w-ink)" }}>
                비밀번호 재설정
            </h2>
            <p style={{ color: "var(--w-ink)", opacity: 0.7, fontSize: "14px" }}>
                가입한 이메일을 입력하시면 재설정 링크를 보내드립니다.
            </p>
            <FormInput
                name="email"
                type="email"
                label="이메일"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            {localError ? <FormError>{localError}</FormError> : null}
            <button
                type="submit"
                className="w-full py-3 rounded-button-pill font-semibold"
                style={{ backgroundColor: "var(--w-ink)", color: "var(--w-canvas)" }}
            >
                {pending ? "보내는 중…" : "재설정 메일 받기"}
            </button>
            <div className="text-center mt-2">
                <PanelLink href="/auth/login" variant="muted">
                    로그인으로 돌아가기
                </PanelLink>
            </div>
        </form>
    );
}
