import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// renderer(jsdom) 와 main/db(node) 를 분리 — Vitest 3 projects.
// (environmentMatchGlobs 는 Vitest 3 에서 deprecated)
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: "renderer",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/test-setup.ts"],
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
      {
        test: {
          name: "main",
          environment: "node",
          globals: true,
          include: ["electron/**/*.test.ts"],
        },
      },
    ],
  },
});
