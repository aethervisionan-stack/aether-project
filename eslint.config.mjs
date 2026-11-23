import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Client-mount gates (Framer Motion SSR, wallet adapters, locale) intentionally
      // set state once after hydration; keep those patterns without blocking CI.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "client/**",
    "tools/**",
    "mobile/**",
    "backend/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
