import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// EditContext API PoC 전용 — 브라우저에서 한글 IME 실측.
export default defineConfig({
  root: "src/poc/editcontext",
  plugins: [react()],
  server: { port: 5236, open: false },
});
