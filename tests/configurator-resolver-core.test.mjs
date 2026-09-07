import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const resolver = fs.readFileSync("lib/configurator-resolver.ts", "utf8");
const route = fs.readFileSync("app/api/configurator/resolve/route.ts", "utf8");
const commerce = fs.readFileSync("app/bag-builder-commerce.tsx", "utf8");

test("configurator resolver wraps the existing validated Bag Builder domain instead of duplicating it", () => {
  assert.match(resolver, /normalizeBagBuilderProjectConfig/);
  assert.match(resolver, /isBagBuilderProjectCompatible/);
  assert.match(resolver, /calculateBagBuilderProjectCents/);
  assert.match(resolver, /bagBuilderProjectCode/);
  assert.doesNotMatch(resolver, /familyBaseCents\s*\[/);
  assert.doesNotMatch(resolver, /stitchCents\s*\[/);
});

test("configuration identity uses canonical SHA-256 and keeps the legacy project code only for continuity", () => {
  assert.match(resolver, /CONFIGURATOR_RESOLVER_VERSION\s*=\s*"compat-v1"/);
  assert.match(resolver, /canonicalize/);
  assert.match(resolver, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(resolver, /configurationHash/);
  assert.match(resolver, /legacyProjectCode/);
  assert.match(resolver, /createConfigurationHash\(configuration: unknown\)/);
});

test("resolver separates production compatibility from price availability", () => {
  assert.match(resolver, /status:\s*"AVAILABLE"\s*\|\s*"DISABLED"\s*\|\s*"UNAVAILABLE"/);
  assert.match(resolver, /status:\s*validation\.valid\s*\?\s*"VALID"\s*:\s*"BLOCKED"/);
  assert.match(resolver, /pricing:\s*resolveConfiguratorPricing/);
  assert.match(resolver, /BUILDER_INCOMPATIBLE/);
});

test("public resolve endpoint accepts the current checkout config envelope and never trusts a client price", () => {
  assert.match(route, /"config" in raw/);
  assert.match(route, /getBagBuilderSettings/);
  assert.match(route, /resolveBagBuilderConfiguration/);
  assert.doesNotMatch(route, /unitAmount|unit_amount|priceCents|grossCents\s*=\s*.*raw/);
});

test("V1 remains the default path while schemaVersion 2 dispatches to the physical resolver", () => {
  assert.match(route, /isProductConfigurationV2Source\(source\)/);
  assert.match(route, /getCraftCalibrationSnapshot/);
  assert.match(route, /resolveProductConfigurationV2\(source, settings, calibration\)/);
  assert.match(route, /return json\(await resolveBagBuilderConfiguration\(source, settings\)\)/);
  assert.match(route, /CALIBRATION_UNAVAILABLE/);
});

test("invalid input is a 400 business boundary while infrastructure failures remain explicit", () => {
  assert.match(route, /ConfiguratorInputError/);
  assert.match(route, /INVALID_JSON/);
  assert.match(route, /SETTINGS_UNAVAILABLE/);
  assert.match(route, /CALIBRATION_UNAVAILABLE/);
  assert.match(route, /RESOLVE_FAILED/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /no-store/);
});

test("live commerce runs resolver in shadow mode without replacing the existing UI decisions", () => {
  assert.match(commerce, /fetch\("\/api\/configurator\/resolve"/);
  assert.match(commerce, /JSON\.stringify\(\{ config \}\)/);
  assert.match(commerce, /resolverParity/);
  assert.match(commerce, /configurationHash/);
  assert.match(commerce, /abags:configurator-resolver-shadow/);
  assert.match(commerce, /resolver parity mismatch/);
  assert.match(commerce, /const price = useMemo/);
  assert.match(commerce, /const localValid = useMemo/);
  assert.match(commerce, /data-builder-live-price=\{price \? String\(price\.total\) : "quote"\}/);
});

test("shadow resolver is debounced, abortable and does not modify configuration controls", () => {
  assert.match(commerce, /window\.setTimeout/);
  assert.match(commerce, /new AbortController\(\)/);
  assert.match(commerce, /controller\.abort\(\)/);
  assert.match(commerce, /180/);
  assert.doesNotMatch(commerce, /resolved[^\n]*\.click\(/);
});
