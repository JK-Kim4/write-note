import type { Metadata } from "next";
import { PrivacyContent } from "@/content/legal/PrivacyContent";

export const metadata: Metadata = {
    title: "개인정보처리방침 | 소설비",
};

/**
 * 개인정보처리방침 — 카카오 로그인 동의항목(이메일·닉네임 필수) 심사 제출용 공개 URL.
 * https://soseolbi.com/privacy. 본문은 src/content/legal/PrivacyContent 공유.
 */
export default function PrivacyPage() {
    return (
        <main
            style={{
                maxWidth: 720,
                margin: "0 auto",
                padding: "48px 24px 80px",
                fontFamily: "var(--font-noto-serif-kr, 'Apple SD Gothic Neo', sans-serif)",
                lineHeight: 1.8,
                color: "var(--w-ink, #1a1a1a)",
            }}
        >
            <PrivacyContent />
        </main>
    );
}
