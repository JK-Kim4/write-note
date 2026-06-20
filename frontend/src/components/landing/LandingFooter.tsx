import Link from "next/link";

export function LandingFooter() {
    return (
        <footer className="landing-footer">
            <div className="landing-wrap">
                <div className="landing-ftop">
                    <div>
                        <span className="landing-fmark" role="img" aria-label="소설비" />
                        <div className="landing-ftag">소설에 기대어 쉬어가는 곳</div>
                    </div>
                    <div className="landing-flinks">
                        <Link href="/auth/login">로그인</Link>
                        <Link href="/privacy">개인정보처리방침</Link>
                    </div>
                </div>
                <p className="landing-notice">
                    아직 베타 테스트 중인 1인 개발 작업실이에요. 불편하거나 바라는 점이 있으면 언제든{" "}
                    <Link className="landing-ask" href="/contact">문의하기</Link>
                </p>
                <div className="landing-fcopy">© 2026 소설비</div>
            </div>
        </footer>
    );
}
