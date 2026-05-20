import Link from "next/link";
import { KakaoButton } from "@/components/auth/KakaoButton";
import { PanelLink } from "@/components/auth/PanelLink";

/**
 * SignupMethodPicker — 회원가입 step 1 (메서드 선택).
 *
 * Spec reference: contracts/route-surfaces.md §1 (signup 행)
 * Source: DESIGN.md §핵심 인증 UX 결정 §2 — Entry → Wizard (Notion·Linear·ChatGPT 패턴).
 *   Kakao 가입자가 다수 가정. 이메일 가입은 보조.
 */

export function SignupMethodPicker() {
    return (
        <div className="flex flex-col gap-4">
            <h2
                className="font-display font-semibold"
                style={{ fontSize: "20px", color: "var(--w-ink)" }}
            >
                회원가입 방법 선택
            </h2>
            <p style={{ color: "var(--w-ink)", opacity: 0.7, fontSize: "14px" }}>
                한 가지 방법을 선택해 시작하세요.
            </p>
            <KakaoButton label="Kakao 로 가입하기" />
            <Link
                href="/auth/signup-email"
                className="w-full py-3 rounded-button-pill font-semibold text-center"
                style={{
                    backgroundColor: "transparent",
                    color: "var(--w-ink)",
                    border: "1px solid var(--w-hairline)",
                }}
            >
                이메일로 가입하기
            </Link>
            <div className="text-center mt-4">
                <PanelLink href="/auth/login" variant="muted">
                    이미 계정이 있어요 — 로그인
                </PanelLink>
            </div>
        </div>
    );
}
