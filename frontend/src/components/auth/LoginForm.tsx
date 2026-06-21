"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login, resendVerification } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { resolveErrorMessage } from "@/lib/api/errors";
import { FormInput } from "@/components/ui/FormInput";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { KakaoButton } from "@/components/auth/KakaoButton";
import { PanelLink } from "@/components/auth/PanelLink";
import { SubmitLoading } from "@/components/ui/SubmitLoading";

const REMEMBERED_EMAIL_KEY = "writenote.rememberedEmail.v1";

/**
 * LoginForm — 이메일 로그인 폼 (US1, contracts/screen-data-flow.md §5).
 *
 * 성공: 쿠키 발급 → `['auth','me']` 무효화 → 앱 홈(/) 이동.
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
    const [remember, setRemember] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem(REMEMBERED_EMAIL_KEY);
        if (saved) {
            setEmail(saved);
            setRemember(true);
        }
    }, []);

    const loginMutation = useMutation({
        mutationFn: () => login({ email, password }),
        onSuccess: async () => {
            if (remember) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
            else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
            await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
            router.push("/");
        },
    });

    const resendMutation = useMutation({
        mutationFn: () => resendVerification(email),
    });

    const dim = state === "loading" || loginMutation.isPending;
    const errorMessage = loginMutation.isError
        ? loginMutation.error instanceof ApiError
            ? resolveErrorMessage(loginMutation.error.code, loginMutation.error.message)
            : "로그인에 실패했습니다."
        : null;
    const isEmailNotVerified =
        loginMutation.error instanceof ApiError &&
        loginMutation.error.code === "EMAIL_NOT_VERIFIED";

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
            <PasswordInput
                name="password"
                label="비밀번호"
                autoComplete="current-password"
                error={errorMessage !== null}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--w-ink)" }}>
                <input
                    type="checkbox"
                    name="rememberEmail"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                />
                <span>이메일 기억하기</span>
            </label>
            {errorMessage ? (
                <p role="alert" style={{ color: "var(--w-error)", fontSize: "14px" }}>
                    {errorMessage}
                </p>
            ) : null}
            {isEmailNotVerified ? (
                resendMutation.isSuccess ? (
                    <p style={{ color: "var(--w-ink)", opacity: 0.7, fontSize: "13px" }}>
                        인증 메일을 다시 보냈어요. 메일함을 확인해주세요.
                    </p>
                ) : (
                    <button
                        type="button"
                        onClick={() => resendMutation.mutate()}
                        disabled={resendMutation.isPending}
                        className="self-start underline"
                        style={{ color: "var(--w-ink)", opacity: 0.7, fontSize: "13px" }}
                    >
                        {resendMutation.isPending ? "재발송 중…" : "인증 메일 재발송"}
                    </button>
                )
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
