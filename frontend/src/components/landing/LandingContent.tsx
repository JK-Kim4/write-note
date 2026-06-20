import "@/styles/landing.css";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingPreview } from "@/components/landing/LandingPreview";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingFooter } from "@/components/landing/LandingFooter";

/**
 * 공개 소개 페이지 마크업. 비로그인·로그인 모두에게 노출(로그인 사용자도 `/welcome` 직접 접속 가능).
 * `isAuthenticated` 일 때 가입/로그인 CTA 대신 "내 작업실로"(`/`) 진입 버튼을 보인다.
 */
export function LandingContent({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
    return (
        <div className="landing">
            <LandingHeader isAuthenticated={isAuthenticated} />
            <main>
                <LandingHero isAuthenticated={isAuthenticated} />
                <LandingPreview />
                <LandingFeatures />
            </main>
            <LandingFooter isAuthenticated={isAuthenticated} />
        </div>
    );
}
