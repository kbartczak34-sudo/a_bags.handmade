"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Stitch = "" | "classic" | "herringbone" | "basket" | "shell";
type Flap = "none" | "crochet" | "leather-black" | "leather-cognac" | "suede-burgundy";
type Handles = "none" | "wood-light" | "wood-dark" | "crochet";
type Strap = "none" | "leather" | "woven" | "chain";
type Hardware = "gold" | "silver" | "black";
type Accent = "none" | "tassel" | "scarf" | "charm";

type Config = {
  family: Family;
  color: string;
  stitch: Stitch;
  flap: Flap;
  handles: Handles;
  strap: Strap;
  hardware: Hardware;
  accent: Accent;
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
  uniforms: Record<"projection" | "view" | "model" | "color" | "material" | "stitch" | "relief" | "light", WebGLUniformLocation>;
};

type Point = [number, number];

type Profile = {
  depth: number;
  bodyY: number;
  topY: number;
  frontZ: number;
  width: number;
  handleScale: number;
  flapScale: [number, number, number];
  flapY: number;
  lockY: number;
  sideX: number;
  accentX: number;
  accentY: number;
};

const EMPTY: Config = {
  family: "",
  color: "",
  stitch: "",
  flap: "none",
  handles: "none",
  strap: "none",
  hardware: "gold",
  accent: "none",
};

const DEFAULT_ROTATION = { x: -0.08, y: 0.52 };
const DEFAULT_ZOOM = 0.8;
const MIN_ZOOM = 0.38;
const MAX_ZOOM = 1.35;

const PROFILES: Record<Exclude<Family, "">, Profile> = {
  tote: { depth: 0.5, bodyY: -0.12, topY: 0.74, frontZ: 0.29, width: 1.03, handleScale: 1, flapScale: [0.82, 0.72, 1], flapY: 0.34, lockY: 0.17, sideX: 1.02, accentX: -0.91, accentY: 0.34 },
  round: { depth: 0.52, bodyY: -0.13, topY: 0.55, frontZ: 0.3, width: 1.0, handleScale: 0.94, flapScale: [0.8, 0.72, 1], flapY: 0.28, lockY: 0.1, sideX: 0.94, accentX: -0.86, accentY: 0.27 },
  bucket: { depth: 0.52, bodyY: -0.12, topY: 0.78, frontZ: 0.3, width: 0.9, handleScale: 0.88, flapScale: [0.72, 0.68, 1], flapY: 0.4, lockY: 0.2, sideX: 0.88, accentX: -0.82, accentY: 0.34 },
  mini: { depth: 0.42, bodyY: -0.1, topY: 0.62, frontZ: 0.25, width: 0.77, handleScale: 0.78, flapScale: [0.66, 0.62, 1], flapY: 0.29, lockY: 0.12, sideX: 0.76, accentX: -0.69, accentY: 0.28 },
};

function readConfig(stage: HTMLElement): Config {
  return {
    family: (stage.dataset.family || "") as Family,
    color: stage.dataset.color || "",
    stitch: (stage.dataset.stitch || "") as Stitch,
    flap: (stage.dataset.flap || "none") as Flap,
    handles: (stage.dataset.handles || "none") as Handles,
    strap: (stage.dataset.strap || "none") as Strap,
    hardware: (stage.dataset.hardware || "gold") as Hardware,
    accent: (stage.dataset.accent || "none") as Accent,
  };
}

function sameConfig(a: Config, b: Config) {
  return (Object.keys(a) as Array<keyof Config>).every((key) => a[key] === b[key]);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
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

function matrix(position: [number, number, number], size: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) {
  return multiply(translation(...position), multiply(rotZ(rotation[2]), multiply(rotY(rotation[1]), multiply(rotX(rotation[0]), scale(...size)))));
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
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function quad(points: Point[], a: Point, control: Point, b: Point, steps = 10) {
  for (let i = 0; i < steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    points.push([
      mt * mt * a[0] + 2 * mt * t * control[0] + t * t * b[0],
      mt * mt * a[1] + 2 * mt * t * control[1] + t * t * b[1],
    ]);
  }
}

function familyContour(family: Exclude<Family, "">): Point[] {
  const p: Point[] = [];
  if (family === "tote") {
    quad(p, [-0.96, 0.76], [0, 0.83], [0.96, 0.76], 16);
    quad(p, [0.96, 0.76], [1.08, 0.05], [1.0, -0.62], 14);
    quad(p, [1.0, -0.62], [0.58, -0.79], [0, -0.78], 10);
    quad(p, [0, -0.78], [-0.58, -0.79], [-1.0, -0.62], 10);
    quad(p, [-1.0, -0.62], [-1.08, 0.05], [-0.96, 0.76], 14);
    return p;
  }
  if (family === "round") {
    quad(p, [-0.82, 0.52], [0, 0.61], [0.82, 0.52], 14);
    quad(p, [0.82, 0.52], [1.05, 0.25], [1.02, -0.03], 9);
    quad(p, [1.02, -0.03], [0.96, -0.56], [0.42, -0.73], 12);
    quad(p, [0.42, -0.73], [0, -0.84], [-0.42, -0.73], 10);
    quad(p, [-0.42, -0.73], [-0.96, -0.56], [-1.02, -0.03], 12);
    quad(p, [-1.02, -0.03], [-1.05, 0.25], [-0.82, 0.52], 9);
    return p;
  }
  if (family === "bucket") {
    quad(p, [-0.7, 0.8], [0, 0.87], [0.7, 0.8], 14);
    quad(p, [0.7, 0.8], [0.82, 0.14], [0.94, -0.56], 14);
    quad(p, [0.94, -0.56], [0.5, -0.82], [0, -0.79], 10);
    quad(p, [0, -0.79], [-0.5, -0.82], [-0.94, -0.56], 10);
    quad(p, [-0.94, -0.56], [-0.82, 0.14], [-0.7, 0.8], 14);
    return p;
  }
  quad(p, [-0.72, 0.64], [0, 0.7], [0.72, 0.64], 14);
  quad(p, [0.72, 0.64], [0.82, 0.02], [0.74, -0.55], 12);
  quad(p, [0.74, -0.55], [0.39, -0.72], [0, -0.7], 9);
  quad(p, [0, -0.7], [-0.39, -0.72], [-0.74, -0.55], 9);
  quad(p, [-0.74, -0.55], [-0.82, 0.02], [-0.72, 0.64], 12);
  return p;
}

function flapContour(): Point[] {
  const p: Point[] = [];
  quad(p, [-0.94, 0.4], [0, 0.46], [0.94, 0.4], 16);
  quad(p, [0.94, 0.4], [0.9, 0.04], [0.67, -0.27], 8);
  quad(p, [0.67, -0.27], [0.35, -0.56], [0, -0.64], 10);
  quad(p, [0, -0.64], [-0.35, -0.56], [-0.67, -0.27], 10);
  quad(p, [-0.67, -0.27], [-0.9, 0.04], [-0.94, 0.4], 8);
  return p;
}

function makeExtrudedContour(contour: Point[], depth: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const half = depth / 2;
  const xs = contour.map((point) => point[0]);
  const ys = contour.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cx = contour.reduce((sum, point) => sum + point[0], 0) / contour.length;
  const cy = contour.reduce((sum, point) => sum + point[1], 0) / contour.length;

  const uv = (point: Point) => [(point[0] - minX) / Math.max(0.001, maxX - minX), (point[1] - minY) / Math.max(0.001, maxY - minY)] as const;

  const frontCenter = positions.length / 3;
  positions.push(cx, cy, half); normals.push(0, 0, 1); uvs.push(0.5, 0.5);
  const frontStart = positions.length / 3;
  contour.forEach((point) => { const [u, v] = uv(point); positions.push(point[0], point[1], half); normals.push(0, 0, 1); uvs.push(u, v); });

  const backCenter = positions.length / 3;
  positions.push(cx, cy, -half); normals.push(0, 0, -1); uvs.push(0.5, 0.5);
  const backStart = positions.length / 3;
  contour.forEach((point) => { const [u, v] = uv(point); positions.push(point[0], point[1], -half); normals.push(0, 0, -1); uvs.push(u, v); });

  for (let i = 0; i < contour.length; i += 1) {
    const next = (i + 1) % contour.length;
    indices.push(frontCenter, frontStart + i, frontStart + next);
    indices.push(backCenter, backStart + next, backStart + i);
  }

  const sideStart = positions.length / 3;
  for (let i = 0; i < contour.length; i += 1) {
    const next = (i + 1) % contour.length;
    const a = contour[i];
    const b = contour[next];
    const [nx, ny] = normalize(b[1] - a[1], -(b[0] - a[0]), 0);
    const edgeU = i / contour.length;
    positions.push(a[0], a[1], half, a[0], a[1], -half, b[0], b[1], half, b[0], b[1], -half);
    normals.push(nx, ny, 0, nx, ny, 0, nx, ny, 0, nx, ny, 0);
    uvs.push(edgeU, 1, edgeU, 0, (i + 1) / contour.length, 1, (i + 1) / contour.length, 0);
    const base = sideStart + i * 4;
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }

  return { positions, normals, uvs, indices };
}

function makeArchTube(rx: number, ry: number, z: number, minor = 0.055, segments = 72, tube = 12, full = false) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const progress = i / segments;
    const t = full ? progress * Math.PI * 2 : Math.PI - progress * Math.PI;
    const cx = rx * Math.cos(t);
    const cy = ry * Math.sin(t);
    const tx = -rx * Math.sin(t);
    const ty = ry * Math.cos(t);
    const length = Math.hypot(tx, ty) || 1;
    const ux = tx / length;
    const uy = ty / length;
    for (let j = 0; j <= tube; j += 1) {
      const a = (j / tube) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nx = -uy * ca;
      const ny = ux * ca;
      const nz = sa;
      positions.push(cx + minor * nx, cy + minor * ny, z + minor * nz);
      normals.push(...normalize(nx, ny, nz));
      uvs.push(progress, j / tube);
    }
  }
  const stride = tube + 1;
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < tube; j += 1) {
      const a = i * stride + j;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions, normals, uvs, indices };
}

function makeEllipsoid(a: number, b: number, c: number, rows = 24, cols = 36) {
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
    for (let c = 0; c < cols; c += 1) {
      const a0 = r * stride + c;
      const b0 = a0 + stride;
      indices.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
    }
  }
  return { positions, normals, uvs, indices };
}

function makeCone(radius = 0.14, height = 0.55, segments = 32) {
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
float knit(vec2 uv,float m){
  if(m<.5){float a=sin((uv.x*1.15+uv.y*.7)*112.0);float b=sin((uv.x*.58-uv.y)*56.0);return a*.52+b*.22;}
  if(m<1.5){vec2 p=fract(uv*vec2(19.0,18.0));return .82-smoothstep(.05,.27,min(abs(p.x-p.y),abs(1.0-p.x-p.y)));}
  if(m<2.5){vec2 p=fract(uv*17.0);float x=1.0-smoothstep(.1,.34,abs(p.x-.5));float y=1.0-smoothstep(.1,.34,abs(p.y-.5));return max(x,y);}
  return sin(uv.x*70.0+sin(uv.y*34.0)*3.2)*.5+sin(uv.y*45.0)*.22;
}
void main(){
  float h=knit(aUv,uStitch)*uRelief;
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
  if(m<.5)a=.56+.24*sin((uv.x*1.15+uv.y*.7)*112.0)+.1*sin(uv.x*220.0);
  else if(m<1.5){vec2 p=fract(uv*vec2(19.0,18.0));a=.4+.5*(1.0-smoothstep(.06,.24,min(abs(p.x-p.y),abs(1.0-p.x-p.y))));}
  else if(m<2.5){vec2 p=fract(uv*17.0);float gx=1.0-smoothstep(.12,.34,abs(p.x-.5));float gy=1.0-smoothstep(.12,.34,abs(p.y-.5));a=.36+.48*max(gx,gy);}
  else a=.5+.29*sin(uv.x*70.0+sin(uv.y*34.0)*3.2)+.1*sin(uv.y*45.0);
  return clamp(a,.08,1.0);
}
void main(){
  vec3 n=normalize(vNormal),l=normalize(uLight),v=normalize(vec3(0.0,.2,5.4)-vWorld),h=normalize(l+v);
  float ndl=max(dot(n,l),0.0),ndh=max(dot(n,h),0.0);
  float rough=.9,metal=0.0,detail=1.0;
  if(uMaterial<.5){detail=.7+.46*yarn(vUv,uStitch)+.035*(hash(floor(vUv*vec2(190.0,170.0)))-.5);rough=.95;}
  else if(uMaterial<1.5){detail=.84+.13*sin(vUv.y*118.0+sin(vUv.x*18.0)*4.2);rough=.38;}
  else if(uMaterial<2.5){detail=.9+.055*(hash(floor(vUv*130.0))-.5)+.04*sin(vUv.y*52.0);rough=.56;}
  else if(uMaterial<3.5){detail=.72+.24*sin(vUv.x*72.0)*sin(vUv.y*38.0);rough=.8;}
  else{metal=.96;rough=.12;detail=1.0;}
  vec3 base=uColor*detail;
  float spec=pow(ndh,mix(88.0,8.0,rough))*mix(.08,.85,metal);
  float rim=pow(1.0-max(dot(n,v),0.0),2.0);
  float sideShade=.84+.16*max(n.z,0.0);
  vec3 color=base*(.3+.8*ndl)*sideShade+vec3(spec)+base*.08*(1.0-ndl)+vec3(.075)*rim;
  gl_FragColor=vec4(pow(color,vec3(.95)),1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "shader");
  return shader;
}

function createMesh(gl: WebGLRenderingContext, data: { positions: number[]; normals: number[]; uvs: number[]; indices: number[] }): Mesh {
  const position = gl.createBuffer();
  const normal = gl.createBuffer();
  const uv = gl.createBuffer();
  const index = gl.createBuffer();
  if (!position || !normal || !uv || !index) throw new Error("buffer");
  gl.bindBuffer(gl.ARRAY_BUFFER, position); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, normal); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, uv); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.uvs), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);
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
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "link");
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
      tote: createMesh(gl, makeExtrudedContour(familyContour("tote"), PROFILES.tote.depth)),
      round: createMesh(gl, makeExtrudedContour(familyContour("round"), PROFILES.round.depth)),
      bucket: createMesh(gl, makeExtrudedContour(familyContour("bucket"), PROFILES.bucket.depth)),
      mini: createMesh(gl, makeExtrudedContour(familyContour("mini"), PROFILES.mini.depth)),
      flap: createMesh(gl, makeExtrudedContour(flapContour(), 0.11)),
      woodHandle: createMesh(gl, makeArchTube(0.73, 0.76, 0, 0.065, 82, 14, true)),
      crochetHandle: createMesh(gl, makeArchTube(0.72, 0.72, 0, 0.06, 70, 12, false)),
      strap: createMesh(gl, makeArchTube(1.18, 1.62, 0, 0.044, 82, 12, false)),
      chain: createMesh(gl, makeArchTube(1.18, 1.62, 0, 0.026, 90, 10, false)),
      ring: createMesh(gl, makeArchTube(0.13, 0.13, 0, 0.025, 40, 9, true)),
      sphere: createMesh(gl, makeEllipsoid(1, 1, 1)),
      ribbon: createMesh(gl, makeEllipsoid(0.46, 0.14, 0.045, 18, 30)),
      cone: createMesh(gl, makeCone()),
    },
    attribs: {
      position: gl.getAttribLocation(program, "aPosition"),
      normal: gl.getAttribLocation(program, "aNormal"),
      uv: gl.getAttribLocation(program, "aUv"),
    },
    uniforms: {
      projection: req("uProjection"), view: req("uView"), model: req("uModel"), color: req("uColor"), material: req("uMaterial"), stitch: req("uStitch"), relief: req("uRelief"), light: req("uLight"),
    },
  };
}

function drawMesh(renderer: Renderer, mesh: Mesh, model: Float32Array, color: string, material: number, stitch: number, relief = 0) {
  const { gl, attribs, uniforms } = renderer;
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position); gl.enableVertexAttribArray(attribs.position); gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal); gl.enableVertexAttribArray(attribs.normal); gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv); gl.enableVertexAttribArray(attribs.uv); gl.vertexAttribPointer(attribs.uv, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
  gl.uniformMatrix4fv(uniforms.model, false, model);
  gl.uniform3fv(uniforms.color, hex(color));
  gl.uniform1f(uniforms.material, material);
  gl.uniform1f(uniforms.stitch, stitch);
  gl.uniform1f(uniforms.relief, relief);
  gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
}

function stitchId(stitch: Stitch) {
  return stitch === "herringbone" ? 1 : stitch === "basket" ? 2 : stitch === "shell" ? 3 : 0;
}

function draw(renderer: Renderer, canvas: HTMLCanvasElement, config: Config, rotation: { x: number; y: number }, zoom: number) {
  const { gl, uniforms, meshes } = renderer;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.uniformMatrix4fv(uniforms.projection, false, perspective(Math.PI / 5.3, width / height, 0.1, 100));
  gl.uniformMatrix4fv(uniforms.view, false, translation(0, -0.02, -5.0));
  gl.uniform3fv(uniforms.light, new Float32Array([-0.42, 0.86, 0.92]));
  if (!config.family) return;

  const profile = PROFILES[config.family];
  const root = multiply(scale(zoom, zoom, zoom), multiply(rotX(rotation.x), rotY(rotation.y)));
  const body = config.color || "#e8ddcc";
  const stitch = stitchId(config.stitch);
  const relief = config.color && config.stitch ? 0.028 : 0.006;
  drawMesh(renderer, meshes[config.family], multiply(root, matrix([0, profile.bodyY, 0], [1, 1, 1])), body, 0, stitch, relief);

  const openingColor = config.color ? body : "#d8cec4";
  drawMesh(renderer, meshes.ring, multiply(root, matrix([0, profile.topY + 0.01, 0], [profile.width * 5.3, 1.1, profile.depth * 1.08], [Math.PI / 2, 0, 0])), openingColor, 0, stitch, 0.008);

  if (config.strap !== "none") {
    const metal = config.hardware === "silver" ? "#d7dbe0" : config.hardware === "black" ? "#29272a" : "#caa55d";
    const strapColor = config.strap === "chain" ? metal : config.strap === "leather" ? "#6b4738" : "#a77d87";
    const material = config.strap === "chain" ? 4 : config.strap === "leather" ? 2 : 3;
    drawMesh(renderer, config.strap === "chain" ? meshes.chain : meshes.strap, multiply(root, matrix([0, profile.topY - 0.02, -profile.depth * 0.6], [profile.handleScale, 0.95, 1])), strapColor, material, stitch, 0);
  }

  if (config.handles !== "none") {
    const handleColor = config.handles === "wood-light" ? "#c99b63" : config.handles === "wood-dark" ? "#61331f" : body;
    const material = config.handles.startsWith("wood") ? 1 : 0;
    const mesh = config.handles.startsWith("wood") ? meshes.woodHandle : meshes.crochetHandle;
    const y = profile.topY + (config.handles.startsWith("wood") ? 0.28 : 0.02);
    const size = profile.handleScale;
    for (const z of [-profile.depth * 0.48, profile.depth * 0.48]) {
      drawMesh(renderer, mesh, multiply(root, matrix([0, y, z], [size, size, 1])), handleColor, material, stitch, config.handles === "crochet" ? 0.018 : 0);
    }
  }

  if (config.flap !== "none") {
    const flapColor = config.flap === "leather-black" ? "#242124" : config.flap === "leather-cognac" ? "#7c5034" : config.flap === "suede-burgundy" ? "#803248" : body;
    const material = config.flap === "crochet" ? 0 : 2;
    drawMesh(renderer, meshes.flap, multiply(root, matrix([0, profile.flapY, profile.frontZ + 0.04], profile.flapScale, [0.02, 0, 0])), flapColor, material, stitch, config.flap === "crochet" ? 0.018 : 0);
  }

  const metal = config.hardware === "silver" ? "#d7dbe0" : config.hardware === "black" ? "#29272a" : "#caa55d";
  const lockZ = profile.frontZ + 0.14;
  drawMesh(renderer, meshes.sphere, multiply(root, matrix([0, config.flap !== "none" ? profile.lockY : -0.47, lockZ], [0.105, 0.105, 0.07])), metal, 4, 0);

  if (config.strap !== "none") {
    for (const x of [-profile.sideX, profile.sideX]) {
      drawMesh(renderer, meshes.ring, multiply(root, matrix([x, profile.topY - 0.18, 0.02], [0.92, 1, 1], [0, Math.PI / 2, 0])), metal, 4, 0);
    }
  }

  drawMesh(renderer, meshes.sphere, multiply(root, matrix([0, -0.61, profile.frontZ + 0.08], [0.17, 0.047, 0.025])), config.hardware === "silver" ? "#cbd0d5" : "#b48a47", config.hardware === "black" ? 2 : 4, 0);

  if (config.accent === "tassel") {
    drawMesh(renderer, meshes.sphere, multiply(root, matrix([profile.accentX, profile.accentY + 0.03, profile.frontZ + 0.07], [0.075, 0.075, 0.055])), metal, 4, 0);
    drawMesh(renderer, meshes.cone, multiply(root, matrix([profile.accentX, profile.accentY - 0.27, profile.frontZ + 0.06], [0.95, 1.05, 0.95])), body, 0, stitch, 0.01);
  } else if (config.accent === "scarf") {
    drawMesh(renderer, meshes.ribbon, multiply(root, matrix([profile.accentX + 0.08, profile.accentY + 0.06, profile.frontZ + 0.12], [0.82, 1, 1], [0, 0, 0.52])), "#e9a8b7", 3, 0);
    drawMesh(renderer, meshes.ribbon, multiply(root, matrix([profile.accentX + 0.18, profile.accentY - 0.04, profile.frontZ + 0.13], [0.72, 1, 1], [0, 0, -0.5])), "#c8718a", 3, 0);
    drawMesh(renderer, meshes.sphere, multiply(root, matrix([profile.accentX + 0.13, profile.accentY + 0.02, profile.frontZ + 0.16], [0.09, 0.075, 0.05])), "#8c5666", 3, 0);
  } else if (config.accent === "charm") {
    drawMesh(renderer, meshes.sphere, multiply(root, matrix([profile.sideX * 0.92, -0.03, profile.frontZ + 0.09], [0.1, 0.15, 0.06])), "#b87880", 4, 0);
  }
}

export default function BagBuilderAtelier3D() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [config, setConfig] = useState<Config>(EMPTY);
  const [rotation, setRotation] = useState(DEFAULT_ROTATION);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [ready, setReady] = useState(false);
  const [view, setViewState] = useState<"front" | "three" | "side">("three");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    const find = () => setStage((current) => {
      const next = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
      return current === next ? current : next;
    });
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!stage) return;
    const sync = () => setConfig((current) => {
      const next = readConfig(stage);
      return sameConfig(current, next) ? current : next;
    });
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(stage, { attributes: true, attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"] });
    return () => observer.disconnect();
  }, [stage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rendererRef.current || !stage) return;
    try {
      rendererRef.current = init(canvas);
      if (rendererRef.current) {
        setReady(true);
        stage.classList.add("abags-pro3d-active", "abags-atelier3d-calibrated");
        stage.setAttribute("data-abags-pro3d-ready", "true");
        stage.setAttribute("data-abags-atelier3d-ready", "true");
      }
    } catch {
      rendererRef.current = null;
      setReady(false);
    }
    return () => {
      stage.classList.remove("abags-pro3d-active", "abags-atelier3d-calibrated");
      stage.removeAttribute("data-abags-pro3d-ready");
      stage.removeAttribute("data-abags-atelier3d-ready");
    };
  }, [stage]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;
    let frame = requestAnimationFrame(() => draw(renderer, canvas, config, rotation, zoom));
    const redraw = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => draw(renderer, canvas, config, rotation, zoom)); };
    window.addEventListener("resize", redraw);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", redraw); };
  }, [config, rotation, zoom, ready]);

  const label = useMemo(() => config.family ? "Kalibrowany model 3D tworzonej torebki A-Bags" : "Wybierz fason, aby rozpocząć model 3D", [config.family]);
  if (!stage) return null;

  const distance = () => {
    const points = Array.from(pointers.current.values());
    return points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const setView = (next: "front" | "three" | "side") => {
    setViewState(next);
    setRotation(next === "front" ? { x: -0.02, y: 0 } : next === "side" ? { x: -0.07, y: Math.PI / 2 } : DEFAULT_ROTATION);
  };

  return createPortal(
    <div className="abags-pro3d-layer abags-atelier3d-layer" data-abags-pro3d data-abags-atelier3d>
      <canvas
        ref={canvasRef}
        className="abags-pro3d-canvas abags-atelier3d-canvas"
        aria-label={label}
        onPointerDown={(event) => {
          event.preventDefault();
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          event.currentTarget.setPointerCapture?.(event.pointerId);
          if (pointers.current.size >= 2) { pinch.current = { distance: distance(), zoom }; drag.current = null; }
          else drag.current = { x: event.clientX, y: event.clientY, rx: rotation.x, ry: rotation.y };
        }}
        onPointerMove={(event) => {
          if (!pointers.current.has(event.pointerId)) return;
          event.preventDefault();
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointers.current.size >= 2 && pinch.current) {
            const next = distance();
            if (pinch.current.distance > 0) setZoom(clamp(pinch.current.zoom * (next / pinch.current.distance), MIN_ZOOM, MAX_ZOOM));
            return;
          }
          if (!drag.current) return;
          setViewState("three");
          setRotation({
            x: clamp(drag.current.rx + (event.clientY - drag.current.y) * 0.008, -0.72, 0.56),
            y: drag.current.ry + (event.clientX - drag.current.x) * 0.012,
          });
        }}
        onPointerUp={(event) => { pointers.current.delete(event.pointerId); if (pointers.current.size < 2) pinch.current = null; if (!pointers.current.size) drag.current = null; }}
        onPointerCancel={(event) => { pointers.current.delete(event.pointerId); pinch.current = null; drag.current = null; }}
        onWheel={(event) => { event.preventDefault(); setZoom((value) => clamp(value - event.deltaY * 0.0008, MIN_ZOOM, MAX_ZOOM)); }}
      />

      <div className="abags-pro3d-chip">PODGLĄD NA ŻYWO · MODEL ATELIER 3D</div>
      <div className="abags-pro3d-view-controls" aria-label="Widok modelu 3D">
        <button type="button" className={view === "front" ? "is-active" : ""} aria-pressed={view === "front"} onClick={() => setView("front")}>Przód</button>
        <button type="button" className={view === "three" ? "is-active" : ""} aria-pressed={view === "three"} onClick={() => setView("three")}>3/4</button>
        <button type="button" className={view === "side" ? "is-active" : ""} aria-pressed={view === "side"} onClick={() => setView("side")}>Bok</button>
      </div>

      <div className="abags-pro3d-zoom" aria-label="Zoom modelu 3D">
        <button type="button" onClick={() => setZoom((value) => clamp(value - 0.1, MIN_ZOOM, MAX_ZOOM))} aria-label="Oddal model">−</button>
        <span>ODDAL</span>
        <input type="range" min={38} max={135} step={1} value={Math.round(zoom * 100)} onChange={(event) => setZoom(clamp(Number(event.currentTarget.value) / 100, MIN_ZOOM, MAX_ZOOM))} aria-label="Skala modelu 3D" />
        <span>PRZYBLIŻ</span>
        <button type="button" onClick={() => setZoom((value) => clamp(value + 0.1, MIN_ZOOM, MAX_ZOOM))} aria-label="Przybliż model">+</button>
        <button type="button" className="abags-pro3d-reset" onClick={() => { setRotation(DEFAULT_ROTATION); setViewState("three"); setZoom(DEFAULT_ZOOM); }}>{Math.round(zoom * 100)}%</button>
      </div>

      <p className="abags-pro3d-hint">Obracaj jednym palcem · przybliżaj dwoma · fason, splot i dodatki aktualizują się bez przeładowania.</p>
    </div>,
    stage,
  );
}
