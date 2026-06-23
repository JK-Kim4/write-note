export function LandingPreview() {
    return (
        <div className="landing-wrap landing-preview">
            <div className="landing-browser">
                <div className="landing-browserbar">
                    <span className="landing-dot" style={{ background: "#e6928a" }} />
                    <span className="landing-dot" style={{ background: "#e6c98a" }} />
                    <span className="landing-dot" style={{ background: "#a7c08a" }} />
                </div>
                <div className="landing-studio">
                    <div className="landing-st-rail">
                        <div className="landing-st-label">목차</div>
                        <div className="landing-chap landing-chap--on">1. 첫 만남</div>
                        <div className="landing-chap">2. 균열</div>
                        <div className="landing-chap">3. 떠나는 날</div>
                    </div>
                    <div className="landing-st-paper">
                        <h4>1. 첫 만남</h4>
                        <div className="landing-ln" style={{ width: "96%" }} />
                        <div className="landing-ln" style={{ width: "88%" }} />
                        <div className="landing-ln" style={{ width: "92%" }} />
                        <div className="landing-ln" style={{ width: "70%" }} />
                        <div className="landing-ln" style={{ width: "90%" }} />
                    </div>
                    <div className="landing-st-side">
                        <div className="landing-st-label">곁쪽지</div>
                        <div className="landing-memo">주인공은 비 오는 날을 싫어함 — 3장 복선</div>
                        <div className="landing-memo">카페 이름 정하기</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
