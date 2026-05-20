"use client";

import { FormInput } from "@/components/ui/FormInput";
import { KakaoButton } from "@/components/auth/KakaoButton";
import { PanelLink } from "@/components/auth/PanelLink";
import { SubmitLoading } from "@/components/ui/SubmitLoading";
import { useAuthPlaceholder } from "@/stores/authPlaceholder";

/**
 * LoginForm — 로그인 폼 (login / login-error / login-loading 공용).
 *
 * Spec reference: contracts/route-surfaces.md §1 (login 행) + DESIGN.md §핵심 인증 UX 결정 §3
 * 본 spec 단계는 정적 외관만. 실제 submit / 검증은 Week 1B 영역.
 */

interface LoginFormProps {
    state?: "default" | "loading";
}

export function LoginForm({ state = "default" }: LoginFormProps) {
    const dim = state === "loading";
    const setUserId = useAuthPlaceholder((s) => s.setUserId);
    const isDev = process.env.NODE_ENV !== "production";
    return (
        <form
            className="flex flex-col gap-4"
            style={{ opacity: dim ? 0.6 : 1, pointerEvents: dim ? "none" : "auto" }}
            onSubmit={(e) => e.preventDefault()}
        >
            {isDev ? (
                /* 임시 — Week 1B-1~2 진입 시 폐기. JWT cookie 기반 세션으로 swap.
                 * dogfooding 시점에 placeholder userId 박아 메인 surface 진입 가능하게.
                 */
                <button
                    type="button"
                    onClick={() => setUserId(`dev-user-${Date.now()}`)}
                    className="w-full py-2 rounded-button-utility text-sm font-semibold"
                    style={{
                        backgroundColor: "color-mix(in srgb, var(--w-accent) 8%, transparent)",
                        color: "var(--w-accent)",
                        border: "1px dashed var(--w-accent)",
                    }}
                >
                    [DEV] 임시 사용자로 진입 →
                </button>
            ) : null}
            <FormInput
                name="email"
                type="email"
                label="이메일"
                placeholder="you@example.com"
                autoComplete="email"
            />
            <FormInput
                name="password"
                type="password"
                label="비밀번호"
                autoComplete="current-password"
            />
            {state === "loading" ? (
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
