"use client";

import { FormInput } from "@/components/ui/FormInput";

/**
 * ResetNewForm — 비밀번호 재설정 step 3 (새 비밀번호 입력).
 *
 * Spec reference: contracts/route-surfaces.md §1 (reset-new)
 */
export function ResetNewForm() {
    return (
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <h2
                className="font-display font-semibold"
                style={{ fontSize: "20px", color: "var(--w-ink)" }}
            >
                새 비밀번호 설정
            </h2>
            <FormInput
                name="password"
                type="password"
                label="새 비밀번호"
                autoComplete="new-password"
            />
            <FormInput
                name="passwordConfirm"
                type="password"
                label="새 비밀번호 확인"
                autoComplete="new-password"
            />
            <button
                type="submit"
                className="w-full py-3 rounded-button-pill font-semibold"
                style={{ backgroundColor: "var(--w-ink)", color: "var(--w-canvas)" }}
            >
                비밀번호 변경
            </button>
        </form>
    );
}
