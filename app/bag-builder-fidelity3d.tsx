"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ABAGS_FIDELITY_V4_FAMILY_SPECS,
  ABAGS_FIDELITY_V4_RENDERER_VERSION,
  type FidelityV4Family,
} from "../lib/abags-fidelity-v4-family-spec";
import { isAgataBuilderConstructionSupported } from "../lib/abags-builder-fidelity";
import { ABAGS_YARN_PALETTES, ABAGS_PASTEL_MINI_YARN_PALETTE, getAbagsYarnPalette } from "../lib/abags-yarn-palettes";
import { getAbagsReferenceModel, getAbagsWoodHandleTone, getAbagsWoodHandleShape, getAbagsCrochetFlapTone } from "../lib/abags-reference-models";
import { createAbagsPrintedTextiles, requestAbagsPrintedTextiles, disposeAbagsPrintedTextiles, type AbagsPrintedTextiles } from "../lib/abags-printed-textiles";
import { getAbagsPrintedTextileProfile } from "../lib/abags-textile-profiles";
import { AbagsCameraGesture, keyboardCamera, wheelCameraZoom, type AbagsCamera } from "../lib/abags-camera-controls";

type Family = "" | "tote" | "round" | "bucket" | "mini" | "satchel" | "tall-tote" | "shoulder";
type Stitch = "" | "classic" | "herringbone" | "basket" | "shell";
type Flap = "none" | "crochet" | "leather-black" | "leather-cognac" | "suede-burgundy";
type Handles = "none" | "wood-light" | "wood-dark" | "crochet" | "leather-braid";
type Strap = "none" | "leather" | "woven" | "chain" | "woven-ornament" | "crochet-braid" | "woven-floral" | "woven-striped" | "chain-leather";
type Hardware = "gold" | "silver" | "black";
type Accent = "none" | "tassel" | "scarf" | "bow" | "charm";

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
  printedTextiles: AbagsPrintedTextiles;
  onTextileReady?: () => void;
  referenceKey?: string;
  referenceParts?: Array<{ name: string; tone: "metal" | "engraving" | "zipper" | "fabric" | "cord" }>;
  referenceTriangles?: number;
  bandPrint?: number;
  ombre?: boolean;
  ombrePalette?: number;
  cognacParts?: CognacPart[];
  interiorEvidence?: { family: FidelityV4Family; topY: number; bottomY: number; probe: YarnPoint };
  rimKey?: string;
  rimTriangles?: number;
  groundPoints?: YarnPoint[];
  shoulderBandKey?: string;
  shoulderBandParts?: Array<{ name: string; tone: BandTone; material: number }>;
  shoulderBandBounds?: { min: YarnPoint; max: YarnPoint };
  shoulderBandTriangles?: number;
  ornamentKey?: string;
  ornamentParts?: Array<{ name: string; tone: OrnamentTone; material: number }>;
  ornamentBounds?: { min: YarnPoint; max: YarnPoint };
  ornamentTriangles?: number;
  yarnKey?: string;
  woodBindingKey?: string;
  referenceWoodHandleShape?: WoodHandleShape;
  strapBindingKey?: string;
  crochetFlapKey?: string;
  crochetFlapLockZ?: number;
  flapShellKey?: string;
  flapLockZ?: number;
  flapLockRotation?: [number, number, number];
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  meshes: Record<string, Mesh>;
  attribs: { position: number; normal: number; uv: number };
  uniforms: Record<"projection" | "view" | "model" | "normalMatrix" | "color" | "material" | "stitch" | "relief" | "light" | "interiorBounds" | "yarnGradientAxis" | "yarnGradientRange" | "yarnOmbre" | "fabricStyle" | "fabricFlower" | "fabricLeaf" | "fabricBorder" | "bandPrint" | "textileReady" | "scarfPrint" | "strapPrint" | "scarfPrintUv" | "strapPrintUv", WebGLUniformLocation>;
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
const CAMERA_LIMITS = { minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM };

const PROFILES: Record<Exclude<Family, "">, FamilyProfile> = Object.fromEntries(
  (Object.keys(ABAGS_FIDELITY_V4_FAMILY_SPECS) as FidelityV4Family[]).map((family) => {
    const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
    return [family, {
      bodyY: spec.bodyY,
      topY: spec.topY,
      frontZ: spec.depth * (family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : family === "satchel" ? 1.35 : family === "tall-tote" ? 1.55 : family === "shoulder" ? 1.42 : 1) / 2,
      baseDepth: spec.depth * (family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : family === "satchel" ? 1.35 : family === "tall-tote" ? 1.55 : family === "shoulder" ? 1.42 : 1),
      topDepth: spec.depth * (family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : family === "satchel" ? 1.35 : family === "tall-tote" ? 1.55 : family === "shoulder" ? 1.42 : 1) * 0.92,
      bottomDepth: spec.depth * (family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : family === "satchel" ? 1.35 : family === "tall-tote" ? 1.55 : family === "shoulder" ? 1.42 : 1) * 1.12,
      width: spec.rx,
      handleScale: spec.handleScale[0],
      handleScaleY: spec.handleScale[1],
      handleY: spec.topY + 0.14,
      flapScale: [spec.flapScale[0], spec.flapScale[1], 1],
      flapY: spec.flapY ?? spec.topY * 0.34,
      lockY: spec.lockY ?? spec.ringY - 0.32,
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

function hardwareEngravingColor(hardware: Hardware) {
  return hardware === "silver" ? "#3A3D43" : hardware === "black" ? "#97908A" : "#49382C";
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

// Inverse transpose keeps highlights correct on nonuniformly scaled wood/leather.
function normalMatrix(model: Float32Array) {
  const [a, b, c] = [model[0], model[1], model[2]];
  const [d, e, f] = [model[4], model[5], model[6]];
  const [g, h, i] = [model[8], model[9], model[10]];
  const determinant = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  const inverse = Math.abs(determinant) > 1e-8 ? 1 / determinant : 1;
  return new Float32Array([
    (e * i - f * h) * inverse, (f * g - d * i) * inverse, (d * h - e * g) * inverse,
    (c * h - b * i) * inverse, (a * i - c * g) * inverse, (b * g - a * h) * inverse,
    (b * f - c * e) * inverse, (c * d - a * f) * inverse, (a * e - b * d) * inverse,
  ]);
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

function flapContour(family?: Exclude<Family, "">): Point[] {
  const p: Point[] = [];
  if (family === "satchel") {
    quad(p, [-.95, .55], [0, .57], [.95, .55], 18);
    quad(p, [.95, .55], [1.04, .16], [.72, -.28], 16);
    quad(p, [.72, -.28], [.62, -.48], [.40, -.48], 12);
    quad(p, [.40, -.48], [0, -.50], [-.40, -.48], 16);
    quad(p, [-.40, -.48], [-.62, -.48], [-.72, -.28], 12);
    quad(p, [-.72, -.28], [-1.04, .16], [-.95, .55], 16);
    return p;
  }
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
  const depthScale = family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : family === "satchel" ? 1.35 : family === "tall-tote" ? 1.55 : family === "shoulder" ? 1.42 : 1;
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
  const depthScale = family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : family === "satchel" ? 1.35 : family === "tall-tote" ? 1.55 : family === "shoulder" ? 1.42 : 1;
  const bulgeZ = spec.depth * depthScale * (0.018 + 0.018 * familyFactor) * center * (1 - Math.min(1, Math.abs(yn))) * (0.72 + 0.28 * lower);
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
  const depthScale = family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : family === "satchel" ? 1.35 : family === "tall-tote" ? 1.55 : family === "shoulder" ? 1.42 : 1;
  const bevel = Math.min(spec.bevel, spec.depth * 0.14);
  const inset = 0.965;

  const addRing = (scaleFactor: number, zSign: number, zInset: number, mode: "face" | "bevel" | "side") => {
    const startIndex = positions.length / 3;
    contour.forEach((point) => {
      const x = cx + (point[0] - cx) * scaleFactor;
      const rawY = cy + (point[1] - cy) * scaleFactor;
      const softness = softBodyOffset(family, x, rawY);
      const y = rawY + softness.y;
      const z = zSign > 0
        ? depthAt(family, y) * 0.5 - zInset + softness.z
        : -depthAt(family, y) * 0.5 + zInset - softness.z;
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
        const nz = mode === "bevel" ? zSign * 0.72 : zSign;
        const tangent = mode === "side" ? 0.22 : mode === "bevel" ? 0.7 : 0;
        normal = normalize(radial[0] * tangent, radial[1] * tangent, nz);
      }
      normals.push(...normal);
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
    positions.push(cx, cy, side === 1
      ? depthAt(family, cy) * .5 - bevel + frontBulge + bodyDomeLift
      : -depthAt(family, cy) * .5 + bevel - backBulge);
    normals.push(0, 0, side);
    uvs.push(.5, .5);
    for (let i = 0; i < contour.length; i++) {
      const j = (i + 1) % contour.length;
      if (side === 1) indices.push(center, previous + i, previous + j);
      else indices.push(center, previous + j, previous + i);
    }
  };
  addFabricFace(frontFace, 1);
  addFabricFace(backFace, -1);

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
    const outward = normalize(ty, -tx, 0.055);
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
    connect(frontFace, frontEdge);
    // A visible, open mouth: gusset triangles are intentionally omitted above
    // the top edge. Depth is a real woven wall instead of a flat UV-stretched cap.
    if ((contour[i][1] + contour[next][1]) * .5 < spec.ry * .90) {
      for (let across = 0; across < sideRows; across++) {
        const a = sideStart + i * (sideRows + 1) + across;
        const b = sideStart + (i + 1) * (sideRows + 1) + across;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    connect(backEdge, backFace, true);
  }

  return { positions, normals, uvs, indices };
}

// The mouth follows the actual shell, including its vertical offset. An
// independent rectangular rim used to float above the textile at three-quarter view.
function openingPath(family: Exclude<Family, "">): Array<[number, number, number]> {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const upper = familyContour(family).filter(([, y]) => y >= spec.ry * .90);
  const edge = ([x, y]: Point, side: number): [number, number, number] => {
    const softness = softBodyOffset(family, x, y);
    return [x, y + softness.y + spec.bodyY, side * (depthAt(family, y) * .5 + softness.z)];
  };
  return [...upper.map((point) => edge(point, 1)), ...[...upper].reverse().map((point) => edge(point, -1))];
}

function woodHandleDepthPlanes(family: Exclude<Family, "">): [number, number] {
  const frontSeam = openingPath(family).filter((point) => point[2] > 0);
  const top = frontSeam.reduce((highest, point) => point[1] > highest[1] ? point : highest);
  return [-top[2], top[2]];
}

// Anchor the open ends of each rigid wooden arch to the same top seam as
// the crocheted bag, rather than suspending both ends above it.
function woodHandleMountHeight(family: Exclude<Family, "">) {
  return Math.max(...openingPath(family).map((point) => point[1])) - 0.012;
}

// The wooden ring and its stitching share one transform, including the inward
// cant. Binding created in screen space used to separate when the bag rotated.
function woodHandleMatrix(family: Exclude<Family, "">, z: number) {
  const profile = PROFILES[family];
  return matrix([0, woodHandleMountHeight(family), z],
    [profile.width * (family === "tall-tote" ? 1.12 : .84), Math.max(.28, profile.handleScaleY * 1.35), 1],
    [z < 0 ? 0.40 : -0.40, 0, 0]);
}

type FabricMesh = { positions: number[]; normals: number[]; uvs: number[]; indices: number[]; occlusion?: number[]; cordOccluders?: CordOccluder[] };
type YarnPoint = [number, number, number];
type CordOccluder = { a: YarnPoint; b: YarnPoint; radius: number; owner: number };
type WoodHandleShape = "round" | "flat-base";

// The photographed rose handle has a straight lower rail with rounded corners.
// Share this centreline between the wood and its cord binding so both turn as
// one physical construction. The other references retain their circular rings.
function referenceWoodHandleFrame(angle: number, shape: WoodHandleShape = "round") {
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  let center: YarnPoint = [.46 * Math.cos(a), .42 * Math.sin(a), 0];
  let tangent = normalize(-.46 * Math.sin(a), .42 * Math.cos(a), 0);
  if (shape === "flat-base" && a > Math.PI) {
    // The inner corner must also leave room for the 5 mm cord; a tighter
    // bend would make its winding intersect the adjacent wooden rail.
    const corner = .12, foot = .02, rail = .46 - corner;
    const arc = Math.PI * corner / 2;
    let distance = (a - Math.PI) / Math.PI * (2 * foot + 2 * arc + 2 * rail);
    if (distance <= foot) {
      center = [-.46, -distance, 0]; tangent = [0, -1, 0];
    } else if ((distance -= foot) <= arc) {
      const turn = Math.PI + distance / corner;
      center = [-rail + corner * Math.cos(turn), -foot + corner * Math.sin(turn), 0];
      tangent = [-Math.sin(turn), Math.cos(turn), 0];
    } else if ((distance -= arc) <= 2 * rail) {
      center = [-rail + distance, -foot - corner, 0]; tangent = [1, 0, 0];
    } else if ((distance -= 2 * rail) <= arc) {
      const turn = Math.PI * 1.5 + distance / corner;
      center = [rail + corner * Math.cos(turn), -foot + corner * Math.sin(turn), 0];
      tangent = [-Math.sin(turn), Math.cos(turn), 0];
    } else {
      center = [.46, -foot + distance - arc, 0]; tangent = [0, 1, 0];
    }
  }
  const outward: YarnPoint = [tangent[1], -tangent[0], 0];
  return { center, tangent, outward };
}

function appendCord(mesh: FabricMesh, points: YarnPoint[], thickness: number, guide: (point: YarnPoint) => YarnPoint, contains: (point: YarnPoint) => boolean, sides = 10, closed = false, occluders?: CordOccluder[]) {
  let previous = -1;
  let distance = 0;
  const firstRingVertex = mesh.positions.length / 3;
  // Each physical length starts at a different carrier phase. Keep it in
  // object space: orbiting or restoring a saved bag must never reseed its yarn.
  const origin = points[0] ?? [0, 0, 0];
  const cordPhase = Math.sin(origin[0] * 31.7 + origin[1] * 47.3 + origin[2] * 19.1) * Math.PI;
  points.forEach((point, index) => {
    if (index > 0) distance += Math.hypot(...point.map((value, axis) => value - points[index - 1][axis]));
    if (!contains(point)) { previous = -1; return; }
    const before = points[index ? index - 1 : closed ? points.length - 2 : 0];
    const after = points[index < points.length - 1 ? index + 1 : closed ? 1 : points.length - 1];
    const tangent = normalize(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
    let normal = guide(point);
    // A spatial hem can briefly run parallel to its preferred guide. Choose
    // another axis there so its round section never collapses to zero normals.
    if (Math.hypot(normal[1] * tangent[2] - normal[2] * tangent[1], normal[2] * tangent[0] - normal[0] * tangent[2], normal[0] * tangent[1] - normal[1] * tangent[0]) < 1e-7)
      normal = Math.abs(tangent[1]) < .8 ? [0, 1, 0] : [1, 0, 0];
    const across = normalize(normal[1] * tangent[2] - normal[2] * tangent[1], normal[2] * tangent[0] - normal[0] * tangent[2], normal[0] * tangent[1] - normal[1] * tangent[0]);
    const outward = normalize(tangent[1] * across[2] - tangent[2] * across[1], tangent[2] * across[0] - tangent[0] * across[2], tangent[0] * across[1] - tangent[1] * across[0]);
    const start = mesh.positions.length / 3;
    // Handmade polyester cord is tensioned unevenly by adjacent crochet
    // loops. Keep a genuinely round 5 mm cross-section, with only a gentle
    // 1-3% variation in radius along the length of each strand. This adds
    // physical soft-spun relief without more vertices, texture files, or
    // random per-frame deformation during orbit/zoom.
    const yarnRadius = thickness * (1
      + .018 * Math.sin(distance * 19.3 + index * .19 + cordPhase)
      + .009 * Math.sin(distance * 43.7 - index * .11 + cordPhase * 1.7));
    for (let side = 0; side <= sides; side++) {
      const angle = side / sides * Math.PI * 2;
      const cosine = Math.cos(angle), sine = Math.sin(angle);
      const n = across.map((v, axis) => v * cosine + outward[axis] * sine) as YarnPoint;
      const around = across.map((v, axis) => -v * sine + outward[axis] * cosine) as YarnPoint;
      // Three interlaced carriers change the TRUE tube cross-section. A
      // low, seam-continuous helical profile catches side light during orbit.
      // This works alongside the lengthwise hand-tension radius above.
      const twist = distance / (thickness * 1.6) * Math.PI * 2;
      const plyPhase = 3 * angle - twist * .8 + cordPhase;
      const finePhase = 5 * angle + twist * 1.3 - cordPhase * .7;
      const plyRadius = 1 + .023 * Math.cos(plyPhase) + .007 * Math.sin(finePhase);
      const angularSlope = -.023 * 3 * Math.sin(plyPhase) + .007 * 5 * Math.cos(finePhase);
      const axialSlope = .023 * (.8 * Math.PI * 2 / 1.6) * Math.sin(plyPhase)
        + .007 * (1.3 * Math.PI * 2 / 1.6) * Math.cos(finePhase);
      const surfaceNormal = normalize(
        n[0] - around[0] * angularSlope - tangent[0] * axialSlope,
        n[1] - around[1] * angularSlope - tangent[1] * axialSlope,
        n[2] - around[2] * angularSlope - tangent[2] * axialSlope,
      );
      // The two ends of a sewn closed cord use identical position/normal
      // rings. Helical yarn twist changes phase along the perimeter; without
      // welding its duplicate end, the rim would acquire a tiny visible split.
      // UVs are kept separate for a proper seam and existing index topology.
      if (closed && index === points.length - 1) {
        const first = (firstRingVertex + side) * 3;
        mesh.positions.push(...mesh.positions.slice(first, first + 3));
        mesh.normals.push(...mesh.normals.slice(first, first + 3));
      } else {
        mesh.positions.push(...point.map((v, axis) => v + n[axis] * yarnRadius * plyRadius));
        mesh.normals.push(...surfaceNormal);
      }
      // The braid repeats at the same physical scale on short loops and long
      // bindings. A normalized 0..1 path stretched the fibres on every seam.
      mesh.uvs.push(distance / (thickness * 1.6) + cordPhase / (Math.PI * 2), side / sides);
      if (previous >= 0 && side < sides) {
        const a = previous + side, b = start + side;
        mesh.indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    if (occluders && previous >= 0) occluders.push({ a: points[index - 1], b: point, radius: thickness, owner: firstRingVertex });
    previous = start;
  });
}

// Bake neighbouring-cord visibility once when a stitch is constructed. A grid
// limits each query to nearby capsule segments; dragging never repeats this work.
// Taking the strongest contribution per cord avoids counting its subdivisions
// as independent occluders. The bake is neutral and follows the actual 3D yarn.
function bakeCordOcclusion(mesh: FabricMesh, occluders: CordOccluder[]) {
  const vertices = mesh.positions.length / 3;
  const values = new Array<number>(vertices).fill(1);
  if (!occluders.length) { mesh.occlusion = values; return; }
  const cell = Math.max(...occluders.map(span => span.radius)) * 4;
  const grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  for (let i = 0; i < occluders.length; i++) {
    const span = occluders[i], pad = span.radius * 3;
    const low = span.a.map((n,j) => Math.floor((Math.min(n,span.b[j])-pad)/cell));
    const high = span.a.map((n,j) => Math.floor((Math.max(n,span.b[j])+pad)/cell));
    for (let x=low[0];x<=high[0];x++) for (let y=low[1];y<=high[1];y++) for (let z=low[2];z<=high[2];z++) {
      const id=key(x,y,z), bucket=grid.get(id);
      if (bucket) bucket.push(i); else grid.set(id,[i]);
    }
  }
  const seen = new Uint32Array(vertices), maximum = new Float32Array(vertices);
  for (let vertex=0;vertex<vertices;vertex++) {
    const offset=vertex*3, x=mesh.positions[offset], y=mesh.positions[offset+1], z=mesh.positions[offset+2];
    const nx=mesh.normals[offset], ny=mesh.normals[offset+1], nz=mesh.normals[offset+2];
    const candidates=grid.get(key(Math.floor(x/cell),Math.floor(y/cell),Math.floor(z/cell)));
    if (!candidates) continue;
    let coverage=0;
    for (const index of candidates) {
      const {a,b,radius,owner}=occluders[index];
      const ax=b[0]-a[0], ay=b[1]-a[1], az=b[2]-a[2];
      const squared=ax*ax+ay*ay+az*az;
      const t=squared>1e-12?clamp(((x-a[0])*ax+(y-a[1])*ay+(z-a[2])*az)/squared,0,1):0;
      const dx=a[0]+ax*t-x, dy=a[1]+ay*t-y, dz=a[2]+az*t-z;
      const facing=nx*dx+ny*dy+nz*dz;
      if (facing<=0) continue;
      const distanceSquared=dx*dx+dy*dy+dz*dz;
      if (distanceSquared>radius*radius*9 || distanceSquared<1e-12) continue;
      const contribution=Math.min(1,radius*radius/distanceSquared)*Math.min(1,facing/Math.sqrt(distanceSquared));
      if (seen[owner]!==vertex+1) {
        seen[owner]=vertex+1; maximum[owner]=contribution; coverage+=contribution;
      } else if (contribution>maximum[owner]) {
        coverage+=contribution-maximum[owner]; maximum[owner]=contribution;
      }
    }
    values[vertex]=Math.max(.40,Math.exp(-coverage*1.3));
  }
  mesh.occlusion=values;
}

type CrochetPatch = {
  rx: number; ry: number; radius: number; columns: number; rows: number;
  seat: (x: number, y: number, lift: number) => YarnPoint;
  tube: (points: YarnPoint[], thickness?: number) => void;
  curveSteps?: number;
};

// The open V in Agata's photographs is taller than a compact herringbone.
// Use the same physical gauge on the body, gusset and flap, keeping 5 mm cord.
function crochetGaugeColumns(stitch: Stitch) {
  // The supplied originals have about twelve open V columns across the body.
  // Sixteen at the same cord diameter closed the gaps into a scale-like skin.
  return stitch === "basket" ? 10 : stitch === "classic" || stitch === "shell" ? 12 : 16;
}

function crochetRowCount(columns: number, rx: number, ry: number, stitch: Stitch, minimum: number) {
  return Math.max(minimum, Math.round(columns * ry / rx * (stitch === "classic" ? .82 : 1.12)));
}

function interlockedVPoint(t: number, width: number, height: number, radius: number): YarnPoint {
  const leg = 2 * t - 1;
  const bend = (Math.sqrt(leg * leg + .008) - Math.sqrt(.008)) / (Math.sqrt(1.008) - Math.sqrt(.008));
  // The crown rises in front, while both shoulders pass beneath the next row.
  // The originals 1000019763/1000019645 show long, nearly straight diagonal
  // legs. A sinusoidal X made them curl into short, scale-like U shapes.
  // Keep a small round turn at the tip so the physical cord has no sharp kink.
  return [leg * width * .43, (bend - .48) * height,
    radius * (.36 * Math.sin(Math.PI * t) - .20 * Math.pow(Math.abs(leg), 6) + .10 * Math.sin(Math.PI * 2 * t))];
}

// One construction produces each selected stitch on panels, flaps and gussets.
function fillCrochetPatch(patch: CrochetPatch, stitch: Stitch) {
  const { radius, columns, rows, seat, tube, curveSteps = 16 } = patch;
  const spec = { rx: patch.rx, ry: patch.ry };
  const dx = spec.rx * 1.94 / columns, dy = spec.ry * 1.94 / rows;
  const curve = (cx: number, cy: number, width: number, height: number, lift: number, drift: number, interlocked = false) => {
    const points: YarnPoint[] = [];
    for (let i = 0; i <= curveSteps; i++) {
      const t = i / curveSteps;
      // A smooth U/V loop, curling outwards at the shoulders like the atelier cord.
      const local = interlocked ? interlockedVPoint(t, width, height, radius) : [
        Math.sin((t - .5) * Math.PI) * width * .43,
        (Math.pow(Math.abs(2 * t - 1), 1.65) - .48) * height,
        radius * .24 * Math.sin(t * Math.PI * 2),
      ];
      points.push(seat(cx + local[0] + drift * Math.sin(t * Math.PI), cy + local[1], lift + local[2]));
    }
    tube(points);
  };
  for (let row = -1; row <= rows; row++) {
    for (let column = -1; column <= columns; column++) {
      // Real hand-crocheted 5 mm cord does not keep machine-identical gauge.
      // Low-amplitude, deterministic tension changes preserve the stitch and
      // panel silhouette without randomising a saved model between frames.
      const variation = Math.sin((row + 7) * 17.31 + (column + 11) * 5.97);
      const crossTension = Math.sin((row + 3) * 7.47 - (column + 5) * 9.13);
      const widthGauge = 1 + variation * .035;
      const heightGauge = 1 + crossTension * .028;
      const rowOffset = (row % 2) * .5;
      const cx = -spec.rx * .97 + (column + .5 + rowOffset) * dx + variation * dx * .012;
      const cy = -spec.ry * .97 + (row + .5) * dy + crossTension * dy * .012;
      if (stitch === "basket") {
        const verticalOver = (row + column) % 2 === 0;
        for (const axis of [0, 1]) for (const strand of [-1, 1]) {
          const points: YarnPoint[] = [];
          for (let i = 0; i <= Math.max(4, curveSteps / 2); i++) {
            const t = i / Math.max(4, curveSteps / 2) - .5;
            const x = cx + (axis === 0 ? strand * dx * .19 : t * dx * 1.10) * widthGauge;
            const y = cy + (axis === 0 ? t * dy * 1.10 : strand * dy * .19) * heightGauge;
            const over = (axis === 0) === verticalOver;
            points.push(seat(x, y, over ? radius * (.50 + .35 * Math.cos(t * Math.PI)) : -radius * .28));
          }
          tube(points, radius * .84);
        }
      } else if (stitch === "shell") {
        // Rounded fans, with a crossing lower crown instead of a flat scallop icon.
        curve(cx, cy, dx * 1.30 * widthGauge, dy * .90 * heightGauge, radius * (.12 + variation * .055), variation * dx * .035);
        curve(cx, cy + dy * .28, dx * .78 * widthGauge, dy * .72 * heightGauge, radius * (.24 + crossTension * .055), -variation * dx * .025);
      } else {
        const compact = stitch === "herringbone";
        curve(cx, cy, dx * (compact ? 1.06 : 1.18) * widthGauge, dy * (compact ? .84 : 1.36) * heightGauge,
          variation * radius * .14, variation * dx * .035, !compact);
      }
    }
  }
}

// Actual 5 mm cord, seated on the same soft shell as the lining and opening.
// Each stitch has a round cross-section, depth and its own surface normals.
function crochetPanelPoint(family: Exclude<Family, "">, x: number, y: number, lift = 0): YarnPoint {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const radius = spec.rx * 5 / 160;
  const taper = 1 + spec.taper * y / spec.ry;
  const fraction = Math.pow(Math.pow(Math.abs(x / (spec.rx * taper)), spec.power) + Math.pow(Math.abs(y / spec.ry), spec.power), 1 / spec.power);
  const softness = softBodyOffset(family, x, y);
  const dome = Math.max(0, 1 - Math.pow(fraction / .965, 2));
  const bevel = Math.min(spec.bevel, spec.depth * .14);
  const depthScale = family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : 1.42;
  const bulge = spec.depth * .12 * depthScale;
  return [x, y + softness.y, depthAt(family, y + softness.y) * .5 - bevel + softness.z + bulge * dome + radius * .62 + lift];
}

function makeCrochetPanel(family: Exclude<Family, "">, stitch: Stitch): FabricMesh {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  const occluders: CordOccluder[] = [];
  const radius = spec.rx * 5 / 160;
  const columns = crochetGaugeColumns(stitch);
  const rows = crochetRowCount(columns, spec.rx, spec.ry, stitch, 9);
  const fractionAt = (x: number, y: number) => {
    const taper = 1 + spec.taper * y / spec.ry;
    return Math.pow(Math.pow(Math.abs(x / (spec.rx * taper)), spec.power) + Math.pow(Math.abs(y / spec.ry), spec.power), 1 / spec.power);
  };
  const seat = (x: number, y: number, lift: number) => crochetPanelPoint(family, x, y, lift);
  const tube = (points: YarnPoint[], thickness = radius) => appendCord(mesh, points, thickness, () => [0, 0, 1], (point) => fractionAt(point[0], point[1]) <= .974, 10, false, occluders);
  fillCrochetPatch({ rx: spec.rx, ry: spec.ry, radius, columns, rows, seat, tube }, stitch);
  // A continuous sewn binding hides clipped loop ends at the rounded panel edge.
  const binding = familyContour(family).map(([x, y]) => seat(x * .953, y * .953, radius * .05));
  binding.push(binding[0]);
  tube(binding, radius * .78);
  mesh.cordOccluders = occluders;
  return mesh;
}

function makeCrochetGusset(family: Exclude<Family, "">, stitch: Stitch = "classic"): FabricMesh {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const contour = familyContour(family);
  const arcs = [0];
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i], b = contour[(i + 1) % contour.length];
    arcs.push(arcs[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const perimeter = arcs[arcs.length - 1];
  const gaugeColumns = crochetGaugeColumns(stitch);
  const columns = Math.round(perimeter / (spec.rx * 1.94 / gaugeColumns));
  const depth = depthAt(family, 0);
  const rows = crochetRowCount(columns, perimeter * .5, depth * .5, stitch, 3);
  const radius = spec.rx * 5 / 160;
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  const occluders: CordOccluder[] = [];
  const at = (arc: number, across: number, lift: number): YarnPoint => {
    const distance = ((arc % perimeter) + perimeter) % perimeter;
    let i = 0;
    while (i < contour.length - 1 && arcs[i + 1] < distance) i++;
    const t = (distance - arcs[i]) / Math.max(.0001, arcs[i + 1] - arcs[i]);
    const a = contour[i], b = contour[(i + 1) % contour.length];
    const normal = normalize(b[1] - a[1], a[0] - b[0], 0);
    const x = a[0] * (1 - t) + b[0] * t, y = a[1] * (1 - t) + b[1] * t;
    const softness = softBodyOffset(family, x, y);
    return [x + normal[0] * (radius * .15 + lift), y + softness.y + normal[1] * (radius * .15 + lift), (.5 - across) * (depthAt(family, y) + softness.z * 2)];
  };
  const seat = (x: number, y: number, lift: number) => at(x + perimeter * .5, .5 - y / depth, lift);
  const tube = (points: YarnPoint[], thickness = radius) => appendCord(mesh, points, thickness,
    ([x, y]) => normalize(x / spec.rx, y / spec.ry, 0),
    ([, y, z]) => y < spec.ry * .90 && Math.abs(z) < depthAt(family, y) * .51, 8, false, occluders);
  fillCrochetPatch({ rx: perimeter * .5, ry: depth * .5, radius, columns, rows, seat, tube, curveSteps: 8 }, stitch);
  // Sewn piping covers the clipped ends where the gusset joins each panel.
  for (const side of [-1, 1]) {
    const seam = contour.map(([x, y]): YarnPoint => {
      const softness = softBodyOffset(family, x, y);
      return [x, y + softness.y, side * (depthAt(family, y) * .5 + softness.z)];
    });
    seam.push(seam[0]);
    appendCord(mesh, seam, radius * 1.02, () => [0, 0, side], ([, y]) => y < spec.ry * .90, 8, false, occluders);
  }
  mesh.cordOccluders = occluders;
  return mesh;
}

function ensureCrochetMeshes(renderer: Renderer, family: Exclude<Family, "">, stitch: Stitch) {
  const key = family + ":" + stitch;
  if (renderer.yarnKey === key) return;
  for (const name of ["yarnFront", "yarnBack", "yarnSide"]) {
    const mesh = renderer.meshes[name];
    if (mesh) for (const buffer of [mesh.position, mesh.normal, mesh.uv, mesh.index]) renderer.gl.deleteBuffer(buffer);
  }
  const front = makeCrochetPanel(family, stitch);
  // Material visibility is prepared at GPU upload, after pure geometry work.
  renderer.meshes.yarnFront = createMesh(renderer.gl, front);
  const back = {
    positions: front.positions.map((v, i) => i % 3 === 2 ? -v : v),
    normals: front.normals.map((v, i) => i % 3 === 2 ? -v : v),
    uvs: front.uvs,
    occlusion: front.occlusion,
    indices: front.indices.map((v, i, indices) => i % 3 === 1 ? indices[i + 1] : i % 3 === 2 ? indices[i - 1] : v),
  };
  renderer.meshes.yarnBack = createMesh(renderer.gl, back);
  const side = makeCrochetGusset(family, stitch);
  renderer.meshes.yarnSide = createMesh(renderer.gl, side);
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  // Keep the actual lower cord vertices for studio contact. No pixel readback
  // or reconstruction from a generic family rectangle is needed while dragging.
  renderer.groundPoints = [];
  for (const mesh of [front, back, side]) for (let i = 0; i < mesh.positions.length; i += 3) {
    if (mesh.positions[i + 1] < -spec.ry * .70) renderer.groundPoints.push([mesh.positions[i], mesh.positions[i + 1] + spec.bodyY, mesh.positions[i + 2]]);
  }
  renderer.groundPoints = groundSupportPoints(renderer.groundPoints);
  renderer.yarnKey = key;
}

function groundSupportPoints(points: YarnPoint[]) {
  // Select real extreme vertices once per construction. The camera may rotate
  // freely in yaw and tilt through its full range without scanning thousands
  // of hidden cord vertices on every pointer movement.
  const selected = new Set<number>();
  for (let elevation = 0; elevation <= 12; elevation++) {
    const angle = elevation * .09, horizontal = Math.sin(angle), ny = -Math.cos(angle);
    for (let azimuth = 0; azimuth < (elevation ? 48 : 1); azimuth++) {
      const a = azimuth / 48 * Math.PI * 2, nx = horizontal * Math.cos(a), nz = horizontal * Math.sin(a);
      let best = -Infinity, index = 0;
      for (let i = 0; i < points.length; i++) {
        const p = points[i], value = nx * p[0] + ny * p[1] + nz * p[2];
        if (value > best) { best = value; index = i; }
      }
      selected.add(index);
    }
  }
  return [...selected].map(i => points[i]);
}

// A flat wooden ring needs a rectangular wrap with rounded corners. The former
// elliptical winding cut through the wide faces and exposed strips of wood.
function flatWoodWrapSection(halfWidth: number, halfDepth: number, clearance: number, progress: number): Point {
  const arc = Math.PI * clearance / 2;
  const perimeter = 4 * (halfWidth + halfDepth) + 4 * arc;
  let distance = ((progress % 1) + 1) % 1 * perimeter;
  if (distance <= halfDepth) return [halfWidth + clearance, distance];
  distance -= halfDepth;
  if (distance <= arc) { const a = distance / clearance; return [halfWidth + clearance * Math.cos(a), halfDepth + clearance * Math.sin(a)]; }
  distance -= arc;
  if (distance <= 2 * halfWidth) return [halfWidth - distance, halfDepth + clearance];
  distance -= 2 * halfWidth;
  if (distance <= arc) { const a = Math.PI / 2 + distance / clearance; return [-halfWidth + clearance * Math.cos(a), halfDepth + clearance * Math.sin(a)]; }
  distance -= arc;
  if (distance <= 2 * halfDepth) return [-halfWidth - clearance, halfDepth - distance];
  distance -= 2 * halfDepth;
  if (distance <= arc) { const a = Math.PI + distance / clearance; return [-halfWidth + clearance * Math.cos(a), -halfDepth + clearance * Math.sin(a)]; }
  distance -= arc;
  if (distance <= 2 * halfWidth) return [-halfWidth + distance, -halfDepth - clearance];
  distance -= 2 * halfWidth;
  if (distance <= arc) { const a = Math.PI * 1.5 + distance / clearance; return [halfWidth + clearance * Math.cos(a), -halfDepth + clearance * Math.sin(a)]; }
  return [halfWidth + clearance, -halfDepth + distance - arc];
}

function woodHandleBindingPaths(family: Exclude<Family, "">, z: number, shape: WoodHandleShape = "round") {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const transform = woodHandleMatrix(family, z);
  const side = z < 0 ? -1 : 1;
  const radius = spec.rx * 5 / 160 * .78;
  const coil = (family === "tall-tote" ? .055 : .042) + radius * .72;
  const coilDepth = family === "tall-tote" ? .026 + radius * .72 : coil;
  const start = Math.PI + .10, span = Math.PI - .20;
  const world = (x: number, y: number, depth: number): YarnPoint => [
    transform[0] * x + transform[4] * y + transform[8] * depth + transform[12],
    transform[1] * x + transform[5] * y + transform[9] * depth + transform[13],
    transform[2] * x + transform[6] * y + transform[10] * depth + transform[14],
  ];
  const flat = family === "tall-tote", arcs = [0], stepsPerTurn = flat ? 40 : 14;
  const depth = normalize(transform[8], transform[9], transform[10]);
  const flatFrame = (angle: number) => {
    const frame = referenceWoodHandleFrame(angle, shape);
    const center = world(...frame.center);
    const [tx, ty] = frame.tangent;
    const tangent = normalize(transform[0]*tx + transform[4]*ty, transform[1]*tx + transform[5]*ty, transform[2]*tx + transform[6]*ty);
    const outward = normalize(tangent[1]*depth[2]-tangent[2]*depth[1], tangent[2]*depth[0]-tangent[0]*depth[2], tangent[0]*depth[1]-tangent[1]*depth[0]);
    const radial = frame.outward;
    const halfWidth = .055 * Math.hypot(transform[0]*radial[0] + transform[4]*radial[1], transform[1]*radial[0] + transform[5]*radial[1], transform[2]*radial[0] + transform[6]*radial[1]);
    return { center, outward, halfWidth };
  };
  if (flat) {
    // Space the turns along the outside of the bend: spacing only along the
    // centreline spreads them apart on this longer edge and reveals the wood.
    const outside = (angle: number) => {
      const { center, outward, halfWidth } = flatFrame(angle);
      return center.map((n,j)=>n + outward[j]*(halfWidth + radius + .003));
    };
    let previous = outside(start);
    for (let i = 1; i <= 128; i++) {
      const next = outside(start + span * i / 128);
      arcs.push(arcs[i-1] + Math.hypot(...next.map((n,j)=>n-previous[j])));
      previous = next;
    }
  }
  const turns = flat ? Math.ceil(arcs[128] / (radius * 1.90)) : Math.round(Math.PI * .44 / (radius * 2.06));
  const angleAt = (progress: number) => {
    if (!flat) return start + span * progress;
    const distance = progress * arcs[128];
    let low = 0, high = 128;
    while (low + 1 < high) { const middle = (low + high) >> 1; if (arcs[middle] <= distance) low = middle; else high = middle; }
    const t = (low + (distance - arcs[low]) / Math.max(.00001, arcs[high] - arcs[low])) / 128;
    return start + span * t;
  };
  const at = (progress: number): YarnPoint => {
    const angle = angleAt(progress);
    const phase = progress * turns * Math.PI * 2;
    const radial = normalize(Math.cos(angle) / .46, Math.sin(angle) / .42, 0);
    if (flat) {
      const { center, outward, halfWidth } = flatFrame(angle);
      const [r, d] = flatWoodWrapSection(halfWidth, .026, radius + .003, progress * turns);
      return center.map((n,j)=>n + outward[j]*r + depth[j]*side*d) as YarnPoint;
    }
    return world(.46 * Math.cos(angle) + radial[0] * coil * Math.cos(phase),
      .42 * Math.sin(angle) + radial[1] * coil * Math.cos(phase), side * coilDepth * Math.sin(phase));
  };
  const winding = Array.from({ length: turns * stepsPerTurn + 1 }, (_, i) => at(i / (turns * stepsPerTurn)));
  const seams: YarnPoint[][] = [];
  for (let turn = 0; turn < turns; turn++) {
    // Each wrap is sewn into the actual crocheted front/back panel rather
    // than hanging as a second independent ring in front of the textile.
    const target = at((turn + .75) / turns);
    const y = clamp(target[1] - spec.bodyY - radius * 1.8, -spec.ry * .94, spec.ry * .91);
    const seat = crochetPanelPoint(family, target[0], y);
    seat[1] += spec.bodyY;
    seat[2] *= side;
    seams.push(Array.from({ length: 7 }, (_, i): YarnPoint => {
      const t = i / 6;
      return [seat[0] * (1 - t) + target[0] * t,
        seat[1] * (1 - t) + target[1] * t,
        seat[2] * (1 - t) + target[2] * t + side * Math.sin(t * Math.PI) * radius * .45];
    }));
  }
  const guideFrames = shape === "flat-base" ? Array.from({ length: 129 }, (_, i) => flatFrame(start + span * i / 128)) : [];
  const guide = (point: YarnPoint): YarnPoint => {
    if (guideFrames.length) {
      const nearest = guideFrames.reduce((best, frame) =>
        Math.hypot(...point.map((n,j)=>n-frame.center[j])) < Math.hypot(...point.map((n,j)=>n-best.center[j])) ? frame : best);
      return normalize(nearest.outward[1]*depth[2]-nearest.outward[2]*depth[1],
        nearest.outward[2]*depth[0]-nearest.outward[0]*depth[2], nearest.outward[0]*depth[1]-nearest.outward[1]*depth[0]);
    }
    const delta = point.map((value, axis) => value - transform[12 + axis]);
    const local = (column: number) => (delta[0] * transform[column] + delta[1] * transform[column + 1] + delta[2] * transform[column + 2])
      / (transform[column] ** 2 + transform[column + 1] ** 2 + transform[column + 2] ** 2);
    const angle = Math.atan2(local(4) / .42, local(0) / .46);
    const tx = -.46 * Math.sin(angle), ty = .42 * Math.cos(angle);
    return normalize(transform[0] * tx + transform[4] * ty,
      transform[1] * tx + transform[5] * ty, transform[2] * tx + transform[6] * ty);
  };
  return { winding, seams, radius, guide };
}

function makeWoodHandleBinding(family: Exclude<Family, "">, shape: WoodHandleShape = "round"): FabricMesh {
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  for (const z of woodHandleDepthPlanes(family)) {
    const { winding, seams, radius, guide } = woodHandleBindingPaths(family, z, shape);
    appendCord(mesh, winding, radius, guide, () => true, 8);
    for (const seam of seams) appendCord(mesh, seam, radius * .75, () => [0, 0, z < 0 ? -1 : 1], () => true, 8);
  }
  return mesh;
}

function ensureWoodHandleBinding(renderer: Renderer, family: Exclude<Family, "">, shape: WoodHandleShape = "round") {
  const key = `${family}:${shape}`;
  if (renderer.woodBindingKey === key) return;
  const previous = renderer.meshes.woodBinding;
  if (previous) for (const buffer of [previous.position, previous.normal, previous.uv, previous.index]) renderer.gl.deleteBuffer(buffer);
  renderer.meshes.woodBinding = createMesh(renderer.gl, makeWoodHandleBinding(family, shape));
  renderer.woodBindingKey = key;
}

type ClosedFlapSurface = {
  mesh: FabricMesh; contour: YarnPoint[]; rx: number; ry: number; centerY: number; thickness: number;
  sample: (x: number, y: number) => { z: number; normal: YarnPoint } | null;
};
// Immutable fitted surfaces are cached per family and construction.
const closedFlapSurfaces = new Map<string, ClosedFlapSurface>();

function closedFlapSurface(family: Exclude<Family, "">, crochet: boolean): ClosedFlapSurface {
  const key = family + (crochet ? ":crochet" : ":leather");
  const cached = closedFlapSurfaces.get(key);
  if (cached) return cached;
  const profile = PROFILES[family];
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  // Preserve the calibrated front outline; only its depth is fitted to the bag.
  const base = crochet ? makeExtrudedContour(flapContour(family), .04, .085) : makeExtrudedContour(flapContour(family), 0.105, 0.085);
  const transform = matrix([0, profile.flapY, profile.frontZ + .13], profile.flapScale, [.02, 0, 0]);
  const outline = flapContour(family).map((_, index): Point => {
    const [x, y, z] = base.positions.slice((index + 1) * 3, (index + 2) * 3);
    return [transform[0] * x + transform[4] * y + transform[8] * z + transform[12],
      transform[1] * x + transform[5] * y + transform[9] * z + transform[13]];
  });
  const radius = spec.rx * 5 / 160;
  const thickness = crochet ? radius * .50 : .018;
  // The backing follows the same dome as the body. Clearance covers the tallest
  // basket crossing; the flap no longer has a thick flat wedge behind its yarn.
  const frontZ = (x: number, y: number) => crochetPanelPoint(family, x, y - spec.bodyY)[2]
    + radius * 1.75 + .003 + thickness;
  const normalAt = (x: number, y: number): YarnPoint => {
    const e = .001;
    return normalize(-(frontZ(x + e, y) - frontZ(x - e, y)) / (2 * e),
      -(frontZ(x, y + e) - frontZ(x, y - e)) / (2 * e), 1);
  };
  const cx = outline.reduce((sum, p) => sum + p[0], 0) / outline.length;
  const cy = outline.reduce((sum, p) => sum + p[1], 0) / outline.length;
  const minX = Math.min(...outline.map((p) => p[0])), maxX = Math.max(...outline.map((p) => p[0]));
  const minY = Math.min(...outline.map((p) => p[1])), maxY = Math.max(...outline.map((p) => p[1]));
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  const vertex = (x: number, y: number, side: number) => {
    const index = mesh.positions.length / 3;
    mesh.positions.push(x, y, frontZ(x, y) - (side < 0 ? thickness : 0));
    mesh.normals.push(...normalAt(x, y).map((v) => v * side));
    mesh.uvs.push((x - minX) / (maxX - minX), (y - minY) / (maxY - minY));
    return index;
  };
  const face = (side: number) => {
    const center = vertex(cx, cy, side);
    let previous: number[] | null = null;
    for (let band = 1; band <= 12; band++) {
      const ring = outline.map(([x, y]) => vertex(cx + (x - cx) * band / 12, cy + (y - cy) * band / 12, side));
      const triangle = (a: number, b: number, c: number) => mesh.indices.push(...(side > 0 ? [a, b, c] : [a, c, b]));
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        if (previous) {
          triangle(previous[i], ring[j], ring[i]);
          triangle(previous[i], previous[j], ring[j]);
        } else triangle(center, ring[j], ring[i]);
      }
      previous = ring;
    }
  };
  face(1); face(-1);
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    const a = outline[i], b = outline[j];
    const normal = normalize(a[1] - b[1], b[0] - a[0], 0);
    const start = mesh.positions.length / 3;
    for (const [p, rear] of [[a, false], [a, true], [b, false], [b, true]] as const) {
      mesh.positions.push(p[0], p[1], frontZ(...p) - (rear ? thickness : 0));
      mesh.normals.push(...normal);
      mesh.uvs.push((p === a ? i : i + 1) / outline.length, rear ? 0 : 1);
    }
    mesh.indices.push(start, start + 2, start + 1, start + 2, start + 3, start + 1);
  }

  // Bucket the actual front triangles, so clipping and yarn seating remain
  // exact without scanning the whole curved mesh for every cord vertex.
  const triangles: Array<{ a: YarnPoint; b: YarnPoint; c: YarnPoint; normal: YarnPoint; determinant: number }> = [];
  const grid = 16;
  const bins: number[][] = Array.from({ length: grid * grid }, () => []);
  const cellX = (x: number) => clamp(Math.floor((x - minX) / (maxX - minX) * grid), 0, grid - 1);
  const cellY = (y: number) => clamp(Math.floor((y - minY) / (maxY - minY) * grid), 0, grid - 1);
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const indices = mesh.indices.slice(i, i + 3);
    if (!indices.every((index) => mesh.normals[index * 3 + 2] > .8)) continue;
    const [a, b, c] = indices.map((index) => mesh.positions.slice(index * 3, index * 3 + 3) as YarnPoint);
    const ab = b.map((v, axis) => v - a[axis]), ac = c.map((v, axis) => v - a[axis]);
    let normal = normalize(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]);
    if (normal[2] < 0) normal = normal.map((v) => -v) as YarnPoint;
    const determinant = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(determinant) <= 1e-8) continue;
    const index = triangles.length;
    triangles.push({ a, b, c, normal, determinant });
    for (let y = cellY(Math.min(a[1], b[1], c[1])); y <= cellY(Math.max(a[1], b[1], c[1])); y++) {
      for (let x = cellX(Math.min(a[0], b[0], c[0])); x <= cellX(Math.max(a[0], b[0], c[0])); x++) bins[y * grid + x].push(index);
    }
  }
  const sample = (x: number, y: number) => {
    if (x < minX - 1e-6 || x > maxX + 1e-6 || y < minY - 1e-6 || y > maxY + 1e-6) return null;
    for (const index of bins[cellY(y) * grid + cellX(x)]) {
      const { a, b, c, normal, determinant } = triangles[index];
      const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / determinant;
      const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / determinant;
      const w = 1 - u - v;
      if (u >= -1e-6 && v >= -1e-6 && w >= -1e-6) return { z: u * a[2] + v * b[2] + w * c[2], normal };
    }
    return null;
  };
  const contour: YarnPoint[] = outline.map(([x, y]) => [x, y, frontZ(x, y)]);
  const rx = Math.max(...contour.map((p) => Math.abs(p[0]))), ry = (maxY - minY) * .5;
  const surface = { mesh, sample, contour, rx, ry, centerY: (minY + maxY) * .5, thickness };
  closedFlapSurfaces.set(key, surface);
  return surface;
}

function crochetFlapSurface(family: Exclude<Family, "">) {
  return closedFlapSurface(family, true);
}

function ensureClosedFlapShell(renderer: Renderer, family: Exclude<Family, "">, crochet: boolean) {
  const key = family + (crochet ? ":crochet" : ":leather");
  if (renderer.flapShellKey === key) return;
  const previous = renderer.meshes.flapShell;
  if (previous) for (const buffer of [previous.position, previous.normal, previous.uv, previous.index]) renderer.gl.deleteBuffer(buffer);
  const surface = closedFlapSurface(family, crochet);
  renderer.meshes.flapShell = createMesh(renderer.gl, surface.mesh);
  const snap = surface.sample(0, PROFILES[family].lockY);
  renderer.flapLockZ = (snap?.z ?? surface.contour[0][2]) + .023;
  const n = snap?.normal ?? [0, 0, 1];
  renderer.flapLockRotation = [-Math.asin(clamp(n[1], -1, 1)), Math.atan2(n[0], n[2]), 0];
  renderer.flapShellKey = key;
}

function makeCrochetFlap(family: Exclude<Family, "">, stitch: Stitch): FabricMesh {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const surface = crochetFlapSurface(family);
  const { rx, ry, centerY } = surface;
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  const occluders: CordOccluder[] = [];
  const radius = spec.rx * 5 / 160;
  const gauge = crochetGaugeColumns(stitch);
  const columns = Math.max(4, Math.round(gauge * rx / spec.rx));
  const rows = crochetRowCount(columns, rx, ry, stitch, 3);
  const seat = (x: number, y: number, lift: number): YarnPoint => {
    const point = surface.sample(x, y + centerY);
    return [x, y + centerY, (point?.z ?? PROFILES[family].frontZ + .20) + radius * .62 + lift];
  };
  const tube = (points: YarnPoint[], thickness = radius) => appendCord(mesh, points, thickness,
    ([x, y]) => surface.sample(x, y)?.normal ?? [0, 0, 1],
    ([x, y]) => surface.sample(x, y) !== null, 10, false, occluders);
  fillCrochetPatch({ rx, ry, radius, columns, rows, seat, tube }, stitch);
  const binding = surface.contour.map(([x, y]) => seat(x * .965, (y - centerY) * .965, radius * .04));
  binding.push(binding[0]);
  tube(binding, radius * .72);
  mesh.cordOccluders = occluders;
  return mesh;
}

function ensureCrochetFlapMesh(renderer: Renderer, family: Exclude<Family, "">, stitch: Stitch) {
  const key = family + ":" + stitch;
  if (renderer.crochetFlapKey === key) return;
  const previous = renderer.meshes.yarnFlap;
  if (previous) for (const buffer of [previous.position, previous.normal, previous.uv, previous.index]) renderer.gl.deleteBuffer(buffer);
  const data = makeCrochetFlap(family, stitch);
  renderer.meshes.yarnFlap = createMesh(renderer.gl, data);
  let contactZ = crochetFlapSurface(family).sample(0, PROFILES[family].lockY)?.z ?? PROFILES[family].frontZ;
  for (let i = 0; i < data.positions.length; i += 3) {
    if (Math.abs(data.positions[i]) < .09 && Math.abs(data.positions[i + 1] - PROFILES[family].lockY) < .06) {
      contactZ = Math.max(contactZ, data.positions[i + 2]);
    }
  }
  // The metal snap sits on the real yarn crowns instead of being buried in them.
  renderer.crochetFlapLockZ = contactZ + .025;
  renderer.crochetFlapKey = key;
}

function openingBraidPaths(family: Exclude<Family, "">) {
  const points = openingPath(family);
  const radius = ABAGS_FIDELITY_V4_FAMILY_SPECS[family].rx * 5 / 160;
  const arc = [0];
  for (let i = 0; i < points.length; i++) arc.push(arc[i] + Math.hypot(...points[(i + 1) % points.length].map((v, axis) => v - points[i][axis])));
  const total = arc[arc.length - 1], turns = Math.max(1, Math.round(total / (radius * 3.5))), samples = turns * 12;
  const at = (distance: number): YarnPoint => {
    const d = (distance % total + total) % total;
    let i = 0;
    while (i + 1 < arc.length - 1 && arc[i + 1] < d) i++;
    const t = (d - arc[i]) / (arc[i + 1] - arc[i]);
    return points[i].map((v, axis) => v + (points[(i + 1) % points.length][axis] - v) * t) as YarnPoint;
  };
  const smooth = (d: number): YarnPoint => {
    const a = at(d - radius * .5), b = at(d), c = at(d + radius * .5);
    return b.map((v, axis) => (a[axis] + 2 * v + c[axis]) / 4) as YarnPoint;
  };
  const paths = [0, Math.PI].map(phase => Array.from({ length: samples + 1 }, (_, i): YarnPoint => {
    const d = total * i / samples, center = smooth(d), a = smooth(d - radius * .4), b = smooth(d + radius * .4);
    const tangent = normalize(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const outward = normalize(-tangent[2], 0, tangent[0]);
    const up = normalize(tangent[1] * outward[2] - tangent[2] * outward[1], tangent[2] * outward[0] - tangent[0] * outward[2], tangent[0] * outward[1] - tangent[1] * outward[0]);
    const angle = i / samples * turns * Math.PI * 2 + phase;
    return center.map((v, axis) => v + radius * .42 * (outward[axis] * Math.cos(angle) + up[axis] * Math.sin(angle))) as YarnPoint;
  }));
  return { paths, radius: radius * .58 };
}

function makeOpeningRim(family: Exclude<Family, "">): FabricMesh {
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  const { paths, radius } = openingBraidPaths(family);
  for (const path of paths) appendCord(mesh, path, radius, () => [0, 1, 0], () => true, 8, true);
  return mesh;
}

function ensureOpeningRim(renderer: Renderer, family: Exclude<Family, "">) {
  if (renderer.rimKey === family) return;
  const old = renderer.meshes.yarnRim;
  if (old) for (const buffer of [old.position, old.normal, old.uv, old.index]) renderer.gl.deleteBuffer(buffer);
  const data = makeOpeningRim(family);
  renderer.meshes.yarnRim = createMesh(renderer.gl, data);
  renderer.rimTriangles = data.indices.length / 3;
  renderer.rimKey = family;
}

function groundContactFrame(points: YarnPoint[], model: Float32Array, aspect: number, cssHeight: number) {
  cssHeight = Math.max(1, cssHeight);
  if (!points.length) return { x: .5, y: 1, width: .2, height: .02, coreWidth: .05, coreHeight: .005, blur: 2, visible: 0 };
  const f = 1 / Math.tan(Math.PI / 5.3 / 2), projected = new Float32Array(points.length * 2);
  let bottom = -Infinity, minX = Infinity, maxX = -Infinity;
  points.forEach(([x, y, z], i) => {
    const wx = model[0] * x + model[4] * y + model[8] * z + model[12];
    const wy = model[1] * x + model[5] * y + model[9] * z + model[13] - .02;
    const wz = model[2] * x + model[6] * y + model[10] * z + model[14] - 5;
    const px = .5 + wx * f / aspect / -wz * .5, py = .5 - wy * f / -wz * .5;
    projected[i * 2] = px; projected[i * 2 + 1] = py;
    bottom = Math.max(bottom, py); minX = Math.min(minX, px); maxX = Math.max(maxX, px);
  });
  let footMin = Infinity, footMax = -Infinity;
  for (let i = 0; i < projected.length; i += 2) if (projected[i + 1] >= bottom - 2 / cssHeight) {
    footMin = Math.min(footMin, projected[i]); footMax = Math.max(footMax, projected[i]);
  }
  const width = Math.max(.035, maxX - minX), height = clamp(width * .075, .018, .046);
  return { x: (footMin + footMax) / 2, y: bottom + .5 / cssHeight,
    width, height, coreWidth: clamp(footMax - footMin + .008, .018, width), coreHeight: clamp(3 / cssHeight, .004, .012),
    blur: clamp(height * cssHeight * .22, 2, 7), visible: Number(bottom > .15 && bottom < 1.025) };
}

function openingLiningLayout(family: Exclude<Family, "">) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family], points = openingPath(family);
  const lengths = [0];
  for (let i = 0; i < points.length; i++) lengths.push(lengths[i] + Math.hypot(...points[i].map((n, axis) => n - points[(i + 1) % points.length][axis])));
  const perimeter = lengths[lengths.length - 1];
  const sample = (u: number): YarnPoint => {
    const distance = ((u % 1 + 1) % 1) * perimeter;
    let i = 0;
    while (i < points.length - 1 && lengths[i + 1] < distance) i++;
    const f = (distance - lengths[i]) / Math.max(.0001, lengths[i + 1] - lengths[i]);
    return points[i].map((n, axis) => n + (points[(i + 1) % points.length][axis] - n) * f) as YarnPoint;
  };
  return { family, spec, sample, perimeter, topY: Math.max(...points.map(p => p[1])), bottomY: spec.bodyY - spec.ry * .72 };
}

function liningWallPoint(layout: ReturnType<typeof openingLiningLayout>, u: number, t: number): YarnPoint {
  const [x, top, z] = layout.sample(u), { family, spec, bottomY } = layout;
  const y = (top - .025) * (1 - t) + bottomY * t;
  // A lining hangs into the existing bag. Small inward pleats relax between the
  // stitched mouth and base; neither the silhouette nor the opening is enlarged.
  const phase = ((u % 1 + 1) % 1) * Math.PI * 2;
  const fold = .012 * Math.sin(Math.PI * t) * (Math.sin(phase * 11 + t * .75) + .45 * Math.sin(phase * 17 - t));
  const depthRatio = depthAt(family, y - spec.bodyY) / depthAt(family, spec.ry);
  return [x * (.96 - .13 * t - fold), y, z * depthRatio * (.92 - .08 * t - fold * 2)];
}

function makeOpeningInterior(family: Exclude<Family, "">): FabricMesh {
  const layout = openingLiningLayout(family), columns = 96, rows = 24;
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    const u = col / columns, t = row / rows, p = liningWallPoint(layout, u, t);
    const left = liningWallPoint(layout, u - .001, t), right = liningWallPoint(layout, u + .001, t);
    const up = liningWallPoint(layout, u, Math.max(0, t - .001)), down = liningWallPoint(layout, u, Math.min(1, t + .001));
    const a = right.map((n, i) => n - left[i]), b = down.map((n, i) => n - up[i]);
    let normal = normalize(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
    if (normal[0] * p[0] + normal[2] * p[2] > 0) normal = normal.map(n => -n) as YarnPoint;
    mesh.positions.push(...p); mesh.normals.push(...normal);
    // Both axes follow physical cloth distances, including the duplicated U seam.
    mesh.uvs.push(u * layout.perimeter, layout.topY - p[1]);
    if (row < rows && col < columns) {
      const a = row * (columns + 1) + col, b = a + columns + 1;
      mesh.indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const center = mesh.positions.length / 3;
  mesh.positions.push(0, layout.bottomY, 0); mesh.normals.push(0, 1, 0); mesh.uvs.push(0, 0);
  const floorStart = mesh.positions.length / 3, floorRows = 10;
  for (let row = 1; row <= floorRows; row++) for (let col = 0; col <= columns; col++) {
    const u = col / columns, r = row / floorRows, edge = liningWallPoint(layout, u, 1);
    const x = edge[0] * r, z = edge[2] * r;
    mesh.positions.push(x, layout.bottomY, z); mesh.normals.push(0, 1, 0); mesh.uvs.push(x, z);
    const current = floorStart + (row - 1) * (columns + 1) + col;
    if (col < columns) {
      if (row === 1) mesh.indices.push(center, current + 1, current);
      else {
        const inner = current - columns - 1;
        mesh.indices.push(inner, current + 1, current, inner, inner + 1, current + 1);
      }
    }
  }
  return mesh;
}

function makeOpeningLiningSeam(family: Exclude<Family, "">): FabricMesh {
  const layout = openingLiningLayout(family), mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  const stitches = Math.round(layout.perimeter / .032);
  for (let i = 0; i < stitches; i++) {
    const path = [0, .28, .56].map(f => {
      const p = liningWallPoint(layout, (i + f) / stitches, .018);
      return [p[0] * .997, p[1], p[2] * .990] as YarnPoint;
    });
    appendCord(mesh, path, .0014, () => [0, 1, 0], () => true, 6);
  }
  return mesh;
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

// A formed D-ring has a straight bar for the sewn tabs, two shoulders and a
// rounded crown. Keeping the old envelope preserves the calibrated attachment
// points and the depth-separated strap/chain ends in every camera view.
function makeDHardwareRing(): FabricMesh {
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  const points: YarnPoint[] = [];
  for (let i = 0; i <= 12; i++) points.push([-.13 + .26 * i / 12, -.13, 0]);
  for (let i = 1; i <= 8; i++) points.push([.13, -.13 + .13 * i / 8, 0]);
  for (let i = 1; i <= 32; i++) {
    const angle = Math.PI * i / 32;
    points.push([.13 * Math.cos(angle), .125 * Math.sin(angle), 0]);
  }
  for (let i = 1; i <= 8; i++) points.push([-.13, -.13 * i / 8, 0]);
  // Closing the sweep (rather than painting a D outline) gives both faces and
  // the tubular cross section correct normals under arbitrary WebGL rotation.
  appendCord(mesh, points, .022, () => [0, 0, 1], () => true, 12);
  return mesh;
}

// Hook and spring gate are separately swept metal tubes, not a screen-space
// accessory illustration. Both remain in the same plane as the D-ring.
function makeLobsterClaspMesh(): FabricMesh {
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  const hook: YarnPoint[] = Array.from({ length: 35 }, (_, i): YarnPoint => {
    const angle = -.36 * Math.PI + 1.63 * Math.PI * i / 34;
    return [.038 * Math.cos(angle), .042 * Math.sin(angle), 0];
  });
  const gate: YarnPoint[] = Array.from({ length: 11 }, (_, i): YarnPoint => {
    const t = i / 10;
    return [.038 - .059 * t, -.035 + .044 * t, .006 * Math.sin(Math.PI * t)];
  });
  appendCord(mesh, hook, .0105, () => [0, 0, 1], () => true, 10);
  appendCord(mesh, gate, .0065, () => [0, 0, 1], () => true, 8);
  return mesh;
}

function strapClaspPosition(family: Exclude<Family, "">, side: number): YarnPoint {
  const [x, y, z] = strapHardwarePosition(family, side);
  // The hook overlaps the upper D-ring and its swivel seats against the end
  // link or leather tab (whose center sits at ringY + .06).
  return [x, y + .08, z];
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

// One height field drives vertex displacement, fragment normals and crossing
// occlusion. Separate patterns previously put highlights beside the raised yarn.
const CROCHET_SURFACE = `
float segmentDistance(vec2 p,vec2 a,vec2 b){
  vec2 ab=b-a;
  return length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0));
}
float cordCrown(float distance,float radius){
  float d=clamp(distance/radius,0.0,1.0);
  return sqrt(max(0.0,1.0-d*d));
}
float knit(vec2 uv,float m){
  vec2 p;
  if(m<.5){
    // 5 mm polyester cord: rounded, interlocking crochet loops.
    // Open V legs, curved at the crossing, rather than closed circular beads.
    float row=uv.y*18.0+sin(uv.x*6.2831)*.025;
    float stagger=mod(floor(row),2.0)*.5;
    vec2 cell=vec2(uv.x*16.0+stagger,row);
    p=fract(cell)-.5;
    float variation=sin(dot(floor(cell),vec2(2.17,5.43)));
    p.x+=variation*.018;
    vec2 q=vec2(abs(p.x),p.y);
    float leg=min(segmentDistance(q,vec2(.46,.54),vec2(.24,.12)),
                  segmentDistance(q,vec2(.24,.12),vec2(.05,-.31)));
    float crossing=segmentDistance(p,vec2(-.12,-.33),vec2(.12,-.43));
    return max(cordCrown(leg,.24+variation*.008),cordCrown(crossing,.19)*.82);
  }
  if(m<1.5){
    // Herringbone: interlocking chevrons with individual cylindrical strands.
    float row=uv.y*22.0;
    p=fract(vec2(uv.x*21.0+mod(floor(row),2.0)*.5,row))-.5;
    float leg=segmentDistance(vec2(abs(p.x),p.y),vec2(.48,.48),vec2(.03,-.43));
    return cordCrown(leg,.19);
  }
  if(m<2.5){
    // Basket stitch: alternating over/under bands, each made of two cords.
    vec2 cell=uv*vec2(12.0,14.0);
    p=fract(cell)-.5;
    float vertical=cordCrown(abs(abs(p.x)-.17),.14);
    float horizontal=cordCrown(abs(abs(p.y)-.17),.14);
    float parity=mod(floor(cell.x)+floor(cell.y),2.0);
    float over=mix(vertical,horizontal,parity);
    float under=mix(horizontal,vertical,parity);
    return max(over,under*(1.0-.58*over));
  }
  // Shell stitch: repeated scallops with rounded fan ribs.
  float row=uv.y*15.0;
  p=fract(vec2(uv.x*16.0+mod(floor(row),2.0)*.5,row))-.5;
  float shell=abs(length((p-vec2(0.0,-.26))*vec2(1.0,.92))-.43);
  float ribs=segmentDistance(vec2(abs(p.x),p.y),vec2(.34,.17),vec2(0.0,-.36));
  return max(cordCrown(shell,.12),cordCrown(ribs,.10)*.88);
}
`;

const VERTEX = `
attribute vec3 aPosition;
attribute vec3 aNormal;
// UV.xy keeps textile coordinates; UV.z carries baked cord visibility without
// allocating another GPU buffer or spending another WebGL 1 attribute slot.
attribute vec3 aUv;
uniform mat4 uProjection,uView,uModel;
uniform mat3 uNormalMatrix;
uniform vec2 uInteriorBounds;
uniform vec3 uYarnGradientAxis;
uniform mediump float uRelief;
uniform mediump float uStitch;
varying vec3 vNormal,vWorld;
varying vec3 vTangent,vBitangent;
varying float vFaceWeight,vLiningDepth,vYarnHeight,vCordOcclusion;
varying vec2 vUv;
${CROCHET_SURFACE}
void main(){
  float h=0.0;
  if(uRelief>0.0) h=knit(aUv.xy,uStitch)*uRelief*.48;
  float frontFace=smoothstep(.45,.85,abs(aNormal.z));
  // The back keeps its outward normal; relief never bends it toward the front.
  float faceSign=aNormal.z<0.0?-1.0:1.0;
  vec3 sidedReliefNormal=vec3(aNormal.xy,abs(aNormal.z)*faceSign);
  vec4 world=uModel*vec4(aPosition+aNormal*h,1.0);
  vWorld=world.xyz;
  vYarnHeight=dot(world.xyz,uYarnGradientAxis);
  vNormal=normalize(uNormalMatrix*sidedReliefNormal);
  // The gusset has its own arc-length UVs, so its tangent follows the perimeter.
  vec3 localTangent=normalize(mix(vec3(-aNormal.y,aNormal.x,.001),vec3(1.0,0.0,0.0),frontFace));
  vec3 localBitangent=mix(vec3(0.0,0.0,-1.0),vec3(0.0,1.0,0.0),frontFace);
  vTangent=normalize(mat3(uModel)*localTangent);
  vBitangent=normalize(mat3(uModel)*localBitangent);
  vFaceWeight=frontFace;
  vLiningDepth=clamp((uInteriorBounds.x-aPosition.y)/max(.001,uInteriorBounds.x-uInteriorBounds.y),0.0,1.0);
  vUv=aUv.xy;
  vCordOcclusion=aUv.z;
  gl_Position=uProjection*uView*world;
}`;

// Generate both smooth dye transitions and distinct pastel bands from the
// same palette data used by the swatches and SVG fallback.
const REFERENCE_YARN_RAMPS = [...ABAGS_YARN_PALETTES, ABAGS_PASTEL_MINI_YARN_PALETTE].map(palette => {
  const id = palette.id === "pastel-mini-columns" ? 6 : palette.color === "#88583F" ? 2 : palette.color === "#D58FAA" ? 3 : palette.color === "#BA9ECF" ? 4 : 5;
  const rgb = (color: string) => `vec3(${Array.from(hex(color)).map(n => n.toFixed(6)).join(",")})`;
  let code = `if(uYarnOmbre>${id - .5}&&uYarnOmbre<${id + .5}){dyed=${rgb(palette.colors[0])};`;
  for (let i = 1; i < palette.colors.length; i++) {
    const edge = palette.edges[i - 1];
    const start = palette.mode === "bands" ? edge - .012 : i === 1 ? 0 : palette.edges[i - 2];
    const end = palette.mode === "bands" ? edge + .012 : edge;
    code += `dyed=mix(dyed,${rgb(palette.colors[i])},smoothstep(${start.toFixed(4)},${end.toFixed(4)},height));`;
  }
  return code + "}";
}).join("\n");

const FRAGMENT = `
#ifdef ABAGS_HAS_DERIVATIVES
#extension GL_OES_standard_derivatives : enable
#endif
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vNormal,vWorld;
varying vec3 vTangent,vBitangent;
varying float vFaceWeight,vLiningDepth,vYarnHeight,vCordOcclusion;
varying vec2 vUv;
uniform vec3 uColor,uLight;
uniform float uMaterial;
uniform float uYarnOmbre;
uniform float uFabricStyle,uBandPrint;
uniform vec2 uTextileReady;
uniform sampler2D uScarfPrint,uStrapPrint;
uniform vec4 uScarfPrintUv,uStrapPrintUv;
uniform vec3 uFabricFlower,uFabricLeaf,uFabricBorder;
uniform vec2 uYarnGradientRange;
uniform mediump float uRelief;
uniform mediump float uStitch;
${CROCHET_SURFACE}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
// Two crossing groups of carriers form the small braid of a polyester cord.
// Circular UVs are periodic at the tube seam; U follows physical cord length.
float cordBraid(vec2 uv,out vec2 slope){
  vec2 phase=6.2831853*vec2(uv.x+uv.y*4.0,uv.x-uv.y*4.0);
  vec2 strands=.5+.5*cos(phase);
  vec2 gradient=-3.14159265*sin(phase);
  float first=step(strands.y,strands.x);
  slope=mix(gradient.y*vec2(1.0,-4.0),gradient.x*vec2(1.0,4.0),first);
  return max(strands.x,strands.y);
}
float braidVisibility(vec2 uv){
#ifdef ABAGS_HAS_DERIVATIVES
  vec2 frequency=vec2(1.0,4.0);
  float footprint=max(length(dFdx(uv)*frequency),length(dFdy(uv)*frequency));
  return 1.0-smoothstep(.28,.75,footprint);
#else
  // Older WebGL 1 devices keep a stable matte cord without subpixel striping.
  return 0.0;
#endif
}
// A second, finer level models the braided polyester filament bundles. Its
// frequency is filtered in UV derivatives, preventing glitter and moire when
// the customer zooms out or rotates a narrow 5 mm stitch on a phone.
float yarnFilaments(vec2 uv){
#ifdef ABAGS_HAS_DERIVATIVES
  vec2 phase=vec2(uv.x*1.25+uv.y*26.0,uv.x*(-.88)+uv.y*31.0);
  float footprint=max(length(dFdx(phase)),length(dFdy(phase)));
  float visibility=1.0-smoothstep(.18,.72,footprint);
  return (.5*sin(phase.x*6.2831853)+.5*sin(phase.y*6.2831853))*visibility;
#else
  return 0.0;
#endif
}
vec3 cordBraidNormal(vec3 normal,vec2 slope){
#ifdef ABAGS_HAS_DERIVATIVES
  vec3 dx=dFdx(vWorld),dy=dFdy(vWorld);
  vec2 ux=dFdx(vUv),uy=dFdy(vUv);
  float orientation=sign(ux.x*uy.y-ux.y*uy.x);
  vec3 tangent=(dx*uy.y-dy*ux.y)*orientation;
  vec3 bitangent=(dy*ux.x-dx*uy.x)*orientation;
  tangent-=normal*dot(normal,tangent);
  bitangent-=normal*dot(normal,bitangent);
  if(dot(tangent,tangent)>1.e-12 && dot(bitangent,bitangent)>1.e-12){
    // Relief is a small fraction of the 5 mm cord radius, not another stitch.
    return normalize(normal-normalize(tangent)*slope.x*.022-normalize(bitangent)*slope.y*.007);
  }
#endif
  return normal;
}
// A rough dielectric highlight instead of the former plastic Phong shine.
vec3 specularGGX(vec3 n,vec3 l,vec3 v,float roughness,vec3 f0){
  vec3 h=normalize(l+v);
  float nl=max(dot(n,l),.001),nv=max(dot(n,v),.001);
  float nh=max(dot(n,h),0.0),vh=max(dot(v,h),0.0);
  float alpha=roughness*roughness,alpha2=alpha*alpha;
  float denom=nh*nh*(alpha2-1.0)+1.0;
  float distribution=alpha2/(3.14159*denom*denom);
  float k=(roughness+1.0)*(roughness+1.0)/8.0;
  float geometry=(nl/(nl*(1.0-k)+k))*(nv/(nv*(1.0-k)+k));
  vec3 fresnel=f0+(1.0-f0)*pow(1.0-vh,5.0);
  return fresnel*distribution*geometry/(4.0*nl*nv)*nl;
}
// Braided polyester has a directional highlight along the cord carriers.
// Derive its tangent from physical cord UVs so the lobe follows every curved
// stitch, seam and binding rather than a screen-space direction.
vec3 cordSpecular(vec3 n,vec3 l,vec3 v,float roughness,vec3 f0){
  if(dot(n,l)<=0.0 || dot(n,v)<=0.0)return vec3(0.0);
#ifdef ABAGS_HAS_DERIVATIVES
  vec3 dx=dFdx(vWorld),dy=dFdy(vWorld);
  vec2 ux=dFdx(vUv),uy=dFdy(vUv);
  float orientation=sign(ux.x*uy.y-ux.y*uy.x);
  vec3 tangent=(dx*uy.y-dy*ux.y)*orientation;
  tangent-=n*dot(n,tangent);
  if(dot(tangent,tangent)>1.e-12){
    tangent=normalize(tangent);
    vec3 across=normalize(cross(n,tangent)),h=normalize(l+v);
    float nl=max(dot(n,l),.001),nv=max(dot(n,v),.001);
    float nh=max(dot(n,h),0.0),vh=max(dot(v,h),0.0);
    float along=max(.18,roughness*roughness*.42);
    float crosswise=min(.85,roughness*roughness*1.35);
    vec2 halfSlope=vec2(dot(tangent,h)/along,dot(across,h)/crosswise);
    float denominator=dot(halfSlope,halfSlope)+nh*nh;
    float distribution=1.0/(3.14159*along*crosswise*denominator*denominator);
    vec2 viewSlope=vec2(along*dot(tangent,v),crosswise*dot(across,v))/nv;
    vec2 lightSlope=vec2(along*dot(tangent,l),crosswise*dot(across,l))/nl;
    float geometry=2.0/(sqrt(1.0+dot(viewSlope,viewSlope))+sqrt(1.0+dot(lightSlope,lightSlope)));
    vec3 fresnel=f0+(1.0-f0)*pow(1.0-vh,5.0);
    return fresnel*distribution*geometry/(4.0*nv);
  }
#endif
  return specularGGX(n,l,v,roughness,f0);
}
// Broad studio panels reflect across the curved links as the customer orbits.
// Fresnel uses the selected metal's colour, including the dark coated fittings.
vec3 studioMetalReflection(vec3 n,vec3 v,float roughness,vec3 f0){
  vec3 r=reflect(-v,n);
  float blur=.12+.55*roughness;
  float left=exp(-pow((r.x+.45)/blur,2.0))*smoothstep(-.35,.10,r.z);
  left*=.35+.65*smoothstep(-.50,.35,r.y);
  float right=exp(-pow((r.x-.65)/(blur*.75),2.0))*smoothstep(-.15,.25,r.z);
  float ceiling=pow(max(r.y,0.0),3.0);
  float grazing=pow(1.0-max(dot(n,v),0.0),5.0);
  vec3 fresnel=f0+(1.0-f0)*grazing;
  vec3 room=vec3(.10,.095,.09)+vec3(1.15,1.10,1.0)*left+vec3(.46,.49,.54)*right+vec3(.18)*ceiling;
  return fresnel*room;
}
void main(){
  vec3 n=normalize(vNormal);
  vec3 l=normalize(uLight);
  vec3 fill=normalize(vec3(.75,.25,.30));
  vec3 v=normalize(vec3(0.0,.02,5.0)-vWorld);
  float rough=.76,metal=0.0,detail=1.0,cordOcclusion=1.0;
  float fibreSheen=0.0;
  vec3 pigment=uColor;
  if(uYarnOmbre>0.0){
    float height=clamp((vYarnHeight-uYarnGradientRange.x)/max(.001,uYarnGradientRange.y-uYarnGradientRange.x),0.0,1.0);
    vec3 low=vec3(.25,.14,.11),mid=vec3(.64,.23,.10),high=vec3(.84,.39,.14);
    // Palette identifiers are selected by the customer color option. The
    // height is evaluated in physical bag space, not screen coordinates.
    vec3 dyed=mix(mix(low,mid,smoothstep(.12,.62,height)),high,smoothstep(.65,.97,height));
    ${REFERENCE_YARN_RAMPS}
    pigment=dyed*(uMaterial<6.5?.78:1.0);
  }
  if(uMaterial<.5){
    float cord=knit(vUv,uStitch);
    float e=.0012;
    vec2 slope=vec2(
      knit(vUv+vec2(e,0.0),uStitch)-knit(vUv-vec2(e,0.0),uStitch),
      knit(vUv+vec2(0.0,e),uStitch)-knit(vUv-vec2(0.0,e),uStitch)
    )/(2.0*e);
    vec3 tangent=normalize(vTangent-n*dot(n,vTangent));
    vec3 bitangent=normalize(vBitangent-n*dot(n,vBitangent));
    float strength=uRelief*.40*mix(.8,1.0,vFaceWeight);
    n=normalize(n-strength*(tangent*slope.x+bitangent*slope.y));
    float strandFibres=sin(vUv.x*1127.0+vUv.y*487.0+cord*3.0);
    detail=mix(.84,1.02,cord)*(1.0+.018*strandFibres);
    cordOcclusion=mix(.62,1.0,smoothstep(.04,.76,cord));
    fibreSheen=.035*cord*(.7+.3*strandFibres);
    rough=.68;
  } else if(uMaterial<1.5){
    // Fine longitudinal grain and pores follow the physical wooden ring.
    float grain=sin(vUv.y*93.0+sin(vUv.x*31.0)*1.7);
    float fine=sin(vUv.y*257.0+sin(vUv.x*47.0)*2.0);
    detail=.92+.045*grain+.018*fine;
    rough=.43;
  } else if(uMaterial<2.5){
    detail=.97+.035*(hash(floor(vUv*220.0))-.5);
    rough=.64;
  } else if(uMaterial<3.5){
    detail=.92+.035*sin(vUv.x*210.0)*sin(vUv.y*136.0);
    rough=.85;
  } else if(uMaterial<4.5){
    // Black fittings have a dark protective coating; silver is polished steel,
    // gold is softly brushed brass. The different BRDFs keep hardware from
    // reading as uniform yellow, grey or black plastic.
    float brightness=max(uColor.r,max(uColor.g,uColor.b));
    float darkCoating=1.0-step(.35,brightness);
    float coolSilver=step(uColor.r,uColor.b)*step(uColor.r,uColor.g);
    metal=mix(.97,.72,darkCoating);
    rough=mix(.27,.38,darkCoating);
    rough=mix(rough,.19,coolSilver*(1.0-darkCoating));
    if(uMaterial>4.1)rough=.38;
  } else if(uMaterial<5.5){
    // Gingham follows physical cloth distances and soft folds, with screen-space
    // filtering instead of the stretched, hard checkerboard of the old cavity.
    vec2 clothUv=vUv*20.0;
    float resolved=0.0;
#ifdef ABAGS_HAS_DERIVATIVES
    float footprint=max(length(dFdx(clothUv)),length(dFdy(clothUv)));
    resolved=1.0-smoothstep(.28,.75,footprint);
#endif
    vec2 bands=mix(vec2(.5),smoothstep(vec2(.35),vec2(.65),.5+.5*cos(clothUv*6.2831853)),resolved);
    detail=1.0-.18*bands.x-.18*bands.y;
    rough=.95;
  } else if(uMaterial<6.5){
    detail=.88+.025*sin(vUv.x*118.0+vUv.y*97.0);
    rough=.96;
  } else if(uMaterial<7.5){
    vec2 braidSlope;
    float braid=cordBraid(vUv,braidSlope);
    float resolved=braidVisibility(vUv);
    n=cordBraidNormal(n,braidSlope*resolved);
    float filament=yarnFilaments(vUv);
    // Anisotropic lustre on the narrow plies, rather than a glossy plastic
    // clearcoat. The low-amplitude microfibre pattern never changes yarn hue.
    detail=mix(.97,.88+.15*braid,resolved)*(1.0+.035*filament);
    cordOcclusion=mix(1.0,.88+.12*braid,resolved);
    // Baked local fibre occlusion is independent of camera pose and zoom.
    // The underside of a real strand receives less light from its neighbours.
    float tubeCrown=.5+.5*sin(vUv.y*6.2831853);
    cordOcclusion*=mix(.68,1.0,smoothstep(.05,.78,tubeCrown));
    cordOcclusion*=vCordOcclusion;
    rough=.735+.055*(1.0-braid)*resolved+.015*(1.0-filament);
    fibreSheen=.018+.012*max(filament,0.0);
  } else if(uMaterial<8.5){
    // Floral satin and a slim bound border follow the fabric's own UVs.
    // The print remains attached to both faces as each loop turns in depth.
    vec2 printUv=vUv*vec2(5.0,1.6);
    vec2 cell=floor(printUv), flower=fract(printUv)-.5;
    float seed=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
    flower.x+=.10*sin(seed*6.28318);
    flower.y+=.08*cos(seed*6.28318);
    float angle=atan(flower.y,flower.x), radius=length(flower);
    float petals=1.0-smoothstep(.18,.22,radius-.045*cos(angle*5.0+seed*6.28318));
    float center=1.0-smoothstep(.040,.065,radius);
    vec2 leaf=flower-vec2(.22,-.17);
    float leaves=1.0-smoothstep(.80,1.0,length(vec2((leaf.x+leaf.y)*5.0,(leaf.y-leaf.x)*11.0)));
    // The bound hem also follows the pointed end of each scarf tail.
    float borderDistance=min(min(vUv.y,1.0-vUv.y),min(vUv.x,1.0-vUv.x)*2.5);
    float borderFilter=.002;
#ifdef ABAGS_HAS_DERIVATIVES
    borderFilter=max(borderFilter,fwidth(borderDistance)*.7);
#endif
    float border=1.0-smoothstep(.035-borderFilter,.055+borderFilter,borderDistance);
    if(uFabricStyle>1.5&&uFabricStyle<2.5){
      float stem=1.0-smoothstep(.015,.035,abs(flower.x-.12*sin(flower.y*5.0)));
      leaves=max(leaves,stem*.6);petals*=.32;
    }
    if(uFabricStyle>5.5){
      petals=max(petals,1.0-smoothstep(.21,.27,radius-.04*cos(angle*9.0)));
      petals*=.72+.28*cos(radius*54.0+angle*.7);
    }
    pigment=mix(pigment,uFabricStyle>0.0?uFabricLeaf:vec3(.31,.41,.30),leaves*.72);
    vec3 flowerInk=uFabricStyle>0.0?mix(uFabricFlower,pigment,step(.65,seed)*.42):mix(vec3(.80,.40,.51),vec3(.98,.90,.80),step(.48,seed));
    pigment=mix(pigment,flowerInk,petals*.85);
    pigment=mix(pigment,vec3(.72,.50,.23),center*.78);
    pigment=mix(pigment,uFabricStyle>0.0?uFabricBorder:vec3(.28,.32,.34),border*.78);
    if(uTextileReady.x>.5){
      // Large botanical ink follows the folded cloth's own coordinates.
      // Mipmapped albedo keeps fine petals stable during mobile rotation.
      pigment=texture2D(uScarfPrint,vUv*uScarfPrintUv.xy+uScarfPrintUv.zw).rgb;
      pigment=mix(pigment,uFabricBorder,border*.90);
    }
    detail=.98+.012*sin(vUv.x*120.0)*sin(vUv.y*74.0);
    rough=.53;
    fibreSheen=.025;
  } else if(uMaterial<9.5){
    // Small polished stone beads retain volume and softly varied mineral colour.
    float vein=sin(vUv.x*23.0+sin(vUv.y*17.0)*1.8);
    detail=.94+.045*vein;
    rough=.30;
  } else if(uMaterial<10.5){
    // Webbing has broad woven faces and bound edges, rather than a cord skin.
    vec2 frequency=vec2(120.0,34.0);
    float resolved=0.0;
#ifdef ABAGS_HAS_DERIVATIVES
    float footprint=max(length(dFdx(vUv)*frequency),length(dFdy(vUv)*frequency));
    resolved=1.0-smoothstep(.28,.75,footprint);
#endif
    float weave=sin(vUv.x*753.982)*sin(vUv.y*213.628);
    float selvedge=1.0-smoothstep(.035,.065,min(vUv.y,1.0-vUv.y));
    float stripe=1.0-smoothstep(.009,.020,min(abs(vUv.y-.18),abs(vUv.y-.82)));
    pigment=mix(pigment,vec3(.89,.77,.68),stripe*.50);
    detail=(.97+.025*weave*resolved)*(1.0-.16*selvedge);
    rough=.87;
    fibreSheen=.025;
  } else if(uMaterial<11.5){
    // Solid matte lining for the remaining constructions.
    detail=.98;
    rough=.95;
  } else {
    // Jacquard ornament, woven into a broad black band. The repeated flower
    // and diamond motifs follow the physical strap rather than the screen.
    vec2 p=vec2(fract(vUv.x)-.5,(vUv.y-.5)*.60);
    float a=atan(p.y,p.x),r=length(p);
    float petals=1.0-smoothstep(.24,.28,r-.055*cos(a*8.0));
    float flowerCentre=1.0-smoothstep(.065,.09,r);
    float diamond=1.0-smoothstep(.012,.034,abs(abs(p.x)+abs(p.y)-.47));
    float selvedge=1.0-smoothstep(.025,.05,min(vUv.y,1.0-vUv.y));
    pigment=mix(vec3(.075,.065,.06),vec3(.91,.86,.74),max(diamond,selvedge)*.95);
    pigment=mix(pigment,vec3(.66,.34,.18),petals*.95);
    pigment=mix(pigment,vec3(.91,.86,.74),flowerCentre*.95);
    if(uBandPrint>.5&&uBandPrint<1.5){
      pigment=mix(vec3(.96,.90,.86),uFabricFlower,petals*.86);
      pigment=mix(pigment,uFabricLeaf,(1.0-smoothstep(.045,.08,abs(p.x-.24*sin(p.y*9.0))))*.5);
      pigment=mix(pigment,uFabricBorder,selvedge*.9);
    }else if(uBandPrint>1.5){
      float band=step(.24,vUv.y)-step(.41,vUv.y)+step(.59,vUv.y)-step(.76,vUv.y);
      pigment=mix(vec3(.89,.84,.75),vec3(.52,.49,.43),band*.65);
      pigment=mix(pigment,vec3(.80,.66,.47),(step(.45,vUv.y)-step(.55,vUv.y))*.65);
    }
    if(uTextileReady.y>.5){
      pigment=texture2D(uStrapPrint,vUv*uStrapPrintUv.xy+uStrapPrintUv.zw).rgb;
      pigment*=1.0-selvedge*.10;
    }
    detail=.96+.025*sin(vUv.x*820.0)*sin(vUv.y*240.0);
    rough=.88;fibreSheen=.02;
  }
  float ndl=max(dot(n,l),0.0);
  float fillLight=max(dot(n,fill),0.0);
  float facing=max(dot(n,v),0.0);
  vec3 base=pow(max(pigment,vec3(.001)),vec3(2.2))*detail;
  float cavity=.94+.06*facing;
  float hemisphere=mix(.66,1.05,.5+.5*n.y);
  float illumination=.30*hemisphere+.66*ndl+.20*fillLight;
  vec3 f0=mix(vec3(.035),base,metal);
  vec3 color=base*illumination*cavity*cordOcclusion*(1.0-metal*.75);
  float physicalCord=step(6.5,uMaterial)*(1.0-step(7.5,uMaterial));
  if(physicalCord>.5)color+=cordSpecular(n,l,v,rough,f0)*.85;
  else color+=specularGGX(n,l,v,rough,f0)*1.6;
  if(uMaterial>3.5 && uMaterial<4.5)color+=studioMetalReflection(n,v,rough,f0)*metal;
  // Multiple scattering inside dyed fibres retains their hue. An untinted
  // white rim used to wash dark navy/brown cord into a uniform grey coating.
  vec3 sheenTint=mix(vec3(1.0),mix(vec3(.20),sqrt(base),.80),physicalCord);
  color+=sheenTint*fibreSheen*pow(1.0-facing,2.0)*(.3+.7*ndl);
  // Cavity light is tied to local fabric depth, so the mouth stays readable
  // while the lining darkens toward its actual base during any rotation.
  if((uMaterial>4.5 && uMaterial<5.5) || (uMaterial>10.5 && uMaterial<11.5))
    color*=mix(1.0,.28,smoothstep(0.0,1.0,vLiningDepth));
  // A restrained warm atelier bounce stays in linear light, preserving cord hue.
  color+=base*vec3(.025,.020,.016);
  color=color/(1.0+color*.18);
  gl_FragColor=vec4(pow(max(color,vec3(0.0)),vec3(1.0/2.2)),1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "shader");
  return shader;
}

function createMesh(gl: WebGLRenderingContext, data: FabricMesh): Mesh {
  // WebGL 1 uses unsigned-short indices, including on older Android devices.
  if (data.positions.length / 3 > 65535) throw new Error("mesh-index-budget");
  if (data.cordOccluders && !data.occlusion) bakeCordOcclusion(data, data.cordOccluders);
  delete data.cordOccluders;
  const position = gl.createBuffer();
  const normal = gl.createBuffer();
  const uv = gl.createBuffer();
  const index = gl.createBuffer();
  if (!position || !normal || !uv || !index) throw new Error("buffer");
  gl.bindBuffer(gl.ARRAY_BUFFER, position); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, normal); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);
  const uvAndOcclusion = new Float32Array(data.positions.length);
  for (let i=0;i<data.positions.length/3;i++) {
    uvAndOcclusion[i*3]=data.uvs[i*2];
    uvAndOcclusion[i*3+1]=data.uvs[i*2+1];
    uvAndOcclusion[i*3+2]=data.occlusion?.[i] ?? 1;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, uv); gl.bufferData(gl.ARRAY_BUFFER, uvAndOcclusion, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);
  return { position, normal, uv, index, count: data.indices.length };
}

function init(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const program = gl.createProgram();
  if (!program) return null;
  // Optional in WebGL 1: detail is filtered in screen space when supported.
  const derivatives = Boolean(gl.getExtension("OES_standard_derivatives"));
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, derivatives ? "#define ABAGS_HAS_DERIVATIVES\n" + FRAGMENT : FRAGMENT));
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
    printedTextiles: createAbagsPrintedTextiles(gl),
    meshes: {
      tote: createMesh(gl, makeVariableDepthBody("tote")),
      round: createMesh(gl, makeVariableDepthBody("round")),
      bucket: createMesh(gl, makeVariableDepthBody("bucket")),
      mini: createMesh(gl, makeVariableDepthBody("mini")),
      toteInterior: createMesh(gl, makeOpeningInterior("tote")),
      roundInterior: createMesh(gl, makeOpeningInterior("round")),
      bucketInterior: createMesh(gl, makeOpeningInterior("bucket")),
      miniInterior: createMesh(gl, makeOpeningInterior("mini")),
      toteLiningSeam: createMesh(gl, makeOpeningLiningSeam("tote")),
      roundLiningSeam: createMesh(gl, makeOpeningLiningSeam("round")),
      bucketLiningSeam: createMesh(gl, makeOpeningLiningSeam("bucket")),
      miniLiningSeam: createMesh(gl, makeOpeningLiningSeam("mini")),
      woodHandle: createMesh(gl, makeArchTube(0.46, 0.42, 0, 0.042, 96, 16, true)),
      crochetHandle: createMesh(gl, makeArchTube(0.72, 0.72, 0, 0.059, 72, 12, false)),
      toteChain: createMesh(gl, familyShoulderChainMesh("tote")),
      roundChain: createMesh(gl, familyShoulderChainMesh("round")),
      bucketChain: createMesh(gl, familyShoulderChainMesh("bucket")),
      miniChain: createMesh(gl, familyShoulderChainMesh("mini")),
      ring: createMesh(gl, makeDHardwareRing()),
      claspHook: createMesh(gl, makeLobsterClaspMesh()),
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
      projection: req("uProjection"), view: req("uView"), model: req("uModel"), normalMatrix: req("uNormalMatrix"), color: req("uColor"), material: req("uMaterial"), stitch: req("uStitch"), relief: req("uRelief"), light: req("uLight"), interiorBounds: req("uInteriorBounds"), yarnGradientAxis: req("uYarnGradientAxis"), yarnGradientRange: req("uYarnGradientRange"), yarnOmbre: req("uYarnOmbre"), fabricStyle: req("uFabricStyle"), fabricFlower: req("uFabricFlower"), fabricLeaf: req("uFabricLeaf"), fabricBorder: req("uFabricBorder"), bandPrint: req("uBandPrint"), textileReady: req("uTextileReady"), scarfPrint: req("uScarfPrint"), strapPrint: req("uStrapPrint"), scarfPrintUv: req("uScarfPrintUv"), strapPrintUv: req("uStrapPrintUv"),
    },
  };
}

function drawMesh(renderer: Renderer, mesh: Mesh, model: Float32Array, color: string, material: number, stitch: number, relief = 0) {
  const { gl, attribs, uniforms } = renderer;
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position); gl.enableVertexAttribArray(attribs.position); gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal); gl.enableVertexAttribArray(attribs.normal); gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv); gl.enableVertexAttribArray(attribs.uv); gl.vertexAttribPointer(attribs.uv, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
  gl.uniformMatrix4fv(uniforms.model, false, model);
  gl.uniformMatrix3fv(uniforms.normalMatrix, false, normalMatrix(model));
  gl.uniform3fv(uniforms.color, hex(color));
  gl.uniform1f(uniforms.material, material);
  gl.uniform1f(uniforms.stitch, stitch);
  gl.uniform1f(uniforms.relief, relief);
  gl.uniform1f(uniforms.yarnOmbre, material === 6 || material === 7 ? (renderer.ombrePalette ?? 0) : 0);
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

function strapHardwarePosition(family: Exclude<Family, "">, side: number): YarnPoint {
  const attachment = familyAttachment(PROFILES[family], family);
  return [side * attachment.x, attachment.y - .08, attachment.z + .035];
}

function shoulderStrapMatrix(family: Exclude<Family, "">) {
  const attachment = familyAttachment(PROFILES[family], family);
  return matrix([0, attachment.y - .02, attachment.z + .035], [1, 1, 1]);
}

function strapBindingPaths(family: Exclude<Family, "">, side: number) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const ring = strapHardwarePosition(family, side);
  const contour = familyContour(family);
  const cord = spec.rx * 5 / 160;
  const radius = cord * .65;
  const footX = side * Math.min(Math.abs(ring[0]), spec.rx * .90);
  const upperAt = (x: number) => {
    let upper = 0;
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i], b = contour[(i + 1) % contour.length];
      if (Math.abs(b[0] - a[0]) < 1e-8 || x < Math.min(a[0], b[0]) || x > Math.max(a[0], b[0])) continue;
      upper = Math.max(upper, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]));
    }
    return upper;
  };
  const footY = Math.min(upperAt(footX - cord * .5), upperAt(footX + cord * .5)) - cord * 2.1;
  const bottom = ring[1] - .13 * .88;
  const y = Math.min(footY, bottom - spec.bodyY - cord * 3);
  const seat = (x: number): YarnPoint => {
    const point = crochetPanelPoint(family, x, y, cord * .35);
    return [point[0], point[1] + spec.bodyY, point[2]];
  };
  const feet = [seat(footX - cord * .5), seat(footX + cord * .5)];
  const bridge = (a: YarnPoint, b: YarnPoint) => Array.from({ length: 7 }, (_, i): YarnPoint => {
    const t = i / 6;
    return a.map((v, axis) => v * (1 - t) + b[axis] * t) as YarnPoint;
  });
  const paths = [-1, 0, 1].map((lane) => {
    // Three sewn cord loops wrap over the bottom of the real metal ring.
    // Their feet are inside the family's curved panel, including round bags.
    const wrap = Array.from({ length: 17 }, (_, i): YarnPoint => {
      const angle = Math.PI * (1 - i / 16);
      return [ring[0] + (.025 + radius * .7) * Math.cos(angle),
        bottom + (.022 + radius * .7) * Math.sin(angle), ring[2] + lane * radius * 1.7];
    });
    const a = [...feet[0]] as YarnPoint, b = [...feet[1]] as YarnPoint;
    a[1] += lane * radius * .65; b[1] += lane * radius * .65;
    return [...bridge(a, wrap[0]), ...wrap.slice(1), ...bridge(wrap[16], b).slice(1), a];
  });
  return { paths, radius };
}

function makeStrapBinding(family: Exclude<Family, "">): FabricMesh {
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  for (const side of [-1, 1]) {
    const { paths, radius } = strapBindingPaths(family, side);
    for (const path of paths) appendCord(mesh, path, radius, () => [0, 0, 1], () => true, 8);
  }
  return mesh;
}

function ensureStrapBinding(renderer: Renderer, family: Exclude<Family, "">) {
  if (renderer.strapBindingKey === family) return;
  const previous = renderer.meshes.strapBinding;
  if (previous) for (const buffer of [previous.position, previous.normal, previous.uv, previous.index]) renderer.gl.deleteBuffer(buffer);
  renderer.meshes.strapBinding = createMesh(renderer.gl, makeStrapBinding(family));
  renderer.strapBindingKey = family;
}

function fidelityAccessoryAnchor(config: Config): YarnPoint | null {
  if (!config.family || config.accent === "none") return null;
  const family = config.family, spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  if (family === "shoulder" && (config.accent === "scarf" || config.accent === "bow")) {
    const x = -spec.rx * .40, y = spec.bodyY + spec.ry * .52;
    return [x, y, ornamentSurfaceZ(config, x, y, .018)];
  }
  if (config.accent === "tassel" && getAbagsCrochetFlapTone(config)) {
    const tip = closedFlapSurface(family, true).contour.reduce((a,b)=>b[1] < a[1] ? b : a);
    return [tip[0], tip[1], ornamentSurfaceZ(config, tip[0], tip[1], .018)];
  }
  if ((config.accent === "scarf" || config.accent === "bow") && config.handles.startsWith("wood")) {
    const model = woodHandleMatrix(family, woodHandleDepthPlanes(family)[1]);
    const angle = Math.PI - .16;
    const x = .46 * Math.cos(angle), y = .42 * Math.sin(angle), z = .055;
    return [model[0] * x + model[4] * y + model[8] * z + model[12],
      model[1] * x + model[5] * y + model[9] * z + model[13],
      model[2] * x + model[6] * y + model[10] * z + model[14]];
  }
  const x = spec.sideAnchor * (config.accent === "tassel" ? .91 : (config.accent === "scarf" || config.accent === "bow") ? -.68 : .86);
  const y = config.accent === "tassel" ? .25 : (config.accent === "scarf" || config.accent === "bow") ? .36 : .12;
  return [x, y, ornamentSurfaceZ(config, x, y, .018)];
}

function ornamentSurfaceZ(config: Config, x: number, worldY: number, clearance: number) {
  const family = config.family as Exclude<Family, "">, spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const radius = spec.rx * 5 / 160;
  let z = crochetPanelPoint(family, x, worldY - spec.bodyY)[2] + radius * 1.75;
  if (config.flap && config.flap !== "none") {
    const crochet = config.flap === "crochet", surface = closedFlapSurface(family, crochet);
    // Include the fabric thickness at the flap's curved edge. A ribbon's
    // offset back face can otherwise enter the flap just past its centreline.
    for (const [dx, dy] of [[0, 0], [-.004, 0], [.004, 0], [0, -.004], [0, .004]]) {
      const flap = surface.sample(x + dx, worldY + dy);
      if (flap) z = Math.max(z, flap.z + (crochet ? radius * 1.75 : 0));
    }
  }
  return z + clearance;
}

type OrnamentTone = "cord" | "metal" | "scarf" | "hem" | "rose" | "lilac" | "teal";
type OrnamentPart = { name: string; tone: OrnamentTone; material: number; mesh: FabricMesh };

function appendOrnamentMesh(target: FabricMesh, source: FabricMesh, pose: Float32Array) {
  const start = target.positions.length / 3, normals = normalMatrix(pose);
  for (let i = 0; i < source.positions.length; i += 3) {
    const [x, y, z] = source.positions.slice(i, i + 3);
    target.positions.push(pose[0] * x + pose[4] * y + pose[8] * z + pose[12], pose[1] * x + pose[5] * y + pose[9] * z + pose[13], pose[2] * x + pose[6] * y + pose[10] * z + pose[14]);
    const [nx, ny, nz] = source.normals.slice(i, i + 3);
    target.normals.push(...normalize(normals[0] * nx + normals[3] * ny + normals[6] * nz, normals[1] * nx + normals[4] * ny + normals[7] * nz, normals[2] * nx + normals[5] * ny + normals[8] * nz));
  }
  target.uvs.push(...source.uvs);
  target.indices.push(...source.indices.map((index) => index + start));
}

function makeOrnamentLathe(profile: Point[], segments = 28): FabricMesh {
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  profile.forEach(([radius, y], row) => {
    const a = profile[Math.max(0, row - 1)], b = profile[Math.min(profile.length - 1, row + 1)];
    const slope = (b[0] - a[0]) / (b[1] - a[1] || .001);
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2, x = Math.cos(angle), z = Math.sin(angle);
      mesh.positions.push(radius * x, y, radius * z);
      mesh.normals.push(...normalize(x, -slope, z)); mesh.uvs.push(i / segments, row / (profile.length - 1));
      if (row && i < segments) {
        const j = row * (segments + 1) + i, k = j - segments - 1;
        mesh.indices.push(k, j, k + 1, k + 1, j, j + 1);
      }
    }
  });
  return mesh;
}

function appendOrnamentRibbon(mesh: FabricMesh, sample: (u: number, v: number) => YarnPoint, rows = 36, columns = 8) {
  const start = mesh.positions.length / 3, faceSize = (rows + 1) * (columns + 1);
  for (const side of [1, -1]) for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    const u = row / rows, v = column / columns * 2 - 1, e = .0005;
    const point = sample(u, v), ua = sample(Math.max(0, u - e), v), ub = sample(Math.min(1, u + e), v);
    const va = sample(u, Math.max(-1, v - e)), vb = sample(u, Math.min(1, v + e));
    const du = ub.map((n, i) => n - ua[i]), dv = vb.map((n, i) => n - va[i]);
    const n = normalize(du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]);
    mesh.positions.push(...point.map((value, i) => value + n[i] * side * .0018));
    mesh.normals.push(...n.map((value) => value * side)); mesh.uvs.push(u, (v + 1) * .5);
  }
  for (const side of [0, 1]) for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = start + side * faceSize + row * (columns + 1) + column, b = a + columns + 1;
    mesh.indices.push(...(side ? [a, a + 1, b, a + 1, b + 1, b] : [a, b, a + 1, a + 1, b, b + 1]));
  }
  const join = (a: number, b: number) => mesh.indices.push(start + a, start + b, start + a + faceSize, start + b, start + b + faceSize, start + a + faceSize);
  for (let row = 0; row < rows; row++) for (const col of [0, columns]) join(row * (columns + 1) + col, (row + 1) * (columns + 1) + col);
  for (let column = 0; column < columns; column++) for (const row of [0, rows]) join(row * (columns + 1) + column, row * (columns + 1) + column + 1);
}

function foldedRibbonLoop(u: number, v: number, side: number, compact: boolean): YarnPoint {
  const arch = Math.sin(Math.PI * u), turn = Math.sin(Math.PI * 2 * u);
  // The long scarf spans roughly two fifths of the tote's front in Agata's
  // red and brown wooden-handle references; a short decorative bow is smaller.
  const span = (compact ? .245 : .430) * (side < 0 ? 1 : .94);
  const width = .018 + (compact ? .077 : .155) * Math.pow(Math.max(0, arch), .7);
  // The return leg folds behind the front leg. Its opening faces sideways,
  // rather than leaving a flat elliptical hole when seen from the front.
  const twist = side * .28 * turn;
  return [side * span * arch * (1 - .20 * v * v * arch) + width * v * Math.sin(twist) * .16,
    side * .028 * arch + .009 * turn + width * v * Math.cos(twist),
    .045 + .045 * arch + .065 * turn + width * v * Math.sin(twist)
      + .009 * (1 - v * v) * Math.sin(Math.PI * 3 * u)];
}

function foldedRibbonTail(u: number, v: number, side: number, compact: boolean): YarnPoint {
  const arch = Math.sin(Math.PI * u), length = compact ? (side < 0 ? .205 : .175) : (side < 0 ? 1.30 : 1.10);
  const width = .018 + (compact ? .044 : .122) * (1 - Math.exp(-u * (compact ? 5 : 4)));
  const twist = side * .25 * arch + .42 * Math.sin(Math.PI * 2 * u) * arch;
  const notch = (compact ? .027 * (1 - Math.abs(v)) : .12 * (1 - side * v)) * Math.pow(u, 12);
  return [side * (.012 + (compact ? .15 : .24) * u + .022 * arch) + width * v * Math.cos(twist),
    -.022 - length * u + notch + side * .010 * v * arch,
    .045 + .035 * arch + .018 * Math.sin(Math.PI * 3 * u) * arch
      + width * v * Math.sin(twist) + .014 * Math.cos(v * Math.PI * 1.5 + side * .4) * arch
      + (side < 0 ? (compact ? .028 : .075) * Math.sin(Math.PI * u * .85) : 0)];
}

function foldedRibbonKnot(u: number, v: number): YarnPoint {
  const a = u * Math.PI * 2, pinch = .030 * (1 - .10 * Math.cos(a * 2));
  return [pinch * v, -.005 + .041 * Math.cos(a),
    .040 + .035 * Math.sin(a) + .005 * (1 - v * v) * Math.sin(a * 3)];
}

// The supplied bows are tied scarves with broad folded wings. Their return
// face passes behind the outer fold instead of turning into an upright leaf.
// Keep the small optional bow's existing construction on the other families.
function referenceRibbonLoop(config: Config, u: number, v: number, side: number): YarnPoint {
  const profile = getAbagsReferenceModel(config)?.ribbon;
  if (!profile) return foldedRibbonLoop(u, v, side, false);
  const arch = Math.sin(Math.PI * u), turn = Math.sin(Math.PI * 2 * u);
  const span = profile.span * (config.family === "tall-tote" ? 1.35 : 1) * (side < 0 ? 1 : .94);
  const width = .015 + profile.height * Math.pow(Math.max(0, arch), .66);
  const twist = side * (.16 + .20 * turn);
  const gather = .026 * Math.sin(v * Math.PI * 3 + side * .5) * Math.pow(1 - arch, 2);
  const fold = .020 * Math.sin(v * Math.PI * 2.5 + side * .6) * arch;
  return [side * span * arch * (1 - .09 * v * v) + width * v * Math.sin(twist) * .15,
    (profile.tilt + side * .035) * arch + width * v * Math.cos(twist) - .025 * arch * arch,
    .070 + .095 * arch + .075 * turn + width * v * Math.sin(twist) + gather + fold];
}

function referenceRibbonTail(config: Config, u: number, v: number, side: number): YarnPoint {
  const profile = getAbagsReferenceModel(config)?.ribbon;
  if (!profile) return foldedRibbonTail(u, v, side, false);
  const arch = Math.sin(Math.PI * u), length = profile.tails[side < 0 ? 0 : 1];
  const width = .016 + profile.width * (config.family === "tall-tote" ? 1.18 : 1) * (1 - Math.exp(-u * 5));
  const twist = side * .22 * arch + .30 * Math.sin(Math.PI * 2 * u) * arch;
  const pointedEnd = .15 * (1 - side * v) * Math.pow(u, 12);
  return [side * (.012 + .18 * u + .035 * arch) + width * v * Math.cos(twist),
    -.025 - length * u + pointedEnd,
    .070 + .045 * arch + width * v * Math.sin(twist)
      + .030 * Math.sin(v * Math.PI * 2 + side * .5) * arch
      + .018 * Math.sin(u * Math.PI * 4 + side * .8) * arch * (1 - v * v)
      + (side < 0 ? .050 * Math.sin(Math.PI * u * .85) : 0)];
}

const woodRibbonFrames = new Map<Exclude<Family, "">, { model: Float32Array; radial: YarnPoint; tangent: YarnPoint; center: YarnPoint }>();
function woodHandleRibbonPoint(family: Exclude<Family, "">, u: number, v: number): YarnPoint {
  let frame = woodRibbonFrames.get(family);
  if (!frame) {
    const angle = Math.PI - .16;
    frame = { model: woodHandleMatrix(family, woodHandleDepthPlanes(family)[1]),
      radial: normalize(Math.cos(angle) / .46, Math.sin(angle) / .42, 0),
      tangent: normalize(-.46 * Math.sin(angle), .42 * Math.cos(angle), 0),
      center: [.46 * Math.cos(angle), .42 * Math.sin(angle), 0] };
    woodRibbonFrames.set(family, frame);
  }
  const { model, radial, tangent, center } = frame, turn = u * Math.PI * 2;
  const local = [center[0] + radial[0] * .050 * Math.cos(turn) + tangent[0] * .027 * v,
    center[1] + radial[1] * .050 * Math.cos(turn) + tangent[1] * .027 * v, .050 * Math.sin(turn)];
  return [model[0] * local[0] + model[4] * local[1] + model[8] * local[2] + model[12],
    model[1] * local[0] + model[5] * local[1] + model[9] * local[2] + model[13],
    model[2] * local[0] + model[6] * local[1] + model[10] * local[2] + model[14]];
}

function tasselFringeStrands() {
  return Array.from({ length: 36 }, (_, strand) => {
    const outer = strand < 24, angle = (outer ? strand / 24 : (strand - 24 + .5) / 12) * Math.PI * 2;
    const length = .70 + .024 * Math.sin(strand * 2.4) + .009 * Math.cos(strand * .9);
    const path: YarnPoint[] = Array.from({ length: 25 }, (_, i) => {
      const t = i / 24, spread = (outer ? .021 : .010) + (outer ? .043 : .027) * t;
      return [Math.cos(angle) * spread + .006 * Math.sin(t * Math.PI + angle), -.115 - length * t,
        .070 + Math.sin(angle) * spread + .012 * Math.sin(t * Math.PI)];
    });
    const end = path[path.length - 1];
    const frays = [-1, 0, 1].map(lane => Array.from({ length: 5 }, (_, i): YarnPoint => {
      const t = i / 4, spread = lane * .0035 * t;
      return [end[0] + Math.cos(angle) * spread, end[1] - (.014 + .003 * Math.sin(strand + lane)) * t,
        end[2] + Math.sin(angle) * spread];
    }));
    return { path, frays };
  });
}

function makeOrnamentGeometry(config: Config) {
  const anchor = fidelityAccessoryAnchor(config);
  const parts: OrnamentPart[] = [];
  if (!anchor || !config.family) return { parts, bounds: undefined };
  const family = config.family, spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const part = (tone: OrnamentTone, material: number) => {
    let current = parts.find((p) => p.tone === tone);
    if (!current) { current = { name: "ornament-" + tone, tone, material, mesh: { positions: [], normals: [], uvs: [], indices: [] } }; parts.push(current); }
    return current.mesh;
  };
  const point = (x: number, y: number, z: number, clearance = .012): YarnPoint => {
    if (family === "shoulder") x *= 1.40;
    const wx = anchor[0] + x, wy = anchor[1] + y, localY = wy - spec.bodyY;
    const taper = 1 + spec.taper * localY / spec.ry;
    const fraction = Math.pow(Math.pow(Math.abs(wx / (spec.rx * taper)), spec.power) + Math.pow(Math.abs(localY / spec.ry), spec.power), 1 / spec.power);
    let wz = anchor[2] + z;
    if (fraction < .974) wz = Math.max(wz, ornamentSurfaceZ(config, wx, wy, clearance));
    return [wx, wy, wz];
  };
  const tube = (target: FabricMesh, points: YarnPoint[], radius: number) => appendCord(target, points, radius, () => [0, 0, 1], () => true, 8);
  const ring = (target: FabricMesh, at: YarnPoint, rx: number, ry: number, radius: number, rotation: [number, number, number] = [0, 0, 0]) => appendOrnamentMesh(target, makeArchTube(rx, ry, 0, radius, 28, 8, true), matrix(at, [1, 1, 1], rotation));
  const bead = (target: FabricMesh, at: YarnPoint, size: YarnPoint) => appendOrnamentMesh(target, makeEllipsoid(1, 1, 1, 10, 14), matrix(at, size));
  if (config.accent === "tassel") {
    const metal = part("metal", 4), cord = part("cord", 7);
    const fanFringe = Boolean(getAbagsCrochetFlapTone(config));
    const fringePoint = ([x,y,z]: YarnPoint) => {
      const t = clamp((-y-.115)/.70,0,1);
      return point(x*(fanFringe ? .75+2.75*t : 1),y,z,.011);
    };
    ring(metal, point(0, -.015, .025), .025, .031, .006);
    const cap = makeOrnamentLathe([[.013, .038], [.027, .031], [.037, .016], [.040, -.023], [.038, -.035], [.031, -.035]]);
    appendOrnamentMesh(cord, cap, matrix(point(0, -.087, .060, .042), [1, 1, 1]));
    for (let strand = 0; strand < 12; strand++) {
      const angle = strand / 12 * Math.PI * 2;
      tube(cord, Array.from({ length: 17 }, (_, i) => {
        const t = i / 16, radius = .014 + .024 * Math.sin(t * Math.PI * .78);
        return point(Math.cos(angle) * radius, -.049 - .073 * t, .060 + Math.sin(angle) * radius, .042);
      }), .003);
    }
    for (const { path, frays } of tasselFringeStrands()) {
      tube(cord, path.map(fringePoint), .0085);
      for (const fray of frays) tube(cord, fray.map(fringePoint), .0018);
    }
    const winding = Array.from({ length: 65 }, (_, i) => {
      const t = i / 64, a = t * Math.PI * 6;
      return point(Math.cos(a) * .030, -.113 - t * .028, .070 + Math.sin(a) * .030, .009);
    });
    tube(cord, winding, .006);
  } else if (config.accent === "scarf" || config.accent === "bow") {
    const fabric = part("scarf", 8), hem = part("hem", 3);
    const ribbon = (sample: (u: number, v: number) => YarnPoint, rows = 40) => {
      appendOrnamentRibbon(fabric, sample, rows);
      for (const edge of [-1, 1]) tube(hem, Array.from({ length: rows + 1 }, (_, i) => sample(i / rows, edge)), .0018);
    };
    const compact = config.accent === "bow" && family !== "tall-tote" && family !== "shoulder";
    const referenceBow = config.accent === "bow" && Boolean(getAbagsReferenceModel(config));
    for (const side of [-1, 1]) ribbon((u, v) => {
      const p = referenceBow ? referenceRibbonLoop(config, u, v, side) : foldedRibbonLoop(u,v,side,compact);
      if(!referenceBow && (family === "tall-tote" || family === "shoulder")){p[0]*=family === "tall-tote"?1.12:1;p[1]*=1.35;}
      return point(...p,.006);
    },48);
    for (const side of [-1, 1]) ribbon((u, v) => {
      const p = referenceBow ? referenceRibbonTail(config, u, v, side) : foldedRibbonTail(u,v,side,compact);
      if(!referenceBow && family === "shoulder")p[1]*=.84;
      return point(...p,side < 0 ? .018 : .007);
    },48);
    if (config.handles.startsWith("wood")) {
      appendOrnamentRibbon(fabric, (u, v) => woodHandleRibbonPoint(family, u, v), 40, 8);
    }
    // A gathered band encircles the tied fabric. Its rear touches the handle
    // wrap, while the front catches the same soft satin light as the loops.
    ribbon((u, v) => {
      const p = foldedRibbonKnot(u, v);
      if (referenceBow) { p[0] *= 1.6; p[1] *= 1.4; p[2] += .095; }
      return point(...p, .006);
    }, 36);
  } else if (config.accent === "charm") {
    const metal = part("metal", 4);
    ring(metal, point(0, -.012, .028), .022, .028, .0055);
    for (let i = 0; i < 7; i++) ring(metal, point(0, -.043 - i * .026, .045, .021), .012, .018, .0038, [0, i % 2 ? Math.PI / 2 : 0, 0]);
    const stones: Array<[OrnamentTone, number, number]> = [["rose", 0, -.285], ["lilac", .047, -.365], ["teal", -.047, -.365]];
    for (const [tone, x, y] of stones) {
      const center = point(x, y, .068, .044);
      tube(metal, [point(0, -.215, .048, .021), [center[0], center[1] + .041, center[2]], [center[0], center[1] - .043, center[2]]], .0035);
      bead(part(tone, 9), center, [.036, .040, .030]);
      ring(metal, [center[0], center[1] + .038, center[2]], .013, .008, .0035);
      // Small rounded caps finish the pin at both ends of each stone.
      bead(metal, [center[0], center[1] + .039, center[2]], [.014, .005, .013]);
      bead(metal, [center[0], center[1] - .040, center[2]], [.012, .005, .012]);
    }
  }
  const min: YarnPoint = [Infinity, Infinity, Infinity], max: YarnPoint = [-Infinity, -Infinity, -Infinity];
  for (const { mesh } of parts) for (let i = 0; i < mesh.positions.length; i++) {
    const axis = i % 3; min[axis] = Math.min(min[axis], mesh.positions[i]); max[axis] = Math.max(max[axis], mesh.positions[i]);
  }
  return { parts, bounds: parts.length ? { min, max } : undefined };
}

function ensureOrnamentMeshes(renderer: Renderer, config: Config) {
  const flapConstruction = config.flap === "crochet" ? "crochet" : config.flap && config.flap !== "none" ? "rigid" : "none";
  const key = [config.family, config.accent, (config.accent === "scarf" || config.accent === "bow") && config.handles.startsWith("wood"), flapConstruction,
    config.accent === "bow" ? getAbagsReferenceModel(config)?.id ?? "custom" : "",
    config.accent === "tassel" && getAbagsCrochetFlapTone(config) ? "flap-tip" : "side"].join("|");
  if (renderer.ornamentKey === key) return;
  for (const part of renderer.ornamentParts ?? []) {
    const mesh = renderer.meshes[part.name];
    for (const buffer of [mesh.position, mesh.normal, mesh.uv, mesh.index]) renderer.gl.deleteBuffer(buffer);
    delete renderer.meshes[part.name];
  }
  const data = makeOrnamentGeometry(config);
  renderer.ornamentParts = data.parts.map(({ name, tone, material, mesh }) => {
    renderer.meshes[name] = createMesh(renderer.gl, mesh);
    return { name, tone, material };
  });
  renderer.ornamentBounds = data.bounds;
  renderer.ornamentTriangles = data.parts.reduce((sum, part) => sum + part.mesh.indices.length / 3, 0);
  renderer.ornamentKey = key;
}

type CognacPart = { name: string; tone: "leather" | "edge" | "seam" | "metal" | "recess" | "engraving"; section: "handle" | "flap" | "badge"; mesh: FabricMesh };

function roundedRectangle(width: number, height: number, radius: number): Point[] {
  const p: Point[] = [], x = width / 2, y = height / 2;
  quad(p, [-x + radius, y], [0, y], [x - radius, y], 8);
  quad(p, [x - radius, y], [x, y], [x, y - radius], 8);
  quad(p, [x, y - radius], [x, 0], [x, -y + radius], 8);
  quad(p, [x, -y + radius], [x, -y], [x - radius, -y], 8);
  quad(p, [x - radius, -y], [0, -y], [-x + radius, -y], 8);
  quad(p, [-x + radius, -y], [-x, -y], [-x, -y + radius], 8);
  quad(p, [-x, -y + radius], [-x, 0], [-x, y - radius], 8);
  quad(p, [-x, y - radius], [-x, y], [-x + radius, y], 8);
  return p;
}

function cognacHandlePoint(t: number, lane = -1): YarnPoint {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS.satchel;
  const x = -.60 + 1.20 * t, y = spec.topY + .075 - .285 * Math.sin(Math.PI * t);
  const tangent = normalize(1.20, -.285 * Math.PI * Math.cos(Math.PI * t), 0);
  const across = [-tangent[1], tangent[0], 0];
  const seat = closedFlapSurface("satchel", false).sample(x, y);
  const z = (seat?.z ?? depthAt("satchel", spec.ry) * .5 + .045) + .042;
  if (lane < 0) return [x, y, z];
  // Three flat leather ribbons alternate over/under at each crossing.
  // The doubled depth rhythm makes a plait, rather than a cylindrical helix.
  const a = t * Math.PI * 14 + lane * Math.PI * 2 / 3;
  return [x + across[0] * .033 * Math.sin(a), y + across[1] * .033 * Math.sin(a), z + .018 * Math.sin(2 * a)];
}

function appendLeatherStrand(mesh: FabricMesh, path: YarnPoint[]) {
  const start = mesh.positions.length / 3, sides = 12;
  path.forEach((p, row) => {
    const a = path[Math.max(0, row - 1)], b = path[Math.min(path.length - 1, row + 1)];
    const tangent = normalize(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const across = normalize(-tangent[1], tangent[0], 0);
    const face = normalize(tangent[1] * across[2] - tangent[2] * across[1], tangent[2] * across[0] - tangent[0] * across[2], tangent[0] * across[1] - tangent[1] * across[0]);
    for (let column = 0; column <= sides; column++) {
      const a = column / sides * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      mesh.positions.push(...p.map((n, i) => n + across[i] * c * .019 + face[i] * s * .009));
      mesh.normals.push(...normalize(...across.map((n, i) => n * c / .019 + face[i] * s / .009) as YarnPoint));
      mesh.uvs.push(row / (path.length - 1), column / sides);
      if (row && column < sides) {
        const i = start + row * (sides + 1) + column, j = i - sides - 1;
        mesh.indices.push(j, i, j + 1, j + 1, i, i + 1);
      }
    }
  });
}

function makeCognacPlate(outline: Point[], depth: number) {
  const mesh = makeExtrudedContour(outline, depth);
  // Small metal plates and mounting tabs are almost flat. The main flap
  // deliberately has more volume; reusing that dome would bury the engraving.
  for (let i = 0; i < mesh.positions.length; i += 3) {
    if (mesh.positions[i + 2] > depth * .5) mesh.positions[i + 2] = depth * .5 + .001;
    if (mesh.normals[i + 2] > .1) mesh.normals.splice(i, 3, 0, 0, 1);
  }
  return mesh;
}

function makeCognacConstruction(): CognacPart[] {
  const empty = (): FabricMesh => ({ positions: [], normals: [], uvs: [], indices: [] });
  const parts: CognacPart[] = [];
  const part = (tone: CognacPart["tone"], section: CognacPart["section"]) => {
    let p = parts.find(p => p.tone === tone && p.section === section);
    if (!p) { p = { name: `cognac-${section}-${tone}`, tone, section, mesh: empty() }; parts.push(p); }
    return p.mesh;
  };
  const tube = (mesh: FabricMesh, path: YarnPoint[], radius: number, closed = false) => appendCord(mesh, path, radius, () => [0, 0, 1], () => true, 8, closed);
  const solid = (mesh: FabricMesh, outline: Point[], at: YarnPoint, depth: number) => appendOrnamentMesh(mesh, makeCognacPlate(outline, depth), matrix(at, [1, 1, 1]));
  const bead = (mesh: FabricMesh, at: YarnPoint, size: YarnPoint) => appendOrnamentMesh(mesh, makeEllipsoid(1, 1, 1, 10, 14), matrix(at, size));
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS.satchel, surface = closedFlapSurface("satchel", false);
  for (let lane = 0; lane < 3; lane++) appendLeatherStrand(part("leather", "handle"), Array.from({ length: 145 }, (_, i) => cognacHandlePoint(i / 144, lane)));
  for (const side of [-1, 1]) {
    const endpoint = cognacHandlePoint(side < 0 ? 0 : 1);
    const mount: YarnPoint = [side * .60, spec.topY + .025, endpoint[2] - .035];
    solid(part("leather", "handle"), roundedRectangle(.063, .20, .020), mount, .012);
    appendOrnamentMesh(part("metal", "handle"), makeArchTube(.054, .066, 0, .009, 40, 10, true), matrix([endpoint[0], endpoint[1] + .065, endpoint[2]], [1, 1, 1]));
    appendOrnamentMesh(part("metal", "handle"), makeLobsterClaspMesh(), matrix([endpoint[0], endpoint[1] + .12, endpoint[2] - .012], [.78, .78, .78], [0, 0, side * -.20]));
    bead(part("metal", "handle"), [mount[0], spec.topY - .033, mount[2] + .012], [.009, .009, .005]);
  }
  // Edge paint and real interrupted saddle stitches follow the fitted flap.
  const cx = 0, cy = surface.centerY;
  const edge = surface.contour.map(([x,y,z]): YarnPoint => [x, y, z + .001]);
  tube(part("edge", "flap"), [...edge, edge[0]], .0030, true);
  const inset = surface.contour.map(([x,y]): YarnPoint => {
    const px = cx + (x - cx) * .975, py = cy + (y - cy) * .95;
    return [px, py, (surface.sample(px, py)?.z ?? .4) + .0025];
  });
  for (let i = 0; i < inset.length; i++) {
    const a = inset[i], b = inset[(i + 1) % inset.length], distance = Math.hypot(...b.map((n,j) => n - a[j]));
    const count = Math.max(1, Math.ceil(distance / .022));
    for (let j = 0; j < count; j++) tube(part("seam", "flap"), [j / count, (j + .55) / count].map(t => a.map((n,k) => n + (b[k] - n) * t) as YarnPoint), .0014);
  }
  const lockY = spec.lockY ?? .02, radius = spec.rx * 5 / 160;
  const lockZ = crochetPanelPoint("satchel", 0, lockY - spec.bodyY)[2] + radius * 1.75 + .034;
  const tongue = makeCognacPlate(roundedRectangle(.30, .34, .12), .018);
  appendOrnamentMesh(part("leather", "flap"), tongue, matrix([0, lockY + .025, lockZ - .012], [1, 1, 1]));
  const tongueSeam = roundedRectangle(.258, .296, .10).map(([x,y]): YarnPoint => [x, y + lockY + .025, lockZ + .008]);
  for (let i = 0; i < tongueSeam.length; i += 2) tube(part("seam", "flap"), [tongueSeam[i], tongueSeam[(i + 1) % tongueSeam.length]], .0013);
  solid(part("recess", "flap"), roundedRectangle(.185, .225, .075), [0, lockY + .012, lockZ + .020], .012);
  const lockRim = roundedRectangle(.171, .207, .065).map(([x,y]): YarnPoint => [x, y + lockY + .012, lockZ + .035]);
  tube(part("metal", "flap"), [...lockRim, lockRim[0]], .010, true);
  solid(part("metal", "flap"), roundedRectangle(.112, .139, .042), [0, lockY + .006, lockZ + .045], .014);
  solid(part("metal", "flap"), roundedRectangle(.223, .057, .025), [0, lockY + .133, lockZ + .048], .019);
  const badgeY = spec.bodyY - .57;
  const badgeZ = crochetPanelPoint("satchel", 0, badgeY - spec.bodyY)[2] + radius * 1.75 + .012;
  solid(part("metal", "badge"), roundedRectangle(.32, .085, .034), [0, badgeY, badgeZ], .009);
  for (const side of [-1,1]) bead(part("metal", "badge"), [side * .136, badgeY, badgeZ + .010], [.009, .009, .004]);
  const glyphs: Record<string, Point[][]> = {
    A: [[[0,0],[1.5,5],[3,0]],[[.6,2],[2.4,2]]], B: [[[0,0],[0,5],[2,5],[3,4],[2,2.5],[0,2.5]],[[2,2.5],[3,1],[2,0],[0,0]]],
    G: [[[3,4.4],[2,5],[.5,5],[0,4],[0,1],[.5,0],[2.5,0],[3,1],[3,2.2],[1.8,2.2]]], S: [[[3,4.5],[2.5,5],[.5,5],[0,4],[.5,3],[2.5,2],[3,1],[2.5,0],[.5,0],[0,.5]]],
    H: [[[0,0],[0,5]],[[3,0],[3,5]],[[0,2.5],[3,2.5]]], N: [[[0,0],[0,5],[3,0],[3,5]]], D: [[[0,0],[0,5],[2,5],[3,4],[3,1],[2,0],[0,0]]],
    M: [[[0,0],[0,5],[1.5,2.5],[3,5],[3,0]]], E: [[[3,0],[0,0],[0,5],[3,5]],[[0,2.5],[2.5,2.5]]], "-": [[[.3,2.5],[2.7,2.5]]],
  };
  for (const [label, scale, offset] of [["A-BAGS", .0085, .007], ["HANDMADE", .0055, -.029]] as const) {
    const width = (label.length * 4 - 1) * scale;
    [...label].forEach((letter, index) => {
      for (const stroke of glyphs[letter] ?? []) tube(part("engraving", "badge"), stroke.map(([x,y]): YarnPoint => [-width / 2 + index * 4 * scale + x * scale, badgeY + offset + y * scale, badgeZ + .010]), .0008);
    });
  }
  return parts;
}

function ensureCognacConstruction(renderer: Renderer) {
  if (renderer.cognacParts) return;
  renderer.meshes.satchel = createMesh(renderer.gl, makeVariableDepthBody("satchel"));
  renderer.meshes.satchelInterior = createMesh(renderer.gl, makeOpeningInterior("satchel"));
  renderer.meshes.satchelLiningSeam = createMesh(renderer.gl, makeOpeningLiningSeam("satchel"));
  renderer.meshes.satchelChain = createMesh(renderer.gl, familyShoulderChainMesh("satchel"));
  renderer.cognacParts = makeCognacConstruction();
  for (const part of renderer.cognacParts) renderer.meshes[part.name] = createMesh(renderer.gl, part.mesh);
}

function makeReferenceWoodHandle(shape: WoodHandleShape = "round"): FabricMesh {
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  const w = .055, h = .026, r = .007, q = Math.SQRT1_2;
  const section = [[w-r,-h,0,-1],[w-r+r*q,-h+r-r*q,q,-q],[w,-h+r,1,0],
    [w,h-r,1,0],[w-r+r*q,h-r+r*q,q,q],[w-r,h,0,1],[-w+r,h,0,1],
    [-w+r-r*q,h-r+r*q,-q,q],[-w,h-r,-1,0],[-w,-h+r,-1,0],
    [-w+r-r*q,-h+r-r*q,-q,-q],[-w+r,-h,0,-1]];
  const rows = shape === "flat-base" ? 160 : 96;
  for (let row = 0; row <= rows; row++) {
    const { center, outward: radial } = referenceWoodHandleFrame(row / rows * Math.PI * 2, shape);
    for (let col = 0; col <= 12; col++) {
      const [u,z,nx,nz] = section[col % 12];
      const x = center[0]+radial[0]*u, y = center[1]+radial[1]*u;
      mesh.positions.push(x,y,z);
      mesh.normals.push(...normalize(radial[0]*nx,radial[1]*nx,nz));
      // Cut wood has grain across its broad face, rather than following the
      // angular index of the ring or stretching around its cross section.
      mesh.uvs.push(.5+x/1.1,.5+y);
      if(row<rows&&col<12){const i=row*13+col,j=i+13;mesh.indices.push(i,j,i+1,j,j+1,i+1);}
    }
  }
  return mesh;
}

function ensureReferenceWoodHandle(renderer: Renderer, shape: WoodHandleShape) {
  if (renderer.referenceWoodHandleShape === shape) return;
  const previous = renderer.meshes.referenceWoodHandle;
  if (previous) for (const buffer of [previous.position, previous.normal, previous.uv, previous.index]) renderer.gl.deleteBuffer(buffer);
  renderer.meshes.referenceWoodHandle = createMesh(renderer.gl, makeReferenceWoodHandle(shape));
  renderer.referenceWoodHandleShape = shape;
}

// Smooth title-case lettering follows the small engraved plaques in the
// supplied photographs. These are local vector strokes, with no font download.
function handmadeBadgeLettering(): Point[][] {
  const glyphs: Record<string, { advance: number; strokes: Point[][] }> = {
    H: { advance: 4.5, strokes: [
      [[-.2,4.4],[.2,5.1],[1,5.4],[1.2,4.8],[.4,.2],[0,-.1]],
      [[4.4,5.3],[3.6,4.6],[2.8,2.4],[2.2,.2],[2.6,0],[3.5,.6]],
      [[.6,2.4],[1.5,2.8],[2.6,2.9],[3.5,3.2]],
    ] },
    a: { advance: 3.2, strokes: [
      [[2.4,2.4],[1.7,2.8],[.7,2.4],[.2,1.3],[.4,.3],[1.1,.1],[2.1,1.1],[2.7,2.8],[2.2,.5],[2.6,.1],[3.3,.7]],
    ] },
    n: { advance: 3.3, strokes: [
      [[0,.1],[.8,2.8],[.4,.9],[1.6,2.7],[2.4,2.6],[2.3,1.5],[1.9,.3],[2.3,.1],[3.4,.8]],
    ] },
    d: { advance: 3.4, strokes: [
      [[2.3,2.4],[1.5,2.8],[.6,2.3],[.2,1.2],[.5,.2],[1.2,.1],[2.3,1.4],[3.5,4.5],[3.5,5.4],[2.9,4.9],[2.1,1.3],[2.1,.3],[2.6,.1],[3.5,.8]],
    ] },
    m: { advance: 4.8, strokes: [
      [[0,.1],[.8,2.8],[.4,.8],[1.5,2.6],[2.2,2.7],[2.4,2.2],[1.8,.2],[2.9,2.5],[3.7,2.7],[4,2.2],[3.5,.4],[3.9,.1],[4.9,.8]],
    ] },
    e: { advance: 3.1, strokes: [
      [[0,1.2],[1.6,1.7],[2.3,2.4],[1.8,2.8],[.8,2.4],[.3,1.5],[.5,.5],[1.2,.1],[2.2,.3],[3.2,1.1]],
    ] },
  };
  const paths: Point[][] = [];
  let cursor = 0;
  for (const letter of "Handmade") {
    const glyph = glyphs[letter];
    for (const stroke of glyph.strokes) {
      const points: Point[] = [];
      for (let i = 0; i < stroke.length - 1; i++) {
        const a = stroke[Math.max(0,i-1)], b = stroke[i], c = stroke[i+1], d = stroke[Math.min(stroke.length-1,i+2)];
        for (let sample = 0; sample < 8; sample++) {
          const t = sample / 8;
          const at = (axis: number) => .5*(2*b[axis]+(-a[axis]+c[axis])*t+(2*a[axis]-5*b[axis]+4*c[axis]-d[axis])*t*t+(-a[axis]+3*b[axis]-3*c[axis]+d[axis])*t*t*t);
          points.push([cursor+at(0),at(1)]);
        }
      }
      points.push([cursor+stroke[stroke.length-1][0],stroke[stroke.length-1][1]]);
      paths.push(points);
    }
    cursor += glyph.advance;
  }
  const xs = paths.flat().map(p=>p[0]), ys = paths.flat().map(p=>p[1]);
  const left = Math.min(...xs), right = Math.max(...xs), bottom = Math.min(...ys), top = Math.max(...ys);
  const scale = .224 / (right-left);
  return paths.map(stroke=>stroke.map(([x,y]): Point => [(x-(left+right)/2)*scale,(y-(bottom+top)/2)*scale]));
}

function handmadeBadgeOutline(width: number, height: number): Point[] {
  const radius = height/2, halfStraight = (width-height)/2, points: Point[] = [];
  // Two semicircles joined by straight top/bottom edges. An exactly maximal
  // corner radius in roundedRectangle would duplicate eight side vertices.
  for (const side of [-1,1]) for (let i=0;i<=24;i++) {
    const angle = (side<0 ? Math.PI/2 : -Math.PI/2)+i/24*Math.PI;
    points.push([side*halfStraight+radius*Math.cos(angle),radius*Math.sin(angle)]);
  }
  return points;
}

function makeHandmadeBadge() {
  const metal: FabricMesh = {positions:[],normals:[],uvs:[],indices:[]};
  const engraving: FabricMesh = {positions:[],normals:[],uvs:[],indices:[]};
  const outline = handmadeBadgeOutline(.32,.088);
  appendOrnamentMesh(metal,makeCognacPlate(outline,.009),identity());
  const tube = (target: FabricMesh, points: YarnPoint[], radius: number, closed = false) =>
    appendCord(target,points,radius,()=>[0,0,1],()=>true,8,closed);
  const rim = handmadeBadgeOutline(.307,.075).map(([x,y]): YarnPoint => [x,y,.0064]);
  rim.push(rim[0]);
  tube(metal,rim,.0018,true);
  for (const side of [-1,1]) {
    const x = side*.138;
    appendOrnamentMesh(metal,makeEllipsoid(1,1,1,8,12),matrix([x,0,.0065],[.0075,.0075,.003]));
    // The two shallow screw slots sit below the rim, above the nearly flat face.
    tube(engraving,[[x-.0038,-.002,.0092],[x+.0038,.002,.0092]],.00065);
  }
  for (const path of handmadeBadgeLettering())
    tube(engraving,path.map(([x,y]): YarnPoint => [x,y,.0065]),.00075);
  return {metal,engraving};
}

function makeReferenceConstruction(config: Config) {
  const family = config.family as "tall-tote" | "shoulder", spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const model = getAbagsReferenceModel(config);
  const empty = (): FabricMesh => ({positions:[],normals:[],uvs:[],indices:[]});
  const metal = empty(), engraving = empty(), zipper = empty(), fabric = empty(), cord = empty();
  const plate = (target: FabricMesh, width: number, height: number, at: YarnPoint, depth = .008, rotation: YarnPoint = [0,0,0]) =>
    appendOrnamentMesh(target,makeCognacPlate(roundedRectangle(width,height,Math.min(height*.4,.032)),depth),matrix(at,[1,1,1],rotation));
  const tube = (target: FabricMesh, points: YarnPoint[], radius: number) => appendCord(target,points,radius,()=>[0,0,1],()=>true,8);
  const badgeX = family === "shoulder" ? spec.rx*.48 : 0;
  const suppliedOriginal = model?.id === "chocolate-crossbody-bow" || model?.id === "forest-ocean-wood-bow";
  const badgeY = model?.fabric === 5 ? spec.bodyY+spec.ry*.72 : spec.bodyY-spec.ry*(suppliedOriginal ? .56 : .73);
  const badgeZ = ornamentSurfaceZ({...config,flap:"none"},badgeX,badgeY,.015);
  const badge = makeHandmadeBadge(), badgePose = matrix([badgeX,badgeY,badgeZ],[1,1,1]);
  appendOrnamentMesh(metal,badge.metal,badgePose);
  appendOrnamentMesh(engraving,badge.engraving,badgePose);
  if(family === "shoulder"){
    const top = Math.max(...openingPath(family).map(p=>p[1]))+.008;
    plate(fabric,spec.rx*1.78,depthAt(family,spec.ry)*.94,[0,top-.006,0],.009,[-Math.PI/2,0,0]);
    const rows=12,halfDepth=depthAt(family,spec.ry)*.43;
    for(let row=0;row<=rows;row++){
      const z=-halfDepth+2*halfDepth*row/rows;if(Math.abs(z)<.047)continue;
      tube(cord,Array.from({length:49},(_,i):YarnPoint=>[-spec.rx*.88+spec.rx*1.76*i/48,top+.002+.006*Math.sin(i*Math.PI/3),z]),spec.rx*5/160*.50);
    }
    plate(zipper,spec.rx*1.76,.075,[0,top+.011,0],.009,[-Math.PI/2,0,0]);
    for(let i=0;i<64;i++){
      const x=-spec.rx*.85+i/63*spec.rx*1.70;
      for(const side of [-1,1])appendOrnamentMesh(metal,makeEllipsoid(1,1,1,6,8),matrix([x+(side<0?.009:0),top+.008,side*.016],[.010,.006,.018]));
    }
    plate(metal,.10,.061,[-spec.rx*.78,top+.014,0],.011,[-Math.PI/2,0,.08]);
    appendOrnamentMesh(metal,makeArchTube(.025,.070,0,.006,28,8,true),matrix([-spec.rx*.84,top+.052,.012],[1,1,1],[-.8,0,.65]));
  }
  return [
    {name:"reference-metal",tone:"metal" as const,mesh:metal},
    {name:"reference-engraving",tone:"engraving" as const,mesh:engraving},
    ...(zipper.indices.length?[
      {name:"reference-zipper",tone:"zipper" as const,mesh:zipper},
      {name:"reference-fabric",tone:"fabric" as const,mesh:fabric},
      {name:"reference-cord",tone:"cord" as const,mesh:cord},
    ]:[]),
  ];
}

function ensureReferenceConstruction(renderer: Renderer, config: Config) {
  const family = config.family;
  const active = family === "tall-tote" || family === "shoulder";
  const reference = getAbagsReferenceModel(config);
  const key = active ? family+":"+(reference?.id??"custom") : "none";
  if(renderer.referenceKey===key)return;
  for(const part of renderer.referenceParts??[]){
    const mesh=renderer.meshes[part.name];
    for(const buffer of [mesh.position,mesh.normal,mesh.uv,mesh.index])renderer.gl.deleteBuffer(buffer);
    delete renderer.meshes[part.name];
  }
  renderer.referenceParts=[];renderer.referenceTriangles=0;renderer.referenceKey=key;
  if(!active)return;
  if(!renderer.meshes[family]){
    renderer.meshes[family]=createMesh(renderer.gl,makeVariableDepthBody(family));
    renderer.meshes[family+"Interior"]=createMesh(renderer.gl,makeOpeningInterior(family));
    renderer.meshes[family+"LiningSeam"]=createMesh(renderer.gl,makeOpeningLiningSeam(family));
    renderer.meshes[family+"Chain"]=createMesh(renderer.gl,familyShoulderChainMesh(family));
  }
  renderer.referenceParts=makeReferenceConstruction(config).map(({name,tone,mesh})=>{
    renderer.meshes[name]=createMesh(renderer.gl,mesh);
    renderer.referenceTriangles=(renderer.referenceTriangles??0)+mesh.indices.length/3;
    return {name,tone};
  });
}

type BandTone = "surface" | "edge" | "stitch" | "metal";
type BandKind = "woven" | "leather" | "ornament" | "crochet" | "floral" | "striped" | "chain-leather";

function crochetShoulderStrapPoint(family: Exclude<Family, "">, t: number): YarnPoint {
  const spec=ABAGS_FIDELITY_V4_FAMILY_SPECS[family],span=spec.rx*spec.attachmentWidthFactor;
  const points:YarnPoint[]=[[-span,0,0],[-span-.13,-.35,.18],[-span*1.10,-1.40,.43],
    [-span*.55,-1.78,.69],[span*.45,-1.72,.72],[span*1.12,-1.36,.48],[span+.10,-.40,.18],[span,0,0]];
  const u=clamp(t,0,1)*(points.length-1),i=Math.min(points.length-2,Math.floor(u)),f=u-i;
  const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
  return b.map((n,k)=>.5*(2*n+(-a[k]+c[k])*f+(2*a[k]-5*n+4*c[k]-d[k])*f*f+(-a[k]+3*n-3*c[k]+d[k])*f*f*f)*(k===1?.70:1)) as YarnPoint;
}

function ornamentStrapPoint(family: Exclude<Family, "">, t: number): YarnPoint {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family], span = spec.rx * spec.attachmentWidthFactor;
  const back = -PROFILES[family].baseDepth - .10;
  const points: YarnPoint[] = [[-span,0,0],[-span-.16,.02,-.35],[-span*.50,.06,back],[span*.55,.05,back],
    [span+.30,-.10,-.18],[span+.38,-1.27,-.08],[span+.26,-1.46,.08],[span+.15,-1.27,.24],[span,0,0]];
  const u = clamp(t,0,1) * (points.length - 1), i = Math.min(points.length - 2, Math.floor(u)), f = u - i;
  const a = points[Math.max(0,i-1)], b = points[i], c = points[i+1], d = points[Math.min(points.length-1,i+2)];
  return b.map((n,k) => .5 * (2*n + (-a[k]+c[k])*f + (2*a[k]-5*n+4*c[k]-d[k])*f*f + (-a[k]+3*n-3*c[k]+d[k])*f*f*f) * (family === "tall-tote" && k === 1 ? 1.12 : 1)) as YarnPoint;
}

function shoulderBandFrame(family: Exclude<Family, "">, progress: number, kind: BandKind = "woven") {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const span = spec.rx * spec.attachmentWidthFactor;
  const rise = clamp(spec.ry * 0.48, 0.28, 0.44);
  const a = Math.PI * progress, bow = Math.min(.13, spec.depth * .28);
  const hanging = kind !== "woven" && kind !== "leather";
  const at = (t: number) => kind === "crochet" ? crochetShoulderStrapPoint(family,t) : ornamentStrapPoint(family,t);
  const center: YarnPoint = hanging ? at(progress) : [-span * Math.cos(a), rise * Math.sin(a), -bow * Math.sin(a)];
  let tangent = normalize(span * Math.sin(a), rise * Math.cos(a), -bow * Math.cos(a));
  if (hanging) {
    const before = at(Math.max(0, progress - .001)), after = at(Math.min(1, progress + .001));
    tangent = normalize(...after.map((n,i) => n - before[i]) as YarnPoint);
  }
  const across = normalize(-tangent[1], tangent[0], 0);
  const face = normalize(tangent[1] * across[2] - tangent[2] * across[1], tangent[2] * across[0] - tangent[0] * across[2], tangent[0] * across[1] - tangent[1] * across[0]);
  const twist = .12 * Math.sin(a * 2), c = Math.cos(twist), s = Math.sin(twist);
  const widthAxis = across.map((n, axis) => n * c + face[axis] * s) as YarnPoint;
  const normal = face.map((n, axis) => n * c - across[axis] * s) as YarnPoint;
  const halfWidth = (kind === "leather" || kind === "chain-leather" ? .050 : hanging ? .095 : .062) * (.67 + .33 * Math.sin(a));
  const halfThickness = kind === "leather" ? .009 : .006;
  return { center, tangent, widthAxis, normal, halfWidth, halfThickness };
}

function familyShoulderStrapMesh(family: Exclude<Family, "">, kind: BandKind = "woven", from = 0, to = 1): FabricMesh {
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  // A rounded rectangular section gives the band two broad faces and a thin
  // finished edge. It tapers into the same calibrated clasp at both ends.
  let distance = 0;
  let previous: YarnPoint | undefined;
  for (let row = 0; row <= 84; row++) {
    const f = shoulderBandFrame(family, from+(to-from)*row / 84, kind), w = f.halfWidth, h = f.halfThickness, r = h * .65, q = Math.SQRT1_2;
    if (previous) distance += Math.hypot(...f.center.map((n,i) => n - previous![i]));
    previous = f.center;
    const uProgress = kind !== "woven" && kind !== "leather" ? distance / .32 : row / 84;
    const section = [[w-r,-h,0,-1],[w-r+r*q,-h+r-r*q,q,-q],[w,-h+r,1,0],[w,h-r,1,0],[w-r+r*q,h-r+r*q,q,q],[w-r,h,0,1],[-w+r,h,0,1],[-w+r-r*q,h-r+r*q,-q,q],[-w,h-r,-1,0],[-w,-h+r,-1,0],[-w+r-r*q,-h+r-r*q,-q,-q],[-w+r,-h,0,-1]];
    for (let column = 0; column <= 12; column++) {
      const [u, z, nx, nz] = section[column % 12];
      mesh.positions.push(...f.center.map((n, axis) => n + f.widthAxis[axis] * u + f.normal[axis] * z));
      mesh.normals.push(...normalize(...f.widthAxis.map((n, axis) => n * nx + f.normal[axis] * nz) as YarnPoint));
      mesh.uvs.push(uProgress, (u / w + 1) * .5);
      if (row < 84 && column < 12) {
        const a = row * 13 + column, b = a + 13;
        mesh.indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  // End caps share the face positions with separate normals, closing the
  // physical cross section without rounding the band into a rope again.
  for (const row of [0, 84]) {
    const f = shoulderBandFrame(family, from+(to-from)*row / 84, kind), start = mesh.positions.length / 3;
    mesh.positions.push(...f.center); mesh.normals.push(...f.tangent.map(n => n * (row ? 1 : -1))); mesh.uvs.push(row / 84, .5);
    for (let j = 0; j < 12; j++) {
      mesh.positions.push(...mesh.positions.slice((row * 13 + j) * 3, (row * 13 + j + 1) * 3));
      mesh.normals.push(...f.tangent.map(n => n * (row ? 1 : -1))); mesh.uvs.push(row / 84, j / 12);
      const a = start + 1 + j, b = start + 1 + (j + 1) % 12;
      mesh.indices.push(...(row ? [start, a, b] : [start, b, a]));
    }
  }
  return mesh;
}

function makeStrapAdjuster(family: Exclude<Family, "">, kind: BandKind): FabricMesh {
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  const frame = shoulderBandFrame(family, .90, kind);
  const at = (x: number, y: number, z: number): YarnPoint => frame.center.map((n, axis) =>
    n + frame.widthAxis[axis] * x + frame.tangent[axis] * y + frame.normal[axis] * z) as YarnPoint;
  const width = frame.halfWidth * 2 + .032;
  const outline = roundedRectangle(width, .128, .020);
  const path = outline.map(([x,y]) => at(x,y,frame.halfThickness+.012));
  path.push(path[0]);
  appendCord(mesh, path, .007, () => frame.normal, () => true, 10);
  // A separate middle bar divides the two open slots. The webbing and its
  // stitching remain visible through them, including in a true side view.
  appendCord(mesh, Array.from({length:13},(_,i)=>at(-width/2+width*i/12,0,frame.halfThickness+.017)),
    .0065, () => frame.normal, () => true, 10);
  return mesh;
}

function makeShoulderBandGeometry(family: Exclude<Family, "">, kind: BandKind) {
  const empty = (): FabricMesh => ({ positions: [], normals: [], uvs: [], indices: [] });
  type Part = {name:string;tone:BandTone;material:number;mesh:FabricMesh};
  const finish = (parts: Part[]) => {
    const min:YarnPoint=[Infinity,Infinity,Infinity],max:YarnPoint=[-Infinity,-Infinity,-Infinity],pose=shoulderStrapMatrix(family);
    for(const {mesh} of parts)for(let i=0;i<mesh.positions.length;i++){
      const axis=i%3,value=mesh.positions[i]+pose[12+axis];min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);
    }
    return {parts,bounds:{min,max}};
  };
  if(kind === "crochet"){
    const mesh=empty(),radius=ABAGS_FIDELITY_V4_FAMILY_SPECS[family].rx*5/160*.84;
    for(let lane=0;lane<3;lane++){
      const points=Array.from({length:321},(_,i):YarnPoint=>{
        const t=i/320,f=shoulderBandFrame(family,t,"crochet"),a=t*Math.PI*34+lane*Math.PI*2/3;
        const width=.078*Math.sin(a)*(.40+.60*Math.sin(Math.PI*t)),depth=.022*Math.sin(2*a);
        return f.center.map((n,j)=>n+f.widthAxis[j]*width+f.normal[j]*depth) as YarnPoint;
      });
      appendCord(mesh,points,radius,()=>[0,0,1],()=>true,8);
    }
    return finish([{name:"shoulderBandSurface",tone:"surface",material:7.1,mesh}]);
  }
  if(kind === "chain-leather"){
    const chain=empty(),samples=Array.from({length:401},(_,i)=>shoulderBandFrame(family,i/400,kind));
    const arc=[0];for(let i=1;i<samples.length;i++)arc.push(arc[i-1]+Math.hypot(...samples[i].center.map((n,j)=>n-samples[i-1].center[j])));
    const link=makeArchTube(.023,.039,0,.006,24,8,true);
    let cursor=0,index=0;
    for(let distance=0;distance<arc[400];distance+=.060,index++){
      while(cursor<399&&arc[cursor+1]<distance)cursor++;
      const t=(cursor+(distance-arc[cursor])/Math.max(.0001,arc[cursor+1]-arc[cursor]))/400;
      if(t>.28&&t<.65)continue;
      const f=shoulderBandFrame(family,t,kind);
      const pose=new Float32Array([...f.widthAxis,0,...f.tangent,0,...f.normal,0,...f.center,1]);
      appendOrnamentMesh(chain,link,multiply(pose,rotY(index%2?Math.PI/2:0)));
    }
    // Domed rivets finish both leather-to-chain joins on both leather faces.
    for (const t of [.30, .63]) for (const side of [-1, 1]) {
      const f = shoulderBandFrame(family, t, kind);
      const pose = new Float32Array([...f.widthAxis,0,...f.tangent,0,...f.normal,0,...f.center,1]);
      appendOrnamentMesh(chain, makeEllipsoid(1,1,1,8,12),
        multiply(pose,matrix([0,0,side*(f.halfThickness+.003)],[.013,.013,.0045])));
    }
    return finish([
      {name:"shoulderBandSurface",tone:"surface",material:2,mesh:familyShoulderStrapMesh(family,kind,.28,.65)},
      {name:"shoulderBandMetal",tone:"metal",material:4.25,mesh:chain},
    ]);
  }
  const edge = empty(), seam = empty();
  const point = (t: number, side: number, face: number, inset: number, lift = 0): YarnPoint => {
    const f = shoulderBandFrame(family, t, kind);
    return f.center.map((n, axis) => n + f.widthAxis[axis] * side * (f.halfWidth - inset) + f.normal[axis] * face * (f.halfThickness + lift)) as YarnPoint;
  };
  for (const side of [-1, 1]) {
    const path = Array.from({ length: 85 }, (_, i) => point(.012 + .976 * i / 84, side, 0, 0));
    appendCord(edge, path, kind === "leather" ? .0020 : .0026, () => [0, 0, 1], () => true, 8);
    for (const face of [-1, 1]) for (let i = 0; i < 96; i++) {
      const t = .020 + i * .010, end = t + .0058;
      const path = [point(t, side, face, .009, .0006), point((t + end) / 2, side, face, .009, .0014), point(end, side, face, .009, .0006)];
      appendCord(seam, path, kind === "leather" ? .0014 : .0016, () => [0, 0, 1], () => true, 8);
    }
  }
  const parts: Array<{ name: string; tone: BandTone; material: number; mesh: FabricMesh }> = [
    { name: "shoulderBandSurface", tone: "surface", material: kind === "leather" ? 2 : kind === "ornament" || kind === "floral" || kind === "striped" ? 12 : 10, mesh: familyShoulderStrapMesh(family, kind) },
    { name: "shoulderBandEdge", tone: "edge", material: kind === "leather" ? 2 : 3, mesh: edge },
    { name: "shoulderBandStitch", tone: "stitch", material: 3, mesh: seam },
  ];
  if (kind !== "leather") parts.push({ name: "shoulderBandAdjuster", tone: "metal", material: 4.25,
    mesh: makeStrapAdjuster(family, kind) });
  const min: YarnPoint = [Infinity, Infinity, Infinity], max: YarnPoint = [-Infinity, -Infinity, -Infinity], pose = shoulderStrapMatrix(family);
  for (const { mesh } of parts) for (let i = 0; i < mesh.positions.length; i++) {
    const axis = i % 3, value = mesh.positions[i] + pose[12 + axis];
    min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
  }
  return { parts, bounds: { min, max } };
}

function ensureShoulderBandMeshes(renderer: Renderer, config: Config) {
  const kind = config.strap === "crochet-braid" ? "crochet" : config.strap === "woven-floral" ? "floral" : config.strap === "woven-striped" ? "striped" : config.strap === "chain-leather" ? "chain-leather" : config.strap === "woven-ornament" ? "ornament" : config.strap === "woven" || config.strap === "leather" ? config.strap : null;
  const key = kind && config.family ? config.family + "|" + kind : "none";
  if (renderer.shoulderBandKey === key) return;
  for (const part of renderer.shoulderBandParts ?? []) {
    const mesh = renderer.meshes[part.name];
    for (const buffer of [mesh.position, mesh.normal, mesh.uv, mesh.index]) renderer.gl.deleteBuffer(buffer);
    delete renderer.meshes[part.name];
  }
  const data = kind && config.family ? makeShoulderBandGeometry(config.family, kind) : undefined;
  renderer.shoulderBandParts = data?.parts.map(({ name, tone, material, mesh }) => {
    renderer.meshes[name] = createMesh(renderer.gl, mesh);
    return { name, tone, material };
  }) ?? [];
  renderer.shoulderBandBounds = data?.bounds;
  renderer.shoulderBandTriangles = data?.parts.reduce((sum, p) => sum + p.mesh.indices.length / 3, 0) ?? 0;
  renderer.shoulderBandKey = key;
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

function projectBagPoint(p: YarnPoint, root: Float32Array, width: number, height: number) {
  const f=1/Math.tan(Math.PI/10.6),aspect=width/height;
  const world=[0,1,2].map(i=>root[i]*p[0]+root[4+i]*p[1]+root[8+i]*p[2]+root[12+i]);
  const distance=5-world[2];
  return {x:(.5+world[0]*f/(aspect*distance)*.5)*width,y:(.5-(world[1]-.02)*f/distance*.5)*height};
}

function referenceYarnProbePoints(family: Exclude<Family, "">, root: Float32Array, width: number, height: number, vertical = false, row = -.45) {
  const spec=ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  return [.12,.38,.64,.90].map(level=>{
    const p=crochetPanelPoint(family,vertical ? spec.rx*(level*2-1) : spec.rx*.34, spec.ry*(vertical ? row : level*2-1));
    p[1]+=spec.bodyY;
    return {level,...projectBagPoint(p,root,width,height)};
  });
}

function yarnGradientFrame(family: Exclude<Family, "">, root: Float32Array, verticalBands: boolean) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family], column = verticalBands ? 0 : 4;
  const length2 = root[column] ** 2 + root[column+1] ** 2 + root[column+2] ** 2;
  return {
    axis: new Float32Array([root[column], root[column+1], root[column+2]].map(n => n / Math.max(.001, length2))),
    min: verticalBands ? -spec.rx : spec.bodyY - spec.ry,
    max: verticalBands ? spec.rx : spec.bodyY + spec.ry,
  };
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
  stage.dataset.abagsCrochetOwner = canvas.dataset.abagsCrochetOwner || "";
  stage.dataset.abagsFidelityAccessoryAnchor = canvas.dataset.abagsFidelityAccessoryAnchor || "";
  stage.dataset.abagsFidelityAccessorySignature = canvas.dataset.abagsFidelityAccessorySignature || "";
  stage.dataset.abagsFidelityOrnamentOwner = canvas.dataset.abagsFidelityOrnamentOwner || "";
  stage.dataset.abagsFidelityOrnamentBounds = canvas.dataset.abagsFidelityOrnamentBounds || "";
  stage.dataset.abagsFidelityOrnamentTriangles = canvas.dataset.abagsFidelityOrnamentTriangles || "0";
  stage.dataset.abagsFidelityOrnamentConstruction = canvas.dataset.abagsFidelityOrnamentConstruction || "";
  stage.dataset.abagsFidelityCognac = canvas.dataset.abagsFidelityCognac || "";
  stage.dataset.abagsFidelityReferenceModel = canvas.dataset.abagsFidelityReferenceModel || "";
  stage.dataset.abagsFidelityTextilePrint = canvas.dataset.abagsFidelityTextilePrint || "";
  stage.dataset.abagsFidelityStrapOwner = canvas.dataset.abagsFidelityStrapOwner || "";
  stage.dataset.abagsFidelityStrapBounds = canvas.dataset.abagsFidelityStrapBounds || "";
  stage.dataset.abagsFidelityStrapTriangles = canvas.dataset.abagsFidelityStrapTriangles || "0";
  stage.dataset.abagsFidelityInterior = canvas.dataset.abagsFidelityInterior || "";
  stage.dataset.abagsFidelityRimTriangles = canvas.dataset.abagsFidelityRimTriangles || "0";
  stage.dataset.abagsFidelityGrounding = canvas.dataset.abagsFidelityGrounding || "";
  const ground = JSON.parse(canvas.dataset.abagsFidelityGrounding || "null");
  if (ground) {
    for (const [name, key] of [["x", "x"], ["y", "y"], ["width", "width"], ["height", "height"], ["core-width", "coreWidth"], ["core-height", "coreHeight"]]) {
      stage.style.setProperty("--abags-ground-" + name, (ground[key] * 100).toFixed(4) + "%");
    }
    stage.style.setProperty("--abags-ground-blur", ground.blur.toFixed(3) + "px");
    stage.style.setProperty("--abags-ground-visible", String(ground.visible));
  }
  stage.dataset.abagsFidelity3dFrameAt = canvas.dataset.abagsFidelity3dFrameAt || String(Date.now());
  stage.removeAttribute("data-abags-fidelity3d-error");
}

function publishRendererError(stage: HTMLElement, canvas: HTMLCanvasElement, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.slice(0, 160) : fallback;
  canvas.removeAttribute("data-abags-fidelity3d-frame");
  canvas.removeAttribute("data-abags-fidelity3d-frame-at");
  canvas.removeAttribute("data-abags-crochet-owner");
  canvas.dataset.abagsFidelity3dError = message;
  stage.removeAttribute("data-abags-fidelity3d-frame");
  stage.removeAttribute("data-abags-fidelity3d-frame-at");
  stage.removeAttribute("data-abags-crochet-owner");
  stage.dataset.abagsFidelity3dError = message;
  for (const node of [stage, canvas]) {
    node.removeAttribute("data-abags-fidelity-accessory-anchor");
    node.removeAttribute("data-abags-fidelity-accessory-signature");
    node.removeAttribute("data-abags-fidelity-ornament-owner");
    node.removeAttribute("data-abags-fidelity-ornament-bounds");
    node.removeAttribute("data-abags-fidelity-ornament-triangles");
    node.removeAttribute("data-abags-fidelity-ornament-construction");
    node.removeAttribute("data-abags-fidelity-cognac");
    node.removeAttribute("data-abags-fidelity-reference-model");
    node.removeAttribute("data-abags-fidelity-textile-print");
    node.removeAttribute("data-abags-fidelity-strap-owner");
    node.removeAttribute("data-abags-fidelity-strap-bounds");
    node.removeAttribute("data-abags-fidelity-strap-triangles");
    node.removeAttribute("data-abags-fidelity-interior");
    node.removeAttribute("data-abags-fidelity-rim-triangles");
    node.removeAttribute("data-abags-fidelity-grounding");
  }
  stage.style.setProperty("--abags-ground-visible", "0");
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
  // Keep the construction state empty in the controls, but never leave the 3D
  // stage visually empty. Before the customer chooses a family, render a neutral
  // atelier base model; as soon as a family/color/stitch is selected, the same
  // WebGL surface switches to the live configuration.
  const renderFamily: Exclude<Family, ""> = config.family || "tote";
  const profile = config.family ? PROFILES[config.family] : PROFILES.tote;
  const fittedZoom = zoom * (renderFamily === "tall-tote" ? .86 : 1);
  const root = multiply(scale(fittedZoom, fittedZoom, fittedZoom), multiply(rotX(rotation.x), rotY(rotation.y)));
  if (renderFamily === "satchel") ensureCognacConstruction(renderer);
  const yarnPalettes: Record<string, number> = {
    "#C7652F": 1, // miedziany ombré
    "#88583F": 2, // brąz ombré z referencji Agaty
    "#D58FAA": 3, // róż ombré z referencji Agaty
    "#BA9ECF": 4, // pastel wielokolorowy
    "#0E9AA7": 5, // zieleń, turkus i niebieski
  };
  renderer.ombrePalette = yarnPalettes[config.color] ?? 0;
  const palette = getAbagsYarnPalette(config.color, renderFamily);
  const verticalBands = palette?.id === "pastel-mini-columns";
  if (verticalBands) renderer.ombrePalette = 6;
  renderer.ombre = renderer.ombrePalette !== 0;
  // Recover the selected bag-space axis through rotation and zoom. The mini's
  // vertical columns use its width; the other photographed dyes use height.
  const gradient = yarnGradientFrame(renderFamily, root, verticalBands);
  gl.uniform3fv(uniforms.yarnGradientAxis, gradient.axis);
  gl.uniform2f(uniforms.yarnGradientRange, gradient.min, gradient.max);
  const reference = getAbagsReferenceModel(config);
  const textiles = renderer.printedTextiles;
  const textileProfile = getAbagsPrintedTextileProfile(config, reference?.fabric);
  requestAbagsPrintedTextiles(textiles, textileProfile, () => renderer.onTextileReady?.());
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textiles.scarf.texture);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textiles.strap.texture);
  gl.uniform1i(uniforms.scarfPrint, 0); gl.uniform1i(uniforms.strapPrint, 1);
  gl.uniform2f(uniforms.textileReady, textiles.scarf.ready ? 1 : 0, textiles.strap.ready ? 1 : 0);
  gl.uniform4f(uniforms.scarfPrintUv, ...(textileProfile.scarf?.uv ?? [1,1,0,0]));
  gl.uniform4f(uniforms.strapPrintUv, ...(textileProfile.strap?.uv ?? [1,1,0,0]));
  const body = palette?.colors[4] ?? (config.color || "#b87880");
  gl.uniform1f(uniforms.fabricStyle, reference?.fabric ?? 0);
  gl.uniform3fv(uniforms.fabricFlower, hex(reference?.fabricFlower ?? "#CC6682"));
  gl.uniform3fv(uniforms.fabricLeaf, hex(reference?.fabricLeaf ?? "#50694D"));
  gl.uniform3fv(uniforms.fabricBorder, hex(reference?.fabricEdge ?? "#475257"));
  renderer.bandPrint = config.strap === "woven-floral" ? 1 : config.strap === "woven-striped" ? 2 : 0;
  gl.uniform1f(uniforms.bandPrint, renderer.bandPrint);
  ensureReferenceConstruction(renderer, config);
  const stitch = stitchId(config.stitch || "classic");
  ensureCrochetMeshes(renderer, renderFamily, config.stitch || "classic");
  const bodyModel = multiply(root, matrix([0, profile.bodyY, 0], [1, 1, 1]));
  // Matte textile in the valleys; the raised surface is actual cylindrical cord.
  drawMesh(renderer, meshes[renderFamily], bodyModel, darken(body, .22), 6, stitch, 0);
  drawMesh(renderer, meshes.yarnFront, bodyModel, body, 7, stitch, 0);
  drawMesh(renderer, meshes.yarnBack, bodyModel, body, 7, stitch, 0);
  drawMesh(renderer, meshes.yarnSide, bodyModel, body, 7, stitch, 0);

  const openingColor = config.color ? body : "#d8cec4";
  const agataOpenWoodTote = renderFamily === "tote" && config.handles.startsWith("wood");
  const interiorColor = agataOpenWoodTote ? "#f0e7d9" : darken(openingColor, .22);
  if (renderer.interiorEvidence?.family !== renderFamily) {
    const layout = openingLiningLayout(renderFamily);
    const backU = Array.from({ length: 96 }, (_, i) => i / 96).filter(u => layout.sample(u)[2] < 0)
      .reduce((best, u) => Math.abs(layout.sample(u)[0]) < Math.abs(layout.sample(best)[0]) ? u : best, .75);
    renderer.interiorEvidence = { family: renderFamily, topY: layout.topY, bottomY: layout.bottomY, probe: liningWallPoint(layout, backU, .10) };
  }
  const interiorLayout = renderer.interiorEvidence;
  gl.uniform2f(uniforms.interiorBounds, interiorLayout.topY, interiorLayout.bottomY);
  // The red and brown wooden-handle versions share one silhouette and geometry.
  // The checked lining is visible when the customer rotates the same model to look inside.
  drawMesh(renderer, meshes[renderFamily + "Interior"], root, interiorColor, agataOpenWoodTote ? 5 : 11, stitch, 0);
  drawMesh(renderer, meshes[renderFamily + "LiningSeam"], root, darken(interiorColor, .24), 3, stitch, 0);
  canvas.dataset.abagsFidelityInterior = JSON.stringify({ ...interiorLayout, finish: agataOpenWoodTote ? "gingham" : "solid",
    triangles: meshes[renderFamily + "Interior"].count / 3, seamTriangles: meshes[renderFamily + "LiningSeam"].count / 3 });
  ensureOpeningRim(renderer, renderFamily);
  drawMesh(renderer, meshes.yarnRim, root, openingColor, 7, stitch, 0);

  ensureShoulderBandMeshes(renderer, config);
  if (config.strap !== "none" && config.strap !== "chain") {
    const surface = config.strap === "crochet-braid" || config.strap === "chain-leather" ? body : config.strap === "woven-floral" ? "#F3E6DD" : config.strap === "woven-striped" ? "#D9CEBA" : config.strap === "woven-ornament" ? "#18140F" : config.strap === "leather" ? "#6b4738" : "#a77d87";
    const bandMetal = config.hardware === "silver" ? "#d7dbe0" : config.hardware === "black" ? "#29272a" : "#caa55d";
    const colors: Record<BandTone, string> = { surface, metal: bandMetal, edge: darken(surface, .28), stitch: config.strap === "leather" ? "#C3A38A" : "#D3B9AD" };
    const pose = multiply(root, shoulderStrapMatrix(renderFamily));
    for (const part of renderer.shoulderBandParts ?? []) drawMesh(renderer, meshes[part.name], pose, colors[part.tone], part.material, stitch, 0);
  } else if (config.strap === "chain") {
    const metal = config.hardware === "silver" ? "#d7dbe0" : config.hardware === "black" ? "#29272a" : "#caa55d";
    const strapColor = metal;
    const material = 4;
    const strapMesh = config.family ? meshes[config.family + "Chain"] : meshes.toteChain;
    drawMesh(
      renderer,
      strapMesh,
      multiply(root, shoulderStrapMatrix(renderFamily)),
      strapColor,
      material,
      stitch,
      0,
    );
  }

  if (config.handles !== "none" && config.handles !== "leather-braid") {
    const handleColor = getAbagsWoodHandleTone(config) ?? body;
    const material = config.handles.startsWith("wood") ? 1 : 0;
    const isWoodHandle = config.handles.startsWith("wood");
    const woodShape = getAbagsWoodHandleShape(config);
    if (isWoodHandle && renderFamily === "tall-tote") ensureReferenceWoodHandle(renderer, woodShape);
    const mesh = isWoodHandle ? (renderFamily === "tall-tote" ? meshes.referenceWoodHandle : meshes.woodHandle) : meshes.crochetHandle;
    const zOffset = profile.topDepth * 0.30;
    // The wooden tote has one ring at the front rim and one at the back rim.
    // They are separated through the bag depth, not arranged left/right across
    // the front face; each ring must rise clearly above the opening.
    if (isWoodHandle) {
      // Both rigid rings attach to the actual front/back seam. The old depth
      // multiplier put the rear ring outside the now-corrected opening.
      const depthPlanes = woodHandleDepthPlanes(renderFamily);
      for (const z of depthPlanes) {
        drawMesh(
          renderer,
          mesh,
          // Real pairs of wooden arches lean slightly towards the centre of
          // the mouth. Their feet stay on the front/back rim while the top
          // of the rear arch falls partly behind the front in a 3/4 view.
          multiply(root, woodHandleMatrix(renderFamily, z)),
          handleColor,
          material,
          stitch,
          0,
        );
      }
      ensureWoodHandleBinding(renderer, renderFamily, woodShape);
      drawMesh(renderer, meshes.woodBinding, root, body, 7, stitch, 0);
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
    const flapColor = getAbagsCrochetFlapTone(config) ?? (config.flap === "leather-black" ? "#242124" : config.flap === "leather-cognac" ? (renderFamily === "satchel" ? "#BC683B" : "#7c5034") : config.flap === "suede-burgundy" ? "#803248" : body);
    const crochet = config.flap === "crochet";
    const material = crochet ? 6 : config.flap === "suede-burgundy" ? 3 : 2;
    ensureClosedFlapShell(renderer, renderFamily, crochet);
    drawMesh(renderer, meshes.flapShell, root, crochet ? darken(flapColor, .22) : flapColor, material, stitch, 0);
    if (crochet) {
      ensureCrochetFlapMesh(renderer, renderFamily, config.stitch || "classic");
      drawMesh(renderer, meshes.yarnFlap, root, flapColor, 7, stitch, 0);
    }
  }

  const metal = config.hardware === "silver" ? "#d7dbe0" : config.hardware === "black" ? "#29272a" : "#caa55d";
  // Closure hardware is only present when a flap/closure is selected.
  if (config.flap !== "none" && renderFamily !== "satchel") {
    const lockZ = (config.flap === "crochet" ? renderer.crochetFlapLockZ : renderer.flapLockZ) ?? profile.frontZ;
    // A seated press stud has a raised rim and a smaller domed cap. Both share
    // the measured flap normal: the closure must not flatten at three-quarter.
    const snapRotation = renderer.flapLockRotation;
    drawMesh(renderer, meshes.sphere, multiply(root, matrix([0, profile.lockY, lockZ], [0.088, 0.060, 0.014], snapRotation)), darken(metal, .24), 4, 0);
    drawMesh(renderer, meshes.sphere, multiply(root, multiply(matrix([0, profile.lockY, lockZ], [1, 1, 1], snapRotation), matrix([0, 0, .012], [0.065, 0.044, 0.021]))), metal, 4, 0);
  }

  if (config.strap !== "none") {
    ensureStrapBinding(renderer, renderFamily);
    drawMesh(renderer, meshes.strapBinding, root, body, 7, stitch, 0);
    for (const side of [-1, 1]) {
      drawMesh(
        renderer,
        meshes.ring,
        multiply(root, matrix(strapHardwarePosition(renderFamily, side), [0.74, 0.88, 1], [0, Math.PI / 2, 0])),
        metal,
        4,
        0,
      );
      // Reusable 3D swivel hook and sprung gate between the shoulder strap
      // and D-ring. No duplicated flat chain or fake painted carabiner.
      const claspPoint = strapClaspPosition(renderFamily, side);
      const claspRotation: [number, number, number] = [0, Math.PI / 2, side < 0 ? -.12 : .12];
      drawMesh(renderer, meshes.claspHook, multiply(root, matrix(claspPoint, [1, 1, 1], claspRotation)), metal, 4, 0);
      drawMesh(renderer, meshes.sphere, multiply(root, matrix([claspPoint[0], claspPoint[1] + .044, claspPoint[2]], [.028, .035, .022], claspRotation)), metal, 4, 0);
    }
  }

  if (renderFamily === "satchel") {
    const colors: Record<CognacPart["tone"], string> = { leather: "#BC683B", edge: "#713B20", seam: "#E4BC8B", metal, recess: darken(metal, .32), engraving: hardwareEngravingColor(config.hardware) };
    for (const part of renderer.cognacParts ?? []) {
      if (part.section === "handle" && config.handles !== "leather-braid") continue;
      if (part.section === "flap" && config.flap === "none") continue;
      const material = part.tone === "metal" || part.tone === "recess" ? 4.25 : part.tone === "leather" || part.tone === "edge" ? 2 : 3;
      drawMesh(renderer, meshes[part.name], root, colors[part.tone], material, stitch, 0);
    }
  }

  // The selected ornament uses the same depth buffer, lighting and camera as
  // the bag. The compatibility canvas is suppressed for this exact signature.
  ensureOrnamentMeshes(renderer, config);
  const ornamentColors: Record<OrnamentTone, string> = { cord: getAbagsCrochetFlapTone(config) ?? body, metal, scarf: reference?.fabricBase ?? "#E9C5CB", hem: reference?.fabricEdge ?? "#777C72", rose: "#B86F82", lilac: "#8E7DB8", teal: "#4F9B9B" };
  for (const part of renderer.ornamentParts ?? []) drawMesh(renderer, meshes[part.name], root, ornamentColors[part.tone], part.material, stitch, 0);

  for (const part of renderer.referenceParts ?? []) {
    const color = part.tone === "metal" ? metal : part.tone === "engraving" ? hardwareEngravingColor(config.hardware) : part.tone === "fabric" || part.tone === "cord" ? body : "#302423";
    const material = part.tone === "metal" ? 4.25 : part.tone === "zipper" ? 2 : part.tone === "fabric" ? 6 : part.tone === "cord" ? 7.1 : 3;
    drawMesh(renderer, meshes[part.name], root, color, material, stitch, 0);
  }

  const renderError = gl.getError();
  if (renderError !== gl.NO_ERROR) throw new Error(`webgl-render-error-${renderError}`);
  if (gl.isContextLost()) throw new Error("webgl-context-lost");

  canvas.dataset.abagsCrochetOwner = "webgl-yarn";
  canvas.dataset.abagsFidelityOrnamentOwner = "webgl";
  canvas.dataset.abagsFidelityOrnamentBounds = renderer.ornamentBounds ? JSON.stringify(renderer.ornamentBounds) : "";
  canvas.dataset.abagsFidelityOrnamentTriangles = String(renderer.ornamentTriangles ?? 0);
  canvas.dataset.abagsFidelityOrnamentConstruction = renderer.ornamentTriangles ? "folded-fabric-gravity-fringe-v3" : "";
  canvas.dataset.abagsFidelityStrapOwner = config.strap !== "none" && config.strap !== "chain" ? "webgl-band" : "";
  canvas.dataset.abagsFidelityStrapBounds = renderer.shoulderBandBounds ? JSON.stringify(renderer.shoulderBandBounds) : "";
  canvas.dataset.abagsFidelityStrapTriangles = String(renderer.shoulderBandTriangles ?? 0);
  canvas.dataset.abagsFidelityReferenceModel = reference ? JSON.stringify({ id: reference.id, source: reference.sourceFile, palette: palette?.id ?? "solid", fabric: reference.fabric, probes: referenceYarnProbePoints(renderFamily,root,width,height), constructionTriangles: renderer.referenceTriangles ?? 0, strapTriangles: renderer.shoulderBandTriangles ?? 0,
    textilePrint: { id: textileProfile.id, scarf: textiles.scarf.ready, strap: textiles.strap.ready } }) : "";
  canvas.dataset.abagsFidelityTextilePrint = JSON.stringify({ id: textileProfile.id, scarf: textiles.scarf.ready, strap: textiles.strap.ready, scarfUrl: textiles.scarf.url, strapUrl: textiles.strap.url });
  const blackFlap = getAbagsCrochetFlapTone(config);
  const flapProbe = blackFlap ? crochetFlapSurface(renderFamily).sample(0, profile.flapY) : null;
  const tip = blackFlap && config.accent === "tassel" ? fidelityAccessoryAnchor(config) : null;
  canvas.dataset.abagsFidelityOwnerCorrection = verticalBands ? JSON.stringify({ id: "pastel-mini", axis: "x", palette: palette.id,
    probes: [...referenceYarnProbePoints(renderFamily,root,width,height,true), ...referenceYarnProbePoints(renderFamily,root,width,height,true,-.70)] }) : blackFlap && flapProbe ? JSON.stringify({ id: "mustard-round", flapTone: blackFlap,
    probes: [projectBagPoint([0,profile.flapY,flapProbe.z+.03],root,width,height),
      ...(tip ? [projectBagPoint([tip[0],tip[1]-.42,tip[2]+.07],root,width,height)] : [])] }) : "";
  canvas.dataset.abagsFidelityCognac = renderFamily === "satchel" ? JSON.stringify({ version: "cognac-ombre-v1", source: "1000020714.png", ombre: renderer.ombre,
    handleTriangles: config.handles === "leather-braid" ? renderer.cognacParts?.filter(p => p.section === "handle").reduce((n,p) => n + p.mesh.indices.length / 3, 0) : 0,
    flapTriangles: config.flap !== "none" ? renderer.cognacParts?.filter(p => p.section === "flap").reduce((n,p) => n + p.mesh.indices.length / 3, 0) : 0,
    badgeTriangles: renderer.cognacParts?.filter(p => p.section === "badge").reduce((n,p) => n + p.mesh.indices.length / 3, 0),
    jacquardTriangles: config.strap === "woven-ornament" ? renderer.shoulderBandTriangles : 0 }) : "";
  canvas.dataset.abagsFidelityRimTriangles = String(renderer.rimTriangles ?? 0);
  canvas.dataset.abagsFidelityGrounding = JSON.stringify(groundContactFrame(renderer.groundPoints ?? [], root, width / height, canvas.clientHeight));
  const accessoryAnchor = fidelityAccessoryAnchor(config);
  canvas.dataset.abagsFidelityAccessoryAnchor = accessoryAnchor ? JSON.stringify(accessoryAnchor) : "";
  canvas.dataset.abagsFidelityAccessorySignature = renderSignature(config);
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
  const [view, setViewState] = useState<"front" | "three" | "side" | "custom">("three");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasNode, setCanvasNode] = useState<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const cameraRef = useRef({ rotation: DEFAULT_ROTATION, zoom: DEFAULT_ZOOM });
  const gesture = useRef(new AbagsCameraGesture(CAMERA_LIMITS));
  const instructionsId = useId();

  const commitCamera = (next: AbagsCamera) => {
    // Pointer events can arrive before React commits the previous frame.
    // Rebase the next gesture on the latest pose immediately.
    cameraRef.current = next;
    setRotation(next.rotation);
    setZoom(next.zoom);
  };

  useLayoutEffect(() => {
    // Initialization and ResizeObserver callbacks outlive a single camera state.
    cameraRef.current = { rotation, zoom };
  }, [rotation, zoom]);

  useEffect(() => {
    const currentGesture = gesture.current;
    const clear = () => currentGesture.clear();
    const onVisibility = () => { if (document.hidden) clear(); };
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clear();
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [stage]);

  useEffect(() => {
    if (!canvasNode) return;
    const onWheel = (event: WheelEvent) => {
      // Leave browser magnification shortcuts available.
      if (event.ctrlKey || event.metaKey) return;
      if (event.cancelable) event.preventDefault();
      const current = cameraRef.current;
      const next = { ...current, zoom: wheelCameraZoom(current.zoom, event.deltaY, event.deltaMode, canvasNode.clientHeight, CAMERA_LIMITS) };
      cameraRef.current = next;
      setZoom(next.zoom);
    };
    // React delegates wheel events passively. Bind to the canvas itself so
    // zooming the bag does not also scroll the customer dialog.
    canvasNode.addEventListener("wheel", onWheel, { passive: false });
    return () => canvasNode.removeEventListener("wheel", onWheel);
  }, [canvasNode]);

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
        const nextRenderer = init(canvas);
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
            disposeAbagsPrintedTextiles(nextRenderer.printedTextiles);
            rendererRef.current = null;
            publishRendererError(stage, canvas, error, "render-failed");
            setReady(false);
            stage.classList.remove("abags-pro3d-active", "abags-fidelity3d-active");
            stage.removeAttribute("data-abags-pro3d-ready");
            stage.removeAttribute("data-abags-fidelity3d-ready");
          }
        };
        nextRenderer.onTextileReady = () => {
          if (!disposed && rendererRef.current === nextRenderer) requestAnimationFrame(paint);
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
      if (rendererRef.current) disposeAbagsPrintedTextiles(rendererRef.current.printedTextiles);
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
      if (rendererRef.current) disposeAbagsPrintedTextiles(rendererRef.current.printedTextiles);
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
        disposeAbagsPrintedTextiles(renderer.printedTextiles);
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

  const setView = (next: "front" | "three" | "side") => {
    gesture.current.clear();
    setViewState(next);
    commitCamera({ ...cameraRef.current, rotation: next === "front" ? { x: -0.02, y: 0 } : next === "side" ? { x: -0.07, y: Math.PI / 2 } : DEFAULT_ROTATION });
  };

  const resetCamera = () => {
    gesture.current.clear();
    setViewState("three");
    commitCamera({ rotation: DEFAULT_ROTATION, zoom: DEFAULT_ZOOM });
  };

  return createPortal(
    <div
      className="abags-pro3d-layer abags-fidelity3d-layer"
      data-abags-pro3d
      data-abags-fidelity3d
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest("button, input, select, textarea, .abags-pro3d-view-controls, .abags-pro3d-zoom, .abags-fidelity3d-view-controls, .abags-fidelity3d-zoom")) return;
        event.preventDefault();
        canvasRef.current?.focus({ preventScroll: true });
        gesture.current.start(event.pointerId, event.clientX, event.clientY, cameraRef.current);
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        const current = cameraRef.current;
        const next = gesture.current.move(event.pointerId, event.clientX, event.clientY, current);
        if (!next) return;
        event.preventDefault();
        if (next.rotation !== current.rotation) setViewState("custom");
        commitCamera(next);
      }}
      onPointerUp={(event) => gesture.current.end(event.pointerId, cameraRef.current)}
      onPointerCancel={(event) => gesture.current.end(event.pointerId, cameraRef.current)}
      onLostPointerCapture={(event) => gesture.current.end(event.pointerId, cameraRef.current)}
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
        tabIndex={0}
        role="region"
        aria-label={label}
        aria-describedby={instructionsId}
        onKeyDown={(event) => {
          if (event.ctrlKey || event.metaKey || event.altKey) return;
          const next = keyboardCamera(event.key, cameraRef.current, { rotation: DEFAULT_ROTATION, zoom: DEFAULT_ZOOM }, CAMERA_LIMITS, event.shiftKey);
          if (!next) return;
          event.preventDefault();
          gesture.current.clear();
          if (event.key === "Home") setViewState("three");
          else if (event.key.startsWith("Arrow")) setViewState("custom");
          commitCamera(next);
        }}
      />
      <p id={instructionsId} className="abags-fidelity3d-instructions">Przeciągnij, aby obrócić. Powiększ dwoma palcami lub kółkiem myszy. Klawiatura: strzałki obracają, + i − zmieniają skalę, Home przywraca widok.</p>

      <div className="abags-pro3d-chip">MODEL ATELIER 3D · REALNE PROPORCJE</div>
      <div className="abags-pro3d-view-controls" role="group" aria-label="Widok modelu 3D">
        <button type="button" className={view === "front" ? "is-active" : ""} aria-pressed={view === "front"} onClick={() => setView("front")}>Przód</button>
        <button type="button" className={view === "three" ? "is-active" : ""} aria-pressed={view === "three"} onClick={() => setView("three")}>3/4</button>
        <button type="button" className={view === "side" ? "is-active" : ""} aria-pressed={view === "side"} onClick={() => setView("side")}>Bok</button>
      </div>

      <div className="abags-pro3d-zoom" role="group" aria-label="Zoom modelu 3D">
        <button type="button" disabled={zoom <= MIN_ZOOM} onClick={() => commitCamera({ ...cameraRef.current, zoom: clamp(cameraRef.current.zoom - .10, MIN_ZOOM, MAX_ZOOM) })} aria-label="Oddal model">−</button>
        <span>ODDAL</span>
        <input type="range" min={34} max={145} step={1} value={Math.round(zoom * 100)} onChange={(event) => commitCamera({ ...cameraRef.current, zoom: clamp(Number(event.currentTarget.value) / 100, MIN_ZOOM, MAX_ZOOM) })} aria-label="Skala modelu 3D" aria-valuetext={`${Math.round(zoom * 100)}%`} />
        <span>PRZYBLIŻ</span>
        <button type="button" disabled={zoom >= MAX_ZOOM} onClick={() => commitCamera({ ...cameraRef.current, zoom: clamp(cameraRef.current.zoom + .10, MIN_ZOOM, MAX_ZOOM) })} aria-label="Przybliż model">+</button>
        <button type="button" className="abags-pro3d-reset" onClick={resetCamera} aria-label={`Przywróć widok początkowy. Obecna skala ${Math.round(zoom * 100)}%`} title="Przywróć widok początkowy">{Math.round(zoom * 100)}%</button>
      </div>

      <p className="abags-pro3d-hint">Obrót 360° pokazuje rzeczywistą zmianę głębokości korpusu · pinch zoom · fason i dodatki aktualizują się na żywo.</p>
    </div>,
    stage,
  );
}
