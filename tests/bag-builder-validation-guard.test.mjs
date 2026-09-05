import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const guard = fs.readFileSync("app/bag-builder-validation-guard.tsx", "utf8");
const fidelity = fs.readFileSync("lib/abags-builder-fidelity.ts", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");

test("validation guard is mounted with the active Bag Builder", () => {
  assert.match(exact, /BagBuilderValidationGuard/);
  assert.match(exact, /<BagBuilderValidationGuard \/>/);
});

test("guard validates every persisted Bag Builder field against supported values", () => {
  assert.match(guard, /const ALLOWED/);
  assert.match(guard, /family: new Set/);
  assert.match(guard, /color: new Set/);
  assert.match(guard, /stitch: new Set/);
  assert.match(guard, /flap: new Set/);
  assert.match(guard, /handles: new Set/);
  assert.match(guard, /strap: new Set/);
  assert.match(guard, /hardware: new Set/);
  assert.match(guard, /accent: new Set/);
});

test("stale invalid drafts cannot silently reach the workshop flow", () => {
  assert.match(guard, /localStorage\.removeItem\(DRAFT_KEY\)/);
  assert.match(guard, /repairSnapshot/);
  assert.match(guard, /invalidRequired/);
  assert.match(guard, /reset\?\.click\(\)/);
  assert.match(guard, /Niepoprawny draft nie może zostać wysłany do pracowni/);
});

test("stale handle choices are repaired from the central Agata reference contract", () => {
  assert.match(guard, /isAgataBuilderHandleSupported/);
  assert.match(guard, /clickChoice\(controls, "handles", "none"\)/);
  assert.match(fidelity, /round:\s*\["none"\]/);
  assert.match(fidelity, /bucket:\s*\["none"\]/);
  assert.match(fidelity, /mini:\s*\["none", "wood-light"\]/);
  assert.doesNotMatch(guard, /snapshot\.family === "round" \|\| snapshot\.family === "mini"/);
});

test("status explains missing required decisions and successful validation", () => {
  assert.match(guard, /Projekt wymaga uzupełnienia/);
  assert.match(guard, /Brakuje:/);
  assert.match(guard, /Projekt gotowy do konsultacji/);
  assert.match(guard, /walidacja ✓/);
  assert.match(guard, /Finalna możliwość wykonania i cena personalizacji są potwierdzane przez pracownię/);
});