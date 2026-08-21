#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "A-Bags deploy pipeline: verified-source-v3"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec bash "${script_dir}/sites-env.sh" -- bash "$0" "$@"
fi

command -v timeout || {
  echo "build-verified.sh requires GNU timeout." >&2
  exit 69
}

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci before building." >&2
  exit 69
fi

# Preserve the existing product/catalog migration behavior for normal builds.
# Non-product CI opts out explicitly so this hardening branch does not evaluate
# or mutate product behavior while testing unrelated production readiness work.
if [[ "${SITES_SKIP_PRODUCT_PATCHES:-0}" != "1" ]]; then
  node "${script_dir}/remove-free-shipping.mjs"
  node "${script_dir}/patch-admin-mobile-upload.mjs"
else
  echo "Skipping product/catalog source patches for non-product CI."
fi

echo "Running bounded vinext build..."
timeout \
  --signal=TERM \
  --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
  "${SITES_BUILD_TIMEOUT:-3m}" \
  "${vinext}" build
