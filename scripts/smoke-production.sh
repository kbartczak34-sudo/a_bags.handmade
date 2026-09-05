#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${ABAGS_PRODUCTION_URL:-https://abagshandmade.pl}"
BASE_URL="${BASE_URL%/}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

CURL_COMMON=(
  --silent
  --show-error
  --retry 5
  --retry-all-errors
  --retry-delay 4
  --connect-timeout 10
  --max-time 30
)

fail() {
  echo "SMOKE FAIL: $*" >&2
  exit 1
}

request_follow() {
  local path="$1"
  local name="$2"
  curl "${CURL_COMMON[@]}" --location \
    --dump-header "$TMP_DIR/${name}.headers" \
    --output "$TMP_DIR/${name}.body" \
    --write-out '%{http_code}' \
    "$BASE_URL$path"
}

request_no_follow() {
  local path="$1"
  local name="$2"
  curl "${CURL_COMMON[@]}" \
    --dump-header "$TMP_DIR/${name}.headers" \
    --output "$TMP_DIR/${name}.body" \
    --write-out '%{http_code}' \
    "$BASE_URL$path"
}

assert_200() {
  local path="$1"
  local name="$2"
  local code
  code="$(request_follow "$path" "$name")"
  [[ "$code" == "200" ]] || fail "$path returned HTTP $code"
}

assert_protected() {
  local path="$1"
  local name="$2"
  local code
  code="$(request_no_follow "$path" "$name")"
  case "$code" in
    302|303|307|308|401|403) ;;
    *) fail "$path returned unexpected anonymous HTTP $code" ;;
  esac
  echo "$code"
}

assert_200 "/" "home"
grep -Fq "a_bags.handmade" "$TMP_DIR/home.body" || fail "home page does not contain the A-Bags brand"
grep -Eqi '^cache-control:.*no-store' "$TMP_DIR/home.headers" || fail "HTML is missing Cache-Control: no-store"
grep -Eqi '^vary:.*cookie' "$TMP_DIR/home.headers" || fail "HTML is missing Vary: Cookie"
grep -Eqi '^content-security-policy:' "$TMP_DIR/home.headers" || fail "HTML is missing Content-Security-Policy"
grep -Eqi '^strict-transport-security:' "$TMP_DIR/home.headers" || fail "HTML is missing HSTS"
grep -Eqi '^x-content-type-options:[[:space:]]*nosniff' "$TMP_DIR/home.headers" || fail "HTML is missing X-Content-Type-Options: nosniff"

assert_200 "/robots.txt" "robots"
grep -Fq "Disallow: /panel" "$TMP_DIR/robots.body" || fail "robots.txt does not exclude owner panel"
grep -Fq "Sitemap: https://abagshandmade.pl/sitemap.xml" "$TMP_DIR/robots.body" || fail "robots.txt does not expose the production sitemap"

assert_200 "/sitemap.xml" "sitemap"
grep -Fq "<loc>https://abagshandmade.pl/</loc>" "$TMP_DIR/sitemap.body" || fail "sitemap.xml does not contain the canonical storefront"
grep -Fq "<loc>https://abagshandmade.pl/zwroty-i-reklamacje/zgloszenie</loc>" "$TMP_DIR/sitemap.body" || fail "sitemap.xml does not contain the customer-case form"

assert_200 "/manifest.webmanifest" "manifest"
grep -Eq '"display"[[:space:]]*:[[:space:]]*"standalone"' "$TMP_DIR/manifest.body" || fail "PWA manifest is not standalone"
grep -Eq '"scope"[[:space:]]*:[[:space:]]*"/"' "$TMP_DIR/manifest.body" || fail "PWA manifest has an unexpected scope"

assert_200 "/api/products" "products"
grep -Eq '"products"[[:space:]]*:' "$TMP_DIR/products.body" || fail "product API response is malformed"

assert_200 "/api/site-content" "site-content"
grep -Fq "Ręcznie szydełkowane" "$TMP_DIR/site-content.body" || fail "storefront does not expose crochet-accurate hero terminology"
if grep -Fq "Ręcznie plecione" "$TMP_DIR/site-content.body"; then
  fail "legacy woven hero terminology is still exposed"
fi
if grep -Fq "ręcznie pleciona" "$TMP_DIR/site-content.body"; then
  fail "legacy woven image terminology is still exposed"
fi
if grep -Fq "ręcznie plecione" "$TMP_DIR/site-content.body"; then
  fail "legacy woven collection terminology is still exposed"
fi

assert_200 "/api/legal-status" "legal"
grep -Eq '"launchReady"[[:space:]]*:' "$TMP_DIR/legal.body" || fail "legal-status API response is malformed"

assert_200 "/zwroty-i-reklamacje/zgloszenie" "customer-case-form"
grep -Fq "Zgłoś zwrot lub reklamację" "$TMP_DIR/customer-case-form.body" || fail "customer-case form page is malformed"

admin_code="$(assert_protected "/api/admin/status" "admin")"
cases_admin_code="$(assert_protected "/api/admin/customer-cases" "admin-cases")"

# A successful HTTP storefront is not enough: every customer-facing builder decision
# must produce a distinct verified WebGL frame in the deployed production build.
ABAGS_PRODUCTION_URL="$BASE_URL" node scripts/smoke-customizer-all-options.mjs

echo "SMOKE PASS: $BASE_URL"
echo "- storefront: 200"
echo "- security/cache headers: present"
echo "- robots/sitemap/manifest: valid"
echo "- products/legal APIs: 200"
echo "- crochet-accurate storefront terminology: present"
echo "- returns/complaints form: 200"
echo "- admin status API: protected (HTTP $admin_code)"
echo "- admin customer-cases API: protected (HTTP $cases_admin_code)"
echo "- all eight Bag Builder decisions visibly redraw verified WebGL: yes"
