"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ABAGS_FIDELITY_V4_FAMILY_SPECS,
  ABAGS_FIDELITY_V4_RENDERER_VERSION,
  type FidelityV4Family,
} from "../lib/abags-fidelity-v4-family-spec";
import { isAgataBuilderConstructionSupported } from "../lib/abags-builder-fidelity";
import { ABAGS_CROCHET_HEIGHT_GLSL, textileNormalMatrix, textileUvFrame } from "../lib/abags-textile-surface";
import { createCrochetCordMeshes } from "../lib/abags-crochet-geometry";
import { createCordTexture } from "../lib/abags-cord-texture";
import { createCordShadow, renderCordShadow, type CordShadow } from "../lib/abags-cord-shadow";

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
  tangent: WebGLBuffer;
  bitangent: WebGLBuffer;
  index: WebGLBuffer;
  count: number;
};

type Renderer = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  meshes: Record<string, Mesh>;
  cordMeshes: Map<string, Mesh[]>;
  cordTexture: WebGLTexture;
  shadow: CordShadow | null;
  commands: DrawCommand[];
  attribs: { position: number; normal: number; uv: number; tangent: number; bitangent: number };
  uniforms: Record<"projection" | "view" | "model" | "normalMatrix" | "color" | "material" | "stitch" | "relief" | "light" | "fiberTexture" | "shadowMatrix" | "shadowTexture" | "shadowEnabled" | "shadowTexel", WebGLUniformLocation>;
};

type DrawCommand = { mesh: Mesh; model: Float32Array; color: string; material: number; stitch: number; relief: number };

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

// Stronger default 3/4 angle on mobile so the physical side wall remains visible
// instead of making the round body read like a flat printed card.
// Calibrated product view: expose the physical side wall immediately on mobile.
// A positive yaw was still reading too close to front-on on some Chromium devices.
const DEFAULT_ROTATION = { x: -0.12, y: -0.62 };
// Frame the rendered bag as the primary product, while preserving enough margin for handles on narrow screens.
const DEFAULT_ZOOM = 0.92;

function physicalDepth(family: Exclude<Family, "">) {
  const calibrated = ABAGS_FIDELITY_V4_FAMILY_SPECS[family].depth;
  // The round reference is calibrated at 0.46, but its photographed construction has
  // a visibly fuller side wall. Keep the Golden Master contract untouched and apply
  // the physical correction only inside the renderer.
  return family === "round" ? calibrated * 1.34 : calibrated;
}
const MIN_ZOOM = 0.34;
const MAX_ZOOM = 1.45;

const PROFILES: Record<Exclude<Family, "">, FamilyProfile> = Object.fromEntries(
  (Object.keys(ABAGS_FIDELITY_V4_FAMILY_SPECS) as FidelityV4Family[]).map((family) => {
    const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
    return [family, {
      bodyY: spec.bodyY,
      topY: spec.topY,
      frontZ: spec.depth * (family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : 1) / 2,
      baseDepth: spec.depth * (family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : 1),
      topDepth: spec.depth * (family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : 1) * 0.92,
      bottomDepth: spec.depth * (family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : 1) * 1.12,
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
  const depthScale = family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : 1;
  return spec.depth * depthScale * belly * topCompression;
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
  // The unsupported middle of the mouth relaxes slightly between its anchors.
  // Keep X unchanged: the family's nominal body width is the physical anchor.
  const upper = Math.pow(Math.max(0, yn), 5);
  const lipSag = -softness * 0.48 * center * upper * (1 + 0.12 * Math.sin(xn * 4.2));
  const depthScale = family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : 1;
  const bulgeZ = spec.depth * depthScale * (0.018 + 0.018 * familyFactor) * center * (1 - Math.min(1, Math.abs(yn))) * (0.72 + 0.28 * lower);
  // Broad, coherent folds belong to the cloth surface, not to a random normal
  // texture. Fade them at the boundary so hardware keeps its existing contacts.
  const foldEnvelope = center * Math.max(0, 1 - yn * yn);
  const folds = Math.sin(xn * 4.1 + yn * 1.6 + 0.3)
    + 0.35 * Math.sin(xn * 7.2 - yn * 3.4);
  const drapeZ = 0.007 * familyFactor * foldEnvelope * folds;
  return { y: sagY + lipSag, z: bulgeZ + drapeZ };
}

function smoothBodyNormals(positions: number[], normals: number[], indices: number[]) {
  const derivatives = new Float64Array(positions.length);
  // Area-weighted surface derivatives follow the actual dome, folds and edge
  // rolls. A guessed sign on nx/ny previously lit the convex front as a hollow.
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const orientation = nx * (normals[a] + normals[b] + normals[c])
      + ny * (normals[a + 1] + normals[b + 1] + normals[c + 1])
      + nz * (normals[a + 2] + normals[b + 2] + normals[c + 2]);
    if (orientation < 0) {
      nx = -nx; ny = -ny; nz = -nz;
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    }
    for (const vertex of [a, b, c]) {
      derivatives[vertex] += nx;
      derivatives[vertex + 1] += ny;
      derivatives[vertex + 2] += nz;
    }
  }
  // UV seams have separate vertices but share one physical textile surface.
  const seamNormals = new Map<string, [number, number, number]>();
  const keys: string[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const key = positions.slice(i, i + 3).map((value) => Math.round(value * 1e6)).join(":");
    keys.push(key);
    const sum = seamNormals.get(key) ?? [0, 0, 0];
    sum[0] += derivatives[i]; sum[1] += derivatives[i + 1]; sum[2] += derivatives[i + 2];
    seamNormals.set(key, sum);
  }
  keys.forEach((key, vertex) => {
    const sum = seamNormals.get(key)!;
    if (Math.hypot(...sum) < 1e-10) return;
    const normal = normalize(...sum);
    normals.splice(vertex * 3, 3, ...normal);
  });
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
  const depthScale = family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : 1;
  const bevel = Math.min(spec.bevel, spec.depth * 0.14);
  const inset = 0.935;

  const addRing = (scaleFactor: number, zSign: number, zInset: number, mode: "face" | "bevel" | "side") => {
    const startIndex = positions.length / 3;
    contour.forEach((point) => {
      const x = cx + (point[0] - cx) * scaleFactor;
      const rawY = cy + (point[1] - cy) * scaleFactor;
      const softness = softBodyOffset(family, x, rawY);
      const y = rawY + softness.y;
      // The front stays at its established depth; the edge rolls away into the
      // gusset rather than standing proud as a rigid frame around the fabric.
      const z = zSign > 0
        ? depthAt(family, y) * 0.5 - 2 * bevel + zInset + softness.z
        : -depthAt(family, y) * 0.5 + 2 * bevel - zInset - softness.z;
      const radial = normalize(x - cx, y - cy, 0);
      let normal: [number, number, number];
      if (mode === "face") {
        // The front of a soft crochet bag is gently convex, not a paper-thin
        // plane. Match the normal field to the same shallow dome used by the
        // center vertex so the selected yarn catches light across the body.
        const xn = (x - cx) / Math.max(0.001, spec.rx);
        const yn = (y - cy) / Math.max(0.001, spec.ry);
        const radialField = clamp(1 - xn * xn - yn * yn, 0, 1);
        const bulge = spec.depth * 0.12 * depthScale;
        const slope = 2 * bulge * Math.pow(Math.max(0, radialField), 0.55);
        normal = normalize(xn * slope, yn * slope, zSign);
      } else {
        const angle = Math.acos(clamp(zInset / Math.max(bevel, 0.001), 0, 1));
        normal = normalize(radial[0] * Math.sin(angle), radial[1] * Math.sin(angle), zSign * Math.cos(angle));
      }
      normals.push(...normal);
      positions.push(x, y, z);
      const [u, v] = uvFor([x, y]);
      uvs.push(u, v);
    });
    return startIndex;
  };

  const frontFace = addRing(inset, 1, bevel, "face");
  const frontEdge = addRing(1, 1, 0, "bevel");
  const backEdge = addRing(1, -1, 0, "bevel");
  const backFace = addRing(inset, -1, bevel, "face");

  // Tessellated fibre panels; sparse fan triangles cannot carry yarn displacement.
  // Dense yarn-level vertices ensure the stitch pattern is displaced in 3D,
  // not just printed between sixteen widely-spaced surface bands.
  const faceBands = 52;
  const frontBulge = spec.depth * .075 * depthScale;
  const bodyDomeLift = spec.depth * .045 * depthScale;
  // Agata confirmed the real bag body looks identical from the back.
  // Equal dome curvature and mirrored Z relief keep front/back physical thickness
  // and the same crochet silhouette under 360-degree rotation.
  const backBulge = frontBulge + bodyDomeLift;
  const addFabricFace = (outer: number, side: 1 | -1) => {
    let previous = outer;
    for (let band = 1; band <= faceBands; band++) {
      const fraction = 1 - band / (faceBands + 1);
      const ring = positions.length / 3;
      contour.forEach(([outlineX, outlineY]) => {
        const x = cx + (outlineX - cx) * inset * fraction;
        const rawY = cy + (outlineY - cy) * inset * fraction;
        const softness = softBodyOffset(family, x, rawY);
        const y = rawY + softness.y;
        const dome = 1 - fraction * fraction;
        const z = side === 1
          ? depthAt(family, y) * .5 - bevel + softness.z + (frontBulge + bodyDomeLift) * dome
          : -depthAt(family, y) * .5 + bevel - softness.z - backBulge * dome;
        const nx = (x - cx) / Math.max(.001, spec.rx);
        const ny = (y - cy) / Math.max(.001, spec.ry);
        positions.push(x, y, z);
        normals.push(...normalize(nx * .17, ny * .16, side));
        uvs.push(...uvFor([x, y]));
      });
      for (let i = 0; i < contour.length; i++) {
        const j = (i + 1) % contour.length;
        const a = previous + i, b = previous + j, c = ring + i, d = ring + j;
        if (side === 1) indices.push(a, b, c, b, d, c);
        else indices.push(a, c, b, b, c, d);
      }
      previous = ring;
    }
    const center = positions.length / 3;
    const centerSoftness = softBodyOffset(family, cx, cy);
    const centerY = cy + centerSoftness.y;
    positions.push(cx, centerY, side === 1
      ? depthAt(family, centerY) * .5 - bevel + centerSoftness.z + frontBulge + bodyDomeLift
      : -depthAt(family, centerY) * .5 + bevel - centerSoftness.z - backBulge);
    normals.push(0, 0, side);
    uvs.push(...uvFor([cx, centerY]));
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      if (side === 1) indices.push(center, previous + i, previous + j);
      else indices.push(center, previous + j, previous + i);
    }
  };
  addFabricFace(frontFace, 1);
  addFabricFace(backFace, -1);

  // Several small quarter-ellipse strips make a soft rolled textile edge.
  // The outer contour and accessory anchors retain their established bounds.
  const frontRoll = [frontFace];
  const backRoll = [backFace];
  const rollBands = 5;
  for (let band = 1; band < rollBands; band++) {
    const angle = band / rollBands * Math.PI * 0.5;
    const fraction = inset + (1 - inset) * Math.sin(angle);
    const zInset = bevel * Math.cos(angle);
    frontRoll.push(addRing(fraction, 1, zInset, "bevel"));
    backRoll.push(addRing(fraction, -1, zInset, "bevel"));
  }
  frontRoll.push(frontEdge);
  backRoll.push(backEdge);

  // A true separate textile gusset. Previously the front and back edge rings
  // shared identical FRONT-FACE UVs; interpolating those across depth gives
  // constant UVs through the sidewall, hence rigid horizontal zebra stripes.
  // Arc length around the bag and distance through its depth now provide the
  // gusset's own stitch coordinates. The mouth remains open.
  const sideRows = 12;
  const sideStart = positions.length / 3;
  let sideArcLength = 0;
  for (let i = 0; i <= contour.length; i++) {
    const index = i % contour.length;
    const previous = (index - 1 + contour.length) % contour.length;
    const next = (index + 1) % contour.length;
    if (i > 0) {
      sideArcLength += Math.hypot(
        contour[index][0] - contour[previous][0],
        contour[index][1] - contour[previous][1],
      );
    }
    const tx = contour[next][0] - contour[previous][0];
    const ty = contour[next][1] - contour[previous][1];
    const outward = normalize(ty, -tx, 0);
    const rimIndex = (frontEdge + index) * 3;
    const backIndex = (backEdge + index) * 3;
    for (let across = 0; across <= sideRows; across++) {
      const depthProgress = across / sideRows;
      positions.push(
        positions[rimIndex],
        positions[rimIndex + 1],
        positions[rimIndex + 2] * (1 - depthProgress) + positions[backIndex + 2] * depthProgress,
      );
      normals.push(...outward);
      // 5 mm cord is approximately a dozen stitches across the gusset,
      // with continuous stitch spacing around the bag perimeter.
      uvs.push(sideArcLength * 0.52, depthProgress * 0.46);
    }
  }
  for (let i = 0; i < contour.length; i++) {
    const next = (i + 1) % contour.length;
    const connect = (aStart: number, bStart: number, reverse = false) => {
      const a = aStart + i, b = aStart + next;
      const c = bStart + i, d = bStart + next;
      if (reverse) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    };
    for (let band = 0; band < rollBands; band++) {
      connect(frontRoll[band], frontRoll[band + 1]);
      connect(backRoll[band], backRoll[band + 1], true);
    }
    // A visible, open mouth: gusset triangles are intentionally omitted above
    // the top edge. Depth is a real woven wall instead of a flat UV-stretched cap.
    if ((contour[i][1] + contour[next][1]) * .5 < spec.ry * .90) {
      for (let across = 0; across < sideRows; across++) {
        const a = sideStart + i * (sideRows + 1) + across;
        const b = sideStart + (i + 1) * (sideRows + 1) + across;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }

  smoothBodyNormals(positions, normals, indices);
  return { positions, normals, uvs, indices };
}

function openingLoop(family: Exclude<Family, "">, segments = 18): Array<[number, number, number]> {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  // Match the actual open upper contour. In particular, a round bag cannot
  // have a rectangular mouth wider than its shell at the height of that mouth.
  const openingY = spec.ry * 0.90;
  const width = spec.rx * Math.pow(1 - Math.pow(0.90, spec.power), 1 / spec.power)
    * (1 + spec.taper * 0.90);
  const bevel = Math.min(spec.bevel, spec.depth * 0.14);
  const points: Array<[number, number, number]> = [];
  const count = segments * 4;
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const x = width * Math.sign(cos) * Math.pow(Math.abs(cos), 1 / 3);
    // The upper branch of the family's superellipse, including its taper.
    let low = openingY, high = spec.ry;
    for (let step = 0; step < 18; step++) {
      const candidate = (low + high) * 0.5;
      const relativeY = candidate / spec.ry;
      const candidateWidth = spec.rx * Math.pow(Math.max(0, 1 - Math.pow(relativeY, spec.power)), 1 / spec.power)
        * (1 + spec.taper * relativeY);
      if (candidateWidth > Math.abs(x)) low = candidate;
      else high = candidate;
    }
    const rawY = (low + high) * 0.5;
    const softness = softBodyOffset(family, x, rawY);
    const halfDepth = depthAt(family, rawY + softness.y) * 0.5 - 2 * bevel + softness.z;
    const z = halfDepth * Math.sign(sin) * Math.pow(Math.abs(sin), 0.5);
    points.push([x, rawY + softness.y + spec.bodyY + 0.004, z]);
  }
  return points;
}

function makeOpeningRim(family: Exclude<Family, "">, minor = 0.028, segments = 18, tube = 8) {
  const points = openingLoop(family, segments);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= points.length; i += 1) {
    const point = points[i % points.length];
    const prev = points[(i - 1 + points.length) % points.length];
    const next = points[(i + 1) % points.length];
    const tangent = normalize(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]);
    const radial = normalize(-tangent[2], 0, tangent[0]);
    const up = normalize(
      -radial[2] * tangent[1],
      radial[2] * tangent[0] - radial[0] * tangent[2],
      radial[0] * tangent[1],
    );
    const cordRadius = minor * (1 + 0.035 * Math.sin(i / points.length * Math.PI * 6));
    for (let j = 0; j <= tube; j += 1) {
      const angle = (j / tube) * Math.PI * 2;
      const ca = Math.cos(angle), sa = Math.sin(angle);
      const nx = radial[0] * ca + up[0] * sa;
      const ny = radial[1] * ca + up[1] * sa;
      const nz = radial[2] * ca + up[2] * sa;
      positions.push(point[0] + cordRadius * nx, point[1] + cordRadius * ny, point[2] + cordRadius * nz);
      normals.push(...normalize(nx, ny, nz));
      uvs.push(i / points.length, j / tube);
    }
  }
  const stride = tube + 1;
  for (let i = 0; i < points.length; i += 1) {
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
  const opening = openingLoop(family, 12);
  // The lining follows the same relaxed lip, slightly inset and below it.
  // Its previous independent topY left a dark panel floating above the shell.
  const width = Math.max(...opening.map(([x]) => Math.abs(x))) * 0.96;
  const depth = Math.max(...opening.map(([, , z]) => Math.abs(z))) * 1.86;
  const bottomY = Math.min(...opening.map(([, y]) => y)) - Math.min(0.43, spec.ry * 0.6);
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const count = opening.length;
  opening.forEach(([x, topY, z], i) => {
    const normal = normalize(-x / Math.max(width, 0.001), 0.06, -z / Math.max(depth * 0.5, 0.001));
    for (const [y, factor, v] of [[topY - 0.022, 0.96, 0], [bottomY, 0.80, 1]] as const) {
      positions.push(x * factor, y, z * factor);
      normals.push(...normal);
      uvs.push(i / count * 12, v * 8);
    }
  });
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count, a = i * 2, b = j * 2;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const floorCenter = positions.length / 3;
  positions.push(0, bottomY, 0);
  normals.push(0, 1, 0);
  uvs.push(0.5, 0.5);
  const floorRing = positions.length / 3;
  opening.forEach(([x, , z]) => {
    positions.push(x * 0.80, bottomY, z * 0.80);
    normals.push(0, 1, 0);
    uvs.push(0.5 + x / Math.max(width * 2, 0.001), 0.5 + z / Math.max(depth, 0.001));
  });
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    indices.push(floorCenter, floorRing + j, floorRing + i);
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
    const sx = x / Math.max(0.001, Math.max(Math.abs(minX), Math.abs(maxX)));
    const sy = y / Math.max(0.001, Math.max(Math.abs(minY), Math.abs(maxY)));
    const radial = clamp(1 - sx * sx - sy * sy, 0, 1);
    // Hinge construction: the upper edge stays close to the bag body while the
    // lower half rolls gently toward the viewer. This gives the flap a real
    // textile fold instead of a centered sticker-like dome.
    const hingeT = clamp((maxY - y) / Math.max(0.001, maxY - minY), 0, 1);
    const hingeCurl = Math.pow(hingeT, 1.55) * frontBulge * 0.72;
    const lateralBow = frontBulge * 0.28 * Math.pow(radial, 1.35);
    return half + hingeCurl + lateralBow;
  };
  const frontNormalAt = (x: number, y: number) => {
    const sx = x / Math.max(0.001, Math.max(Math.abs(minX), Math.abs(maxX)));
    const sy = y / Math.max(0.001, Math.max(Math.abs(minY), Math.abs(maxY)));
    const radial = clamp(1 - sx * sx - sy * sy, 0, 1);
    const hingeT = clamp((maxY - y) / Math.max(0.001, maxY - minY), 0, 1);
    const hingeSlope = frontBulge * 0.72 * 1.55 * Math.pow(Math.max(0.001, hingeT), 0.55) / Math.max(0.001, maxY - minY);
    const lateralSlope = frontBulge * 0.28 * 2.7 * Math.pow(Math.max(0, radial), 0.32);
    return normalize(-sx * lateralSlope, hingeSlope + sy * lateralSlope, 1);
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
attribute vec3 aPosition,aNormal,aTangent,aBitangent;
attribute vec2 aUv;
uniform mat4 uProjection,uView,uModel;
uniform mat4 uShadowMatrix;
uniform mat3 uNormalMatrix;
uniform mediump float uRelief;
uniform mediump float uStitch;
varying vec3 vNormal,vWorld,vTangent,vBitangent;
varying float vReliefScale;
varying vec4 vShadowPosition;
varying vec2 vUv;
${ABAGS_CROCHET_HEIGHT_GLSL}
void main(){
  float height=crochetHeight(aUv,uStitch)*uRelief*.48;
  vec3 pos=aPosition+aNormal*height;
  vec4 world=uModel*vec4(pos,1.0);
  vWorld=world.xyz;
  vShadowPosition=uShadowMatrix*world;
  vNormal=normalize(uNormalMatrix*aNormal);
  vReliefScale=dot(mat3(uModel)*aNormal,vNormal);
  // UV derivatives follow the front, back and gusset, including mirrored UVs.
  vTangent=mat3(uModel)*aTangent;
  vBitangent=mat3(uModel)*aBitangent;
  vUv=aUv;
  gl_Position=uProjection*uView*world;
}`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vNormal,vWorld,vTangent,vBitangent;
varying float vReliefScale;
varying vec4 vShadowPosition;
varying vec2 vUv;
uniform vec3 uColor,uLight;
uniform float uMaterial;
uniform mediump float uRelief;
uniform mediump float uStitch;
uniform sampler2D uFiberTexture;
uniform sampler2D uShadowTexture;
uniform float uShadowEnabled,uShadowTexel;
${ABAGS_CROCHET_HEIGHT_GLSL}
float cordShadow(float ndl){
  if(uShadowEnabled<.5)return 1.0;
  vec3 coordinate=vShadowPosition.xyz/vShadowPosition.w*.5+.5;
  if(coordinate.x<0.0||coordinate.x>1.0||coordinate.y<0.0||coordinate.y>1.0||coordinate.z>1.0||coordinate.z<0.0)return 1.0;
  float bias=.00025+.00035*(1.0-ndl);
  float light=0.0;
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
    float depth=texture2D(uShadowTexture,coordinate.xy+vec2(float(x),float(y))*uShadowTexel).r;
    light+=coordinate.z-bias<=depth?1.0:.16;
  }
  return light/9.0;
}
vec3 filmic(vec3 x){
  return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.0,1.0);
}
void main(){
  vec3 n=normalize(vNormal);
  vec3 l=normalize(uLight);
  vec3 fill=normalize(vec3(.72,.26,-.35));
  vec3 v=normalize(vec3(0.0,.02,5.0)-vWorld);
  vec3 h=normalize(l+v);
  float rough=.88,metal=0.0,detail=1.0,cordOcclusion=1.0,sheen=0.0;
  if(uMaterial<.5){
    float visibility=1.0;
#ifdef ABAGS_DERIVATIVES
    vec2 stitchUv=vUv*vec2(22.0,20.0);
    float footprint=max(length(dFdx(stitchUv)),length(dFdy(stitchUv)));
    visibility=1.0-smoothstep(.32,.95,footprint);
#endif
    float cord=crochetHeight(vUv,uStitch);
    float e=.0008;
    vec2 slope=vec2(
      crochetHeight(vUv+vec2(e,0.0),uStitch)-crochetHeight(vUv-vec2(e,0.0),uStitch),
      crochetHeight(vUv+vec2(0.0,e),uStitch)-crochetHeight(vUv-vec2(0.0,e),uStitch)
    )/(2.0*e);
    // Reciprocal UV frame converts relief to physical slopes on curved panels.
    // Unlike a global XY normal map this also lights yarn on the side wall.
    vec3 reciprocalU=cross(vBitangent,n);
    float determinant=dot(vTangent,reciprocalU);
    if(abs(determinant)>.00001){
      vec3 gradient=(reciprocalU*slope.x+cross(n,vTangent)*slope.y)/determinant;
      n=normalize(n-gradient*uRelief*vReliefScale*.48*visibility);
    }
    float fullness=smoothstep(.12,.86,cord);
    float dye=.985+.015*sin(vUv.x*43.0+sin(vUv.y*19.0)*2.0);
    // Intersections are softly occluded; dark outlines made the old weave read as ink.
    detail=mix(1.0,mix(.92,1.035,fullness)*dye,visibility);
    cordOcclusion=mix(1.0,mix(.72,1.0,smoothstep(.08,.72,cord)),visibility);
    rough=.91;
    sheen=.055;
  }else if(uMaterial<1.5){
    float grain=sin(vUv.x*37.0+sin(vUv.y*8.0)*1.8);
    float pores=textileHash(floor(vUv*vec2(150.0,46.0)));
    detail=.91+.065*grain+.02*(pores-.5);
    rough=.53;
  }else if(uMaterial<2.5){
    detail=.94+.035*(textileHash(floor(vUv*150.0))-.5);
    rough=.58;
  }else if(uMaterial<3.5){
    detail=.9+.07*sin(vUv.x*72.0)*sin(vUv.y*38.0);
    rough=.84;
  }else if(uMaterial<4.5){
    metal=.97; rough=.22;
  }else if(uMaterial<5.5){
    vec2 checker=floor(vUv*vec2(12.0,12.0));
    detail=mix(.78,1.0,mod(checker.x+checker.y,2.0));
    rough=.94;
  }else if(uMaterial<6.5){
    detail=.87+.025*sin(vUv.x*118.0+vUv.y*97.0);
    rough=.96;
  }else if(uMaterial<7.5){
    // Individually modelled round cord: only filament detail belongs in the shader.
    // U measures distance along the strand in radii; V goes around its circumference.
    vec2 fiberUv=vec2(vUv.y,vUv.x*.07);
    float fibre=texture2D(uFiberTexture,fiberUv).r;
    vec2 fiberSlope=vec2(
      texture2D(uFiberTexture,fiberUv+vec2(.0015,0.0)).r-texture2D(uFiberTexture,fiberUv-vec2(.0015,0.0)).r,
      texture2D(uFiberTexture,fiberUv+vec2(0.0,.0015)).r-texture2D(uFiberTexture,fiberUv-vec2(0.0,.0015)).r
    );
    detail=.60+.80*fibre;
    vec3 along=normalize(vTangent);
    vec3 around=normalize(vBitangent-n*dot(n,vBitangent));
    n=normalize(n-around*fiberSlope.x*1.25-along*fiberSlope.y*.65);
    rough=.94;
    sheen=.065;
  }else{
    // Continuous matte substrate is visible only deep between physical cords.
    detail=.36;
    rough=.98;
  }
  float ndl=max(dot(n,l),0.0);
  float fillLight=max(dot(n,fill),0.0);
  float ndh=max(dot(n,h),0.0);
  float ndv=max(dot(n,v),.001);
  float vdh=max(dot(v,h),0.0);
  float shadow=cordShadow(ndl);
  vec3 base=pow(uColor,vec3(2.2))*detail;
  // Broad studio key and environment fill, evaluated in linear colour space.
  float sky=.28+.12*max(n.y,0.0);
  vec3 diffuse=base*(sky+1.12*ndl*shadow+.30*fillLight)*cordOcclusion*(1.0-metal);
  float alpha=rough*rough,alpha2=alpha*alpha;
  float denominator=ndh*ndh*(alpha2-1.0)+1.0;
  float distribution=alpha2/(3.14159*denominator*denominator+.0001);
  float k=(rough+1.0)*(rough+1.0)/8.0;
  float geometry=(ndl/(ndl*(1.0-k)+k))*(ndv/(ndv*(1.0-k)+k));
  vec3 f0=mix(vec3(.035),base,metal);
  vec3 fresnel=f0+(1.0-f0)*pow(1.0-vdh,5.0);
  vec3 specular=distribution*geometry*fresnel/(4.0*ndv*max(ndl,.001)+.001)*ndl*shadow;
  // A broad reflection keeps metal legible between direct highlights.
  vec3 environment=mix(vec3(.50,.43,.36),vec3(.96,.97,1.0),smoothstep(-.35,.65,n.y));
  vec3 metalReflection=environment*base*metal*(.35+.45*pow(1.0-ndv,2.0));
  vec3 fiberSheen=mix(base,vec3(1.0),.25)*sheen*pow(1.0-ndv,4.0);
  // A restrained warm atelier bounce keeps pale cords from washing out.
  vec3 color=diffuse+specular+metalReflection+fiberSheen+base*vec3(.035,.024,.018);
  gl_FragColor=vec4(pow(filmic(max(color,0.0)),vec3(1.0/2.2)),1.0);
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
  const tangent = gl.createBuffer();
  const bitangent = gl.createBuffer();
  const index = gl.createBuffer();
  if (!position || !normal || !uv || !tangent || !bitangent || !index) throw new Error("buffer");
  const frame = textileUvFrame(data);
  gl.bindBuffer(gl.ARRAY_BUFFER, position); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, normal); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, uv); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.uvs), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, tangent); gl.bufferData(gl.ARRAY_BUFFER, frame.tangent, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, bitangent); gl.bufferData(gl.ARRAY_BUFFER, frame.bitangent, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);
  return { position, normal, uv, tangent, bitangent, index, count: data.indices.length };
}

function init(canvas: HTMLCanvasElement, onMaterialReady: () => void): Renderer | null {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  const derivatives = gl.getExtension("OES_standard_derivatives")
    ? "#extension GL_OES_standard_derivatives : enable\n#define ABAGS_DERIVATIVES\n" : "";
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, derivatives + FRAGMENT));
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
    cordMeshes: new Map(),
    cordTexture: createCordTexture(gl, canvas, onMaterialReady),
    shadow: createCordShadow(gl),
    commands: [],
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
      woodHandle: createMesh(gl, makeArchTube(0.46, 0.42, 0, 0.042, 96, 16, true)),
      crochetHandle: createMesh(gl, makeArchTube(0.72, 0.72, 0, 0.059, 72, 12, false)),
      toteStrap: createMesh(gl, familyShoulderStrapMesh("tote")),
      roundStrap: createMesh(gl, familyShoulderStrapMesh("round")),
      bucketStrap: createMesh(gl, familyShoulderStrapMesh("bucket")),
      miniStrap: createMesh(gl, familyShoulderStrapMesh("mini")),
      toteChain: createMesh(gl, familyShoulderChainMesh("tote")),
      roundChain: createMesh(gl, familyShoulderChainMesh("round")),
      bucketChain: createMesh(gl, familyShoulderChainMesh("bucket")),
      miniChain: createMesh(gl, familyShoulderChainMesh("mini")),
      ring: createMesh(gl, makeArchTube(0.13, 0.13, 0, 0.025, 40, 9, true)),
      sphere: createMesh(gl, makeEllipsoid(1, 1, 1)),
      ribbon: createMesh(gl, makeEllipsoid(0.46, 0.14, 0.045, 18, 30)),
      cone: createMesh(gl, makeCone()),
    },
    attribs: {
      position: gl.getAttribLocation(program, "aPosition"),
      normal: gl.getAttribLocation(program, "aNormal"),
      uv: gl.getAttribLocation(program, "aUv"),
      tangent: gl.getAttribLocation(program, "aTangent"),
      bitangent: gl.getAttribLocation(program, "aBitangent"),
    },
    uniforms: {
      projection: req("uProjection"), view: req("uView"), model: req("uModel"), normalMatrix: req("uNormalMatrix"), color: req("uColor"), material: req("uMaterial"), stitch: req("uStitch"), relief: req("uRelief"), light: req("uLight"), fiberTexture: req("uFiberTexture"), shadowMatrix: req("uShadowMatrix"), shadowTexture: req("uShadowTexture"), shadowEnabled: req("uShadowEnabled"), shadowTexel: req("uShadowTexel"),
    },
  };
}

function drawMesh(renderer: Renderer, mesh: Mesh, model: Float32Array, color: string, material: number, stitch: number, relief = 0) {
  renderer.commands.push({ mesh, model, color, material, stitch, relief });
}

function drawCommand(renderer: Renderer, { mesh, model, color, material, stitch, relief }: DrawCommand) {
  const { gl, attribs, uniforms } = renderer;
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position); gl.enableVertexAttribArray(attribs.position); gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal); gl.enableVertexAttribArray(attribs.normal); gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv); gl.enableVertexAttribArray(attribs.uv); gl.vertexAttribPointer(attribs.uv, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.tangent); gl.enableVertexAttribArray(attribs.tangent); gl.vertexAttribPointer(attribs.tangent, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.bitangent); gl.enableVertexAttribArray(attribs.bitangent); gl.vertexAttribPointer(attribs.bitangent, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
  gl.uniformMatrix4fv(uniforms.model, false, model);
  gl.uniformMatrix3fv(uniforms.normalMatrix, false, textileNormalMatrix(model));
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

function familyShoulderStrapMesh(family: Exclude<Family, "">) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  // Build the shoulder strap in the same coordinate space as the family rings.
  // The old generic 1.18 × 1.62 arch was later scaled into place; on narrow
  // Chromium viewports that produced a long detached vertical leg because the
  // projected arch no longer matched the actual attachment span. Generate the
  // arch at the calibrated span instead, with a deliberately compact rise.
  const span = spec.rx * spec.attachmentWidthFactor;
  const rise = clamp(spec.ry * 0.48, 0.28, 0.44);
  return makeArchTube(span, rise, 0, 0.043, 84, 12, false);
}

function familyShoulderChainMesh(family: Exclude<Family, "">) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  // Chain and fabric straps attach to the same hardware. The former tall
  // chain arch clipped the mobile stage and extended beyond those anchors.
  const span = spec.rx * spec.attachmentWidthFactor;
  const rise = clamp(spec.ry * 0.48, 0.28, 0.44);
  return makeSegmentedChain(span, rise, 0, spec.chain[2], spec.chain[3], spec.chain[4]);
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

// The verifier owns the stage, while draw() owns the WebGL canvas. Publish the
// canvas proof onto the stage that Final3DController actually inspects.
function publishFrameMetadata(stage: HTMLElement, canvas: HTMLCanvasElement, config: Config) {
  const frameSignature = canvas.dataset.abagsFidelity3dFrame || renderSignature(config);
  const blockedSignature = stage.dataset.abagsFinal3dBlockedSignature || "";
  const fallbackReason = stage.dataset.abagsFinal3dReason || "";
  const recoverableReadinessFallback = fallbackReason.startsWith("renderer-not-ready:")
    || fallbackReason === "current-frame-not-drawn";
  if (stage.dataset.abagsFinal3d === "fallback" && blockedSignature === renderSignature(config) && !recoverableReadinessFallback) return;

  stage.dataset.abagsFidelity3dFrame = frameSignature;
  stage.dataset.abagsFidelity3dFrameAt = canvas.dataset.abagsFidelity3dFrameAt || String(Date.now());
  stage.removeAttribute("data-abags-fidelity3d-error");
}

function publishRendererError(stage: HTMLElement, canvas: HTMLCanvasElement, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.slice(0, 160) : fallback;
  canvas.removeAttribute("data-abags-fidelity3d-frame");
  canvas.removeAttribute("data-abags-fidelity3d-frame-at");
  canvas.dataset.abagsFidelity3dError = message;
  stage.removeAttribute("data-abags-fidelity3d-frame");
  stage.removeAttribute("data-abags-fidelity3d-frame-at");
  stage.dataset.abagsFidelity3dError = message;
}

function draw(renderer: Renderer, canvas: HTMLCanvasElement, config: Config, rotation: { x: number; y: number }, zoom: number) {
  const { gl, uniforms, meshes } = renderer;
  if (gl.isContextLost()) throw new Error("webgl-context-lost");
  gl.useProgram(renderer.program);
  renderer.commands = [];
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.uniformMatrix4fv(uniforms.projection, false, perspective(Math.PI / 5.3, width / height, 0.1, 100));
  gl.uniformMatrix4fv(uniforms.view, false, translation(0, -0.02, -5.0));
  gl.uniform3fv(uniforms.light, new Float32Array([-0.42, 0.86, 0.92]));
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, renderer.cordTexture);
  gl.uniform1i(uniforms.fiberTexture, 0);
  gl.uniformMatrix4fv(uniforms.shadowMatrix, false, renderer.shadow?.matrix ?? identity());
  gl.uniform1f(uniforms.shadowEnabled, renderer.shadow ? 1 : 0);
  gl.uniform1f(uniforms.shadowTexel, renderer.shadow ? 1 / renderer.shadow.size : 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, renderer.shadow?.texture ?? renderer.cordTexture);
  gl.uniform1i(uniforms.shadowTexture, 1);
  // Keep the construction state empty in the controls, but never leave the 3D
  // stage visually empty. Before the customer chooses a family, render a neutral
  // atelier base model; as soon as a family/color/stitch is selected, the same
  // WebGL surface switches to the live configuration.
  const renderFamily: Exclude<Family, ""> = config.family || "tote";
  const profile = config.family ? PROFILES[config.family] : PROFILES.tote;
  const root = multiply(scale(zoom, zoom, zoom), multiply(rotX(rotation.x), rotY(rotation.y)));
  const body = config.color || "#b87880";
  const stitch = stitchId(config.stitch || "classic");
  const relief = config.color && config.stitch ? 0.037 : 0.016;
  const physicalCord = stitch === 0 || stitch === 1;
  const bodyModel = multiply(root, matrix([0, profile.bodyY, 0], [1, 1, 1]));
  drawMesh(renderer, meshes[renderFamily], bodyModel, body, physicalCord ? 8 : 0, stitch, physicalCord ? 0 : relief);
  if (physicalCord) {
    const key = `${renderFamily}:${stitch}`;
    let cords = renderer.cordMeshes.get(key);
    if (!cords) {
      cords = createCrochetCordMeshes(renderFamily, stitch).map((data) => createMesh(gl, data));
    }
    renderer.cordMeshes.delete(key);
    renderer.cordMeshes.set(key, cords);
    while (renderer.cordMeshes.size > 2) {
      const oldest = renderer.cordMeshes.keys().next().value!;
      for (const mesh of renderer.cordMeshes.get(oldest)!) {
        for (const buffer of [mesh.position, mesh.normal, mesh.uv, mesh.tangent, mesh.bitangent, mesh.index]) gl.deleteBuffer(buffer);
      }
      renderer.cordMeshes.delete(oldest);
    }
    for (const cord of cords) drawMesh(renderer, cord, bodyModel, body, 7, stitch, 0);
  }

  const openingColor = config.color ? body : "#d8cec4";
  const agataOpenWoodTote = renderFamily === "tote" && config.handles.startsWith("wood");
  const interiorColor = agataOpenWoodTote ? "#f0e7d9" : darken(openingColor, 0.58);
  // The red and brown wooden-handle versions share one silhouette and geometry.
  // The checked lining is visible when the customer rotates the same model to look inside.
  drawMesh(renderer, config.family ? meshes[config.family + "Interior"] : meshes.toteInterior, root, interiorColor, agataOpenWoodTote ? 5 : 6, stitch, 0);
  drawMesh(renderer, config.family ? meshes[config.family + "Rim"] : meshes.toteRim, root, openingColor, 0, stitch, config.color && config.stitch ? 0.009 : 0.004);

  if (config.strap !== "none") {
    const metal = config.hardware === "silver" ? "#d7dbe0" : config.hardware === "black" ? "#29272a" : "#caa55d";
    const strapColor = config.strap === "chain" ? metal : config.strap === "leather" ? "#6b4738" : "#a77d87";
    const material = config.strap === "chain" ? 4 : config.strap === "leather" ? 2 : 3;
    const attachment = familyAttachment(profile, renderFamily);
    const strapMesh = config.strap === "chain"
      ? (config.family ? meshes[config.family + "Chain"] : meshes.toteChain)
      : meshes[renderFamily + "Strap"];
    drawMesh(
      renderer,
      strapMesh,
      multiply(
        root,
        matrix(
          [0, attachment.y - 0.02, attachment.z + 0.035],
          [1, 1, 1],
        ),
      ),
      strapColor,
      material,
      stitch,
      0,
    );
  }

  if (config.handles !== "none") {
    const handleColor = config.handles === "wood-light" ? "#b98a55" : config.handles === "wood-dark" ? "#573622" : body;
    const material = config.handles.startsWith("wood") ? 1 : 0;
    const isWoodHandle = config.handles.startsWith("wood");
    const mesh = isWoodHandle ? meshes.woodHandle : meshes.crochetHandle;
    const zOffset = profile.topDepth * 0.30;
    // The wooden tote has one ring at the front rim and one at the back rim.
    // They are separated through the bag depth, not arranged left/right across
    // the front face; each ring must rise clearly above the opening.
    if (isWoodHandle) {
      const transform = {
        x: 0,
        // Keep the rigid ring visible above the softly domed crocheted mouth
        // at a 3/4 camera yaw, without changing its attachment-plane depth.
        y: profile.topY + 0.17,
        scaleX: profile.width * 0.62,
        scaleY: Math.max(0.28, profile.handleScaleY * 0.88),
      };
      // Two physical rigid rings sit on the front and rear mounting planes.
      // Keep enough depth to reveal separate attachment points in side view.
      // A small part of the rear ring naturally peeks out at 3/4 yaw: that is
      // physical occlusion, not a detached flat 2D decoration.
      // Anchor the rings into the actual front/back rim. The former .78
      // offset placed their feet too far outside the shell, breaking the rear arch
      // into detached fragments at a three-quarter camera angle.
      // The matching back textile dome is deeper than the former flat rear panel.
      // Seat the two rings just outside BOTH physical textile faces (0.61)
      // so the rear arch remains visible in profile without detached handles.
      const depthPlanes = [-profile.topDepth * 0.61, profile.topDepth * 0.61];
      for (const z of depthPlanes) {
        drawMesh(
          renderer,
          mesh,
          multiply(root, matrix([transform.x, transform.y, z], [transform.scaleX, transform.scaleY, 1])),
          handleColor,
          material,
          stitch,
          0,
        );
      }
    } else {
      for (const side of [-1, 1]) {
        const transform = handleTransform(profile, renderFamily, side);
        for (const z of [-zOffset * 0.72, zOffset * 0.72]) {
          drawMesh(
            renderer,
            mesh,
            multiply(root, matrix([transform.x, transform.y, z], [transform.scaleX, transform.scaleY, 1])),
            handleColor,
            material,
            stitch,
            0.008,
          );
        }
      }
    }
  }

  if (config.flap !== "none") {
    const flapColor = config.flap === "leather-black" ? "#242124" : config.flap === "leather-cognac" ? "#7c5034" : config.flap === "suede-burgundy" ? "#803248" : body;
    const material = config.flap === "crochet" ? 0 : 2;
    drawMesh(renderer, meshes.flap, multiply(root, matrix([0, profile.flapY, profile.frontZ + 0.045], profile.flapScale, [0.02, 0, 0])), flapColor, material, stitch, config.flap === "crochet" ? 0.0035 : 0);
  }

  const metal = config.hardware === "silver" ? "#d7dbe0" : config.hardware === "black" ? "#29272a" : "#caa55d";
  // Closure hardware is only present when a flap/closure is selected.
  if (config.flap !== "none") {
    drawMesh(renderer, meshes.sphere, multiply(root, matrix([0, profile.lockY, profile.frontZ + 0.15], [0.088, 0.088, 0.058])), metal, 4, 0);
  }

  if (config.strap !== "none") {
    for (const side of [-1, 1]) {
      const attachment = familyAttachment(profile, renderFamily);
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

  // Optional ornaments are drawn only by the synchronized accessory compositor.
  // Rendering them here as well created doubled bows/charms; this renderer owns
  // the bag body, flap, handles, shoulder strap and strap attachment hardware.
  // Do not add unconditional decorative hardware to an otherwise plain bag.

  if (renderer.shadow) renderCordShadow(renderer.shadow, renderer.commands);
  gl.useProgram(renderer.program);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, width, height);
  gl.colorMask(true, true, true, true);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, renderer.cordTexture);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, renderer.shadow?.texture ?? renderer.cordTexture);
  for (const command of renderer.commands) drawCommand(renderer, command);
  renderer.commands = [];
  canvas.dataset.abagsCordShadow = renderer.shadow ? "ready" : "unsupported";

  const renderError = gl.getError();
  if (renderError !== gl.NO_ERROR) throw new Error(`webgl-render-error-${renderError}`);
  if (gl.isContextLost()) throw new Error("webgl-context-lost");

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
  const [canvasNode, setCanvasNode] = useState<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const cameraRef = useRef({ rotation: DEFAULT_ROTATION, zoom: DEFAULT_ZOOM });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  useLayoutEffect(() => {
    // Initialization and ResizeObserver callbacks outlive a single camera state.
    cameraRef.current = { rotation, zoom };
  }, [rotation, zoom]);

  useEffect(() => {
    const find = () => setStage((current) => {
      const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-vc-builder-active");
      // The renderer must read configuration from the exact stage that owns its
      // canvas. Several legacy/final-stage wrappers can coexist during promotion;
      // choosing an unrelated engine-stage makes the swatch UI and WebGL model
      // drift apart (e.g. purple selected while the bag stays pink).
      // The active customer stage is authoritative. A stale canvas may briefly
      // survive in a hidden compatibility stage during mobile family replacement;
      // selecting its parent first portals the live renderer into the wrong stage
      // and disconnects the controls/configuration from the visible builder.
      const liveStage =
        dialog?.querySelector<HTMLElement>(".abags-vc-preview .abags-bag-builder-stage[data-abags-live-stage='true']") ??
        dialog?.querySelector<HTMLElement>(".abags-bag-builder-stage[data-abags-live-stage='true']");
      const canvas =
        dialog?.querySelector<HTMLCanvasElement>(".abags-fidelity3d-canvas") ??
        document.querySelector<HTMLCanvasElement>(".abags-fidelity3d-canvas");
      const canvasStage = canvas?.closest<HTMLElement>(".abags-bag-builder-stage") ?? null;
      const next =
        liveStage ??
        dialog?.querySelector<HTMLElement>(".abags-vc-preview .abags-bag-builder-stage[data-abags-engine-stage='true']") ??
        dialog?.querySelector<HTMLElement>(".abags-bag-builder-stage[data-abags-engine-stage='true']") ??
        dialog?.querySelector<HTMLElement>(".abags-vc-preview .abags-bag-builder-stage") ??
        canvasStage ??
        document.querySelector<HTMLElement>(".abags-bag-builder-stage[data-abags-engine-stage='true']");
      return current === next ? current : next;
    });
    find();
    const observer = new MutationObserver(find);
    // The live preview is promoted by changing stage attributes, not always by
    // inserting/removing DOM nodes. Observe those transitions as well as portal
    // mounts so the WebGL layer, neutral fallback and interactive controls move
    // together into the currently active customer stage on mobile.
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-abags-live-stage", "data-abags-engine-stage"],
    });
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

  useLayoutEffect(() => {
    if (!stage) return;
    let disposed = false;
    let retryFrame = 0;
    let stageObserver: MutationObserver | null = null;
    let boundCanvas: HTMLCanvasElement | null = null;
    let contextLost = false;

    const unbindCanvasEvents = () => {
      boundCanvas?.removeEventListener("webglcontextlost", handleContextLost);
      boundCanvas?.removeEventListener("webglcontextrestored", handleContextRestored);
      boundCanvas = null;
    };

    const initialize = () => {
      if (disposed || contextLost || rendererRef.current) return;
      const canvas = canvasNode ?? canvasRef.current ?? stage.querySelector<HTMLCanvasElement>(".abags-fidelity3d-canvas");
      if (!canvas) {
        retryFrame = window.requestAnimationFrame(initialize);
        return;
      }
      canvasRef.current = canvas;
      if (boundCanvas !== canvas) {
        unbindCanvasEvents();
        boundCanvas = canvas;
        canvas.addEventListener("webglcontextlost", handleContextLost);
        canvas.addEventListener("webglcontextrestored", handleContextRestored);
      }
      try {
        const nextRenderer = init(canvas, () => {
          requestAnimationFrame(() => {
            const renderer = rendererRef.current;
            if (disposed || !renderer || renderer !== nextRenderer || canvasRef.current !== canvas) return;
            const rect = stage.getBoundingClientRect();
            if (rect.width < 40 || rect.height < 40) return;
            try {
              const { rotation, zoom } = cameraRef.current;
              draw(renderer, canvas, readConfig(stage), rotation, zoom);
              publishFrameMetadata(stage, canvas, readConfig(stage));
            } catch (error) {
              publishRendererError(stage, canvas, error, "material-frame-failed");
            }
          });
        });
        if (!nextRenderer) throw new Error("webgl-unavailable");
        rendererRef.current = nextRenderer;

        // Keep the deterministic fallback visible while WebGL is being prepared.
        // A valid WebGL context alone is not evidence that the customer can see a
        // rendered product. The renderer is promoted only after draw() succeeds.
        stage.classList.remove("abags-pro3d-active", "abags-fidelity3d-active");
        stage.removeAttribute("data-abags-pro3d-ready");
        stage.removeAttribute("data-abags-fidelity3d-ready");
        setReady(false);

        const paint = () => {
          if (disposed || rendererRef.current !== nextRenderer || canvasRef.current !== canvas) return;
          try {
            const rect = stage.getBoundingClientRect();
            if (rect.width < 40 || rect.height < 40) {
              requestAnimationFrame(paint);
              return;
            }
            const currentConfig = readConfig(stage);
            const { rotation, zoom } = cameraRef.current;
            draw(nextRenderer, canvas, currentConfig, rotation, zoom);

            // If this exact frame was already rejected, do not publish new proof that
            // would re-trigger promotion and recreate the blank-stage race.
            const blockedSignature = stage.dataset.abagsFinal3dBlockedSignature || "";
            const fallbackReason = stage.dataset.abagsFinal3dReason || "";
            // Missing frame/readiness metadata can time out while the stage is
            // still hidden. A successful first paint must be allowed to publish
            // evidence for validation. Keep the block for actual canvas/pixel acceptance failures.
            const recoverableReadinessFallback = fallbackReason.startsWith("renderer-not-ready:")
              || fallbackReason === "current-frame-not-drawn";
            if (
              stage.dataset.abagsFinal3d === "fallback" &&
              blockedSignature === renderSignature(currentConfig) &&
              !recoverableReadinessFallback
            ) {
              stage.classList.remove("abags-pro3d-active", "abags-fidelity3d-active");
              stage.removeAttribute("data-abags-pro3d-ready");
              stage.removeAttribute("data-abags-fidelity3d-ready");
              setReady(false);
              return;
            }

            publishFrameMetadata(stage, canvas, currentConfig);

            // Promotion happens only after a successful framebuffer write.
            // This prevents Android/Chromium from hiding the SVG fallback when
            // WebGL initialized but the first visible frame was still blank.
            stage.classList.remove("abags-pro3d-active", "abags-fidelity3d-active");
            stage.setAttribute("data-abags-pro3d-ready", "true");
            stage.setAttribute("data-abags-fidelity3d-ready", ABAGS_FIDELITY_V4_RENDERER_VERSION);
            // Final customer-visible state is owned exclusively by Final3DController.
            // The renderer publishes only its own framebuffer-readiness metadata.
            stage.classList.remove("abags-final3d-ready");
            setReady(true);
          } catch (error) {
            rendererRef.current = null;
            publishRendererError(stage, canvas, error, "render-failed");
            setReady(false);
            stage.classList.remove("abags-pro3d-active", "abags-fidelity3d-active");
            stage.removeAttribute("data-abags-pro3d-ready");
            stage.removeAttribute("data-abags-fidelity3d-ready");
          }
        };
        requestAnimationFrame(paint);
      } catch (error) {
        rendererRef.current = null;
        publishRendererError(stage, canvas, error, "renderer-init-failed");
        setReady(false);
        stage.classList.remove("abags-pro3d-active", "abags-fidelity3d-active");
        stage.removeAttribute("data-abags-pro3d-ready");
        stage.removeAttribute("data-abags-fidelity3d-ready");
        retryFrame = window.requestAnimationFrame(initialize);
      }
    };

    initialize();
    stageObserver = new MutationObserver(initialize);
    stageObserver.observe(stage, { childList: true, subtree: true });
    const resizeObserver = new ResizeObserver(() => {
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      if (!renderer || !canvas) return;
      try {
        const rect = stage.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) return;
        const currentConfig = readConfig(stage);
        const { rotation, zoom } = cameraRef.current;
        draw(renderer, canvas, currentConfig, rotation, zoom);
        publishFrameMetadata(stage, canvas, currentConfig);
      } catch (error) {
        publishRendererError(stage, canvas, error, "resize-render-failed");
      }
    });
    resizeObserver.observe(stage);

    return () => {
      disposed = true;
      if (retryFrame) window.cancelAnimationFrame(retryFrame);
      stageObserver?.disconnect();
      resizeObserver.disconnect();
      unbindCanvasEvents();
      rendererRef.current = null;
      stage.classList.remove("abags-pro3d-active", "abags-fidelity3d-active");
      stage.removeAttribute("data-abags-pro3d-ready");
      stage.removeAttribute("data-abags-fidelity3d-ready");
    };

    function handleContextLost(event: Event) {
      event.preventDefault();
      if (disposed || !stage) return;
      contextLost = true;
      if (retryFrame) window.cancelAnimationFrame(retryFrame);
      retryFrame = 0;
      setReady(false);
      rendererRef.current = null;
      const canvas = boundCanvas;
      if (canvas) publishRendererError(stage, canvas, new Error("webgl-context-lost"), "webgl-context-lost");
      stage.classList.remove("abags-pro3d-active", "abags-fidelity3d-active");
      stage.removeAttribute("data-abags-pro3d-ready");
      stage.removeAttribute("data-abags-fidelity3d-ready");
      // Programs and buffers are invalid until the browser restores the context.
      // Keep the fallback visible instead of retrying initialization every frame.
    }

    function handleContextRestored() {
      if (disposed) return;
      contextLost = false;
      rendererRef.current = null;
      // Rebuild all GPU resources, then let the controller verify the new frame.
      setRendererEpoch((value) => value + 1);
    }
  }, [stage, rendererEpoch]);

  useEffect(() => {
    if (!stage) return;
    // The accessory compositor is a separate 2D projection layer. Publish the exact
    // WebGL camera transform so straps/handles/accents stay locked to the 3D model
    // during initial render, rotation and pinch/wheel zoom.
    stage.setAttribute("data-abags-fidelity3d-rotation-x", String(rotation.x));
    stage.setAttribute("data-abags-fidelity3d-rotation-y", String(rotation.y));
    stage.setAttribute("data-abags-fidelity3d-zoom", String(zoom));
    stage.dispatchEvent(new CustomEvent("abags:fidelity3d-transform", {
      detail: { rotation: { x: rotation.x, y: rotation.y }, zoom },
    }));
  }, [rotation, zoom, stage]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;

    const renderFrame = () => {
      if (rendererRef.current !== renderer || canvasRef.current !== canvas) return;
      try {
        const rect = stage?.getBoundingClientRect();
        if (rect && (rect.width < 40 || rect.height < 40)) return;
        draw(renderer, canvas, config, rotation, zoom);
        if (stage) publishFrameMetadata(stage, canvas, config);
      } catch (error) {
        rendererRef.current = null;
        if (stage) publishRendererError(stage, canvas, error, "render-failed");
        else {
          canvas.removeAttribute("data-abags-fidelity3d-frame");
          canvas.removeAttribute("data-abags-fidelity3d-frame-at");
          canvas.dataset.abagsFidelity3dError = error instanceof Error ? error.message.slice(0, 160) : "render-failed";
        }
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
    <div
      className="abags-pro3d-layer abags-fidelity3d-layer"
      data-abags-pro3d
      data-abags-fidelity3d
      onPointerDown={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("button, input, select, textarea, .abags-pro3d-view-controls, .abags-pro3d-zoom, .abags-fidelity3d-view-controls, .abags-fidelity3d-zoom")) return;
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
      onWheel={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("button, input, select, textarea, .abags-pro3d-view-controls, .abags-pro3d-zoom, .abags-fidelity3d-view-controls, .abags-fidelity3d-zoom")) return;
        event.preventDefault();
        setZoom((value) => clamp(value - event.deltaY * 0.0008, MIN_ZOOM, MAX_ZOOM));
      }}
    >
      <div className="abags-neutral-3d" aria-hidden="true">
          <div className="abags-neutral-3d-shadow" />
          <div className="abags-neutral-3d-object">
            <div className="abags-neutral-3d-front">
              <span className="abags-neutral-3d-stitch" />
              <span className="abags-neutral-3d-lock" />
            </div>
            <div className="abags-neutral-3d-side" />
            <div className="abags-neutral-3d-top" />
            <div className="abags-neutral-3d-handle abags-neutral-3d-handle-left" />
            <div className="abags-neutral-3d-handle abags-neutral-3d-handle-right" />
          </div>
      </div>
      <canvas
        ref={(node) => {
          canvasRef.current = node;
          setCanvasNode(node);
          if (!node) return;
          const host = node.closest<HTMLElement>(".abags-bag-builder-stage");
          if (host) setStage((current) => current ?? host);
        }}
        className="abags-pro3d-canvas abags-fidelity3d-canvas"
        style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
        aria-label={label}

      />

      <div className="abags-pro3d-chip">MODEL ATELIER 3D · REALNE PROPORCJE</div>
      <div className="abags-pro3d-view-controls" aria-label="Widok modelu 3D">
        <button type="button" className={view === "front" ? "is-active" : ""} aria-pressed={view === "front"} onClick={() => setView("front")}>Przód</button>
        <button type="button" className={view === "three" ? "is-active" : ""} aria-pressed={view === "three"} onClick={() => setView("three")}>3/4</button>
        <button type="button" className={view === "side" ? "is-active" : ""} aria-pressed={view === "side"} onClick={() => setView("side")}>Bok</button>
      </div>

      <div className="abags-pro3d-zoom" aria-label="Zoom modelu 3D">
        <button type="button" onClick={() => setZoom((value) => clamp(value - 0.10, MIN_ZOOM, MAX_ZOOM))} aria-label="Oddal model">−</button>
        <span>ODDAL</span>
        <input type="range" min={34} max={145} step={1} value={Math.round(zoom * 100)} onChange={(event) => setZoom(clamp(Number(event.currentTarget.value) / 100, MIN_ZOOM, MAX_ZOOM))} aria-label="Skala modelu 3D" />
        <span>PRZYBLIŻ</span>
        <button type="button" onClick={() => setZoom((value) => clamp(value + 0.10, MIN_ZOOM, MAX_ZOOM))} aria-label="Przybliż model">+</button>
        <button type="button" className="abags-pro3d-reset" onClick={() => { setRotation(DEFAULT_ROTATION); setViewState("three"); setZoom(DEFAULT_ZOOM); }}>{Math.round(zoom * 100)}%</button>
      </div>

      <p className="abags-pro3d-hint">Obrót 360° pokazuje rzeczywistą zmianę głębokości korpusu · pinch zoom · fason i dodatki aktualizują się na żywo.</p>
    </div>,
    stage,
  );
}
