import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, contract, library] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-abags-fidelity-contract.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/exact-customizer-library.ts", import.meta.url), "utf8"),
]);

test("real-product fidelity contract is mounted after the final reference controller", () => {
  assert.match(stack, /import BagBuilderAbagsFidelityContract/);
  const reference = stack.indexOf("<BagBuilderReferenceV4 />");
  const fidelity = stack.indexOf("<BagBuilderAbagsFidelityContract />");
  assert.ok(reference >= 0 && fidelity > reference);
});

test("customer family copy is calibrated to real A-Bags reference families", () => {
  for (const label of ["Kuferek / tote", "Okrągła", "Z klapą", "Strukturalna / mini"]) {
    assert.ok(contract.includes(label), `missing customer family label: ${label}`);
  }
  for (const reference of ["pastel-tote-wood-bow", "cream-round-taupe-flap", "cream-burgundy-flap", "small-multicolor-chain"]) {
    assert.ok(contract.includes(reference), `missing real-product family reference: ${reference}`);
    assert.ok(library.includes(`id:\"${reference}\"`), `reference ${reference} must exist in exact atelier library`);
  }
});

test("customer stitch copy follows stitch structures documented by the real atelier library", () => {
  for (const [label, reference] of [
    ["Ażurowy V", "open-v"],
    ["Pionowy ażurowy", "vertical-open"],
    ["Koszykowy", "basket"],
    ["Promienisty", "radial"],
  ]) {
    assert.ok(contract.includes(label), `missing stitch label: ${label}`);
    assert.ok(contract.includes(`reference: \"${reference}\"`), `missing stitch reference: ${reference}`);
    assert.ok(library.includes(`stitch:\"${reference}\"`), `atelier library must contain stitch ${reference}`);
  }
});

test("legacy pro3d active class means visible accepted 3D only", () => {
  assert.match(contract, /const ready = state === \"ready\"/);
  assert.match(contract, /classList\.toggle\(\"abags-pro3d-active\", ready\)/);
  assert.match(contract, /classList\.toggle\(\"abags-fidelity3d-active\", ready\)/);
  assert.match(contract, /abagsRendererVisible = ready \? \"fidelity3d\" : \"svg-fallback\"/);
});
