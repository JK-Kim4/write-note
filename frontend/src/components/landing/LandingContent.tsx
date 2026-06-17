import "@/styles/landing.css";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingPreview } from "@/components/landing/LandingPreview";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingFooter } from "@/components/landing/LandingFooter";

/** 공개 소개 페이지 마크업 — 비로그인 방문자에게 보이는 정적 랜딩. 인증 분기는 app/page.tsx 가 담당. */
export function LandingContent() {
    return (
        <div className="landing">
            <LandingHeader />
            <main>
                <LandingHero />
                <LandingPreview />
                <LandingFeatures />
            </main>
            <LandingFooter />
        </div>
    );
}
