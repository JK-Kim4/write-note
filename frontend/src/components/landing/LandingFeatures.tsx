const FEATURES = [
    {
        icon: "🗺️",
        title: "구상을 한눈에 — 플롯 보드",
        body: "인물·사건·복선을 카드로 펼쳐 선으로 잇습니다. 머릿속에만 있던 이야기 구조를 캔버스 위에 설계하세요.",
    },
    {
        icon: "✍️",
        title: "종이처럼 쓰는 집필실",
        body: "쓰는 순간부터 한 권의 책처럼. 실제 출판 판형으로 페이지가 넘어가고, 초고가 그대로 내 책이 됩니다.",
    },
    {
        icon: "📤",
        title: "보여주고, 피드백 받고, 내보내기",
        body: "공유 링크로 초고를 보여주고 문장 단위 피드백을 받습니다. 작품을 시리즈로 묶어 PDF·한글(HWPX)·워드(DOCX)로 내보내고요.",
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
