import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/bag-builder-photo-true.tsx", import.meta.url), "utf8");

test("Photo-True readiness follows the currently mounted builder stage", () => {
  assert.match(source, /if \(!stage \|\| !selected\?\.imageUrl\) return;/);
  assert.match(source, /const liveStage = stage;/);
  assert.match(source, /liveStage\.dataset\.abagsPhotoTrue = "active"/);
  assert.match(source, /liveStage\.dataset\.photoProductId = selected\.id/);
  assert.match(source, /dialog\.dataset\.photoProductId = selected\.id/);
  assert.match(source, /\}, \[selected, stage\]\);/);
});

test("Photo-True no longer binds readiness to a stale global stage lookup", () => {
  const readinessEffect = source.slice(source.indexOf("const selected = useMemo"), source.indexOf("if (!selectedId) return;"));
  assert.doesNotMatch(readinessEffect, /document\.querySelector<HTMLElement>\("\.abags-vc-dialog\.abags-reference-layout-v4 \.abags-bag-builder-stage"\)/);
  assert.match(readinessEffect, /if \(dialog\.dataset\.photoProductId === selected\.id\)/);
});
