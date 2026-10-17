/** Generated neutral filament microtexture; not a scan or calibrated product map. */
export function createCordTexture(gl: WebGLRenderingContext, canvas: HTMLCanvasElement, onReady: () => void) {
  const texture = gl.createTexture();
  if (!texture) throw new Error("cord-texture-buffer");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  canvas.dataset.abagsCordTexture = "loading";
  const active = () => canvas.isConnected && !gl.isContextLost() && gl.isTexture(texture);
  const image = new Image();
  image.onload = () => {
    if (!active()) return;
    try {
      // WebGL1 repeating textures need power-of-two dimensions. Mipmaps also
      // stop individual filaments aliasing when the customer zooms out.
      const source = document.createElement("canvas");
      source.width = source.height = 1024;
      const context = source.getContext("2d");
      if (!context) throw new Error("cord-texture-resample");
      context.drawImage(image, 0, 0, source.width, source.height);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      const anisotropy = gl.getExtension("EXT_texture_filter_anisotropic");
      if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
        Math.min(4, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      canvas.dataset.abagsCordTexture = "ready";
      canvas.dataset.abagsCordTextureReadyAt = String(Date.now());
      onReady();
    } catch {
      canvas.dataset.abagsCordTexture = "fallback";
    }
  };
  image.onerror = () => { if (active()) canvas.dataset.abagsCordTexture = "fallback"; };
  image.src = "/images/configurator/cord-microfiber-v1.webp";
  return texture;
}
