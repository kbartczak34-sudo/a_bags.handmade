import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/admin/orders/production-snapshot/route.ts", "utf8");
const orders = fs.readFileSync("lib/orders.ts", "utf8");
const snapshots = fs.readFileSync("lib/production-snapshots.ts", "utf8");
const panel = fs.readFileSync("app/panel/orders-manager.tsx", "utf8");

test("admin production snapshot endpoint is owner protected and server authoritative", () => {
  assert.match(route, /isAdminRequest\(request\)/);
  assert.match(route, /getProductionSnapshot\(snapshotId\)/);
  assert.match(route, /PRODUCTION_SNAPSHOT_NOT_FOUND/);
  assert.doesNotMatch(route, /persistProductionSnapshot/);
});

test("admin orders expose the immutable V2 snapshot identity", () => {
  assert.match(orders, /production_snapshot_id TEXT/);
  assert.match(orders, /production_package_hash TEXT/);
  assert.match(orders, /productionSnapshotId: row\.production_snapshot_id/);
  assert.match(orders, /productionPackageHash: row\.production_package_hash/);
});

test("immutable snapshot storage has no mutation path", () => {
  assert.match(snapshots, /ON CONFLICT\(package_hash\) DO NOTHING/);
  assert.doesNotMatch(snapshots, /export async function updateProductionSnapshot/);
  assert.doesNotMatch(snapshots, /export async function deleteProductionSnapshot/);
});

test("orders panel exposes and verifies the immutable V2 production package", () => {
  assert.match(panel, /productionSnapshotId: string \| null/);
  assert.match(panel, /productionPackageHash: string \| null/);
  assert.match(panel, /\/api\/admin\/orders\/production-snapshot\?snapshotId=/);
  assert.match(panel, /data\.snapshot\.packageHash !== order\.productionPackageHash/);
  assert.match(panel, /Pokaż pakiet produkcyjny/);
  assert.match(panel, /JSON\.stringify\(selectedSnapshot\.package, null, 2\)/);
});
