import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const load=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
const [spec,renderer,engine,doc]=await Promise.all([
  load("lib/abags-fidelity-v4-family-spec.ts"),
  load("app/bag-builder-fidelity3d.tsx"),
  load("app/bag-builder-engine.tsx"),
  load("docs/3d-asset-status.md"),
]);
test("all four real A-Bags families have an approximate 16cm width, NOT invented height or depth",()=>{
  assert.match(spec,/ABAGS_AGATA_NOMINAL_BODY_WIDTH_CM = 16/);
  assert.match(spec,/bodyWidthIsApproximate: true/);
  assert.match(spec,/confirmedHeightCm: null/);
  assert.match(spec,/confirmedDepthCm: null/);
  assert.match(spec,/equivalentCrochetFrontAndBack: true/);
  for(const family of ["tote","round","bucket","mini"]) assert.ok(spec.includes(`${family}: {`));
  assert.match(doc,/Approximate physical \*\*body width: 16 cm\*\*/);
});
test("3D model has the same real crochet body from the front and back",()=>{
  assert.match(renderer,/const backBulge = frontBulge \+ bodyDomeLift/);
  assert.match(renderer,/addFabricFace\(frontFace, 1\)/);
  assert.match(renderer,/addFabricFace\(backFace, -1\)/);
  assert.match(renderer,/\.5 \+ bevel - softness\.z - backBulge \* dome/);
  assert.match(renderer,/vNormal=normalize\(uNormalMatrix\*aNormal\)/);
  assert.match(renderer,/reciprocalU=cross\(vBitangent,n\)/);
  assert.doesNotMatch(renderer,/vFaceWeight/);
  assert.doesNotMatch(renderer,/backBulge = spec\.depth \* \.025|softness\.z \* \.38/);
});
test("builder shows width as approximate while leaving other dimensions unspecified",()=>{
  assert.match(engine,/data-approx-width-cm=/);
  assert.match(engine,/data-matching-crochet-back="true"/);
  assert.match(engine,/Szerokość korpusu: około/);
  assert.match(engine,/Wysokość i głębokość do potwierdzenia/);
});
