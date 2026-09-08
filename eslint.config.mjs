import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ["app/legal-compliance-enhancer.tsx"],
    rules: {
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
      "app/bag-builder-threejs-bridge.tsx",
    ],
    rules: {
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
