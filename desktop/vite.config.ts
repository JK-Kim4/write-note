import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";

export default defineConfig({
  // Electron 프로덕션은 file:// 로 dist/index.html 을 로드한다.
  // 절대경로 asset(/assets/..)은 file:// 루트로 깨지므로 상대경로로 빌드한다.
  base: "./",
  plugins: [
    react(),
    electron({
      main: { entry: "electron/main.ts" },
      preload: { input: "electron/preload.ts" },
    }),
  ],
});
