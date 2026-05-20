"use client";

import { FormInput } from "@/components/ui/FormInput";
import { FormError } from "@/components/ui/FormError";
import { PanelLink } from "@/components/auth/PanelLink";

/**
 * SignupEmailForm — 회원가입 step 2 (이메일 + 약관) + signup-error 변형.
 *
 * Spec reference: contracts/route-surfaces.md §1 (signup-email / signup-error 행)
 * Source: DESIGN.md §핵심 인증 UX 결정 §6 — 에러 메시지에 해결 경로 인라인 링크.
 */

export interface SignupEmailFormProps {
    emailError?: string;          // 예: "이미 가입된 이메일입니다."
    emailHasLoginLink?: boolean;  // 인라인 해결 경로 (로그인 링크) 노출 여부
    passwordError?: string;        // 예: "비밀번호가 너무 약합니다."
    submitDisabled?: boolean;
}

export function SignupEmailForm({
    emailError,
    emailHasLoginLink = false,
    passwordError,
    submitDisabled = false,
}: SignupEmailFormProps) {
    return (
        <form
            className="flex flex-col gap-4"
            onSubmit={(e) => e.preventDefault()}
        >
            <FormInput
                name="email"
                type="email"
                label="이메일"
                error={Boolean(emailError)}
                placeholder="you@example.com"
                autoComplete="email"
            />
            {emailError ? (
                <FormError>
                    {emailError}
                    {emailHasLoginLink ? (
                        <>
                            {" "}
                            <PanelLink href="/auth/login">로그인하기 →</PanelLink>
                        </>
                    ) : null}
                </FormError>
            ) : null}

            <FormInput
                name="password"
                type="password"
                label="비밀번호"
                error={Boolean(passwordError)}
                autoComplete="new-password"
            />
            {passwordError ? <FormError>{passwordError}</FormError> : null}

            <FormInput
                name="passwordConfirm"
                type="password"
                label="비밀번호 확인"
                autoComplete="new-password"
            />

            <label
                className="flex items-start gap-2 text-sm mt-2"
                style={{ color: "var(--w-ink)" }}
            >
                <input type="checkbox" name="terms" className="mt-1" />
                <span>
                    이용약관 및 개인정보 처리방침에 동의합니다.
                </span>
            </label>

            <button
                type="submit"
                disabled={submitDisabled}
                className="w-full py-3 rounded-button-pill font-semibold mt-2"
                style={{
                    backgroundColor: submitDisabled
                        ? "color-mix(in srgb, var(--w-ink) 30%, transparent)"
                        : "var(--w-ink)",
                    color: "var(--w-canvas)",
                    cursor: submitDisabled ? "not-allowed" : "pointer",
                }}
            >
                가입하기
            </button>
        </form>
    );
}
