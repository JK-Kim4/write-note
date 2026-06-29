import type { MetadataRoute } from "next";

/**
 * Next.js 16 file convention — App Router 가 `<link rel="manifest" href="/manifest.webmanifest">` 자동 부착.
 * 출처: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md
 *
 * PoC 0-3 본질 = iOS Safari + Android Chrome "홈 화면 추가" 메뉴 노출 검증.
 * 색상 토큰은 DESIGN.md L207-211 디자인 시스템 정합 (Action Blue #0066cc / canvas #ffffff).
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "소설비",
        short_name: "소설비",
        description: "흩어진 아이디어를 한 편의 작품으로 — 작가를 위한 창작 작업실",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0066cc",
        lang: "ko-KR",
        icons: [
            {
                src: "/icon.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any",
            },
        ],
    };
}
