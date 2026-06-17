const FEATURES = [
    {
        icon: "🪶",
        title: "맥락이 죽지 않아요",
        body: "세션이 끊겨도 메모·등장인물·마지막 한 줄·다음 장면이 그대로. 다시 열면 어디서 멈췄는지 한눈에 보입니다.",
    },
    {
        icon: "🗂️",
        title: "메모와 집필이 한곳에",
        body: "곁쪽지(메모)와 집필 에디터가 같은 시스템에. 떠오른 설정·복선을 잃지 않고 집필 중 바로 곁에 둡니다.",
    },
    {
        icon: "📤",
        title: "챕터로 쓰고 내보내기",
        body: "작품을 챕터 단위로 구성·정렬하고, PDF·한글(HWPX)·워드(DOCX)로 골라 묶어 내보냅니다.",
    },
] as const;

export function LandingFeatures() {
    return (
        <section className="landing-wrap landing-features">
            <div className="landing-fgrid">
                {FEATURES.map((feature) => (
                    <div key={feature.title} className="landing-fcard">
                        <div className="landing-ficon" aria-hidden="true">{feature.icon}</div>
                        <h3>{feature.title}</h3>
                        <p>{feature.body}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
