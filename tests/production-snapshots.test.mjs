import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const snapshots = fs.readFileSync("lib/production-snapshots.ts", "utf8");

test("production snapshots are persisted server-side with a unique canonical package hash", () => {
  assert.match(snapshots, /CREATE TABLE IF NOT EXISTS production_snapshots/);
  assert.match(snapshots, /package_hash TEXT NOT NULL UNIQUE/);
  assert.match(snapshots, /package_json TEXT NOT NULL/);
  assert.match(snapshots, /createConfigurationHash\(productionPackage\)/);
  assert.match(snapshots, /INSERT INTO production_snapshots/);
  assert.match(snapshots, /ON CONFLICT\(package_hash\) DO NOTHING/);
});

test("production snapshot identity is generated server-side and cannot be supplied by the client package", () => {
  assert.match(snapshots, /crypto\.randomUUID\(\)/);
  assert.match(snapshots, /const id = `ps_\$\{crypto\.randomUUID\(\)\}`/);
  assert.doesNotMatch(snapshots, /source.*id/);
});

test("production snapshots expose read-only persistence operations", () => {
  assert.match(snapshots, /export async function persistProductionSnapshot/);
  assert.match(snapshots, /export async function getProductionSnapshot/);
  assert.doesNotMatch(snapshots, /export async function updateProductionSnapshot/);
  assert.doesNotMatch(snapshots, /export async function deleteProductionSnapshot/);
});
