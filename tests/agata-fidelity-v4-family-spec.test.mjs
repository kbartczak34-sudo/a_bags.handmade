import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [spec, renderer, contract] = await Promise.all([
  readFile(new URL("../lib/abags-fidelity-v4-family-spec.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-final-webgl3d.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-abags-fidelity-contract.tsx", import.meta.url), "utf8"),
]);

test("each Fidelity V4 family is locked to a real Agata product reference", () => {
  for (const reference of [
    "pastel-tote-wood-bow",
    "cream-round-taupe-flap",
    "cream-burgundy-flap",
    "small-multicolor-chain",
  ]) {
    assert.ok(spec.includes(`reference: \"${reference}\"`), `missing geometry reference ${reference}`);
    assert.ok(contract.includes(reference), `customer fidelity contract must expose ${reference}`);
  }
});

test("family contract owns hardware anchors instead of renderer guesses", () => {
  for (const ringY of ["0.49", "0.46", "0.42"]) assert.ok(spec.includes(`ringY: ${ringY}`));
  assert.match(spec, /ringY: number/);
});

test("renderer version explicitly identifies the Agata 1:1 fidelity contract", () => {
  assert.match(spec, /ABAGS_FIDELITY_V4_RENDERER_VERSION = \"abags-fidelity-v4-agata-1to1\"/);
  assert.match(renderer, /ABAGS_FIDELITY_V4_RENDERER_VERSION/);
});
