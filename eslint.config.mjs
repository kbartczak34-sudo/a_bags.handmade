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
    files: [
      "app/bag-builder-webgl3d.tsx",
      "app/bag-builder-real3d.tsx",
      "app/bag-builder-pro3d.tsx",
      "app/bag-builder-atelier3d.tsx",
      "app/bag-builder-material-pass.tsx",
    ],
    rules: {
      // 3D/material renderers are imperative browser bridges. Their ready/mount
      // state is synchronized only after the real browser rendering surface exists.
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
