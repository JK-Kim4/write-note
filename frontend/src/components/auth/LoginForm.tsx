"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { resolveErrorMessage } from "@/lib/api/errors";
import { FormInput } from "@/components/ui/FormInput";
import { KakaoButton } from "@/components/auth/KakaoButton";
import { PanelLink } from "@/components/auth/PanelLink";
import { SubmitLoading } from "@/components/ui/SubmitLoading";

/**
 * LoginForm — 이메일 로그인 폼 (US1, contracts/screen-data-flow.md §5).
 *
 * 성공: 쿠키 발급 → `['auth','me']` 무효화 → 홈(`/`) 이동.
 * 실패: 401 code(EMAIL_NOT_VERIFIED / LOGIN_FAILED / LOGIN_LOCKED) → 한국어 메시지.
 *
 * `state` prop 은 데모 라우트(login-loading)용 외관 제어. 실제 진행 상태는 mutation.isPending.
 */

interface LoginFormProps {
    state?: "default" | "loading";
}

export function LoginForm({ state = "default" }: LoginFormProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const loginMutation = useMutation({
        mutationFn: () => login({ email, password }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
            router.push("/");
        },
    });

    const dim = state === "loading" || loginMutation.isPending;
    const errorMessage = loginMutation.isError
        ? loginMutation.error instanceof ApiError
            ? resolveErrorMessage(loginMutation.error.code, loginMutation.error.message)
            : "로그인에 실패했습니다."
        : null;

    return (
        <form
            className="flex flex-col gap-4"
            style={{ opacity: dim ? 0.6 : 1, pointerEvents: dim ? "none" : "auto" }}
            onSubmit={(e) => {
                e.preventDefault();
                loginMutation.mutate();
            }}
        >
            <FormInput
                name="email"
                type="email"
                label="이메일"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            <FormInput
                name="password"
                type="password"
                label="비밀번호"
                autoComplete="current-password"
                error={errorMessage !== null}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            {errorMessage ? (
                <p role="alert" style={{ color: "var(--w-error)", fontSize: "14px" }}>
                    {errorMessage}
                </p>
            ) : null}
            {dim ? (
                <SubmitLoading label="로그인 중…" />
            ) : (
                <button
                    type="submit"
                    className="w-full py-3 rounded-button-pill font-semibold"
                    style={{ backgroundColor: "var(--w-ink)", color: "var(--w-canvas)" }}
                >
                    로그인
                </button>
            )}
            <div className="flex items-center gap-2" aria-hidden="true">
                <div className="flex-1" style={{ borderTop: "1px solid var(--w-hairline)" }} />
                <span style={{ fontSize: "12px", color: "var(--w-ink)", opacity: 0.5 }}>
                    또는
                </span>
                <div className="flex-1" style={{ borderTop: "1px solid var(--w-hairline)" }} />
            </div>
            <KakaoButton disabled={dim} />
            <div className="flex items-center justify-between mt-4">
                <PanelLink href="/auth/reset-request" variant="muted">
                    비밀번호 재설정
                </PanelLink>
                <PanelLink href="/auth/signup">회원가입 →</PanelLink>
            </div>
        </form>
    );
}
