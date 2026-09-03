"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type BuilderConfig = {
  family: "" | "tote" | "round" | "bucket" | "mini";
  color: string;
  stitch: "" | "classic" | "herringbone" | "basket" | "shell";
  flap: "none" | "crochet" | "leather-black" | "leather-cognac" | "suede-burgundy";
  handles: "none" | "wood-light" | "wood-dark" | "crochet";
  strap: "none" | "leather" | "woven" | "chain";
  hardware: "gold" | "silver" | "black";
  accent: "none" | "tassel" | "scarf" | "charm";
};

type Mesh = {
  position: WebGLBuffer;
  normal: WebGLBuffer;
  uv: WebGLBuffer;
  index: WebGLBuffer;
  count: number;
};

type Renderer = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  meshes: Record<string, Mesh>;
  attribs: { position: number; normal: number; uv: number };
  uniforms: Record<
    "projection" | "view" | "model" | "color" | "material" | "stitch" | "relief" | "light",
    WebGLUniformLocation
  >;
};

const EMPTY: BuilderConfig = {
  family: "",
  color: "",
  stitch: "",
  flap: "none",
  handles: "none",
  strap: "none",
  hardware: "gold",
  accent: "none",
};

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.28;
const DEFAULT_ZOOM = 0.78;
const DEFAULT_ROTATION = { x: -0.16, y: 0.74 };

function readConfig(stage: HTMLElement): BuilderConfig {
  return {
    family: (stage.dataset.family ?? "") as BuilderConfig["family"],
    color: stage.dataset.color ?? "",
    stitch: (stage.dataset.stitch ?? "") as BuilderConfig["stitch"],
    flap: (stage.dataset.flap ?? "none") as BuilderConfig["flap"],
    handles: (stage.dataset.handles ?? "none") as BuilderConfig["handles"],
    strap: (stage.dataset.strap ?? "none") as BuilderConfig["strap"],
    hardware: (stage.dataset.hardware ?? "gold") as BuilderConfig["hardware"],
    accent: (stage.dataset.accent ?? "none") as BuilderConfig["accent"],
  };
}

function sameConfig(a: BuilderConfig, b: BuilderConfig) {
  return (Object.keys(a) as Array<keyof BuilderConfig>).every((key) => a[key] === b[key]);
}

function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function hex(value: string): [number, number, number] {
  const raw = value.replace("#", "").padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(raw || "e8ddcc", 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function multiply(a: Float32Array, b: Float32Array) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      o[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

function translation(x: number, y: number, z: number) {
  const o = identity();
  o[12] = x;
  o[13] = y;
  o[14] = z;
  return o;
}

function scale(x: number, y: number, z: number) {
  const o = identity();
  o[0] = x;
  o[5] = y;
  o[10] = z;
  return o;
}

function rotX(a: number) {
  const o = identity();
  const c = Math.cos(a);
  const s = Math.sin(a);
  o[5] = c;
  o[6] = s;
  o[9] = -s;
  o[10] = c;
  return o;
}

function rotY(a: number) {
  const o = identity();
  const c = Math.cos(a);
  const s = Math.sin(a);
  o[0] = c;
  o[2] = -s;
  o[8] = s;
  o[10] = c;
  return o;
}

function rotZ(a: number) {
  const o = identity();
  const c = Math.cos(a);
  const s = Math.sin(a);
  o[0] = c;
  o[1] = s;
  o[4] = -s;
  o[5] = c;
  return o;
}

function matrix(
  position: [number, number, number],
  size: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
) {
  return multiply(
    translation(...position),
    multiply(rotZ(rotation[2]), multiply(rotY(rotation[1]), multiply(rotX(rotation[0]), scale(...size)))),
  );
}

function perspective(fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2);
  const o = new Float32Array(16);
  o[0] = f / aspect;
  o[5] = f;
  o[10] = (far + near) / (near - far);
  o[11] = -1;
  o[14] = (2 * far * near) / (near - far);
  return o;
}

function normalize(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

function makeBagShell(
  width: number,
  height: number,
  depth: number,
  shape: "tote" | "round" | "bucket" | "mini",
  rows = 58,
  columns = 112,
) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const power = shape === "round" ? 1.65 : shape === "bucket" ? 3.1 : shape === "mini" ? 3.4 : 4.8;

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const y = -height + 2 * height * v;
    const bottomRound = 0.82 + 0.18 * Math.sin((Math.PI * Math.min(v / 0.24, 1)) / 2);
    const topTaper = 1 - (shape === "bucket" ? 0.17 : shape === "mini" ? 0.07 : 0.025) * Math.max(0, (v - 0.62) / 0.38);
    const roundBoost = shape === "round" ? 0.76 + 0.24 * Math.sin(Math.PI * v) : 1;
    const w = width * bottomRound * topTaper * roundBoost;
    const d = depth * (0.92 + 0.08 * Math.sin(Math.PI * v));

    for (let col = 0; col <= columns; col += 1) {
      const u = col / columns;
      const a = u * Math.PI * 2 - Math.PI;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const x = w * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / power);
      const z = d * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / power);
      positions.push(x, y, z);
      const [nx, , nz] = normalize(x / (w * w), 0, z / (d * d));
      const ny = (v < 0.14 ? -0.1 : 0) + (v > 0.76 ? 0.065 : 0);
      normals.push(...normalize(nx, ny, nz));
      uvs.push(u, v);
    }
  }

  const stride = columns + 1;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      const a = r * stride + c;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions, normals, uvs, indices };
}

function makeOvalTube(rx: number, rz: number, minor = 0.055, major = 80, tube = 14) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= major; i += 1) {
    const u = (i / major) * Math.PI * 2;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    for (let j = 0; j <= tube; j += 1) {
      const v = (j / tube) * Math.PI * 2;
      const cv = Math.cos(v);
      const sv = Math.sin(v);
      const nx = cu * cv;
      const nz = su * cv;
      const ny = sv;
      positions.push(rx * cu + minor * nx, minor * ny, rz * su + minor * nz);
      normals.push(...normalize(nx, ny, nz));
      uvs.push(i / major, j / tube);
    }
  }
  const stride = tube + 1;
  for (let i = 0; i < major; i += 1) {
    for (let j = 0; j < tube; j += 1) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions, normals, uvs, indices };
}

function makeArchTube(rx: number, ry: number, z: number, minor = 0.055, segments = 64, tube = 12) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = Math.PI - (i / segments) * Math.PI;
    const cx = rx * Math.cos(t);
    const cy = ry * Math.sin(t);
    const tx = -rx * Math.sin(t);
    const ty = ry * Math.cos(t);
    const tl = Math.hypot(tx, ty) || 1;
    const ux = tx / tl;
    const uy = ty / tl;
    for (let j = 0; j <= tube; j += 1) {
      const a = (j / tube) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nx = -uy * ca;
      const nY = ux * ca;
      const nz = sa;
      positions.push(cx + minor * nx, cy + minor * nY, z + minor * nz);
      normals.push(...normalize(nx, nY, nz));
      uvs.push(i / segments, j / tube);
    }
  }
  const stride = tube + 1;
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < tube; j += 1) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions, normals, uvs, indices };
}

function makeEllipsoid(a: number, b: number, c: number, rows = 30, cols = 48) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rows; r += 1) {
    const t = -Math.PI / 2 + (Math.PI * r) / rows;
    for (let k = 0; k <= cols; k += 1) {
      const ph = -Math.PI + (Math.PI * 2 * k) / cols;
      const x = a * Math.cos(t) * Math.cos(ph);
      const y = b * Math.sin(t);
      const z = c * Math.cos(t) * Math.sin(ph);
      positions.push(x, y, z);
      normals.push(...normalize(x / (a * a), y / (b * b), z / (c * c)));
      uvs.push(k / cols, 1 - r / rows);
    }
  }
  const stride = cols + 1;
  for (let r = 0; r < rows; r += 1) {
    for (let c0 = 0; c0 < cols; c0 += 1) {
      const a0 = r * stride + c0;
      const b0 = a0 + stride;
      indices.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
    }
  }
  return { positions, normals, uvs, indices };
}

function makeCone(radius = 0.16, height = 0.64, segments = 30) {
  const positions = [0, height / 2, 0];
  const normals = [0, 1, 0];
  const uvs = [0.5, 1];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    positions.push(x, -height / 2, z);
    normals.push(...normalize(x, radius / height, z));
    uvs.push(i / segments, 0);
    if (i < segments) indices.push(0, i + 1, i + 2);
  }
  return { positions, normals, uvs, indices };
}

const VERTEX = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;
uniform mat4 uProjection,uView,uModel;
uniform float uRelief,uStitch;
varying vec3 vNormal,vWorld;
varying vec2 vUv;
float stitch(vec2 uv,float m){
  if(m<.5)return sin((uv.x*1.2+uv.y*.72)*110.0)*.55+sin((uv.x*.6-uv.y)*55.0)*.25;
  if(m<1.5){vec2 p=fract(uv*vec2(20.0,18.0));return .8-smoothstep(.06,.28,min(abs(p.x-p.y),abs(1.0-p.x-p.y)));}
  if(m<2.5){vec2 p=fract(uv*18.0);return max(1.0-smoothstep(.12,.34,abs(p.x-.5)),1.0-smoothstep(.12,.34,abs(p.y-.5)));}
  return sin(uv.x*72.0+sin(uv.y*36.0)*2.8)*.55+sin(uv.y*44.0)*.2;
}
void main(){
  float h=stitch(aUv,uStitch)*uRelief;
  vec3 pos=aPosition+aNormal*h;
  vec4 world=uModel*vec4(pos,1.0);
  vWorld=world.xyz;
  vNormal=normalize(mat3(uModel)*aNormal);
  vUv=aUv;
  gl_Position=uProjection*uView*world;
}`;

const FRAGMENT = `
precision mediump float;
varying vec3 vNormal,vWorld;
varying vec2 vUv;
uniform vec3 uColor,uLight;
uniform float uMaterial,uStitch;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float yarn(vec2 uv,float m){
  float a;
  if(m<.5)a=.58+.24*sin((uv.x*1.2+uv.y*.72)*110.0)+.1*sin(uv.x*214.0);
  else if(m<1.5){vec2 p=fract(uv*vec2(20.0,18.0));a=.42+.48*(1.0-smoothstep(.07,.25,min(abs(p.x-p.y),abs(1.0-p.x-p.y))));}
  else if(m<2.5){vec2 p=fract(uv*18.0);float gx=1.0-smoothstep(.14,.34,abs(p.x-.5)),gy=1.0-smoothstep(.14,.34,abs(p.y-.5));a=.38+.45*max(gx,gy);}
  else a=.52+.28*sin(uv.x*72.0+sin(uv.y*36.0)*2.8)+.1*sin(uv.y*44.0);
  return clamp(a,.08,1.0);
}
void main(){
  vec3 n=normalize(vNormal),l=normalize(uLight),v=normalize(vec3(0.0,.15,5.2)-vWorld),h=normalize(l+v);
  float ndl=max(dot(n,l),0.0),ndh=max(dot(n,h),0.0);
  float rough=.9,metal=0.0,detail=1.0;
  if(uMaterial<.5){detail=.72+.42*yarn(vUv,uStitch)+.04*(hash(floor(vUv*vec2(180.0,160.0)))-.5);rough=.94;}
  else if(uMaterial<1.5){detail=.86+.1*sin(vUv.y*115.0+sin(vUv.x*17.0)*4.0);rough=.42;}
  else if(uMaterial<2.5){detail=.9+.08*sin(vUv.x*34.0+sin(vUv.y*7.0)*3.0)+.035*(hash(floor(vUv*90.0))-.5);rough=.58;}
  else if(uMaterial<3.5){detail=.72+.28*sin(vUv.x*68.0)*sin(vUv.y*34.0);rough=.78;}
  else{metal=.95;rough=.14;detail=1.0;}
  vec3 base=uColor*detail;
  float spec=pow(ndh,mix(82.0,9.0,rough))*mix(.08,.78,metal);
  float rim=pow(1.0-max(dot(n,v),0.0),2.3);
  vec3 color=base*(.28+.84*ndl)+vec3(spec)+base*.08*(1.0-ndl)+vec3(.08)*rim;
  gl_FragColor=vec4(pow(color,vec3(.95)),1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
  return shader;
}

function createMesh(
  gl: WebGLRenderingContext,
  data: { positions: number[]; normals: number[]; uvs: number[]; indices: number[] },
): Mesh {
  const position = gl.createBuffer();
  const normal = gl.createBuffer();
  const uv = gl.createBuffer();
  const index = gl.createBuffer();
  if (!position || !normal || !uv || !index) throw new Error("buffer");
  gl.bindBuffer(gl.ARRAY_BUFFER, position);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, normal);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, uv);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.uvs), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);
  return { position, normal, uv, index, count: data.indices.length };
}

function init(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false });
  if (!gl) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
  gl.useProgram(program);
  const req = (name: string) => {
    const location = gl.getUniformLocation(program, name);
    if (!location) throw new Error(name);
    return location;
  };
  return {
    gl,
    program,
    meshes: {
      tote: createMesh(gl, makeBagShell(1.14, 1.05, 0.5, "tote")),
      round: createMesh(gl, makeBagShell(1.16, 0.93, 0.52, "round")),
      bucket: createMesh(gl, makeBagShell(1.0, 1.16, 0.5, "bucket")),
      mini: createMesh(gl, makeBagShell(0.86, 0.9, 0.42, "mini")),
      rim: createMesh(gl, makeOvalTube(1, 0.38, 0.055)),
      handle: createMesh(gl, makeArchTube(0.82, 0.82, 0, 0.066)),
      strap: createMesh(gl, makeArchTube(1.2, 1.7, 0, 0.046)),
      chain: createMesh(gl, makeArchTube(1.2, 1.7, 0, 0.03)),
      flap: createMesh(gl, makeEllipsoid(1, 0.48, 0.1)),
      sphere: createMesh(gl, makeEllipsoid(1, 1, 1, 22, 34)),
      ribbon: createMesh(gl, makeEllipsoid(0.46, 0.12, 0.04, 16, 30)),
      cone: createMesh(gl, makeCone()),
    },
    attribs: {
      position: gl.getAttribLocation(program, "aPosition"),
      normal: gl.getAttribLocation(program, "aNormal"),
      uv: gl.getAttribLocation(program, "aUv"),
    },
    uniforms: {
      projection: req("uProjection"),
      view: req("uView"),
      model: req("uModel"),
      color: req("uColor"),
      material: req("uMaterial"),
      stitch: req("uStitch"),
      relief: req("uRelief"),
      light: req("uLight"),
    },
  };
}

function drawMesh(
  renderer: Renderer,
  mesh: Mesh,
  model: Float32Array,
  color: string,
  material: number,
  stitch: number,
  relief = 0,
) {
  const { gl, attribs, uniforms } = renderer;
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position);
  gl.enableVertexAttribArray(attribs.position);
  gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal);
  gl.enableVertexAttribArray(attribs.normal);
  gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv);
  gl.enableVertexAttribArray(attribs.uv);
  gl.vertexAttribPointer(attribs.uv, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
  gl.uniformMatrix4fv(uniforms.model, false, model);
  gl.uniform3fv(uniforms.color, hex(color));
  gl.uniform1f(uniforms.material, material);
  gl.uniform1f(uniforms.stitch, stitch);
  gl.uniform1f(uniforms.relief, relief);
  gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
}

function stitchId(stitch: BuilderConfig["stitch"]) {
  return stitch === "herringbone" ? 1 : stitch === "basket" ? 2 : stitch === "shell" ? 3 : 0;
}

function draw(
  renderer: Renderer,
  canvas: HTMLCanvasElement,
  config: BuilderConfig,
  rotation: { x: number; y: number },
  zoom: number,
) {
  const { gl, uniforms, meshes } = renderer;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.uniformMatrix4fv(uniforms.projection, false, perspective(Math.PI / 5.1, width / height, 0.1, 100));
  gl.uniformMatrix4fv(uniforms.view, false, translation(0, -0.04, -5.0));
  gl.uniform3fv(uniforms.light, new Float32Array([-0.38, 0.82, 0.9]));

  if (!config.family) return;

  const root = multiply(scale(zoom, zoom, zoom), multiply(rotX(rotation.x), rotY(rotation.y)));
  const body = config.color || "#ddd4ca";
  const stitch = stitchId(config.stitch);
  const relief = config.color && config.stitch ? 0.031 : 0.008;
  const bagMesh = meshes[config.family];
  drawMesh(renderer, bagMesh, multiply(root, matrix([0, -0.16, 0], [1, 1, 1])), body, 0, stitch, relief);

  const dims =
    config.family === "mini"
      ? [0.75, 0.36, 0.88]
      : config.family === "round"
        ? [1.02, 0.45, 0.8]
        : config.family === "bucket"
          ? [0.9, 0.42, 1.03]
          : [1.03, 0.43, 0.94];

  drawMesh(
    renderer,
    meshes.rim,
    multiply(root, matrix([0, dims[2], 0], [dims[0], 1, dims[1]])),
    body,
    0,
    stitch,
    0.013,
  );

  if (config.handles !== "none") {
    const handleColor =
      config.handles === "wood-light"
        ? "#c99a62"
        : config.handles === "wood-dark"
          ? "#5c2d1d"
          : body;
    const material = config.handles.startsWith("wood") ? 1 : 0;
    const handleScale = config.family === "mini" ? 0.8 : 1;
    for (const z of [-0.26, 0.26]) {
      drawMesh(
        renderer,
        meshes.handle,
        multiply(root, matrix([0, dims[2] - 0.03, z], [handleScale, 1, 1])),
        handleColor,
        material,
        stitch,
        config.handles === "crochet" ? 0.019 : 0,
      );
    }
  }

  if (config.strap !== "none") {
    const strapColor =
      config.strap === "chain"
        ? config.hardware === "silver"
          ? "#d2d6dc"
          : config.hardware === "black"
            ? "#242225"
            : "#c9a45b"
        : config.strap === "leather"
          ? "#6a493c"
          : "#9b7080";
    const material = config.strap === "chain" ? 4 : config.strap === "leather" ? 2 : 3;
    drawMesh(
      renderer,
      config.strap === "chain" ? meshes.chain : meshes.strap,
      multiply(root, matrix([0, -0.12, -0.3], [1, 1, 1])),
      strapColor,
      material,
      stitch,
      0,
    );
  }

  if (config.flap !== "none") {
    const flapColor =
      config.flap === "leather-black"
        ? "#242124"
        : config.flap === "leather-cognac"
          ? "#7b4f34"
          : config.flap === "suede-burgundy"
            ? "#7f3043"
            : body;
    const material = config.flap === "crochet" ? 0 : 2;
    drawMesh(
      renderer,
      meshes.flap,
      multiply(root, matrix([0, 0.44, 0.5], [config.family === "mini" ? 0.78 : 1.02, config.family === "round" ? 0.82 : 0.76, 0.7], [0.06, 0, 0])),
      flapColor,
      material,
      stitch,
      config.flap === "crochet" ? 0.019 : 0,
    );
  }

  const metal = config.hardware === "silver" ? "#d4d8de" : config.hardware === "black" ? "#29272a" : "#c9a45b";
  drawMesh(
    renderer,
    meshes.sphere,
    multiply(root, matrix([0, config.flap !== "none" ? 0.31 : -0.58, 0.59], [0.105, 0.105, 0.075])),
    metal,
    4,
    0,
  );

  for (const x of [-1.04, 1.04]) {
    drawMesh(renderer, meshes.sphere, multiply(root, matrix([x, 0.34, 0.05], [0.065, 0.065, 0.065])), metal, 4, 0);
  }

  if (config.accent === "tassel") {
    drawMesh(renderer, meshes.cone, multiply(root, matrix([-1.03, -0.08, 0.3], [0.92, 1, 0.92], [0, 0, -0.08])), body, 0, stitch, 0.01);
  } else if (config.accent === "scarf") {
    drawMesh(renderer, meshes.ribbon, multiply(root, matrix([-0.86, 0.29, 0.4], [0.8, 1, 1], [0, 0, 0.52])), "#e3a0b0", 3, 0);
    drawMesh(renderer, meshes.ribbon, multiply(root, matrix([-0.76, 0.19, 0.43], [0.7, 1, 1], [0, 0, -0.46])), "#c66f87", 3, 0);
  } else if (config.accent === "charm") {
    drawMesh(renderer, meshes.sphere, multiply(root, matrix([1.0, -0.08, 0.4], [0.11, 0.16, 0.07])), "#b87880", 4, 0);
  }
}

export default function BagBuilderPro3D() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [config, setConfig] = useState<BuilderConfig>(EMPTY);
  const [rotation, setRotation] = useState(DEFAULT_ROTATION);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    const attach = () => {
      const next = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
      setStage((current) => (current === next ? current : next));
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!stage) return;
    const sync = () => {
      setConfig((current) => {
        const next = readConfig(stage);
        return sameConfig(current, next) ? current : next;
      });
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(stage, {
      attributes: true,
      attributeFilter: [
        "data-family",
        "data-color",
        "data-stitch",
        "data-flap",
        "data-handles",
        "data-strap",
        "data-hardware",
        "data-accent",
      ],
    });
    return () => observer.disconnect();
  }, [stage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rendererRef.current) return;
    try {
      rendererRef.current = init(canvas);
      if (rendererRef.current) {
        setReady(true);
        stage?.classList.add("abags-pro3d-active");
        stage?.setAttribute("data-abags-pro3d-ready", "true");
      }
    } catch {
      rendererRef.current = null;
      setReady(false);
    }
    return () => {
      stage?.classList.remove("abags-pro3d-active");
      stage?.removeAttribute("data-abags-pro3d-ready");
    };
  }, [stage]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;
    let frame = requestAnimationFrame(() => draw(renderer, canvas, config, rotation, zoom));
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => draw(renderer, canvas, config, rotation, zoom));
    };
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [config, rotation, zoom, ready]);

  const label = useMemo(
    () => (config.family ? "Interaktywny model 3D tworzonej torebki" : "Wybierz fason, aby rozpocząć model 3D"),
    [config.family],
  );

  if (!stage) return null;

  const pointerDistance = () => {
    const points = Array.from(pointersRef.current.values());
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const setView = (view: "front" | "three" | "side") => {
    setRotation(view === "front" ? { x: -0.03, y: 0 } : view === "side" ? { x: -0.12, y: 1.52 } : DEFAULT_ROTATION);
  };

  return createPortal(
    <div className="abags-pro3d-layer" data-abags-pro3d>
      <canvas
        ref={canvasRef}
        className="abags-pro3d-canvas"
        aria-label={label}
        onPointerDown={(event) => {
          pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          event.currentTarget.setPointerCapture(event.pointerId);
          if (pointersRef.current.size >= 2) {
            pinchRef.current = { distance: pointerDistance(), zoom };
            dragRef.current = null;
          } else {
            dragRef.current = { x: event.clientX, y: event.clientY, rx: rotation.x, ry: rotation.y };
          }
        }}
        onPointerMove={(event) => {
          if (!pointersRef.current.has(event.pointerId)) return;
          pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointersRef.current.size >= 2 && pinchRef.current) {
            const distance = pointerDistance();
            if (pinchRef.current.distance > 0) setZoom(clampZoom(pinchRef.current.zoom * (distance / pinchRef.current.distance)));
            return;
          }
          const drag = dragRef.current;
          if (!drag) return;
          setRotation({
            x: Math.max(-0.78, Math.min(0.62, drag.rx + (event.clientY - drag.y) * 0.008)),
            y: drag.ry + (event.clientX - drag.x) * 0.012,
          });
        }}
        onPointerUp={(event) => {
          pointersRef.current.delete(event.pointerId);
          if (pointersRef.current.size < 2) pinchRef.current = null;
          if (pointersRef.current.size === 0) dragRef.current = null;
        }}
        onPointerCancel={(event) => {
          pointersRef.current.delete(event.pointerId);
          pinchRef.current = null;
          dragRef.current = null;
        }}
        onWheel={(event) => {
          event.preventDefault();
          setZoom((value) => clampZoom(value - event.deltaY * 0.0008));
        }}
      />

      <div className="abags-pro3d-chip">MODEL 3D · OBRÓT 360°</div>
      <div className="abags-pro3d-view-controls" aria-label="Widok modelu 3D">
        <button type="button" onClick={() => setView("front")}>Przód</button>
        <button type="button" onClick={() => setView("three")}>3/4</button>
        <button type="button" onClick={() => setView("side")}>Bok</button>
      </div>

      <div className="abags-pro3d-zoom" aria-label="Oddalenie modelu 3D">
        <button type="button" onClick={() => setZoom((value) => clampZoom(value - 0.1))} aria-label="Oddal model">−</button>
        <span>ODDAL</span>
        <input
          type="range"
          min={45}
          max={128}
          step={1}
          value={Math.round(zoom * 100)}
          onChange={(event) => setZoom(clampZoom(Number(event.currentTarget.value) / 100))}
          aria-label="Skala modelu 3D"
        />
        <span>PRZYBLIŻ</span>
        <button type="button" onClick={() => setZoom((value) => clampZoom(value + 0.1))} aria-label="Przybliż model">+</button>
        <button type="button" className="abags-pro3d-reset" onClick={() => setZoom(DEFAULT_ZOOM)}>{Math.round(zoom * 100)}%</button>
      </div>

      <p className="abags-pro3d-hint">1 palec: obrót 360° · 2 palce: zoom · wybierz „Bok”, aby zobaczyć rzeczywistą głębokość.</p>
    </div>,
    stage,
  );
}
