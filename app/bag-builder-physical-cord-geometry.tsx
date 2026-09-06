"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS } from "../lib/abags-fidelity-v4-family-spec";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Stitch = "" | "classic" | "herringbone" | "basket" | "shell";
type Rotation = { x: number; y: number };
type TransformDetail = { rotation?: Rotation; zoom?: number };
type Point3 = [number, number, number];
type MeshData = { positions: number[]; normals: number[]; uvs: number[] };
type FamilySpec = (typeof ABAGS_FIDELITY_V4_FAMILY_SPECS)[Exclude<Family, "">];
type Renderer = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  position: WebGLBuffer;
  normal: WebGLBuffer;
  uv: WebGLBuffer;
  count: number;
  meshKey: string;
  attribs: { position: number; normal: number; uv: number };
  uniforms: {
    projection: WebGLUniformLocation;
    view: WebGLUniformLocation;
    model: WebGLUniformLocation;
    color: WebGLUniformLocation;
    light: WebGLUniformLocation;
  };
};

type Config = { family: Family; stitch: Stitch; color: string };

const STAGE_SELECTOR = ".abags-bag-builder-stage";
const LAYER_SELECTOR = ".abags-fidelity3d-layer";
const DEFAULT_ROTATION: Rotation = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const SURFACE_VERSION = "physical-cord-geometry-v1-volumetric-loops";
const SURFACE_INSET = 0.055;
const TUBE_SEGMENTS = 8;

const VERTEX = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
void main(){
  vec4 world=uModel*vec4(aPosition,1.0);
  vWorld=world.xyz;
  vNormal=normalize(mat3(uModel)*aNormal);
  vUv=aUv;
  gl_Position=uProjection*uView*world;
}`;

const FRAGMENT = `
precision mediump float;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
uniform vec3 uColor;
uniform vec3 uLight;
void main(){
  vec3 n=normalize(vNormal);
  vec3 lightDir=normalize(uLight);
  vec3 viewDir=normalize(vec3(0.0,.10,5.8)-vWorld);
  vec3 halfDir=normalize(lightDir+viewDir);
  float diffuse=max(dot(n,lightDir),0.0);
  float fill=max(dot(n,normalize(vec3(.55,.22,.82))),0.0);
  float crown=pow(max(dot(n,halfDir),0.0),24.0);
  float rim=pow(1.0-max(dot(n,viewDir),0.0),3.1);
  float filament=.985+.010*sin(vUv.x*1120.0+vUv.y*73.0)+.006*sin((vUv.x-vUv.y)*1710.0);
  vec3 base=uColor*filament;
  vec3 lit=base*(.29+.72*diffuse+.12*fill)+vec3(.055*crown+.012*rim);
  gl_FragColor=vec4(pow(max(lit,vec3(0.0)),vec3(.96)),.985);
}`;

function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function multiply(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

function translation(x: number, y: number, z: number) {
  const out = identity();
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

function scale(x: number, y: number, z: number) {
  const out = identity();
  out[0] = x; out[5] = y; out[10] = z;
  return out;
}

function rotX(angle: number) {
  const out = identity();
  const c = Math.cos(angle), s = Math.sin(angle);
  out[5] = c; out[6] = s; out[9] = -s; out[10] = c;
  return out;
}

function rotY(angle: number) {
  const out = identity();
  const c = Math.cos(angle), s = Math.sin(angle);
  out[0] = c; out[2] = -s; out[8] = s; out[10] = c;
  return out;
}

function perspective(fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function hex(value: string): [number, number, number] {
  const raw = value.replace("#", "").padEnd(6, "0").slice(0, 6);
  const parsed = Number.parseInt(raw || "eadfd7", 16);
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255];
}

function halfWidthAtY(spec: FamilySpec, y: number) {
  const normalizedY = Math.min(0.999, Math.abs(y / Math.max(spec.ry, 0.001)));
  const residual = Math.max(0, 1 - Math.pow(normalizedY, spec.power));
  const base = spec.rx * Math.pow(residual, 1 / spec.power);
  return base * (1 + spec.taper * (y / spec.ry));
}

/* A-Bags 1:1 safety contract: all physical cord geometry stays inset from the
   Fidelity V4 contour. It may rise in Z, but it cannot alter width/height silhouette. */
function mapToBody(spec: FamilySpec, nx: number, ny: number): [number, number] {
  const safeNy = Math.max(-0.84, Math.min(0.84, ny));
  const y = safeNy * spec.ry;
  const halfWidth = halfWidthAtY(spec, y) * (1 - SURFACE_INSET);
  const safeNx = Math.max(-0.91, Math.min(0.91, nx));
  return [safeNx * halfWidth, y];
}

function addVertex(data: MeshData, position: Point3, normal: Point3, uv: [number, number]) {
  data.positions.push(...position);
  data.normals.push(...normal);
  data.uvs.push(...uv);
}

function addTube(data: MeshData, a: Point3, b: Point3, radius: number, phase = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const length = Math.hypot(dx, dy, dz) || 1;
  const axis: Point3 = [dx / length, dy / length, dz / length];
  let side: Point3 = [-axis[1], axis[0], 0];
  const sideLength = Math.hypot(...side) || 1;
  side = [side[0] / sideLength, side[1] / sideLength, side[2] / sideLength];
  const depth: Point3 = [
    axis[1] * side[2] - axis[2] * side[1],
    axis[2] * side[0] - axis[0] * side[2],
    axis[0] * side[1] - axis[1] * side[0],
  ];

  const ring = (point: Point3, ringIndex: number, progress: number) => {
    const angle = (ringIndex / TUBE_SEGMENTS) * Math.PI * 2 + phase;
    const c = Math.cos(angle), s = Math.sin(angle);
    const normal: Point3 = [
      side[0] * c + depth[0] * s,
      side[1] * c + depth[1] * s,
      side[2] * c + depth[2] * s,
    ];
    const position: Point3 = [
      point[0] + normal[0] * radius,
      point[1] + normal[1] * radius,
      point[2] + normal[2] * radius,
    ];
    return { position, normal, uv: [progress, ringIndex / TUBE_SEGMENTS] as [number, number] };
  };

  for (let ringIndex = 0; ringIndex < TUBE_SEGMENTS; ringIndex += 1) {
    const next = ringIndex + 1;
    const v0 = ring(a, ringIndex, 0), v1 = ring(b, ringIndex, 1);
    const v2 = ring(b, next, 1), v3 = ring(a, next, 0);
    addVertex(data, v0.position, v0.normal, v0.uv);
    addVertex(data, v1.position, v1.normal, v1.uv);
    addVertex(data, v2.position, v2.normal, v2.uv);
    addVertex(data, v0.position, v0.normal, v0.uv);
    addVertex(data, v2.position, v2.normal, v2.uv);
    addVertex(data, v3.position, v3.normal, v3.uv);
  }
}

function addMappedTube(
  data: MeshData,
  spec: FamilySpec,
  a: [number, number],
  b: [number, number],
  z: number,
  radius: number,
  phase = 0,
) {
  const pa = mapToBody(spec, a[0], a[1]);
  const pb = mapToBody(spec, b[0], b[1]);
  addTube(data, [pa[0], pa[1], z], [pb[0], pb[1], z], radius, phase);
}

function deterministicDrift(row: number, column: number, salt: number) {
  const wave = Math.sin((row + 3) * 12.9898 + (column + 7) * 78.233 + salt * 3.117);
  return wave - Math.trunc(wave);
}

function buildOpenV(data: MeshData, spec: FamilySpec, side: 1 | -1, radius: number) {
  const z = side * (spec.depth / 2 + radius * 0.34);
  const rows = 9, columns = 7;
  const dx = 1.48 / columns, dy = 1.48 / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const stagger = row % 2 ? dx * 0.5 : 0;
      const cx = -0.74 + (column + 0.5) * dx + stagger;
      if (cx > 0.84) continue;
      const cy = -0.72 + (row + 0.5) * dy;
      const drift = deterministicDrift(row, column, 11) * 0.014;
      const bottomY = cy - dy * 0.42, crownY = cy + dy * 0.34;
      addMappedTube(data, spec, [cx - dx * 0.42 + drift, bottomY], [cx, crownY], z, radius, 0.10);
      addMappedTube(data, spec, [cx + dx * 0.42 + drift, bottomY], [cx, crownY], z + side * radius * 0.10, radius, -0.08);
      addMappedTube(data, spec, [cx, crownY], [cx - dx * 0.29, crownY + dy * 0.15], z, radius * 0.91, 0.04);
      addMappedTube(data, spec, [cx, crownY], [cx + dx * 0.29, crownY + dy * 0.15], z, radius * 0.91, -0.04);
    }
  }
}

function buildVerticalOpen(data: MeshData, spec: FamilySpec, side: 1 | -1, radius: number) {
  const baseZ = side * (spec.depth / 2 + radius * 0.30);
  const rows = 10, columns = 7;
  const dx = 1.48 / columns, dy = 1.50 / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cx = -0.74 + (column + 0.5) * dx + (row % 2 ? dx * 0.46 : 0);
      if (cx > 0.84) continue;
      const cy = -0.73 + (row + 0.5) * dy;
      const drift = deterministicDrift(row, column, 23) * 0.012;
      const lower = cy - dy * 0.43, mid = cy - dy * 0.05, upper = cy + dy * 0.42;
      addMappedTube(data, spec, [cx - dx * 0.43 + drift, lower], [cx - dx * 0.08, mid], baseZ, radius, 0.08);
      addMappedTube(data, spec, [cx + dx * 0.43 + drift, lower], [cx + dx * 0.08, mid], baseZ, radius, -0.08);
      addMappedTube(data, spec, [cx - dx * 0.08, mid], [cx + dx * 0.31, upper], baseZ + side * radius * 0.15, radius * 0.94, 0.03);
      addMappedTube(data, spec, [cx + dx * 0.08, mid], [cx - dx * 0.31, upper], baseZ, radius * 0.94, -0.03);
    }
  }
}

function buildBasket(data: MeshData, spec: FamilySpec, side: 1 | -1, radius: number) {
  const rows = 8, columns = 7;
  const dx = 1.50 / columns, dy = 1.48 / rows;
  const outerBase = spec.depth / 2;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cx = -0.75 + (column + 0.5) * dx;
      const cy = -0.72 + (row + 0.5) * dy;
      const driftX = deterministicDrift(row, column, 31) * 0.010;
      const driftY = deterministicDrift(row, column, 37) * 0.010;
      const overHorizontal = (row + column) % 2 === 0;
      const overZ = side * (outerBase + radius * 0.72);
      const underZ = side * (outerBase + radius * 0.16);
      const gapX = dx * 0.16, gapY = dy * 0.16;

      if (overHorizontal) {
        addMappedTube(data, spec, [cx - dx * 0.50, cy + driftY], [cx + dx * 0.50, cy + driftY], overZ, radius, 0.03);
        addMappedTube(data, spec, [cx + driftX, cy - dy * 0.50], [cx + driftX, cy - gapY], underZ, radius * 0.92, -0.02);
        addMappedTube(data, spec, [cx + driftX, cy + gapY], [cx + driftX, cy + dy * 0.50], underZ, radius * 0.92, -0.02);
      } else {
        addMappedTube(data, spec, [cx + driftX, cy - dy * 0.50], [cx + driftX, cy + dy * 0.50], overZ, radius, -0.03);
        addMappedTube(data, spec, [cx - dx * 0.50, cy + driftY], [cx - gapX, cy + driftY], underZ, radius * 0.92, 0.02);
        addMappedTube(data, spec, [cx + gapX, cy + driftY], [cx + dx * 0.50, cy + driftY], underZ, radius * 0.92, 0.02);
      }
    }
  }
}

function buildRadial(data: MeshData, spec: FamilySpec, side: 1 | -1, radius: number) {
  const z = side * (spec.depth / 2 + radius * 0.32);
  const spokes = 14;
  for (let spoke = 0; spoke < spokes; spoke += 1) {
    const angle = (spoke / spokes) * Math.PI * 2;
    let previous: [number, number] = [Math.cos(angle) * 0.12, Math.sin(angle) * 0.12];
    for (let step = 1; step <= 4; step += 1) {
      const r = 0.12 + step * 0.145;
      const current: [number, number] = [Math.cos(angle) * r, Math.sin(angle) * r];
      addMappedTube(data, spec, previous, current, z + side * (spoke % 2) * radius * 0.08, radius * 0.92, angle * 0.05);
      previous = current;
    }
  }
  for (const ringRadius of [0.27, 0.43, 0.59]) {
    const segments = 38;
    for (let segment = 0; segment < segments; segment += 1) {
      const a = (segment / segments) * Math.PI * 2;
      const b = ((segment + 1) / segments) * Math.PI * 2;
      addMappedTube(
        data,
        spec,
        [Math.cos(a) * ringRadius, Math.sin(a) * ringRadius],
        [Math.cos(b) * ringRadius, Math.sin(b) * ringRadius],
        z + side * radius * 0.08,
        radius * 0.82,
        a * 0.04,
      );
    }
  }
}

function buildPhysicalCordGeometry(family: Exclude<Family, "">, stitch: Stitch) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const data: MeshData = { positions: [], normals: [], uvs: [] };
  const radius = Math.max(0.020, Math.min(0.033, Math.min(spec.rx, spec.ry) * 0.031));
  for (const side of [1, -1] as const) {
    if (stitch === "herringbone") buildVerticalOpen(data, spec, side, radius);
    else if (stitch === "basket") buildBasket(data, spec, side, radius);
    else if (stitch === "shell") buildRadial(data, spec, side, radius);
    else buildOpenV(data, spec, side, radius);
  }
  return data;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Nie udało się utworzyć shadera Physical Cord 3D.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Błąd shadera Physical Cord 3D.");
  }
  return shader;
}

function init(canvas: HTMLCanvasElement): Renderer {
  const gl = canvas.getContext("webgl", {
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  if (!gl) throw new Error("WebGL nie jest dostępny dla Physical Cord 3D.");
  const program = gl.createProgram();
  if (!program) throw new Error("Nie udało się utworzyć programu Physical Cord 3D.");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Błąd linkowania Physical Cord 3D.");
  }
  gl.useProgram(program);
  const position = gl.createBuffer(), normal = gl.createBuffer(), uv = gl.createBuffer();
  if (!position || !normal || !uv) throw new Error("Nie udało się utworzyć buforów Physical Cord 3D.");
  const attribute = (name: string) => {
    const value = gl.getAttribLocation(program, name);
    if (value < 0) throw new Error(`Brak atrybutu ${name}.`);
    return value;
  };
  const uniform = (name: string) => {
    const value = gl.getUniformLocation(program, name);
    if (value === null) throw new Error(`Brak uniformu ${name}.`);
    return value;
  };
  return {
    gl, program, position, normal, uv, count: 0, meshKey: "",
    attribs: { position: attribute("aPosition"), normal: attribute("aNormal"), uv: attribute("aUv") },
    uniforms: {
      projection: uniform("uProjection"), view: uniform("uView"), model: uniform("uModel"),
      color: uniform("uColor"), light: uniform("uLight"),
    },
  };
}

function uploadMesh(renderer: Renderer, family: Exclude<Family, "">, stitch: Stitch) {
  const key = `${family}:${stitch || "classic"}`;
  if (renderer.meshKey === key) return;
  const data = buildPhysicalCordGeometry(family, stitch);
  const { gl } = renderer;
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.position);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.normal);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.uv);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.uvs), gl.STATIC_DRAW);
  renderer.count = data.positions.length / 3;
  renderer.meshKey = key;
}

function readConfig(stage: HTMLElement): Config {
  return {
    family: (stage.dataset.family || "") as Family,
    stitch: (stage.dataset.stitch || "classic") as Stitch,
    color: stage.dataset.color || "#eadfd7",
  };
}

function draw(renderer: Renderer, canvas: HTMLCanvasElement, config: Config, rotation: Rotation, zoom: number) {
  if (!config.family) return;
  uploadMesh(renderer, config.family as Exclude<Family, "">, config.stitch);
  const { gl, attribs, uniforms } = renderer;
  const ratio = Math.min(window.devicePixelRatio || 1, window.innerWidth <= 620 ? 1.35 : 1.75);
  const width = Math.max(2, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(2, Math.floor(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);
  gl.useProgram(renderer.program);

  const aspect = width / Math.max(1, height);
  const narrow = aspect < 0.82;
  const cameraZ = narrow ? -6.45 : aspect < 1.15 ? -5.85 : -5.25;
  const verticalOffset = narrow ? -0.08 : -0.03;
  gl.uniformMatrix4fv(uniforms.projection, false, perspective(Math.PI / 5.15, aspect, 0.1, 100));
  gl.uniformMatrix4fv(uniforms.view, false, translation(0, verticalOffset, cameraZ));
  gl.uniform3fv(uniforms.light, new Float32Array([-0.55, 0.95, 1.25]));
  gl.uniform3fv(uniforms.color, new Float32Array(hex(config.color)));

  const fit = narrow ? 0.92 : aspect < 1.15 ? 0.97 : 1;
  const rootScale = zoom * fit;
  const root = multiply(rotY(rotation.y), multiply(rotX(rotation.x), scale(rootScale, rootScale, rootScale)));
  gl.uniformMatrix4fv(uniforms.model, false, root);

  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.position);
  gl.enableVertexAttribArray(attribs.position);
  gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.normal);
  gl.enableVertexAttribArray(attribs.normal);
  gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.uv);
  gl.enableVertexAttribArray(attribs.uv);
  gl.vertexAttribPointer(attribs.uv, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, renderer.count);
  gl.finish();
}

export default function BagBuilderPhysicalCordGeometry() {
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const rotationRef = useRef<Rotation>(DEFAULT_ROTATION);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const frameRef = useRef<number | null>(null);
  const version = useMemo(() => SURFACE_VERSION, []);

  useEffect(() => {
    const findLayer = () => {
      const stage = document.querySelector<HTMLElement>(STAGE_SELECTOR);
      const next = stage?.querySelector<HTMLElement>(`:scope > ${LAYER_SELECTOR}`) ?? null;
      setLayer((current) => current === next ? current : next);
    };
    findLayer();
    const observer = new MutationObserver(findLayer);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!layer) return;
    const stage = layer.closest<HTMLElement>(STAGE_SELECTOR);
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    try {
      rendererRef.current = init(canvas);
      stage.dataset.abagsPhysicalCordGeometry = "initialised";
      stage.removeAttribute("data-abags-physical-cord-geometry-error");
    } catch (error) {
      stage.dataset.abagsPhysicalCordGeometryError = error instanceof Error ? error.message.slice(0, 180) : "init-failed";
      rendererRef.current = null;
      return;
    }

    const clear = () => {
      const renderer = rendererRef.current;
      if (renderer) {
        renderer.gl.clearColor(0, 0, 0, 0);
        renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT | renderer.gl.DEPTH_BUFFER_BIT);
      }
      stage.removeAttribute("data-abags-physical-cord-geometry");
    };

    const syncTransform = () => {
      const x = Number(stage.dataset.abagsFidelity3dRotationX);
      const y = Number(stage.dataset.abagsFidelity3dRotationY);
      const nextZoom = Number(stage.dataset.abagsFidelity3dZoom);
      if (Number.isFinite(x) && Number.isFinite(y)) rotationRef.current = { x, y };
      if (Number.isFinite(nextZoom) && nextZoom > 0) zoomRef.current = nextZoom;
    };

    const paint = () => {
      frameRef.current = null;
      if (
        stage.dataset.abagsPhotoTrue === "active" ||
        stage.dataset.abagsFinal3d !== "ready" ||
        stage.dataset.abagsAgataCordWebgl !== "agata-cord-webgl-v1-photo-calibrated"
      ) {
        clear();
        return;
      }
      const renderer = rendererRef.current;
      if (!renderer) return;
      syncTransform();
      const config = readConfig(stage);
      if (!config.family) { clear(); return; }
      try {
        draw(renderer, canvas, config, rotationRef.current, zoomRef.current);
        stage.dataset.abagsPhysicalCordGeometry = SURFACE_VERSION;
        stage.removeAttribute("data-abags-physical-cord-geometry-error");
      } catch (error) {
        stage.dataset.abagsPhysicalCordGeometryError = error instanceof Error ? error.message.slice(0, 180) : "draw-failed";
        clear();
      }
    };

    const schedule = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(paint);
    };

    const onTransform = (event: Event) => {
      const detail = (event as CustomEvent<TransformDetail>).detail;
      if (detail?.rotation) rotationRef.current = detail.rotation;
      if (typeof detail?.zoom === "number" && detail.zoom > 0) zoomRef.current = detail.zoom;
      schedule();
    };

    const observer = new MutationObserver(schedule);
    observer.observe(stage, { attributes: true, attributeFilter: [
      "data-family", "data-color", "data-stitch", "data-abags-final3d", "data-abags-photo-true",
      "data-abags-agata-cord-webgl", "data-abags-fidelity3d-frame-at",
      "data-abags-fidelity3d-rotation-x", "data-abags-fidelity3d-rotation-y", "data-abags-fidelity3d-zoom",
    ] });
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    resizeObserver?.observe(layer);
    stage.addEventListener("abags:fidelity3d-transform", onTransform as EventListener);
    window.addEventListener("resize", schedule);
    schedule();

    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
      stage.removeEventListener("abags:fidelity3d-transform", onTransform as EventListener);
      window.removeEventListener("resize", schedule);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      stage.removeAttribute("data-abags-physical-cord-geometry");
      stage.removeAttribute("data-abags-physical-cord-geometry-error");
      rendererRef.current = null;
    };
  }, [layer]);

  if (!layer) return null;
  return createPortal(
    <canvas
      ref={canvasRef}
      className="abags-physical-cord-geometry"
      data-physical-cord-version={version}
      aria-hidden="true"
    />,
    layer,
  );
}
