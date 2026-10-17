type ShadowMesh = { position: WebGLBuffer; index: WebGLBuffer; count: number };
export type CordShadowCommand = { mesh: ShadowMesh; model: Float32Array };

export type CordShadow = {
  gl: WebGLRenderingContext;
  texture: WebGLTexture;
  matrix: Float32Array;
  size: number;
  framebuffer: WebGLFramebuffer;
  color: WebGLRenderbuffer;
  program: WebGLProgram;
  position: number;
  mvp: WebGLUniformLocation;
};

function multiply(a: Float32Array, b: Float32Array) {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) result[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    }
  }
  return result;
}

/** Column-major light projection, in the same world coordinates as Fidelity3D. */
export function cordShadowMatrix() {
  const length = Math.hypot(-.42, .86, .92);
  const z = [-.42 / length, .86 / length, .92 / length];
  const xLength = Math.hypot(z[2], z[0]);
  const x = [z[2] / xLength, 0, -z[0] / xLength];
  const y = [z[1] * x[2], z[2] * x[0] - z[0] * x[2], -z[1] * x[0]];
  const view = new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    0, 0, -6, 1,
  ]);
  const near = .1, far = 12, halfSpan = 3;
  const projection = new Float32Array([
    1 / halfSpan, 0, 0, 0,
    0, 1 / halfSpan, 0, 0,
    0, 0, -2 / (far - near), 0,
    0, 0, -(far + near) / (far - near), 1,
  ]);
  return multiply(projection, view);
}

/** Optional, fixed-size WebGL1 depth pass; unsupported devices keep the main renderer. */
export function createCordShadow(gl: WebGLRenderingContext): CordShadow | null {
  if (!gl.getExtension("WEBGL_depth_texture") || gl.isContextLost()) return null;
  const size = 1024;
  if (gl.getParameter(gl.MAX_TEXTURE_SIZE) < size || gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) < size) return null;

  let texture: WebGLTexture | null = null;
  let framebuffer: WebGLFramebuffer | null = null;
  let color: WebGLRenderbuffer | null = null;
  let program: WebGLProgram | null = null;
  const shaders: WebGLShader[] = [];
  let completed = false;
  try {
    texture = gl.createTexture();
    framebuffer = gl.createFramebuffer();
    color = gl.createRenderbuffer();
    program = gl.createProgram();
    if (!texture || !framebuffer || !color || !program) return null;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("shadow-shader-buffer");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error("shadow-shader-compile");
      return shader;
    };
    gl.attachShader(program, compile(gl.VERTEX_SHADER,
      "attribute vec3 aPosition;uniform mat4 uMVP;void main(){gl_Position=uMVP*vec4(aPosition,1.0);}"));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER,
      "precision mediump float;void main(){gl_FragColor=vec4(1.0);}"));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    const position = gl.getAttribLocation(program, "aPosition");
    const mvp = gl.getUniformLocation(program, "uMVP");
    if (position < 0 || !mvp) return null;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindRenderbuffer(gl.RENDERBUFFER, color);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA4, size, size);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE || gl.isContextLost()) return null;
    completed = true;
    return { gl, texture, matrix: cordShadowMatrix(), size, framebuffer, color, program, position, mvp };
  } catch {
    return null;
  } finally {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    for (const shader of shaders) gl.deleteShader(shader);
    if (!completed) {
      if (program) gl.deleteProgram(program);
      if (color) gl.deleteRenderbuffer(color);
      if (framebuffer) gl.deleteFramebuffer(framebuffer);
      if (texture) gl.deleteTexture(texture);
      // Optional allocation failures must not poison the main draw's error check.
      for (let attempts = 0; attempts < 8 && gl.getError() !== gl.NO_ERROR; attempts++) { /* Drain bounded GL errors. */ }
    }
  }
}

/** The caller restores its main program, viewport and texture bindings afterwards. */
export function renderCordShadow(shadow: CordShadow, commands: CordShadowCommand[]): void {
  const { gl } = shadow;
  if (gl.isContextLost()) return;
  try {
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadow.framebuffer);
    gl.viewport(0, 0, shadow.size, shadow.size);
    gl.useProgram(shadow.program);
    for (let attribute = 0; attribute < gl.getParameter(gl.MAX_VERTEX_ATTRIBS); attribute++) {
      if (attribute !== shadow.position) gl.disableVertexAttribArray(attribute);
    }
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);
    gl.disable(gl.CULL_FACE);
    gl.clearDepth(1);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (const { mesh, model } of commands) {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position);
      gl.enableVertexAttribArray(shadow.position);
      gl.vertexAttribPointer(shadow.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
      gl.uniformMatrix4fv(shadow.mvp, false, multiply(shadow.matrix, model));
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
    }
  } finally {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}
