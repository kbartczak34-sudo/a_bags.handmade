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
    files: ["app/bag-builder-webgl3d.tsx"],
    rules: {
      // WebGL context creation is an imperative browser bridge. The ready flag is
      // set only after a real context/program exists so the SVG fallback remains
      // visible on devices without WebGL.
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
