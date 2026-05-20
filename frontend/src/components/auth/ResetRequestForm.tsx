"use client";

import { FormInput } from "@/components/ui/FormInput";
import { PanelLink } from "@/components/auth/PanelLink";

/**
 * ResetRequestForm — 비밀번호 재설정 step 1 (이메일 입력).
 *
 * Spec reference: contracts/route-surfaces.md §1 (reset-request)
 */
export function ResetRequestForm() {
    return (
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <h2
                className="font-display font-semibold"
                style={{ fontSize: "20px", color: "var(--w-ink)" }}
            >
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
            />
            <button
                type="submit"
                className="w-full py-3 rounded-button-pill font-semibold"
                style={{ backgroundColor: "var(--w-ink)", color: "var(--w-canvas)" }}
            >
                재설정 메일 받기
            </button>
            <div className="text-center mt-2">
                <PanelLink href="/auth/login" variant="muted">
                    로그인으로 돌아가기
                </PanelLink>
            </div>
        </form>
    );
}
