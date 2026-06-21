"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { signupEmail } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { resolveErrorMessage } from "@/lib/api/errors";
import { FormInput } from "@/components/ui/FormInput";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { FormError } from "@/components/ui/FormError";
import { PanelLink } from "@/components/auth/PanelLink";
import { TermsModal } from "@/components/auth/TermsModal";
import { TermsContent } from "@/content/legal/TermsContent";
import { PrivacyContent } from "@/content/legal/PrivacyContent";

/**
 * SignupEmailForm — 이메일 회원가입 (US5, contracts/screen-data-flow.md §5).
 *
 * 성공 → 인증 메일 발송 안내(`/auth/verify-pending`). 실패 code:
 *   - EMAIL_ALREADY_REGISTERED(409) → 이메일 에러 + 로그인 링크
 *   - PASSWORD_TOO_WEAK / EMAIL_INVALID_FORMAT / VALIDATION_FAILED(400) → 해당 메시지
 */

export function SignupEmailForm() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [agreedPrivacy, setAgreedPrivacy] = useState(false);
    const [openModal, setOpenModal] = useState<"terms" | "privacy" | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);

    const signupMutation = useMutation({
        mutationFn: () => signupEmail({ email: email.trim(), password }),
        onSuccess: () => router.push(`/auth/verify-pending?email=${encodeURIComponent(email.trim())}`),
    });

    const errorCode = signupMutation.error instanceof ApiError ? signupMutation.error.code : null;
    const emailAlreadyRegistered = errorCode === "EMAIL_ALREADY_REGISTERED";
    const emailError = emailAlreadyRegistered ? "이미 가입된 이메일입니다." : null;
    const passwordError =
        errorCode && !emailAlreadyRegistered
            ? resolveErrorMessage(errorCode, (signupMutation.error as ApiError).message)
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
        if (!agreedTerms || !agreedPrivacy) {
            setLocalError("이용약관과 개인정보처리방침에 모두 동의해주세요.");
            return;
        }
        setLocalError(null);
        signupMutation.mutate();
    };

    const pending = signupMutation.isPending;

    return (
        <>
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

            <PasswordInput
                name="password"
                label="비밀번호"
                error={Boolean(passwordError)}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            {passwordError ? <FormError>{passwordError}</FormError> : null}

            <PasswordInput
                name="passwordConfirm"
                label="비밀번호 확인"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
            />

            <div className="flex flex-col gap-2 mt-2 text-sm" style={{ color: "var(--w-ink)" }}>
                <div className="flex items-center justify-between gap-2">
                    <label className="flex items-start gap-2">
                        <input
                            type="checkbox"
                            name="terms"
                            className="mt-1"
                            checked={agreedTerms}
                            onChange={(e) => setAgreedTerms(e.target.checked)}
                        />
                        <span>(필수) 이용약관에 동의합니다.</span>
                    </label>
                    <button
                        type="button"
                        onClick={() => setOpenModal("terms")}
                        className="underline underline-offset-2 shrink-0"
                        style={{ color: "var(--w-accent)" }}
                    >
                        이용약관 보기
                    </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <label className="flex items-start gap-2">
                        <input
                            type="checkbox"
                            name="privacy"
                            className="mt-1"
                            checked={agreedPrivacy}
                            onChange={(e) => setAgreedPrivacy(e.target.checked)}
                        />
                        <span>(필수) 개인정보처리방침에 동의합니다.</span>
                    </label>
                    <button
                        type="button"
                        onClick={() => setOpenModal("privacy")}
                        className="underline underline-offset-2 shrink-0"
                        style={{ color: "var(--w-accent)" }}
                    >
                        개인정보처리방침 보기
                    </button>
                </div>
            </div>

            {localError ? <FormError>{localError}</FormError> : null}

            <button
                type="submit"
                className="w-full py-3 rounded-button-pill font-semibold mt-2"
                style={{ backgroundColor: "var(--w-ink)", color: "var(--w-canvas)" }}
            >
                {pending ? "가입 중…" : "가입하기"}
            </button>
        </form>
        {openModal === "terms" ? (
            <TermsModal title="이용약관" onClose={() => setOpenModal(null)}>
                <TermsContent />
            </TermsModal>
        ) : null}
        {openModal === "privacy" ? (
            <TermsModal title="개인정보처리방침" onClose={() => setOpenModal(null)}>
                <PrivacyContent />
            </TermsModal>
        ) : null}
        </>
    );
}
