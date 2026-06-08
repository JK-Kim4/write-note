"use client";

/**
 * KakaoButton — Kakao OAuth2 진입 CTA (US6, contracts/screen-data-flow.md §5).
 *
 * 클릭 시 `/api/auth/oauth/kakao` 로 브라우저 전체 네비게이션(same-origin 프록시 → backend OAuth).
 * 콜백 성공 시 backend(OAuth2SuccessHandler)가 쿠키 발급 + 홈(`/`) redirect.
 */

interface KakaoButtonProps {
    label?: string;
    disabled?: boolean;
}

const KAKAO_YELLOW = "#fee500";
const KAKAO_INK = "#191600";

export function KakaoButton({ label = "Kakao 로 시작하기", disabled = false }: KakaoButtonProps) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => {
                window.location.href = "/api/auth/oauth/kakao";
            }}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-button-pill font-semibold"
            style={{
                backgroundColor: KAKAO_YELLOW,
                color: KAKAO_INK,
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
            }}
        >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={KAKAO_INK} aria-hidden="true">
                <path d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.92 5.34 4.78 6.74L5.5 22l4.9-3.07c.52.06 1.06.07 1.6.07 5.52 0 10-3.58 10-8s-4.48-8-10-8z" />
            </svg>
            {label}
        </button>
    );
}
