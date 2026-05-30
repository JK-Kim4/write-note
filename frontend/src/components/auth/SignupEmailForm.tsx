"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { signupEmail } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { FormInput } from "@/components/ui/FormInput";
import { FormError } from "@/components/ui/FormError";
import { PanelLink } from "@/components/auth/PanelLink";

/**
 * SignupEmailForm — 이메일 회원가입 (US5, contracts/screen-data-flow.md §5).
 *
 * 성공 → 인증 메일 발송 안내(`/auth/verify-pending`). 실패 code:
 *   - EMAIL_ALREADY_REGISTERED(409) → 이메일 에러 + 로그인 링크
 *   - PASSWORD_TOO_WEAK / EMAIL_INVALID_FORMAT / VALIDATION_FAILED(400) → 해당 메시지
 */

const PASSWORD_ERROR_CODES: Record<string, string> = {
    PASSWORD_TOO_WEAK: "비밀번호가 너무 약합니다. 8자 이상, 숫자·문자 조합을 사용하세요.",
    EMAIL_INVALID_FORMAT: "이메일 형식이 올바르지 않습니다.",
    VALIDATION_FAILED: "입력값을 확인해주세요.",
};

export function SignupEmailForm() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [agreed, setAgreed] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const signupMutation = useMutation({
        mutationFn: () => signupEmail({ email: email.trim(), password }),
        onSuccess: () => router.push("/auth/verify-pending"),
    });

    const errorCode = signupMutation.error instanceof ApiError ? signupMutation.error.code : null;
    const emailAlreadyRegistered = errorCode === "EMAIL_ALREADY_REGISTERED";
    const emailError = emailAlreadyRegistered ? "이미 가입된 이메일입니다." : null;
    const passwordError =
        errorCode && !emailAlreadyRegistered
            ? (PASSWORD_ERROR_CODES[errorCode] ?? (signupMutation.error as ApiError).message)
            : null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password) {
            setLocalError("이메일과 비밀번호를 입력해주세요.");
            return;
        }
        if (password !== passwordConfirm) {
            setLocalError("비밀번호 확인이 일치하지 않습니다.");
            return;
        }
        if (!agreed) {
            setLocalError("이용약관에 동의해주세요.");
            return;
        }
        setLocalError(null);
        signupMutation.mutate();
    };

    const pending = signupMutation.isPending;

    return (
        <form
            className="flex flex-col gap-4"
            style={{ opacity: pending ? 0.6 : 1, pointerEvents: pending ? "none" : "auto" }}
            onSubmit={handleSubmit}
        >
            <FormInput
                name="email"
                type="email"
                label="이메일"
                error={Boolean(emailError)}
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            {emailError ? (
                <FormError>
                    {emailError} <PanelLink href="/auth/login">로그인하기 →</PanelLink>
                </FormError>
            ) : null}

            <FormInput
                name="password"
                type="password"
                label="비밀번호"
                error={Boolean(passwordError)}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            {passwordError ? <FormError>{passwordError}</FormError> : null}

            <FormInput
                name="passwordConfirm"
                type="password"
                label="비밀번호 확인"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
            />

            <label className="flex items-start gap-2 text-sm mt-2" style={{ color: "var(--w-ink)" }}>
                <input
                    type="checkbox"
                    name="terms"
                    className="mt-1"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                />
                <span>이용약관 및 개인정보 처리방침에 동의합니다.</span>
            </label>

            {localError ? <FormError>{localError}</FormError> : null}

            <button
                type="submit"
                className="w-full py-3 rounded-button-pill font-semibold mt-2"
                style={{ backgroundColor: "var(--w-ink)", color: "var(--w-canvas)" }}
            >
                {pending ? "가입 중…" : "가입하기"}
            </button>
        </form>
    );
}
