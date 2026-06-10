import type { Metadata } from "next";
import { Noto_Serif_KR, Nanum_Myeongjo } from "next/font/google";
import "./globals.css";
import "@/styles/desktop-app.css";
import { SWRegister } from "./sw-register";
import { Providers } from "./providers";

/*
 * 본 spec (002-frontend-route-scaffold) Phase 2 T024 산출.
 *
 * 폰트 결정 (research.md §"폰트 로딩"):
 * - Noto Serif KR — 본문 프로즈 (DESIGN.md §디자인 시스템 / 타이포그래피)
 * - Nanum Myeongjo — 원고지
 * - SF Pro Display / SF Pro Text — 시스템 fallback chain (tokens.css 에서 처리)
 *
 * Theme FOUC 회피: <script> blocking inline — localStorage 즉시 읽어 :root.dark 적용.
 * Providers wrapper (client component) 가 React Query + useThemeEffect 담당.
 */
const notoSerifKR = Noto_Serif_KR({
    variable: "--font-noto-serif-kr",
    subsets: ["latin"],
    weight: ["300", "400", "600", "700"],
    display: "swap",
});

const nanumMyeongjo = Nanum_Myeongjo({
    variable: "--font-nanum-myeongjo",
    subsets: ["latin"],
    weight: ["400", "700"],
    display: "swap",
});

export const metadata: Metadata = {
    title: "나래 노트",
    description: "컨텍스트가 안 죽는 작가용 작업공간",
};

const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('writenote.preferences.v1');var t='system';if(s){var p=JSON.parse(s);if(p&&p.state&&p.state.theme){t=p.state.theme;}}var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="ko"
            className={`${notoSerifKR.variable} ${nanumMyeongjo.variable} h-full antialiased`}
            suppressHydrationWarning
        >
            <head>
                <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
            </head>
            <body className="min-h-full flex flex-col">
                <Providers>
                    <SWRegister />
                    {children}
                </Providers>
            </body>
        </html>
    );
}
