import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8");
const materialStart = source.indexOf("} else if(uMaterial<1.5){");
const leatherStart = source.indexOf("} else if(uMaterial<2.5){", materialStart);
const wood = source.slice(materialStart, leatherStart);

test("wood handle grain is mapped in its physical two-dimensional cut plane", () => {
  assert.ok(materialStart > 0 && leatherStart > materialStart);
  assert.match(source, /makeReferenceWoodHandle\(\)/);
  assert.match(source, /mesh\.uvs\.push\(\.5\+x\/1\.1,\.5\+y\)/);
  assert.match(wood, /float grainPath=vUv\.y\*99\.0/);
  assert.match(wood, /sin\(vUv\.x\*18\.0\+vUv\.y\*9\.0\)/);
  assert.match(wood, /sin\(vUv\.x\*51\.0-vUv\.y\*12\.0\)/);
  assert.match(wood, /float rings=sin\(grainPath\)/);
  assert.match(wood, /float growth=pow/);
});

test("small mobile wooden handles do not shimmer with subpixel pores", () => {
  assert.match(source, /#extension GL_OES_standard_derivatives : enable/);
  assert.match(wood, /#ifdef ABAGS_HAS_DERIVATIVES/);
  assert.match(wood, /length\(dFdx\(vUv\*vec2\(51\.0,257\.0\)\)\)/);
  assert.match(wood, /length\(dFdy\(vUv\*vec2\(51\.0,257\.0\)\)\)/);
  assert.match(wood, /grainVisibility=1\.0-smoothstep/);
  assert.match(wood, /rough=\.43\+grainVisibility/);
  // Customer hue and color remain owned by the selected wood tone; texture
  // modulates lighting, not an invented or recolored image.
  assert.doesNotMatch(wood, /pigment\s*=|uColor\s*=/);
});
