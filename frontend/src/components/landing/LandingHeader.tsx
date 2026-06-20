import Link from "next/link";

export function LandingHeader() {
    return (
        <header className="landing-header">
            <div className="landing-wrap landing-nav">
                <span className="landing-logo" role="img" aria-label="소설비" />
                <div className="landing-nav-right">
                    <Link className="landing-navlink" href="/auth/login">로그인</Link>
                    <Link className="landing-btn landing-btn--primary" href="/auth/signup">무료로 시작하기</Link>
                </div>
            </div>
        </header>
    );
}
