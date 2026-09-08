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
      "app/bag-builder-fidelity3d.tsx",
      "app/bag-builder-material-pass.tsx",
      "app/bag-builder-commerce.tsx",
      "app/bag-builder-checkout-handoff.tsx",
    ],
    rules: {
      // These components bridge React with imperative DOM/browser systems. Their
      // effects intentionally reset/synchronize state when the external builder
      // surface or its validated server state changes.
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
