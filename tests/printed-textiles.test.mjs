import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/abags-printed-textiles.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;

function fixture() {
  const images = [], calls = [];
  let lost = false;
  class Image {
    constructor() { this.naturalWidth = 1024; this.naturalHeight = 1024; images.push(this); }
  }
  const gl = Object.fromEntries(["TEXTURE_2D", "RGBA", "UNSIGNED_BYTE", "TEXTURE_MIN_FILTER", "TEXTURE_MAG_FILTER", "TEXTURE_WRAP_S", "TEXTURE_WRAP_T", "LINEAR", "CLAMP_TO_EDGE", "REPEAT", "LINEAR_MIPMAP_LINEAR"].map((key,i) => [key,i]));
  gl.createTexture = () => ({});
  for (const name of ["bindTexture", "texImage2D", "texParameteri", "generateMipmap", "deleteTexture"])
    gl[name] = (...args) => calls.push([name, ...args]);
  gl.isContextLost = () => lost;
  const context = { exports: {}, Image, Uint8Array };
  runInNewContext(code, context);
  const api = context.exports, textiles = api.createAbagsPrintedTextiles(gl);
  return { api, textiles, gl, images, calls, lose() { lost = true; } };
}

test("both samplers start with complete WebGL 1 placeholders and request no network image", () => {
  const { textiles, images, calls } = fixture();
  assert.equal(images.length, 0);
  assert.equal(textiles.scarf.ready, false);
  assert.equal(textiles.strap.ready, false);
  const uploads = calls.filter(c => c[0] === "texImage2D");
  assert.equal(uploads.length, 2);
  for (const upload of uploads) {
    assert.equal(upload[4], 1); assert.equal(upload[5], 1);
    assert.deepEqual([...upload[9]], [255,255,255,255]);
  }
});

test("printed fabrics load once, become independently ready and use filtered mipmaps", () => {
  const { api, textiles, images, calls, gl } = fixture();
  let paints = 0;
  api.requestAbagsPrintedTextiles(textiles, () => paints++);
  api.requestAbagsPrintedTextiles(textiles, () => paints++);
  assert.equal(images.length, 2);
  assert.equal(images[0].src, api.ABAGS_PRINTED_TEXTILE_ASSETS.scarf);
  images[0].onload();
  assert.equal(textiles.scarf.ready, true);
  assert.equal(textiles.strap.ready, false);
  assert.equal(paints, 1);
  images[1].onload();
  assert.equal(textiles.strap.ready, true);
  assert.equal(paints, 2);
  assert.equal(calls.filter(c => c[0] === "generateMipmap").length, 2);
  assert.ok(calls.some(c => c[0] === "texParameteri" && c[2] === gl.TEXTURE_MIN_FILTER && c[3] === gl.LINEAR_MIPMAP_LINEAR));
});

test("failed or late image requests retain the procedural fallback without touching a lost context", () => {
  const { api, textiles, images, calls, lose } = fixture();
  let paints = 0;
  api.requestAbagsPrintedTextiles(textiles, () => paints++);
  images[0].onerror();
  assert.equal(textiles.scarf.ready, false);
  lose();
  const before = calls.length;
  images[1].onload();
  assert.equal(calls.length, before);
  assert.equal(textiles.strap.ready, false);
  assert.equal(paints, 0);
});

test("disposal cancels pending callbacks, releases both textures and is idempotent", () => {
  const { api, textiles, images, calls } = fixture();
  api.requestAbagsPrintedTextiles(textiles, () => assert.fail("disposed renderer repainted"));
  const lateLoad = images[0].onload;
  api.disposeAbagsPrintedTextiles(textiles);
  api.disposeAbagsPrintedTextiles(textiles);
  assert.equal(calls.filter(c => c[0] === "deleteTexture").length, 2);
  assert.equal(images[0].onload, null);
  assert.equal(images[1].onerror, null);
  const before = calls.length;
  lateLoad();
  api.requestAbagsPrintedTextiles(textiles, () => {});
  assert.equal(calls.length, before);
  assert.equal(images.length, 2);
});

test("production textile assets stay within the mobile transfer and WebGL 1 size budget", async () => {
  const { api } = fixture();
  let bytes = 0;
  for (const path of Object.values(api.ABAGS_PRINTED_TEXTILE_ASSETS)) {
    const image = await readFile(new URL("../public" + path, import.meta.url));
    bytes += image.length;
    assert.equal(image.readUInt16BE(0), 0xffd8, "JPEG magic");
    let dimensions;
    for (let offset = 2; offset < image.length;) {
      const marker = image.readUInt16BE(offset), length = image.readUInt16BE(offset + 2);
      if (marker === 0xffc0 || marker === 0xffc2) { dimensions = [image.readUInt16BE(offset + 7), image.readUInt16BE(offset + 5)]; break; }
      offset += 2 + length;
    }
    assert.ok(dimensions, "JPEG has a supported frame");
    for (const n of dimensions) assert.ok(n <= 1024 && (n & (n - 1)) === 0, "power-of-two mipmap dimensions");
  }
  assert.ok(bytes < 500_000, `combined print download: ${bytes} bytes`);
});
