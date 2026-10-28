import type { AbagsPrintedTextileProfile } from "./abags-textile-profiles";

type TextileKey = "scarf" | "strap";
type PrintedTextile = { texture: WebGLTexture; image: HTMLImageElement | null; url: string | null; ready: boolean };
export type AbagsPrintedTextiles = { gl: WebGLRenderingContext; disposed: boolean; scarf: PrintedTextile; strap: PrintedTextile };

export function createAbagsPrintedTextiles(gl: WebGLRenderingContext): AbagsPrintedTextiles {
  const create = (): PrintedTextile => {
    const texture = gl.createTexture();
    if (!texture) throw new Error("textile-texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Complete white placeholders keep both WebGL 1 samplers valid before an
    // image arrives. The existing procedural material remains visible then.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { texture, image: null, url: null, ready: false };
  };
  return { gl, disposed: false, scarf: create(), strap: create() };
}

export function requestAbagsPrintedTextiles(textiles: AbagsPrintedTextiles, profile: AbagsPrintedTextileProfile, onReady: () => void) {
  if (textiles.disposed) return;
  for (const key of ["scarf", "strap"] as TextileKey[]) {
    const entry = textiles[key];
    const url = profile[key]?.url ?? null;
    if (entry.url === url) continue;
    if (entry.image) { entry.image.onload = null; entry.image.onerror = null; }
    entry.image = null;
    entry.url = url;
    entry.ready = false;
    if (!url || typeof Image === "undefined") continue;
    const image = new Image();
    entry.image = image;
    image.decoding = "async";
    image.onload = () => {
      const { gl } = textiles;
      if (textiles.disposed || entry.image !== image || entry.url !== url || gl.isContextLost()) return;
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      const powerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;
      if (powerOfTwo(image.naturalWidth) && powerOfTwo(image.naturalHeight)) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      }
      entry.ready = true;
      entry.image = null;
      onReady();
    };
    image.onerror = () => { if (entry.image === image) entry.image = null; };
    image.src = url;
  }
}

export function disposeAbagsPrintedTextiles(textiles: AbagsPrintedTextiles) {
  if (textiles.disposed) return;
  textiles.disposed = true;
  for (const key of ["scarf", "strap"] as TextileKey[]) {
    const entry = textiles[key];
    if (entry.image) { entry.image.onload = null; entry.image.onerror = null; entry.image = null; }
    if (!textiles.gl.isContextLost()) textiles.gl.deleteTexture(entry.texture);
    entry.ready = false;
  }
}
