import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ["app/legal-compliance-enhancer.tsx"],
    rules: {
      // This mount effect intentionally synchronizes React state from browser
      // persistence (cookie/localStorage). Keep the exception local to this bridge.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["app/personalization-entry.tsx"],
    rules: {
      // Asset readiness is reset when the selected product changes, then completed
      // asynchronously by the product-specific customizer manifest request.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "dist/**",
    "out/**",
    "build/**",
    ".sites-runtime/**",
    "next-env.d.ts",
  ]),
]);
