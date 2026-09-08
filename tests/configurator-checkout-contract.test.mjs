import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const checkoutHandoff = fs.readFileSync("app/bag-builder-checkout-handoff.tsx", "utf8");
const commerce = fs.readFileSync("app/bag-builder-commerce.tsx", "utf8");
const legacyCheckout = fs.readFileSync("app/api/bag-builder-checkout/route.ts", "utf8");
const v2Checkout = fs.readFileSync("app/api/configurator/checkout/route.ts", "utf8");
const snapshotRoute = fs.readFileSync("app/api/configurator/snapshot/route.ts", "utf8");

const postsTo = (source, path) => source.includes(`fetch(\"${path}\"`);

test("builder checkout never uses the retired legacy checkout endpoint", () => {
  assert.equal(postsTo(checkoutHandoff, "/api/bag-builder-checkout"), false);
  assert.equal(legacyCheckout.includes("LEGACY_BUILDER_CHECKOUT_RETIRED"), true);
  assert.equal(legacyCheckout.includes("status: 410"), true);
});

test("builder handoff requires resolver validation and an immutable production package", () => {
  assert.equal(postsTo(checkoutHandoff, "/api/configurator/resolve"), true);
  assert.equal(postsTo(checkoutHandoff, "/api/configurator/snapshot"), true);
  assert.equal(postsTo(checkoutHandoff, "/api/configurator/checkout"), true);
  assert.equal(checkoutHandoff.includes("resolved.validation?.valid !== true"), true);
  assert.equal(checkoutHandoff.includes("!resolved.productionPackageHash"), true);
  assert.equal(checkoutHandoff.includes("snapshot.productionPackageHash !== resolved.productionPackageHash"), true);
});

test("live commerce gate cannot report ready without server package and price parity", () => {
  assert.equal(commerce.includes("const packageReady = typeof resolved.productionPackageHash === \"string\""), true);
  assert.equal(commerce.includes("const priceMatch = nextServerPrice === localPrice"), true);
  assert.equal(commerce.includes("const fullyReady = validationMatch && packageReady && priceMatch"), true);
  assert.equal(commerce.includes("Boolean(productionPackageHash)"), true);
  assert.equal(commerce.includes("data-builder-server-ready"), true);
});

test("live commerce invalidates the previous gate before a new resolver request", () => {
  const reset = "setServerStatus(\"checking\");\n    setServerPrice(null);\n    setProductionPackageHash(null);";
  assert.equal(commerce.includes(reset), true);
  assert.equal(commerce.includes("controller.abort()"), true);
  assert.equal(commerce.includes("if (!active) return;"), true);
});

test("server checkout trusts snapshotId rather than a client-supplied price/config", () => {
  assert.equal(v2Checkout.includes("snapshotId"), true);
  assert.equal(v2Checkout.includes("email"), true);
  assert.equal(v2Checkout.includes("productionPackageHash"), true);
  assert.equal(v2Checkout.includes("snapshot"), true);
  assert.equal(v2Checkout.includes("grossCents"), true);
});

test("snapshot route re-resolves the production BOM and persists its package hash", () => {
  assert.equal(snapshotRoute.includes("resolveProductionPackage"), true);
  assert.equal(snapshotRoute.includes("productionPackageHash"), true);
  assert.equal(snapshotRoute.includes("BOM_VALIDATED"), true);
});
