import type { NextConfig } from "next";

/**
 * same-origin 프록시 (005 R-1, contracts/proxy-and-client.md §1).
 *
 * 브라우저는 `localhost:3000/api/*` 만 호출 → same-origin (쿠키 자동 동봉).
 * Next 서버가 backend 로 프록시하며 Set-Cookie 헤더를 그대로 전달.
 */
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
    ];
  },
};

export default nextConfig;
