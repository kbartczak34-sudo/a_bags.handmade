"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ABAGS_FIDELITY_V4_FAMILY_SPECS,
  ABAGS_FIDELITY_V4_RENDERER_VERSION,
  type FidelityV4Family,
} from "../lib/abags-fidelity-v4-family-spec";
import { isAgataBuilderConstructionSupported } from "../lib/abags-builder-fidelity";

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
type FamilyProfile = {
  bodyY: number;
  topY: number;
  frontZ: number;
  baseDepth: number;
  topDepth: number;
  bottomDepth: number;
  width: number;
  handleScale: number;
  handleScaleY: number;
  handleY: number;
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

const DEFAULT_ROTATION = { x: -0.1, y: 0.56 };
const DEFAULT_ZOOM = 1.02;
const MIN_ZOOM = 0.34;
const MAX_ZOOM = 1.45;

const PROFILES: Record<Exclude<Family, "">, FamilyProfile> = Object.fromEntries(
  (Object.keys(ABAGS_FIDELITY_V4_FAMILY_SPECS) as FidelityV4Family[]).map((family) => {
    const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
    return [family, {
      bodyY: spec.bodyY,
      topY: spec.topY,
      frontZ: spec.depth / 2,
      baseDepth: spec.depth,
      topDepth: spec.depth * 0.92,
      bottomDepth: spec.depth * 1.12,
      width: spec.rx,
      handleScale: spec.handleScale[0],
      handleScaleY: spec.handleScale[1],
      handleY: spec.topY + 0.14,
      flapScale: [spec.flapScale[0], spec.flapScale[1], 1],
      flapY: spec.flapY ?? spec.topY * 0.34,
      lockY: spec.ringY - 0.32,
      sideX: spec.sideAnchor,
      accentX: -spec.sideAnchor * 0.92,
      accentY: spec.flapY ?? spec.topY * 0.34,
    }] as const;
  }),
) as Record<Exclude<Family, "">, FamilyProfile>;

function readConfig(stage: HTMLElement): Config {
  const family = (stage.dataset.family || "") as Family;
  const rawFlap = (stage.dataset.flap || "none") as Flap;
  const flap = family && !isAgataBuilderConstructionSupported(family, "flaps", rawFlap) ? "none" : rawFlap;
  return {
    family,
    color: stage.dataset.color || "",
    stitch: (stage.dataset.stitch || "") as Stitch,
    flap,
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

function darken(value: string, amount = 0.34) {
  const [r, g, b] = hex(value).map((channel) => Math.round(channel * 255));
  const factor = clamp(1 - amount, 0.18, 1);
  return "#" + [r, g, b].map((channel) => Math.round(channel * factor).toString(16).padStart(2, "0")).join("");
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
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const points: Point[] = [];
  const samples = 96;
  const exponent = 2 / Math.max(1.01, spec.power);
  for (let i = 0; i < samples; i += 1) {
    const theta = (i / samples) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const x0 = Math.sign(cos) * Math.pow(Math.abs(cos), exponent) * spec.rx;
    const y = Math.sign(sin) * Math.pow(Math.abs(sin), exponent) * spec.ry;
    const taper = 1 + spec.taper * (y / Math.max(0.001, spec.ry));
    points.push([x0 * taper, y]);
  }
  return points;
}

function flapContour(): Point[] {
  const p: Point[] = [];
  quad(p, [-0.94, 0.4], [0, 0.46], [0.94, 0.4], 18);
  quad(p, [0.94, 0.4], [0.9, 0.04], [0.67, -0.27], 9);
  quad(p, [0.67, -0.27], [0.35, -0.56], [0, -0.64], 11);
  quad(p, [0, -0.64], [-0.35, -0.56], [-0.67, -0.27], 11);
  quad(p, [-0.67, -0.27], [-0.9, 0.04], [-0.94, 0.4], 9);
  return p;
}

function depthAt(family: Exclude<Family, "">, y: number) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const normalizedY = clamp(y / Math.max(0.001, spec.ry), -1, 1);
  const edge = Math.abs(normalizedY);
  const belly = 1 + Math.sin((1 - edge) * Math.PI * 0.5) * (0.035 + spec.depth * 0.035);
  const topCompression = 1 - Math.max(0, normalizedY) * 0.04;
  return spec.depth * belly * topCompression;
}

function softBodyOffset(family: Exclude<Family, "">, x: number, y: number) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const familyFactor = ABAGS_FIDELITY_V4_FAMILY_SPECS[family].softnessFactor;
  const xn = clamp(x / Math.max(0.001, spec.rx), -1, 1);
  const yn = clamp(y / Math.max(0.001, spec.ry), -1, 1);
  const center = 1 - xn * xn;
  const lower = Math.pow(clamp((-yn + 0.02) / 1.02, 0, 1), 1.45);
  const softness = (0.022 + spec.ry * 0.018) * familyFactor;
  const sagY = -softness * center * lower;
  const bulgeZ = spec.depth * (0.018 + 0.018 * familyFactor) * center * (1 - Math.min(1, Math.abs(yn))) * (0.72 + 0.28 * lower);
  return { y: sagY, z: bulgeZ };
}

function makeVariableDepthBody(family: Exclude<Family, "">) {
  const contour = familyContour(family);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const xs = contour.map((point) => point[0]);
  const ys = contour.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cx = contour.reduce((sum, point) => sum + point[0], 0) / contour.length;
  const cy = contour.reduce((sum, point) => sum + point[1], 0) / contour.length;
  const uvFor = (point: Point) => [(point[0] - minX) / Math.max(0.001, maxX - minX), (point[1] - minY) / Math.max(0.001, maxY - minY)] as const;
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const bevel = Math.min(spec.bevel, spec.depth * 0.14);
  const inset = 0.965;
  const frontZ = spec.depth * 0.5;
  const backZ = -frontZ;
  const frontFaceZ = frontZ - bevel;
  const backFaceZ = backZ + bevel;

  const addRing = (scaleFactor: number, zSign: number, zInset: number, mode: "face" | "bevel" | "side") => {
    const startIndex = positions.length / 3;
    contour.forEach((point) => {
      const x = cx + (point[0] - cx) * scaleFactor;
      const rawY = cy + (point[1] - cy) * scaleFactor;
      const softness = softBodyOffset(family, x, rawY);
      const y = rawY + softness.y;
      const z = zSign > 0
        ? depthAt(family, y) * 0.5 - zInset + softness.z
        : -depthAt(family, y) * 0.5 + zInset + softness.z * 0.38;
      const radial = normalize(x - cx, y - cy, 0);
      const nz = mode === "bevel" ? zSign * 0.72 : zSign;
      const tangent = mode === "side" ? 0.22 : mode === "bevel" ? 0.7 : 0;
      normals.push(...normalize(radial[0] * tangent, radial[1] * tangent, nz));
      positions.push(x, y, z);
      const [u, v] = uvFor(point);
      uvs.push(u, v);
    });
    return startIndex;
  };

  const frontFace = addRing(inset, 1, bevel, "face");
  const frontEdge = addRing(1, 1, 0, "bevel");
  const backEdge = addRing(1, -1, 0, "bevel");
  const backFace = addRing(inset, -1, bevel, "face");

  const frontBulge = spec.depth * 0.075;
  const frontCenter = positions.length / 3;
  positions.push(cx, cy, frontFaceZ + frontBulge);
  normals.push(0, 0, 1);
  uvs.push(0.5, 0.5);
  const backCenter = positions.length / 3;
  positions.push(cx, cy, backFaceZ - spec.depth * 0.025);
  normals.push(0, 0, -1);
  uvs.push(0.5, 0.5);

  for (let i = 0; i < contour.length; i += 1) {
    const next = (i + 1) % contour.length;
    indices.push(frontCenter, frontFace + i, frontFace + next);
    indices.push(backCenter, backFace + next, backFace + i);

    const connect = (aStart: number, bStart: number, reverse = false) => {
      const a = aStart + i;
      const b = aStart + next;
      const c = bStart + i;
      const d = bStart + next;
      if (reverse) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    };
    connect(frontFace, frontEdge);
    connect(frontEdge, backEdge);
    connect(backEdge, backFace, true);
  }

  return { positions, normals, uvs, indices };
}

function makeOpeningRim(family: Exclude<Family, "">, minor = 0.028, segments = 18, tube = 8) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const width = spec.rx * 0.91;
  const depth = spec.depth * 0.84;
  const y = spec.topY + 0.015;
  const radius = Math.min(width, depth) * 0.12;
  const points: Array<[number, number, number]> = [];
  const add = (x: number, z: number) => points.push([x, y, z]);

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    add(-width + radius + (2 * (width - radius)) * t, depth * 0.5);
  }
  for (let i = 1; i <= segments; i += 1) {
    const a = Math.PI / 2 - (Math.PI / 2) * (i / segments);
    add(width - radius + radius * Math.cos(a), depth * 0.5 - radius + radius * Math.sin(a));
  }
  for (let i = 1; i <= segments; i += 1) {
    const t = i / segments;
    add(width - radius - (2 * (width - radius)) * t, -depth * 0.5);
  }
  for (let i = 1; i <= segments; i += 1) {
    const a = -Math.PI / 2 - (Math.PI / 2) * (i / segments);
    add(-width + radius + radius * Math.cos(a), -depth * 0.5 + radius + radius * Math.sin(a));
  }
  points.push(points[0]);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const tx = next[0] - prev[0];
    const tz = next[2] - prev[2];
    const len = Math.hypot(tx, tz) || 1;
    const txN = tx / len;
    const tzN = tz / len;
    for (let j = 0; j <= tube; j += 1) {
      const a = (j / tube) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nx = -tzN * ca;
      const ny = sa;
      const nz = txN * ca;
      positions.push(points[i][0] + minor * nx, points[i][1] + minor * ny, points[i][2] + minor * nz);
      normals.push(...normalize(nx, ny, nz));
      uvs.push(i / Math.max(1, points.length - 1), j / tube);
    }
  }
  const stride = tube + 1;
  for (let i = 0; i < points.length - 1; i += 1) {
    for (let j = 0; j < tube; j += 1) {
      const a = i * stride + j;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions, normals, uvs, indices };
}

function makeOpeningInterior(family: Exclude<Family, "">) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const width = spec.rx * 0.82;
  const depth = spec.depth * 0.68;
  const y = spec.topY - 0.035;
  const radius = Math.min(width, depth) * 0.14;
  const points: Array<[number, number]> = [];
  const add = (x: number, z: number) => points.push([x, z]);
  const segments = 12;
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    add(-width + radius + 2 * (width - radius) * t, depth * 0.5 - radius);
  }
  for (let i = 1; i <= segments; i += 1) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / segments);
    add(width - radius + radius * Math.cos(a), depth * 0.5 - radius + radius * Math.sin(a));
  }
  for (let i = 1; i <= segments; i += 1) {
    const t = i / segments;
    add(width - radius - 2 * (width - radius) * t, -depth * 0.5 + radius);
  }
  for (let i = 1; i <= segments; i += 1) {
    const a = Math.PI / 2 + (Math.PI / 2) * (i / segments);
    add(-width + radius + radius * Math.cos(a), -depth * 0.5 + radius + radius * Math.sin(a));
  }

  const positions = [0, y, 0];
  const normals = [0, 1, 0];
  const uvs = [0.5, 0.5];
  const indices: number[] = [];
  const minX = Math.min(...points.map((p) => p[0]));
  const maxX = Math.max(...points.map((p) => p[0]));
  const minZ = Math.min(...points.map((p) => p[1]));
  const maxZ = Math.max(...points.map((p) => p[1]));
  points.forEach(([x, z]) => {
    positions.push(x, y, z);
    normals.push(0, 1, 0);
    uvs.push((x - minX) / Math.max(0.001, maxX - minX), (z - minZ) / Math.max(0.001, maxZ - minZ));
  });
  for (let i = 0; i < points.length; i += 1) {
    const next = (i + 1) % points.length;
    indices.push(0, next + 1, i + 1);
  }
  return { positions, normals, uvs, indices };
}

function makeExtrudedContour(contour: Point[], depth: number, softness = 0) {
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
  const uvFor = (point: Point) => [(point[0] - minX) / Math.max(0.001, maxX - minX), (point[1] - minY) / Math.max(0.001, maxY - minY)] as const;
  const softened = contour.map(([x, y]) => {
    const center = 1 - Math.pow(clamp(x / Math.max(0.001, Math.max(Math.abs(minX), Math.abs(maxX))), -1, 1), 2);
    const lower = Math.pow(clamp((-y + 0.02) / Math.max(0.001, maxY - minY), 0, 1), 1.35);
    return [x, y - softness * center * lower] as Point;
  });

  // A flap is a soft textile component, not a flat card. Give the front
  // surface a shallow dome so the yarn catches light continuously across the
  // center and rolls into the edge instead of reading as a sticker.
  const frontBulge = Math.min(0.085, Math.max(0.035, depth * 0.42));
  const frontZAt = (x: number, y: number) => {
    const nx = x / Math.max(0.001, Math.max(Math.abs(minX), Math.abs(maxX)));
    const ny = y / Math.max(0.001, Math.max(Math.abs(minY), Math.abs(maxY)));
    const radial = clamp(1 - nx * nx - ny * ny, 0, 1);
    return half + frontBulge * Math.pow(radial, 1.35);
  };
  const frontNormalAt = (x: number, y: number) => {
    const sx = x / Math.max(0.001, Math.max(Math.abs(minX), Math.abs(maxX)));
    const sy = y / Math.max(0.001, Math.max(Math.abs(minY), Math.abs(maxY)));
    const radial = clamp(1 - sx * sx - sy * sy, 0, 1);
    const slope = frontBulge * 2.7 * Math.pow(Math.max(0, radial), 0.32);
    return normalize(-sx * slope, -sy * slope, 1);
  };

  const frontCenter = positions.length / 3;
  positions.push(cx, cy, half + frontBulge); normals.push(0, 0, 1); uvs.push(0.5, 0.5);
  const frontStart = positions.length / 3;
  softened.forEach((point) => {
    const [u, v] = uvFor(point);
    positions.push(point[0], point[1], frontZAt(point[0], point[1]));
    normals.push(...frontNormalAt(point[0], point[1]));
    uvs.push(u, v);
  });
  const backCenter = positions.length / 3;
  positions.push(cx, cy, -half); normals.push(0, 0, -1); uvs.push(0.5, 0.5);
  const backStart = positions.length / 3;
  softened.forEach((point) => { const [u, v] = uvFor(point); positions.push(point[0], point[1], -half); normals.push(0, 0, -1); uvs.push(u, v); });
  for (let i = 0; i < contour.length; i += 1) {
    const next = (i + 1) % contour.length;
    indices.push(frontCenter, frontStart + i, frontStart + next);
    indices.push(backCenter, backStart + next, backStart + i);
  }
  const sideStart = positions.length / 3;
  for (let i = 0; i < contour.length; i += 1) {
    const next = (i + 1) % contour.length;
    const a = softened[i];
    const b = softened[next];
    const [nx, ny] = normalize(b[1] - a[1], -(b[0] - a[0]), 0);
    positions.push(
      a[0], a[1], frontZAt(a[0], a[1]),
      a[0], a[1], -half,
      b[0], b[1], frontZAt(b[0], b[1]),
      b[0], b[1], -half,
    );
    normals.push(nx, ny, 0, nx, ny, 0, nx, ny, 0, nx, ny, 0);
    uvs.push(i / contour.length, 1, i / contour.length, 0, (i + 1) / contour.length, 1, (i + 1) / contour.length, 0);
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

function makeSegmentedChain(rx: number, ry: number, z: number, links = 34, major = 0.043, minor = 0.011) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const rows = 8;
  const cols = 10;

  for (let i = 0; i < links; i += 1) {
    const progress = links === 1 ? 0.5 : i / (links - 1);
    const t = Math.PI - progress * Math.PI;
    const cx = rx * Math.cos(t);
    const cy = ry * Math.sin(t);
    const tx = -rx * Math.sin(t);
    const ty = ry * Math.cos(t);
    const tangent = normalize(tx, ty, 0);
    const normalXY: [number, number, number] = [-tangent[1], tangent[0], 0];
    const u = i % 2 === 0 ? tangent : normalXY;
    const v: [number, number, number] = [0, 0, 1];
    const linkNormal = normalize(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
    const base = positions.length / 3;

    for (let r = 0; r <= rows; r += 1) {
      const a = (r / rows) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (let k = 0; k <= cols; k += 1) {
        const b = (k / cols) * Math.PI * 2;
        const cb = Math.cos(b);
        const sb = Math.sin(b);
        const radial: [number, number, number] = [
          ca * u[0] + sa * v[0],
          ca * u[1] + sa * v[1],
          ca * u[2] + sa * v[2],
        ];
        const px = cx + (major + minor * cb) * (ca * u[0] + sa * v[0]) + minor * sb * linkNormal[0];
        const py = cy + (major + minor * cb) * (ca * u[1] + sa * v[1]) + minor * sb * linkNormal[1];
        const pz = z + (major + minor * cb) * (ca * u[2] + sa * v[2]) + minor * sb * linkNormal[2];
        const n = normalize(
          radial[0] * cb + linkNormal[0] * sb,
          radial[1] * cb + linkNormal[1] * sb,
          radial[2] * cb + linkNormal[2] * sb,
        );
        positions.push(px, py, pz);
        normals.push(...n);
        uvs.push(progress, (r * (cols + 1) + k) / ((rows + 1) * (cols + 1)));
      }
    }

    const stride = cols + 1;
    for (let r = 0; r < rows; r += 1) {
      for (let k = 0; k < cols; k += 1) {
        const a = base + r * stride + k;
        const b = a + stride;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  return { positions, normals, uvs, indices };
}

function makeEllipsoid(a: number, b: number, c: number, rows = 22, cols = 34) {
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

float smoothLoop(float x,float width){
  float d=abs(fract(x)-.5);
  return 1.0-smoothstep(.08,width,d);
}

float knit(vec2 uv,float m){
  vec2 p;
  float row;
  if(m<.5){
    // Classic crochet: compact horizontal loops with a subtle stagger.
    row=uv.y*54.0+sin(uv.x*8.0)*.22;
    p=fract(vec2(uv.x*31.0+floor(row)*.5,row));
    float loop=1.0-smoothstep(.08,.34,abs(p.x-.5));
    float crossing=1.0-smoothstep(.03,.18,abs(p.y-.52));
    return loop*.58+crossing*.26;
  }
  if(m<1.5){
    // Herringbone: interlocking chevrons, not a flat diamond grid.
    p=fract(uv*vec2(23.0,25.0));
    float diag=abs(fract(p.x+p.y)-.5);
    float anti=abs(fract(p.x-p.y)-.5);
    return 1.0-smoothstep(.07,.24,min(diag,anti));
  }
  if(m<2.5){
    // Basket stitch: alternating over/under bands.
    p=fract(uv*vec2(16.0,18.0));
    float warp=1.0-smoothstep(.16,.38,abs(p.x-.5));
    float weft=1.0-smoothstep(.16,.38,abs(p.y-.5));
    return max(warp*(.72+.28*step(.5,fract(uv.y*9.0))),weft*(.72+.28*step(.5,fract(uv.x*8.0))));
  }
  // Shell stitch: repeated scallops with a woven secondary strand.
  row=uv.y*24.0;
  p=fract(vec2(uv.x*28.0,row));
  float shell=1.0-smoothstep(.06,.42,abs(length(p-vec2(.5,.32))-.34));
  float rib=1.0-smoothstep(.05,.17,abs(p.x-.5));
  return shell*.7+rib*.22;
}

void main(){
  float h=knit(aUv,uStitch)*uRelief;
  float eps=.0028;
  float hx=(knit(aUv+vec2(eps,0.0),uStitch)-knit(aUv-vec2(eps,0.0),uStitch))/(2.0*eps);
  float hy=(knit(aUv+vec2(0.0,eps),uStitch)-knit(aUv-vec2(0.0,eps),uStitch))/(2.0*eps);
  vec3 reliefNormal=normalize(vec3(-hx*uRelief*2.2,-hy*uRelief*2.2,1.0));
  float frontFace=clamp(abs(aNormal.z),0.0,1.0);
  vec3 localNormal=normalize(mix(aNormal,reliefNormal,frontFace*.82));
  vec3 pos=aPosition+aNormal*h;
  vec4 world=uModel*vec4(pos,1.0);
  vWorld=world.xyz;
  vNormal=normalize(mat3(uModel)*localNormal);
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
  vec2 p;
  float a;
  if(m<.5){
    p=fract(vec2(uv.x*31.0+floor(uv.y*54.0)*.5,uv.y*54.0));
    a=.42+.34*(1.0-smoothstep(.06,.34,abs(p.x-.5)))+.16*sin(p.y*6.2831);
  } else if(m<1.5){
    p=fract(uv*vec2(23.0,25.0));
    a=.38+.5*(1.0-smoothstep(.06,.24,min(abs(fract(p.x+p.y)-.5),abs(fract(p.x-p.y)-.5))));
  } else if(m<2.5){
    p=fract(uv*vec2(16.0,18.0));
    a=.4+.42*max(1.0-smoothstep(.14,.38,abs(p.x-.5)),1.0-smoothstep(.14,.38,abs(p.y-.5)));
  } else {
    p=fract(uv*vec2(28.0,24.0));
    a=.44+.38*(1.0-smoothstep(.08,.4,abs(length(p-vec2(.5,.32))-.34)));
  }
  float micro=sin((uv.x*311.0+uv.y*179.0))*sin((uv.x*97.0-uv.y*131.0));
  return clamp(a+.055*micro,.10,.96);
}

void main(){
  vec3 n=normalize(vNormal);
  vec3 l=normalize(uLight);
  vec3 fill=normalize(vec3(.55,.30,.82));
  vec3 v=normalize(vec3(0.0,.10,5.2)-vWorld);
  vec3 h=normalize(l+v);
  float ndl=max(dot(n,l),0.0);
  float fillLight=max(dot(n,fill),0.0);
  float ndh=max(dot(n,h),0.0);
  float facing=max(dot(n,v),0.0);
  float rough=.88,metal=0.0,detail=1.0;

  if(uMaterial<.5){
    detail=.78+.32*yarn(vUv,uStitch)+.025*(hash(floor(vUv*vec2(260.0,240.0)))-.5);
    rough=.94;
  } else if(uMaterial<1.5){
    detail=.88+.10*sin(vUv.y*118.0+sin(vUv.x*18.0)*3.0);
    rough=.34;
  } else if(uMaterial<2.5){
    detail=.88+.065*(hash(floor(vUv*150.0))-.5)+.045*sin(vUv.y*52.0);
    rough=.52;
  } else if(uMaterial<3.5){
    detail=.76+.18*sin(vUv.x*72.0)*sin(vUv.y*38.0);
    rough=.78;
  } else {
    metal=.97; rough=.14; detail=1.0;
  }

  vec3 base=uColor*detail;
  float spec=pow(max(ndh,0.0),mix(72.0,10.0,rough))*mix(.07,.9,metal);
  float rim=pow(1.0-facing,2.7);
  float cavity=.92+.08*pow(1.0-facing,1.5);
  float illumination=.18+.72*ndl+.18*fillLight;
  vec3 color=base*illumination*cavity+vec3(spec)+base*.035*rim;

  // A restrained warm atelier bounce keeps pale cords from washing out.
  color+=base*vec3(.035,.024,.018);
  gl_FragColor=vec4(pow(max(color,0.0),vec3(.95)),1.0);
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
      tote: createMesh(gl, makeVariableDepthBody("tote")),
      round: createMesh(gl, makeVariableDepthBody("round")),
      bucket: createMesh(gl, makeVariableDepthBody("bucket")),
      mini: createMesh(gl, makeVariableDepthBody("mini")),
      toteRim: createMesh(gl, makeOpeningRim("tote")),
      roundRim: createMesh(gl, makeOpeningRim("round")),
      bucketRim: createMesh(gl, makeOpeningRim("bucket")),
      miniRim: createMesh(gl, makeOpeningRim("mini")),
      toteInterior: createMesh(gl, makeOpeningInterior("tote")),
      roundInterior: createMesh(gl, makeOpeningInterior("round")),
      bucketInterior: createMesh(gl, makeOpeningInterior("bucket")),
      miniInterior: createMesh(gl, makeOpeningInterior("mini")),
      flap: createMesh(gl, makeExtrudedContour(flapContour(), 0.105, 0.085)),
      woodHandle: createMesh(gl, makeArchTube(0.73, 0.76, 0, 0.064, 82, 14, true)),
      crochetHandle: createMesh(gl, makeArchTube(0.72, 0.72, 0, 0.059, 72, 12, false)),
      strap: createMesh(gl, makeArchTube(1.18, 1.62, 0, 0.043, 84, 12, false)),
      toteChain: createMesh(gl, makeSegmentedChain(ABAGS_FIDELITY_V4_FAMILY_SPECS.tote.rx * ABAGS_FIDELITY_V4_FAMILY_SPECS.tote.chain[0], ABAGS_FIDELITY_V4_FAMILY_SPECS.tote.ry * ABAGS_FIDELITY_V4_FAMILY_SPECS.tote.chain[1], 0, ABAGS_FIDELITY_V4_FAMILY_SPECS.tote.chain[2], ABAGS_FIDELITY_V4_FAMILY_SPECS.tote.chain[3], ABAGS_FIDELITY_V4_FAMILY_SPECS.tote.chain[4])),
      roundChain: createMesh(gl, makeSegmentedChain(ABAGS_FIDELITY_V4_FAMILY_SPECS.round.rx * ABAGS_FIDELITY_V4_FAMILY_SPECS.round.chain[0], ABAGS_FIDELITY_V4_FAMILY_SPECS.round.ry * ABAGS_FIDELITY_V4_FAMILY_SPECS.round.chain[1], 0, ABAGS_FIDELITY_V4_FAMILY_SPECS.round.chain[2], ABAGS_FIDELITY_V4_FAMILY_SPECS.round.chain[3], ABAGS_FIDELITY_V4_FAMILY_SPECS.round.chain[4])),
      bucketChain: createMesh(gl, makeSegmentedChain(ABAGS_FIDELITY_V4_FAMILY_SPECS.bucket.rx * ABAGS_FIDELITY_V4_FAMILY_SPECS.bucket.chain[0], ABAGS_FIDELITY_V4_FAMILY_SPECS.bucket.ry * ABAGS_FIDELITY_V4_FAMILY_SPECS.bucket.chain[1], 0, ABAGS_FIDELITY_V4_FAMILY_SPECS.bucket.chain[2], ABAGS_FIDELITY_V4_FAMILY_SPECS.bucket.chain[3], ABAGS_FIDELITY_V4_FAMILY_SPECS.bucket.chain[4])),
      miniChain: createMesh(gl, makeSegmentedChain(ABAGS_FIDELITY_V4_FAMILY_SPECS.mini.rx * ABAGS_FIDELITY_V4_FAMILY_SPECS.mini.chain[0], ABAGS_FIDELITY_V4_FAMILY_SPECS.mini.ry * ABAGS_FIDELITY_V4_FAMILY_SPECS.mini.chain[1], 0, ABAGS_FIDELITY_V4_FAMILY_SPECS.mini.chain[2], ABAGS_FIDELITY_V4_FAMILY_SPECS.mini.chain[3], ABAGS_FIDELITY_V4_FAMILY_SPECS.mini.chain[4])),
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

function familyAttachment(profile: FamilyProfile, family: Exclude<Family, "">) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  return {
    x: profile.width * spec.attachmentWidthFactor,
    y: profile.topY + spec.attachmentYOffset,
    z: profile.frontZ * spec.attachmentZFactor,
  };
}

function handleTransform(profile: FamilyProfile, family: Exclude<Family, "">, side: number) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const attachment = familyAttachment(profile, family);
  const span = profile.width * spec.handleSpanFactor;
  return {
    x: side * span,
    y: attachment.y,
    z: attachment.z,
    scaleX: profile.handleScale * spec.handleScaleFactor,
    scaleY: profile.handleScaleY * spec.handleYScaleFactor,
  };
}

function renderSignature(config: Config) {
  return [
    config.family,
    config.color,
    config.stitch,
    config.flap,
    config.handles,
    config.strap,
    config.hardware,
    config.accent,
  ].join("|");
}

function draw(renderer: Renderer, canvas: HTMLCanvasElement, config: Config, rotation: { x: number; y: number }, zoom: number) {
  const { gl, uniforms, meshes } = renderer;
  if (gl.isContextLost()) throw new Error("webgl-context-lost");
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
  if (!config.family) {
    const renderError = gl.getError();
  if (renderError !== gl.NO_ERROR) throw new Error(`webgl-render-error-${renderError}`);
  if (gl.isContextLost()) throw new Error("webgl-context-lost");
  canvas.dataset.abagsFidelity3dFrame = renderSignature(config);
    canvas.dataset.abagsFidelity3dFrameAt = String(Date.now());
    canvas.removeAttribute("data-abags-fidelity3d-error");
    return;
  }

  const profile = PROFILES[config.family];
  const root = multiply(scale(zoom, zoom, zoom), multiply(rotX(rotation.x), rotY(rotation.y)));
  const body = config.color || "#e8ddcc";
  const stitch = stitchId(config.stitch);
  const relief = config.color && config.stitch ? 0.021 : 0.004;
  drawMesh(renderer, meshes[config.family], multiply(root, matrix([0, profile.bodyY, 0], [1, 1, 1])), body, 0, stitch, relief);

  const openingColor = config.color ? body : "#d8cec4";
  const interiorColor = darken(openingColor, 0.58);
  drawMesh(renderer, meshes[config.family + "Interior"], root, interiorColor, 0, stitch, 0);
  drawMesh(renderer, meshes[config.family + "Rim"], root, openingColor, 0, stitch, config.color && config.stitch ? 0.012 : 0.004);

  if (config.strap !== "none") {
    const metal = config.hardware === "silver" ? "#d7dbe0" : config.hardware === "black" ? "#29272a" : "#caa55d";
    const strapColor = config.strap === "chain" ? metal : config.strap === "leather" ? "#6b4738" : "#a77d87";
    const material = config.strap === "chain" ? 4 : config.strap === "leather" ? 2 : 3;
    const attachment = familyAttachment(profile, config.family);
    const strapScale = config.strap === "chain" ? profile.handleScale * 0.96 : profile.handleScale;
    drawMesh(
      renderer,
      config.strap === "chain" ? meshes[config.family + "Chain"] : meshes.strap,
      multiply(root, matrix([0, attachment.y - 0.02, -profile.topDepth * 0.88], [strapScale * 0.72, 0.84, 1])),
      strapColor,
      material,
      stitch,
      0,
    );
  }

  if (config.handles !== "none") {
    const handleColor = config.handles === "wood-light" ? "#c99b63" : config.handles === "wood-dark" ? "#61331f" : body;
    const material = config.handles.startsWith("wood") ? 1 : 0;
    const mesh = config.handles.startsWith("wood") ? meshes.woodHandle : meshes.crochetHandle;
    const zOffset = profile.topDepth * 0.46;
    for (const side of [-1, 1]) {
      const transform = handleTransform(profile, config.family, side);
      for (const z of [-zOffset * 0.72, zOffset * 0.72]) {
        drawMesh(
          renderer,
          mesh,
          multiply(root, matrix([transform.x, transform.y, z], [transform.scaleX, transform.scaleY, 1])),
          handleColor,
          material,
          stitch,
          config.handles === "crochet" ? 0.018 : 0,
        );
      }
    }
  }

  if (config.flap !== "none") {
    const flapColor = config.flap === "leather-black" ? "#242124" : config.flap === "leather-cognac" ? "#7c5034" : config.flap === "suede-burgundy" ? "#803248" : body;
    const material = config.flap === "crochet" ? 0 : 2;
    drawMesh(renderer, meshes.flap, multiply(root, matrix([0, profile.flapY, profile.frontZ + 0.045], profile.flapScale, [0.02, 0, 0])), flapColor, material, stitch, config.flap === "crochet" ? 0.018 : 0);
  }

  const metal = config.hardware === "silver" ? "#d7dbe0" : config.hardware === "black" ? "#29272a" : "#caa55d";
  drawMesh(renderer, meshes.sphere, multiply(root, matrix([0, config.flap !== "none" ? profile.lockY : -0.47, profile.frontZ + 0.15], [0.088, 0.088, 0.058])), metal, 4, 0);

  if (config.strap !== "none") {
    for (const side of [-1, 1]) {
      const attachment = familyAttachment(profile, config.family);
      const x = side * attachment.x;
      drawMesh(
        renderer,
        meshes.ring,
        multiply(root, matrix([x, attachment.y - 0.08, 0.02], [0.74, 0.88, 1], [0, Math.PI / 2, 0])),
        metal,
        4,
        0,
      );
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

  canvas.dataset.abagsFidelity3dFrame = renderSignature(config);
  canvas.dataset.abagsFidelity3dFrameAt = String(Date.now());
  canvas.removeAttribute("data-abags-fidelity3d-error");
}

export default function BagBuilderFidelity3D() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [config, setConfig] = useState<Config>(EMPTY);
  const [rotation, setRotation] = useState(DEFAULT_ROTATION);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [ready, setReady] = useState(false);
  const [rendererEpoch, setRendererEpoch] = useState(0);
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
      // Keep persisted/legacy drafts from rendering a flap that the selected
      // family does not support. The visual renderer must never invent a
      // construction that the customer cannot actually select in the UI.
      if (stage.dataset.flap !== next.flap) stage.dataset.flap = next.flap;
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
        canvas.removeAttribute("data-abags-fidelity3d-error");
        canvas.removeAttribute("data-abags-fidelity3d-frame");
        canvas.removeAttribute("data-abags-fidelity3d-frame-at");
        setReady(true);
        stage.classList.add("abags-pro3d-active", "abags-fidelity3d-active");
        stage.setAttribute("data-abags-pro3d-ready", "true");
        stage.setAttribute("data-abags-fidelity3d-ready", ABAGS_FIDELITY_V4_RENDERER_VERSION);
        // The legacy SVG is a fallback surface only. Hide it at the renderer
        // boundary as well as via CSS so mobile Chromium cannot composite the
        // old preview over the live WebGL model.
        stage.querySelectorAll<SVGElement>("svg").forEach((svg) => {
          svg.dataset.abagsLegacySurfaceSuppressed = "true";
          svg.style.setProperty("display", "none", "important");
          svg.style.setProperty("opacity", "0", "important");
          svg.style.setProperty("visibility", "hidden", "important");
          svg.style.setProperty("pointer-events", "none", "important");
        });
      }
    } catch (error) {
      rendererRef.current = null;
      canvas.removeAttribute("data-abags-fidelity3d-frame");
      canvas.removeAttribute("data-abags-fidelity3d-frame-at");
      canvas.dataset.abagsFidelity3dError = error instanceof Error ? error.message.slice(0, 160) : "renderer-init-failed";
      setReady(false);
      stage.classList.remove("abags-pro3d-active", "abags-fidelity3d-active");
      stage.removeAttribute("data-abags-pro3d-ready");
      stage.removeAttribute("data-abags-fidelity3d-ready");
    }

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setReady(false);
      rendererRef.current = null;
      canvas.removeAttribute("data-abags-fidelity3d-frame");
      canvas.removeAttribute("data-abags-fidelity3d-frame-at");
      canvas.dataset.abagsFidelity3dError = "webgl-context-lost";
      stage.classList.remove("abags-pro3d-active", "abags-fidelity3d-active");
      stage.removeAttribute("data-abags-pro3d-ready");
      stage.removeAttribute("data-abags-fidelity3d-ready");
    };
    const handleContextRestored = () => {
      rendererRef.current = null;
      setRendererEpoch((value) => value + 1);
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      rendererRef.current = null;
      stage.classList.remove("abags-pro3d-active", "abags-fidelity3d-active");
      stage.removeAttribute("data-abags-pro3d-ready");
      stage.removeAttribute("data-abags-fidelity3d-ready");
    };
  }, [stage, rendererEpoch]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;

    const renderFrame = () => {
      if (rendererRef.current !== renderer || canvasRef.current !== canvas) return;
      try {
        draw(renderer, canvas, config, rotation, zoom);
      } catch (error) {
        rendererRef.current = null;
        canvas.removeAttribute("data-abags-fidelity3d-frame");
        canvas.removeAttribute("data-abags-fidelity3d-frame-at");
        canvas.dataset.abagsFidelity3dError = error instanceof Error ? error.message.slice(0, 160) : "render-failed";
        setReady(false);
        if (stage) {
          stage.classList.remove("abags-pro3d-active", "abags-fidelity3d-active");
          stage.removeAttribute("data-abags-pro3d-ready");
          stage.removeAttribute("data-abags-fidelity3d-ready");
        }
        setRendererEpoch((value) => value + 1);
      }
    };

    let frame = requestAnimationFrame(renderFrame);
    const redraw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(renderFrame);
    };
    window.addEventListener("resize", redraw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", redraw);
    };
  }, [config, rotation, zoom, ready, stage]);

  const label = useMemo(() => config.family ? "Interaktywny model 3D A-Bags z kalibrowaną głębokością" : "Wybierz fason, aby rozpocząć model 3D", [config.family]);
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
    <div className="abags-pro3d-layer abags-fidelity3d-layer" data-abags-pro3d data-abags-fidelity3d>
      <canvas
        ref={canvasRef}
        className="abags-pro3d-canvas abags-fidelity3d-canvas"
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

      <div className="abags-pro3d-chip">MODEL ATELIER 3D · REALNE PROPORCJE</div>
      <div className="abags-pro3d-view-controls" aria-label="Widok modelu 3D">
        <button type="button" className={view === "front" ? "is-active" : ""} aria-pressed={view === "front"} onClick={() => setView("front")}>Przód</button>
        <button type="button" className={view === "three" ? "is-active" : ""} aria-pressed={view === "three"} onClick={() => setView("three")}>3/4</button>
        <button type="button" className={view === "side" ? "is-active" : ""} aria-pressed={view === "side"} onClick={() => setView("side")}>Bok</button>
      </div>

      <div className="abags-pro3d-zoom" aria-label="Zoom modelu 3D">
        <button type="button" onClick={() => setZoom((value) => clamp(value - 0.1, MIN_ZOOM, MAX_ZOOM))} aria-label="Oddal model">−</button>
        <span>ODDAL</span>
        <input type="range" min={34} max={145} step={1} value={Math.round(zoom * 100)} onChange={(event) => setZoom(clamp(Number(event.currentTarget.value) / 100, MIN_ZOOM, MAX_ZOOM))} aria-label="Skala modelu 3D" />
        <span>PRZYBLIŻ</span>
        <button type="button" onClick={() => setZoom((value) => clamp(value + 0.1, MIN_ZOOM, MAX_ZOOM))} aria-label="Przybliż model">+</button>
        <button type="button" className="abags-pro3d-reset" onClick={() => { setRotation(DEFAULT_ROTATION); setViewState("three"); setZoom(DEFAULT_ZOOM); }}>{Math.round(zoom * 100)}%</button>
      </div>

      <p className="abags-pro3d-hint">Obrót 360° pokazuje rzeczywistą zmianę głębokości korpusu · pinch zoom · fason i dodatki aktualizują się na żywo.</p>
    </div>,
    stage,
  );
}
