import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const renderer = await read("app/bag-builder-final-webgl3d.tsx");
const controller = await read("app/bag-builder-final3d-controller.tsx");
const familySpec = await read("lib/abags-fidelity-v4-family-spec.ts");


test("final renderer is bound to the calibrated V4 family geometry contract", () => {
  assert.match(renderer, /ABAGS_FIDELITY_V4_FAMILY_SPECS/);
  assert.match(renderer, /function familyContour/);
  assert.match(renderer, /superellipseContour/);
  assert.match(renderer, /function configSignature/);
  assert.match(renderer, /RENDERER_VERSION = ABAGS_FIDELITY_V4_RENDERER_VERSION/);
  for (const family of ["tote", "round", "bucket", "mini"]) {
    assert.match(familySpec, new RegExp(`\\b${family}: \\{`));
  }
});

test("final renderer has distinct material paths for cord, leather, metal, wood and suede", () => {
  assert.match(renderer, /uMaterial<\.5/);
  assert.match(renderer, /uMaterial<1\.5/);
  assert.match(renderer, /uMaterial<2\.5/);
  assert.match(renderer, /uMaterial<3\.5/);
  assert.match(renderer, /hm=config\.handles==="crochet"\?0:3/);
  assert.match(renderer, /fm=config\.flap==="crochet"\?0:config\.flap==="suede-burgundy"\?4:1/);
  assert.match(renderer, /drawMesh\(renderer,meshes\.ring[\s\S]*,hardware,0,2\)/);
});

test("final renderer accepts every customer-visible configuration dimension", () => {
  for (const key of ["family", "color", "stitch", "flap", "handles", "strap", "hardware", "accent"]) {
    assert.match(renderer, new RegExp(`config\\.${key}`));
  }
});

test("final 3D controller never promotes a stale signature to ready", () => {
  assert.match(controller, /rendererReady !== REQUIRED_RENDERER/);
  assert.match(controller, /frameSignature !== expectedSignature/);
  assert.match(controller, /currentSignature !== expectedSignature/);
  assert.match(controller, /currentFrame !== currentSignature/);
  assert.match(controller, /stage\.dataset\.abagsFinal3d = \"ready\"/);
  assert.match(controller, /stage\.dataset\.abagsFinal3dSignature = currentSignature/);
});
