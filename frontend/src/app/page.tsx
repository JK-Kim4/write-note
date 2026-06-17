import "@/styles/landing.css";
import { LandingAuthRedirect } from "@/components/landing/LandingAuthRedirect";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingPreview } from "@/components/landing/LandingPreview";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingFooter } from "@/components/landing/LandingFooter";

/** 공개 소개 페이지 — 비로그인 진입점. 로그인 사용자는 LandingAuthRedirect 가 홈으로 보낸다. */
export default function LandingPage() {
    return (
        <div className="landing">
            <LandingAuthRedirect />
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
