#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec bash "${script_dir}/sites-env.sh" -- bash "$0" "$@"
fi

worker="${SITES_PROJECT_ROOT}/dist/server/index.js"
hosting="${SITES_PROJECT_ROOT}/dist/.openai/hosting.json"

[[ -f "${worker}" ]] || {
  echo "Missing Sites Worker entry: dist/server/index.js" >&2
  exit 66
}
[[ -f "${hosting}" ]] || {
  echo "Missing packaged Sites manifest: dist/.openai/hosting.json" >&2
  exit 66
}

# Validate the generated artifact without importing it in plain Node.js.
# The Vinext/Cloudflare bundle legitimately contains cloudflare:* module imports,
# which Node's default ESM loader cannot resolve outside the Workers runtime.
node --check "${worker}"
node --input-type=module - "${worker}" "${hosting}" <<'NODE'
import { readFile } from "node:fs/promises";

const [workerPath, hostingPath] = process.argv.slice(2);
JSON.parse(await readFile(hostingPath, "utf8"));
const source = await readFile(workerPath, "utf8");

const hasDefaultExport = /export\s*\{[^}]*\bas\s+default\b[^}]*\}/s.test(source) ||
  /export\s+default\b/.test(source);
if (!hasDefaultExport) {
  throw new Error("dist/server/index.js must expose an ESM default export");
}
NODE

echo "Validated Sites artifact: Worker syntax, default export marker, and hosting manifest are present."
