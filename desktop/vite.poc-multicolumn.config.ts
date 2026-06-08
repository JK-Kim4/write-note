import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// PoC 0-4 / 안 1 — CSS multi-column 기반 TipTap.
// Electron 없이 브라우저에서 바로 띄운다(실키보드 한글 IME 검증용). 실제 앱 빌드와 완전 분리.
export default defineConfig({
  root: "src/poc/multicolumn",
  plugins: [react()],
  server: { port: 5238, open: false },
});
