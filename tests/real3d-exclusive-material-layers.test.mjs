import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=p=>readFile(new URL("../"+p,import.meta.url),"utf8");
const [cord,basket,sidewall]=await Promise.all([
 read("app/bag-builder-physical-cord-geometry.css"),
 read("app/bag-builder-basket-physical-cord-v2.css"),
 read("app/bag-builder-sidewall-crochet-depth.css"),
]);
test("duplicate WebGL cord layers no longer cover the actual bag material",()=>{
 assert.match(cord,/data-abags-physical-cord-geometry="physical-cord-geometry-v1-volumetric-loops"[\s\S]*?opacity:0!important;[\s\S]*?visibility:hidden!important;/);
 assert.match(basket,/data-abags-basket-physical-cord-v2="basket-physical-cord-v2-continuous-handmade-weave"[\s\S]*?opacity:0!important;[\s\S]*?visibility:hidden!important;/);
});
test("floating 2D sidewall ribbon retires when verified 3D is ready",()=>{
 assert.match(sidewall,/data-abags-final3d="ready"[\s\S]*?opacity:0!important;[\s\S]*?visibility:hidden!important;/);
});
