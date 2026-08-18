import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

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
        configPath: "./wrangler.jsonc",
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: (userConfig) => {
          userConfig.name = "a-bags-handmade";
          userConfig.main = "./worker/index.ts";
          userConfig.compatibility_date = "2026-08-19";
          userConfig.compatibility_flags = ["nodejs_compat"];
          userConfig.observability = {
            enabled: true,
            head_sampling_rate: 1,
            traces: { enabled: true },
          };
          userConfig.assets = { binding: "ASSETS" };
          userConfig.images = { binding: "IMAGES" };
          userConfig.d1_databases = [{ binding: "ABAGSDB26081901" }];
          userConfig.r2_buckets = [{ binding: "ABAGSMEDIA26081901" }];
        },
      }),
    ],
  };
});
