import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// PoC 전용 — Electron 플러그인 없이 브라우저에서 바로 띄운다(실키보드 IME 검증용).
// 실제 앱 빌드(vite.config.ts)와 완전 분리. 루트는 PoC 디렉토리.
export default defineConfig({
  root: "src/poc/pagination",
  plugins: [react()],
  server: { port: 5234, open: false },
});
