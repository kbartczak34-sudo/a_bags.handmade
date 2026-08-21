#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec bash "${script_dir}/sites-env.sh" -- bash "$0" "$@"
fi

command -v timeout || {
  echo "install-ci.sh requires GNU timeout." >&2
  exit 69
}

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
install_timeout="${SITES_INSTALL_TIMEOUT:-8m}"
kill_after="${SITES_INSTALL_KILL_AFTER:-15s}"

if [[ -f "${SITES_PROJECT_ROOT}/package-lock.json" ]]; then
  echo "[sites] package-lock.json found; running reproducible npm ci"
  install_args=(ci --no-audit --no-fund)
else
  echo "[sites] package-lock.json not found; running npm install without creating a lockfile"
  install_args=(install --no-audit --no-fund --package-lock=false)
fi

timeout \
  --signal=TERM \
  --kill-after="${kill_after}" \
  "${install_timeout}" \
  npm "${install_args[@]}"

if [[ ! -x "${vinext}" ]]; then
  echo "Dependency installation completed but node_modules/.bin/vinext is unavailable." >&2
  exit 69
fi

echo "[sites] dependency installation passed and vinext is available"
