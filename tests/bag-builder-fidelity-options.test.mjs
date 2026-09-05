import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const guard = fs.readFileSync("app/bag-builder-fidelity-options.tsx", "utf8");
const exact = fs.readFileSync("app/exact-live-customizer.tsx", "utf8");

test("Agata fidelity option guard mounts immediately after the live engine", () => {
  assert.match(exact, /import BagBuilderFidelityOptions/);
  assert.match(exact, /<BagBuilderEngine \/>\s*<BagBuilderFidelityOptions \/>\s*<BagBuilderFinalWebGL3D \/>/);
});

test("guard covers every construction field constrained by Agata reference evidence", () => {
  assert.match(guard, /flap: "flaps"/);
  assert.match(guard, /handles: "handles"/);
  assert.match(guard, /strap: "straps"/);
  assert.match(guard, /accent: "accents"/);
  assert.match(guard, /isAgataBuilderConstructionSupported/);
});

test("unsupported live choices are disabled accessibly and stale selections fall back to none", () => {
  assert.match(guard, /button\.disabled = !supported/);
  assert.match(guard, /is-fidelity-incompatible/);
  assert.match(guard, /aria-disabled/);
  assert.match(guard, /data-builder-value="none"/);
  assert.match(guard, /fallback\.click\(\)/);
});

test("guard resynchronizes on family and construction changes before the next interaction frame", () => {
  assert.match(guard, /MutationObserver/);
  assert.match(guard, /data-family/);
  assert.match(guard, /data-flap/);
  assert.match(guard, /data-handles/);
  assert.match(guard, /data-strap/);
  assert.match(guard, /data-accent/);
  assert.match(guard, /requestAnimationFrame/);
});