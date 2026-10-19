import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const s=await readFile(new URL("../app/bag-builder-fidelity3d.tsx",import.meta.url),"utf8");
test("crochet cords have textile tonal separation rather than drawn-pictogram contrast",()=>{
 assert.match(s,/a=\.72\+\.235\*raised\+\.045\*bridge/);
 assert.match(s,/detail=mix\(\.87,1\.045,fullness\)/);
 assert.match(s,/cordOcclusion=mix\(\.82,1\.0,smoothstep\(\.44,\.89,cord\)\)/);
 assert.doesNotMatch(s,/a=\.25\+\.65\*raised/);
});
