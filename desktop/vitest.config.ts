import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// 렌더러(React) 컴포넌트 단위 테스트용. vite-plugin-electron 은 포함하지 않는다
// (테스트 시 Electron 을 기동하지 않기 위함).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
