/**
 * BrandLoader — 소설비 브랜드 로딩 효과(로고 마크 펄스 + 점 3개).
 *
 * 서비스 공용 로더. `/entering`(로그인 중 트랜지션)에서 처음 도입(C안), 이후 풀스크린 오버레이·인라인
 * 영역 어디든 재사용한다. 디자인 = 목업 `docs/research/2026-06-29-login-transition-mockup.html`(사용자 승인).
 *
 * - `fullscreen`: 화면 전체를 양피지 배경으로 덮는 오버레이(인증 확인·라우트 전환 등). 기본은 인라인(영역 채움).
 * - `label`: 보이는 문구 + 스크린리더 라벨. 없으면 로고+점만 보이고 기본 aria-label("로딩 중")로 상태를 알린다.
 *
 * 시각 효과(펄스·점·페이드)는 단위테스트로 보장하지 않는다(dogfooding 영역). prop 분기·접근성만 테스트로 잠근다.
 */

interface BrandLoaderProps {
    fullscreen?: boolean;
    label?: string;
}

export function BrandLoader({ fullscreen = false, label }: BrandLoaderProps) {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={label ?? "로딩 중"}
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                ...(fullscreen
                    ? {
                          position: "fixed",
                          inset: 0,
                          backgroundColor: "var(--w-parchment)",
                          zIndex: 50,
                      }
                    : { padding: "32px", width: "100%" }),
            }}
        >
            <span className="brandloader-mark" aria-hidden="true" />
            <span className="brandloader-dots" aria-hidden="true">
                <i />
                <i />
                <i />
            </span>
            {label ? (
                <span
                    data-testid="brandloader-label"
                    style={{ fontSize: "14px", color: "var(--w-muted)" }}
                >
                    {label}
                </span>
            ) : null}
            <style>{`
                .brandloader-mark {
                    width: 72px;
                    height: 72px;
                    background: url('/soseolbi-mark.png') center / contain no-repeat;
                    animation: brandLoaderPulse 1s ease-in-out infinite;
                }
                .brandloader-dots {
                    display: flex;
                    gap: 6px;
                }
                .brandloader-dots i {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: var(--w-accent);
                    opacity: 0.4;
                    animation: brandLoaderDot 1s infinite;
                }
                .brandloader-dots i:nth-child(2) { animation-delay: 0.15s; }
                .brandloader-dots i:nth-child(3) { animation-delay: 0.3s; }
                @keyframes brandLoaderPulse {
                    0%, 100% { transform: scale(1); opacity: 0.55; }
                    50% { transform: scale(1.08); opacity: 1; }
                }
                @keyframes brandLoaderDot {
                    0%, 100% { opacity: 0.35; transform: translateY(0); }
                    50% { opacity: 1; transform: translateY(-3px); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .brandloader-mark, .brandloader-dots i { animation: none; }
                }
            `}</style>
        </div>
    );
}
