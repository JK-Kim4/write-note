import type { NextConfig } from "next";

/**
 * same-origin 프록시 (005 R-1, contracts/proxy-and-client.md §1).
 *
 * 브라우저는 `localhost:3000/api/*` 만 호출 → same-origin (쿠키 자동 동봉).
 * Next 서버가 backend 로 프록시하며 Set-Cookie 헤더를 그대로 전달.
 */
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:8080";

/**
 * 보안 응답 헤더 (심층방어).
 *
 * CSP 는 script-src/default-src 를 의도적으로 두지 않는다 — layout.tsx 의 인라인 테마
 * 초기화 스크립트와 Next.js 런타임 인라인 스크립트를 깨지 않기 위함. 대신 스크립트 실행을
 * 게이트하지 않는 지시자(frame-ancestors / object-src / base-uri / form-action)만 박아
 * 클릭재킹·base 변조·폼 탈취를 막는다. 엄격한 nonce 기반 script-src 는 후속 과제.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // 구 도메인 harubuild.xyz → soseolbi.com 영구 redirect (경로 보존). soseolbi 는 host 미매칭이라 통과.
  async redirects() {
    return [
      // 037: 기존 설정 화면 → 마이페이지 환경설정 흡수(끊긴 링크 방지). permanent:false(추후 IA 재변경 여지).
      {
        source: "/settings",
        destination: "/mypage/settings",
        permanent: false,
      },
      // 044 보드 중심 전환: 메모·인물 페이지 폐기 → 보드로(끊긴 링크·북마크 방지). permanent:false(가져오기 후속 여지).
      { source: "/memos", destination: "/boards", permanent: false },
      { source: "/characters", destination: "/boards", permanent: false },
      {
        source: "/:path*",
        has: [{ type: "host", value: "harubuild.xyz" }],
        destination: "https://soseolbi.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.harubuild.xyz" }],
        destination: "https://soseolbi.com/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
