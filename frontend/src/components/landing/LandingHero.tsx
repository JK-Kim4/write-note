import Link from "next/link";

export function LandingHero({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
    return (
        <section className="landing-wrap landing-hero">
            <span className="landing-eyebrow">작가를 위한 창작 작업실</span>
            <h1>
                흩어진 아이디어가,
                <br />
                <span className="lp-accent">한 편의 작품이 되기까지.</span>
            </h1>
            <p className="landing-sub">
                아이디어를 모으고, 플롯을 세우고, 초고를 쓰고, 다듬어 내보내기까지. 한 작품을 완성하는 모든 과정을 한 작업실에서 잇습니다.
            </p>
            <div className="landing-cta">
                {isAuthenticated ? (
                    <Link className="landing-btn landing-btn--primary landing-btn--lg" href="/">내 작업실로</Link>
                ) : (
                    <>
                        <Link className="landing-btn landing-btn--primary landing-btn--lg" href="/auth/signup">무료로 시작하기</Link>
                        <Link className="landing-btn landing-btn--ghost landing-btn--lg" href="/auth/login">로그인</Link>
                    </>
                )}
            </div>
        </section>
    );
}
