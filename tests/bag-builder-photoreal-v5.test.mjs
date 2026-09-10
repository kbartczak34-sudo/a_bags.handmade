import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const renderer = fs.readFileSync(new URL("../app/bag-builder-photoreal-v5.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("Photoreal V5 is mounted as the final construction-depth layer", () => {
  assert.match(layout, /import BagBuilderPhotorealV5 from "\.\/bag-builder-photoreal-v5"/);
  assert.match(layout, /<BagBuilderPhotorealV4 \/>\s*<BagBuilderPhotorealV5 \/>/);
});

test("Photoreal V5 contains real bag construction geometry", () => {
  assert.match(renderer, /roundedBody\(1\.72,1\.52,1\.42\)/);
  assert.match(renderer, /rimLoop\(1\.46,1\.08,\.76\)/);
  assert.match(renderer, /ellipsoid\(\.67,\.13,\.49\)/);
  assert.match(renderer, /ellipsoid\(\.69,\.055,\.51\)/);
  assert.match(renderer, /meshes\.interior/);
  assert.match(renderer, /meshes\.bottom/);
  assert.match(renderer, /tube3D\(\[\[-\.66/);
});

test("Photoreal V5 preserves material and crochet fidelity", () => {
  assert.match(renderer, /uMaterial<\.5/);
  assert.match(renderer, /uMaterial>2\.5/);
  assert.match(renderer, /noise\(vUv\*760\.\)/);
  assert.match(renderer, /stitch\(aUv,uStitch\)\*\.038/);
  assert.match(renderer, /herringbone|jodeł/);
  assert.match(renderer, /basket|koszyk/);
  assert.match(renderer, /shell|muszel/);
});

test("Photoreal V5 supports distinct product families and mobile framing", () => {
  assert.match(renderer, /tote/);
  assert.match(renderer, /round/);
  assert.match(renderer, /flap/);
  assert.match(renderer, /mini/);
  assert.match(renderer, /else if\(fam===\"round\"\)\{sx=\.91;sy=1\.10;sz=1\.04;\}/);
  assert.match(renderer, /stage\.clientWidth<700/);
  assert.match(renderer, /camZ=\(mobile\?5\.7:5\.15\)\/zoom/);
});

test("Photoreal V5 hides older visual passes only after WebGL initialization", () => {
  const webgl = renderer.indexOf('canvas.getContext("webgl"');
  const hide = renderer.indexOf('querySelectorAll<HTMLElement>');
  assert.ok(webgl >= 0 && hide > webgl);
  assert.match(renderer, /abags-photoreal-v4-canvas/);
});
