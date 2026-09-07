"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS } from "../lib/abags-fidelity-v4-family-spec";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Rotation = { x: number; y: number };
type TransformDetail = { rotation?: Rotation; zoom?: number };
type Point3 = [number, number, number];
type MeshData = { positions: number[]; normals: number[]; uvs: number[] };
type FamilySpec = (typeof ABAGS_FIDELITY_V4_FAMILY_SPECS)[Exclude<Family, "">];
type Config = { family: Family; stitch: string; color: string };
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

const STAGE_SELECTOR = ".abags-bag-builder-stage";
const LAYER_SELECTOR = ".abags-fidelity3d-layer";
const DEFAULT_ROTATION: Rotation = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const SURFACE_VERSION = "basket-physical-cord-v2-continuous-handmade-weave";
const SURFACE_INSET = 0.070;
const TUBE_SEGMENTS = 10;
const PATH_SAMPLES = 52;

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
  float fill=max(dot(n,normalize(vec3(.48,.25,.82))),0.0);
  float crown=pow(max(dot(n,halfDir),0.0),30.0);
  float rim=pow(1.0-max(dot(n,viewDir),0.0),3.4);
  float filament=.992+.006*sin(vUv.x*980.0+vUv.y*61.0)+.004*sin((vUv.x-vUv.y)*1510.0);
  vec3 base=uColor*filament;
  vec3 lit=base*(.36+.58*diffuse+.10*fill)+vec3(.034*crown+.008*rim);
  gl_FragColor=vec4(pow(max(lit,vec3(0.0)),vec3(.97)),.955);
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
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

function scale(x: number, y: number, z: number) {
  const out = identity();
  out[0] = x;
  out[5] = y;
  out[10] = z;
  return out;
}

function rotX(angle: number) {
  const out = identity();
  const c = Math.cos(angle), s = Math.sin(angle);
  out[5] = c;
  out[6] = s;
  out[9] = -s;
  out[10] = c;
  return out;
}

function rotY(angle: number) {
  const out = identity();
  const c = Math.cos(angle), s = Math.sin(angle);
  out[0] = c;
  out[2] = -s;
  out[8] = s;
  out[10] = c;
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

/* V2 is deliberately tighter than V1: the real 3D cord may rise in depth,
   but x/y remain inset from the locked Fidelity V4 product silhouette. */
function mapToBody(spec: FamilySpec, nx: number, ny: number): [number, number] {
  const safeNy = Math.max(-0.82, Math.min(0.82, ny));
  const y = safeNy * spec.ry;
  const halfWidth = halfWidthAtY(spec, y) * (1 - SURFACE_INSET);
  const safeNx = Math.max(-0.88, Math.min(0.88, nx));
  return [safeNx * halfWidth, y];
}

function addVertex(data: MeshData, position: Point3, normal: Point3, uv: [number, number]) {
  data.positions.push(...position);
  data.normals.push(...normal);
  data.uvs.push(...uv);
}

function normalize(point: Point3): Point3 {
  const length = Math.hypot(point[0], point[1], point[2]) || 1;
  return [point[0] / length, point[1] / length, point[2] / length];
}

function cross(a: Point3, b: Point3): Point3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/* A single sampled polyline creates one continuous tube. Adjacent samples share
   the same logical strand, removing the cell-by-cell block seams visible in V1. */
function addPolylineTube(data: MeshData, points: Point3[], radius: number, phase = 0) {
  if (points.length < 2) return;
  const rings = points.map((point, pointIndex) => {
    const previous = points[Math.max(0, pointIndex - 1)];
    const next = points[Math.min(points.length - 1, pointIndex + 1)];
    const tangent = normalize([next[0] - previous[0], next[1] - previous[1], next[2] - previous[2]]);
    let side = normalize([-tangent[1], tangent[0], 0]);
    if (Math.hypot(side[0], side[1], side[2]) < 0.01) side = [1, 0, 0];
    const depth = normalize(cross(tangent, side));
    return Array.from({ length: TUBE_SEGMENTS + 1 }, (_, ringIndex) => {
      const angle = (ringIndex / TUBE_SEGMENTS) * Math.PI * 2 + phase;
      const c = Math.cos(angle), s = Math.sin(angle);
      const normal: Point3 = normalize([
        side[0] * c + depth[0] * s,
        side[1] * c + depth[1] * s,
        side[2] * c + depth[2] * s,
      ]);
      const position: Point3 = [
        point[0] + normal[0] * radius,
        point[1] + normal[1] * radius,
        point[2] + normal[2] * radius,
      ];
      return { position, normal, uv: [pointIndex / (points.length - 1), ringIndex / TUBE_SEGMENTS] as [number, number] };
    });
  });

  for (let pointIndex = 0; pointIndex < rings.length - 1; pointIndex += 1) {
    for (let ringIndex = 0; ringIndex < TUBE_SEGMENTS; ringIndex += 1) {
      const a = rings[pointIndex][ringIndex];
      const b = rings[pointIndex + 1][ringIndex];
      const c = rings[pointIndex + 1][ringIndex + 1];
      const d = rings[pointIndex][ringIndex + 1];
      addVertex(data, a.position, a.normal, a.uv);
      addVertex(data, b.position, b.normal, b.uv);
      addVertex(data, c.position, c.normal, c.uv);
      addVertex(data, a.position, a.normal, a.uv);
      addVertex(data, c.position, c.normal, c.uv);
      addVertex(data, d.position, d.normal, d.uv);
    }
  }
}

function deterministicDrift(row: number, column: number, salt: number) {
  const wave = Math.sin((row + 3) * 12.9898 + (column + 7) * 78.233 + salt * 3.117);
  return wave - Math.trunc(wave);
}

function smoothCrossingWeight(distance: number) {
  const normalized = Math.max(0, Math.min(1, 1 - distance / 0.34));
  return normalized * normalized * (3 - 2 * normalized);
}

function handmadeWave(strand: number, t: number, salt: number) {
  return Math.sin(t * Math.PI * 2 + strand * 0.71 + salt) * 0.0045
    + Math.sin(t * Math.PI * 5 + strand * 0.37 + salt * 1.7) * 0.0022;
}

function buildContinuousBasket(data: MeshData, spec: FamilySpec, side: 1 | -1, radius: number) {
  const rows = 8, columns = 7;
  const minX = -0.76, maxX = 0.76;
  const minY = -0.70, maxY = 0.70;
  const outerBase = spec.depth / 2;
  const neutralLift = radius * 0.01;
  const overLift = radius * 0.28;
  const underSink = radius * -0.20;

  for (let row = 0; row < rows; row += 1) {
    const rowT = row / (rows - 1);
    const rowBase = minY + (maxY - minY) * rowT + deterministicDrift(row, 0, 41) * 0.010;
    const horizontalPoints: Point3[] = [];
    for (let sample = 0; sample <= PATH_SAMPLES; sample += 1) {
      const t = sample / PATH_SAMPLES;
      const nx = minX + (maxX - minX) * t;
      const columnFloat = t * (columns - 1);
      const column = Math.max(0, Math.min(columns - 1, Math.round(columnFloat)));
      const crossing = smoothCrossingWeight(Math.abs(columnFloat - column));
      const horizontalOver = (row + column) % 2 === 0;
      const target = horizontalOver ? overLift : underSink;
      const zOffset = neutralLift + (target - neutralLift) * crossing;
      const ny = rowBase + handmadeWave(row, t, 0.43) + deterministicDrift(row, sample, 53) * 0.0018;
      const [x, y] = mapToBody(spec, nx, ny);
      horizontalPoints.push([x, y, side * (outerBase + zOffset)]);
    }
    addPolylineTube(data, horizontalPoints, radius, 0.035 + row * 0.007);
  }

  for (let column = 0; column < columns; column += 1) {
    const columnT = column / (columns - 1);
    const columnBase = minX + (maxX - minX) * columnT + deterministicDrift(column, 0, 67) * 0.009;
    const verticalPoints: Point3[] = [];
    for (let sample = 0; sample <= PATH_SAMPLES; sample += 1) {
      const t = sample / PATH_SAMPLES;
      const ny = minY + (maxY - minY) * t;
      const rowFloat = t * (rows - 1);
      const row = Math.max(0, Math.min(rows - 1, Math.round(rowFloat)));
      const crossing = smoothCrossingWeight(Math.abs(rowFloat - row));
      const horizontalOver = (row + column) % 2 === 0;
      const verticalOver = !horizontalOver;
      const target = verticalOver ? overLift : underSink;
      const zOffset = neutralLift + (target - neutralLift) * crossing;
      const nx = columnBase + handmadeWave(column, t, 1.17) + deterministicDrift(sample, column, 79) * 0.0018;
      const [x, y] = mapToBody(spec, nx, ny);
      verticalPoints.push([x, y, side * (outerBase + zOffset)]);
    }
    addPolylineTube(data, verticalPoints, radius * 0.96, -0.03 - column * 0.006);
  }
}

function buildBasketGeometry(family: Exclude<Family, "">) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const data: MeshData = { positions: [], normals: [], uvs: [] };
  const radius = Math.max(0.017, Math.min(0.026, Math.min(spec.rx, spec.ry) * 0.024));
  for (const side of [1, -1] as const) buildContinuousBasket(data, spec, side, radius);
  return data;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Nie udało się utworzyć shadera Basket Cord V2.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Błąd shadera Basket Cord V2.");
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
  if (!gl) throw new Error("WebGL nie jest dostępny dla Basket Cord V2.");
  const program = gl.createProgram();
  if (!program) throw new Error("Nie udało się utworzyć programu Basket Cord V2.");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Błąd linkowania Basket Cord V2.");
  }
  gl.useProgram(program);
  const position = gl.createBuffer(), normal = gl.createBuffer(), uv = gl.createBuffer();
  if (!position || !normal || !uv) throw new Error("Nie udało się utworzyć buforów Basket Cord V2.");
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

function uploadMesh(renderer: Renderer, family: Exclude<Family, "">) {
  if (renderer.meshKey === family) return;
  const data = buildBasketGeometry(family);
  const { gl } = renderer;
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.position);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.normal);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.uv);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.uvs), gl.STATIC_DRAW);
  renderer.count = data.positions.length / 3;
  renderer.meshKey = family;
}

function readConfig(stage: HTMLElement): Config {
  return {
    family: (stage.dataset.family || "") as Family,
    stitch: stage.dataset.stitch || "classic",
    color: stage.dataset.color || "#eadfd7",
  };
}

function draw(renderer: Renderer, canvas: HTMLCanvasElement, config: Config, rotation: Rotation, zoom: number) {
  if (!config.family || config.stitch !== "basket") return;
  uploadMesh(renderer, config.family as Exclude<Family, "">);
  const { gl, attribs, uniforms } = renderer;
  const ratio = Math.min(window.devicePixelRatio || 1, window.innerWidth <= 620 ? 1.25 : 1.65);
  const width = Math.max(2, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(2, Math.floor(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
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

export default function BagBuilderBasketPhysicalCordV2() {
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
      stage.removeAttribute("data-abags-basket-physical-cord-v2-error");
    } catch (error) {
      stage.dataset.abagsBasketPhysicalCordV2Error = error instanceof Error ? error.message.slice(0, 180) : "init-failed";
      rendererRef.current = null;
      return;
    }

    const clear = () => {
      const renderer = rendererRef.current;
      if (renderer) {
        renderer.gl.clearColor(0, 0, 0, 0);
        renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT | renderer.gl.DEPTH_BUFFER_BIT);
      }
      stage.removeAttribute("data-abags-basket-physical-cord-v2");
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
        stage.dataset.abagsAgataCordWebgl !== "agata-cord-webgl-v1-photo-calibrated" ||
        stage.dataset.stitch !== "basket"
      ) {
        clear();
        return;
      }
      const renderer = rendererRef.current;
      if (!renderer) return;
      syncTransform();
      const config = readConfig(stage);
      if (!config.family) {
        clear();
        return;
      }
      try {
        draw(renderer, canvas, config, rotationRef.current, zoomRef.current);
        stage.dataset.abagsBasketPhysicalCordV2 = SURFACE_VERSION;
        stage.removeAttribute("data-abags-basket-physical-cord-v2-error");
      } catch (error) {
        stage.dataset.abagsBasketPhysicalCordV2Error = error instanceof Error ? error.message.slice(0, 180) : "draw-failed";
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
      stage.removeAttribute("data-abags-basket-physical-cord-v2");
      stage.removeAttribute("data-abags-basket-physical-cord-v2-error");
      rendererRef.current = null;
    };
  }, [layer]);

  if (!layer) return null;
  return createPortal(
    <canvas
      ref={canvasRef}
      className="abags-basket-physical-cord-v2"
      data-basket-physical-cord-version={version}
      aria-hidden="true"
    />,
    layer,
  );
}
