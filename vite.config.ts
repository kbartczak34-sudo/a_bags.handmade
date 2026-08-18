import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const cloudflareConfig = {
  name: "a-bags-handmade",
  main: "./worker/index.ts",
  compatibility_date: "2026-08-19",
  compatibility_flags: ["nodejs_compat"],
  observability: {
    enabled: true,
    head_sampling_rate: 1,
    traces: {
      enabled: true,
    },
  },
  assets: {
    binding: "ASSETS",
  },
  images: {
    binding: "IMAGES",
  },
  // Use unique internal binding names so automatic provisioning does not
  // collide with stale resources left by previous failed deploy attempts.
  d1_databases: d1 ? [{ binding: "STOREDB" }] : [],
  r2_buckets: r2 ? [{ binding: "STOREMEDIA" }] : [],
};

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: cloudflareConfig,
      }),
    ],
  };
});
