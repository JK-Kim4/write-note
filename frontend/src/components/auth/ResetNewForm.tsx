"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { confirmPasswordReset } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { resolveErrorMessage } from "@/lib/api/errors";
import { FormInput } from "@/components/ui/FormInput";
import { FormError } from "@/components/ui/FormError";
import { PanelLink } from "@/components/auth/PanelLink";

/**
 * ResetNewForm — 비밀번호 재설정 확정 (US5).
 *
 * 메일 링크의 `?token=` 을 읽어 새 비밀번호와 함께 confirmPasswordReset → 성공 시 `/auth/reset-done`.
 * 토큰 부재/만료/정책 실패는 안내 메시지. (useSearchParams 사용 — 부모가 Suspense 로 감쌈)
 */
export function ResetNewForm() {
    const router = useRouter();
    const token = useSearchParams().get("token");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);

    const confirmMutation = useMutation({
        mutationFn: () => confirmPasswordReset({ token: token ?? "", newPassword: password }),
        onSuccess: () => router.push("/auth/reset-done"),
    });

    const serverError = confirmMutation.isError
        ? confirmMutation.error instanceof ApiError
            ? resolveErrorMessage(
                  confirmMutation.error.code,
                  "재설정 링크가 만료되었거나 유효하지 않습니다. 다시 요청해주세요.",
              )
            : "재설정 중 문제가 발생했습니다."
        : null;

    if (!token) {
        return (
            <div className="flex flex-col gap-4">
                <h2 className="font-display font-semibold" style={{ fontSize: "20px", color: "var(--w-ink)" }}>
                    잘못된 재설정 링크
                </h2>
                <p style={{ color: "var(--w-ink)", opacity: 0.7, fontSize: "14px" }}>
                    메일의 재설정 링크를 다시 확인해주세요.
                </p>
                <PanelLink href="/auth/reset-request" variant="muted">
                    재설정 다시 요청하기
                </PanelLink>
            </div>
        );
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) {
            setLocalError("새 비밀번호를 입력해주세요.");
            return;
        }
        if (password !== passwordConfirm) {
            setLocalError("비밀번호 확인이 일치하지 않습니다.");
            return;
        }
        setLocalError(null);
        confirmMutation.mutate();
    };

    const pending = confirmMutation.isPending;

    return (
        <form
            className="flex flex-col gap-4"
            style={{ opacity: pending ? 0.6 : 1, pointerEvents: pending ? "none" : "auto" }}
            onSubmit={handleSubmit}
        >
            <h2 className="font-display font-semibold" style={{ fontSize: "20px", color: "var(--w-ink)" }}>
                새 비밀번호 설정
            </h2>
            <FormInput
                name="password"
                type="password"
                label="새 비밀번호"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <FormInput
                name="passwordConfirm"
                type="password"
                label="새 비밀번호 확인"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
            />
            {(localError ?? serverError) ? <FormError>{localError ?? serverError}</FormError> : null}
            <button
                type="submit"
                className="w-full py-3 rounded-button-pill font-semibold"
                style={{ backgroundColor: "var(--w-ink)", color: "var(--w-canvas)" }}
            >
                {pending ? "변경 중…" : "비밀번호 변경"}
            </button>
        </form>
    );
}
