import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
const [surface,css,stack]=await Promise.all([
 read("app/bag-builder-lifelike-surface.tsx"),
 read("app/bag-builder-volumetric-yarn.css"),
 read("app/exact-live-customizer.tsx"),
]);
test("only the actual WebGL renderer feeds the physical-stitch image",()=>{
 assert.match(surface,/stage\.dataset\.stitch === "herringbone"/);
 assert.match(surface,/name: "physical-5mm-fidelity3d"/);
 assert.match(surface,/layer\.querySelector<HTMLCanvasElement>\(BASE_SOURCE_SELECTOR\)/);
 assert.match(stack,/bag-builder-volumetric-yarn\.css/);
});
test("retired projected stitches cannot obscure volumetric 3D cords",()=>{
 assert.match(css,/data-stitch="herringbone"/);
 assert.match(css,/abags-physical-cord-geometry/);
 assert.match(css,/abags-sidewall-crochet-depth/);
 assert.match(css,/opacity:0!important/);
 assert.match(css,/visibility:hidden!important/);
 assert.match(css,/abags-fidelity3d-canvas/);
});
