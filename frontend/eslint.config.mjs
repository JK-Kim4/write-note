import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // react-hooks 신규 룰(eslint-config-next 가 error 로 켬)을 warn 으로 완화. 위반 대부분이 의도적·안전한
    // ref 동기화(이벤트 핸들러가 최신 state/props 를 참조하도록 렌더 중 ref.current 갱신) / mount 감지
    // 패턴이라 error 는 과하다 — effect 로 옮기면 오히려 타이밍 stale 위험. 경고로 인지는 유지(미래 진짜
    // 오용 시 warn 표시). exhaustive-deps 는 error 유지(실제 deps 누락 버그 방지 — 022 챕터 OOM 류).
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
