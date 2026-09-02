import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const store = fs.readFileSync("lib/customizer-assets.ts", "utf8");
const publicManifest = fs.readFileSync("app/api/customizer-assets/route.ts", "utf8");
const publicImage = fs.readFileSync("app/api/customizer-image/route.ts", "utf8");
const dynamicLayer = fs.readFileSync("app/images/configurator/[productId]/[category]/[variant]/route.ts", "utf8");
const adminApi = fs.readFileSync("app/api/admin/customizer-assets/route.ts", "utf8");
const manager = fs.readFileSync("app/panel/customizer-assets-manager.tsx", "utf8");
const panel = fs.readFileSync("app/panel/admin-panel.tsx", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const adminStyles = fs.readFileSync("app/customizer-admin.css", "utf8");

test("customizer assets are stored per product, category and variant", () => {
  assert.match(store, /CREATE TABLE IF NOT EXISTS customizer_assets/);
  assert.match(store, /UNIQUE\(product_id, category, variant\)/);
  assert.match(store, /color.*stitch.*handles.*hardware.*strap.*accent/s);
  assert.match(store, /getProductBucket/);
});

test("customizer product lookup tolerates normalized route casing", () => {
  assert.match(store, /product_id = \? COLLATE NOCASE/);
});

test("public customizer endpoints expose manifests and immutable images", () => {
  assert.match(publicManifest, /listCustomizerAssets/);
  assert.match(publicImage, /getCustomizerAssetRecord/);
  assert.match(publicImage, /max-age=31536000, immutable/);
  assert.match(dynamicLayer, /png\|webp/);
  assert.match(dynamicLayer, /getCustomizerBucket/);
});

test("owner API validates transparent layer formats and requires admin access", () => {
  assert.match(adminApi, /isAdminRequest/);
  assert.match(adminApi, /image\/png/);
  assert.match(adminApi, /image\/webp/);
  assert.doesNotMatch(adminApi, /image\/jpeg/);
  assert.match(adminApi, /MAX_IMAGE_BYTES/);
});

test("owner panel contains a styled personalization asset manager", () => {
  assert.match(panel, /CustomizerAssetsManager/);
  assert.match(panel, /Personalizacja/);
  assert.match(manager, /Warstwy personalizacji/);
  assert.match(manager, /Dodaj \/ zastąp warstwę/);
  assert.match(manager, /api\/admin\/customizer-assets/);
  assert.match(layout, /customizer-admin\.css/);
  assert.match(adminStyles, /admin-customizer-manager/);
});