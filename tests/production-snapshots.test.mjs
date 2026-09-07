import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const snapshots = fs.readFileSync("lib/production-snapshots.ts", "utf8");
const route = fs.readFileSync("app/api/configurator/snapshot/route.ts", "utf8");

test("production snapshots are persisted server-side with a unique canonical package hash", () => {
  assert.match(snapshots, /CREATE TABLE IF NOT EXISTS production_snapshots/);
  assert.match(snapshots, /package_hash TEXT NOT NULL UNIQUE/);
  assert.match(snapshots, /package_json TEXT NOT NULL/);
  assert.match(snapshots, /createConfigurationHash\(productionPackage\)/);
  assert.match(snapshots, /INSERT INTO production_snapshots/);
  assert.match(snapshots, /ON CONFLICT\(package_hash\) DO NOTHING/);
});

test("snapshot API re-resolves V2 input and never trusts a client-supplied production package", () => {
  assert.match(route, /resolveBomBoundProductConfigurationV2/);
  assert.match(route, /persistProductionSnapshot\(resolved\.productionPackagePreview\)/);
  assert.doesNotMatch(route, /persistProductionSnapshot\(.*raw/);
  assert.match(route, /PRODUCTION_SNAPSHOT_BLOCKED/);
});

test("snapshot identity is generated server-side and immutable operations have no update/delete API", () => {
  assert.match(snapshots, /crypto\.randomUUID\(\)/);
  assert.match(snapshots, /const id = `ps_\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(snapshots, /export async function persistProductionSnapshot/);
  assert.match(snapshots, /export async function getProductionSnapshot/);
  assert.doesNotMatch(snapshots, /export async function updateProductionSnapshot/);
  assert.doesNotMatch(snapshots, /export async function deleteProductionSnapshot/);
});

test("snapshot API verifies the resolver hash after persistence", () => {
  assert.match(route, /snapshot\.packageHash !== resolved\.productionPackageHash/);
  assert.match(route, /PRODUCTION_SNAPSHOT_HASH_MISMATCH/);
});
