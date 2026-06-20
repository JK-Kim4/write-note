import Link from "next/link";

export function LandingHero({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
    return (
        <section className="landing-wrap landing-hero">
            <span className="landing-eyebrow">작가를 위한 집필 작업실</span>
            <h1>
                쉬었다 와도,
                <br />
                <span className="lp-accent">이야기는 그 자리에.</span>
            </h1>
            <p className="landing-sub">
                메모도, 등장인물도, 마지막으로 쓴 한 줄도 한자리에. 며칠 만에 다시 열어도 작품의 맥락이 그대로 남습니다.
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
