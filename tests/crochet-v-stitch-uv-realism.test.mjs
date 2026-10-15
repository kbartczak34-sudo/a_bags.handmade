import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const s=await readFile(new URL("../app/bag-builder-fidelity3d.tsx",import.meta.url),"utf8");
test("front side knit and visible yarn use the same interlocking V coordinates",()=>{
 const v=s.match(/const VERTEX = `([\s\S]*?)`;/)?.[1] || "";
 const f=s.match(/const FRAGMENT = `([\s\S]*?)`;/)?.[1] || "";
 for(const src of [v,f]) {
  assert.match(src,/uv\.x\*17\.0\+mod\(row,2\.0\)\*\.5/);
  assert.match(src,/vec2 left=vec2\(\.18,\.76\),base=vec2\(\.49,\.20\),right=vec2\(\.82,\.76\)/);
  assert.doesNotMatch(src,/min\(diag,anti\)|min\(abs\(fract\(p\.x\+p\.y\)/);
 }
});
