import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const guard = fs.readFileSync("app/bag-builder-validation-guard.tsx", "utf8");
const store = fs.readFileSync("app/bag-builder-config-store.ts", "utf8");
const fidelity = fs.readFileSync("lib/abags-builder-fidelity.ts", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");

test("validation guard is mounted with the active Bag Builder", () => {
  assert.match(exact, /BagBuilderValidationGuard/);
  assert.match(exact, /<BagBuilderValidationGuard \/>/);
});

test("guard consumes central normalized state and raw integrity failures", () => {
  assert.match(guard, /useBagBuilderClientState/);
  assert.match(guard, /invalidKeys/);
  assert.match(guard, /toBagBuilderDraftConfig/);
  assert.doesNotMatch(guard, /const ALLOWED/);
  assert.match(store, /const ALLOWED/);
  assert.match(store, /const COLORS/);
  assert.match(store, /normalizeBagBuilderDraftInput/);
});

test("stale invalid drafts cannot silently reach the workshop flow", () => {
  assert.match(guard, /localStorage\.removeItem\(DRAFT_KEY\)/);
  assert.match(guard, /repairSnapshot/);
  assert.match(guard, /invalidRequired/);
  assert.match(guard, /reset\?\.click\(\)/);
  assert.match(guard, /Niepoprawny draft nie może zostać wysłany do pracowni/);
});

test("stale construction choices are repaired from the central Agata reference contract", () => {
  assert.match(guard, /isAgataBuilderConstructionSupported/);
  assert.match(guard, /fidelityInvalidKeys/);
  assert.match(guard, /flap: "flaps"/);
  assert.match(guard, /handles: "handles"/);
  assert.match(guard, /strap: "straps"/);
  assert.match(guard, /accent: "accents"/);
  assert.match(guard, /clickChoice\(controls, key, "none"\)/);
  assert.match(fidelity, /AGATA_BUILDER_CONSTRUCTION_COMPATIBILITY/);
  assert.match(fidelity, /round:\s*\{[\s\S]*?handles:\s*\["none"\]/);
  assert.match(fidelity, /mini:\s*\{[\s\S]*?handles:\s*\["none", "wood-light"\]/);
});

test("status reports incompatible and invalid saved constructions before repairing them", () => {
  assert.match(guard, /incompatible = fidelityInvalidKeys\(snapshot\)/);
  assert.match(guard, /invalidKeys\.length \|\| incompatible\.length/);
  assert.match(guard, /nie ma w zweryfikowanych konstrukcjach tego fasonu A-Bags/);
  assert.match(guard, /zgodna ze zweryfikowanymi referencjami A-Bags/);
});

test("status explains missing required decisions and successful validation", () => {
  assert.match(guard, /Projekt wymaga uzupełnienia/);
  assert.match(guard, /Brakuje:/);
  assert.match(guard, /Projekt gotowy do konsultacji/);
  assert.match(guard, /walidacja ✓/);
  assert.match(guard, /Finalna możliwość wykonania i cena personalizacji są potwierdzane przez pracownię/);
});

test("validation guard no longer owns a second configuration attribute observer", () => {
  assert.doesNotMatch(guard, /attributeFilter:\s*\["data-family"/);
  assert.match(store, /attributeFilter: \[\.\.\.OBSERVED_ATTRIBUTES\]/);
});
