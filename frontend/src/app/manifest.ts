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
        name: "write-note",
        short_name: "write-note",
        description: "컨텍스트가 안 죽는 작가용 작업공간",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0066cc",
        lang: "ko-KR",
        icons: [
            {
                src: "/icon.svg",
                sizes: "any",
                type: "image/svg+xml",
                purpose: "any",
            },
        ],
    };
}
