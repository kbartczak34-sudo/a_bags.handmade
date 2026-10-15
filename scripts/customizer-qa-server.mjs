import { spawn } from "node:child_process";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { createRequire } from "node:module";

// The locked local workerd predates the production compatibility date. Use an
// ephemeral QA config rather than changing the Worker that will be deployed.
const require = createRequire(import.meta.url);
const compatibilityDate = require("workerd").compatibilityDate;
const configPath = ".abags-qa-vite.config.ts";
const source = await readFile("vite.config.ts", "utf8");
const dateAssignment = /userConfig\.compatibility_date = "[\d-]+";/;
if (!dateAssignment.test(source)) throw new Error("Could not select the local QA compatibility date.");
const config = source.replace(dateAssignment,
  `userConfig.compatibility_date = ${JSON.stringify(compatibilityDate)};`);
await writeFile(configPath, config, { flag: "wx" });
console.log(`Customizer QA uses local workerd compatibility ${compatibilityDate}; production config is unchanged.`);
try {
  const child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--config", configPath,
    "--host", "127.0.0.1", "--port", "5173", "--strictPort"], {
    stdio: "inherit",
    env: { ...process.env, ABAGS_SKIP_REMOTE_RESOURCE_DISCOVERY: "1" },
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; resolve(); });
  });
} finally {
  await unlink(configPath);
}
