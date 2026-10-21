"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  yarnKey?: string;
  woodBindingKey?: string;
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
  uniforms: Record<"projection" | "view" | "model" | "normalMatrix" | "color" | "material" | "stitch" | "relief" | "light", WebGLUniformLocation>;
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
  const depthScale = family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : 1;
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
  const depthScale = family === "round" ? 1.34 : family === "tote" ? 1.78 : family === "bucket" ? 1.52 : family === "mini" ? 1.42 : 1;
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
    [profile.width * .84, Math.max(.28, profile.handleScaleY * 1.35), 1],
    [z < 0 ? 0.40 : -0.40, 0, 0]);
}

type FabricMesh = { positions: number[]; normals: number[]; uvs: number[]; indices: number[] };
type YarnPoint = [number, number, number];

function appendCord(mesh: FabricMesh, points: YarnPoint[], thickness: number, guide: (point: YarnPoint) => YarnPoint, contains: (point: YarnPoint) => boolean, sides = 10) {
  let previous = -1;
  let distance = 0;
  points.forEach((point, index) => {
    if (index > 0) distance += Math.hypot(...point.map((value, axis) => value - points[index - 1][axis]));
    if (!contains(point)) { previous = -1; return; }
    const before = points[Math.max(0, index - 1)], after = points[Math.min(points.length - 1, index + 1)];
    const tangent = normalize(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
    const normal = guide(point);
    const across = normalize(normal[1] * tangent[2] - normal[2] * tangent[1], normal[2] * tangent[0] - normal[0] * tangent[2], normal[0] * tangent[1] - normal[1] * tangent[0]);
    const outward = normalize(tangent[1] * across[2] - tangent[2] * across[1], tangent[2] * across[0] - tangent[0] * across[2], tangent[0] * across[1] - tangent[1] * across[0]);
    const start = mesh.positions.length / 3;
    for (let side = 0; side <= sides; side++) {
      const angle = side / sides * Math.PI * 2;
      const n = across.map((v, axis) => v * Math.cos(angle) + outward[axis] * Math.sin(angle)) as YarnPoint;
      mesh.positions.push(...point.map((v, axis) => v + n[axis] * thickness));
      mesh.normals.push(...n);
      // The braid repeats at the same physical scale on short loops and long
      // bindings. A normalized 0..1 path stretched the fibres on every seam.
      mesh.uvs.push(distance / (thickness * 1.6), side / sides);
      if (previous >= 0 && side < sides) {
        const a = previous + side, b = start + side;
        mesh.indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    previous = start;
  });
}

type CrochetPatch = {
  rx: number; ry: number; radius: number; columns: number; rows: number;
  seat: (x: number, y: number, lift: number) => YarnPoint;
  tube: (points: YarnPoint[], thickness?: number) => void;
  curveSteps?: number;
};

// One construction produces each selected stitch on panels, flaps and gussets.
function fillCrochetPatch(patch: CrochetPatch, stitch: Stitch) {
  const { radius, columns, rows, seat, tube, curveSteps = 16 } = patch;
  const spec = { rx: patch.rx, ry: patch.ry };
  const dx = spec.rx * 1.94 / columns, dy = spec.ry * 1.94 / rows;
  const curve = (cx: number, cy: number, width: number, height: number, lift: number, drift: number) => {
    const points: YarnPoint[] = [];
    for (let i = 0; i <= curveSteps; i++) {
      const t = i / curveSteps;
      // A smooth U/V loop, curling outwards at the shoulders like the atelier cord.
      const x = cx + Math.sin((t - .5) * Math.PI) * width * .43 + drift * Math.sin(t * Math.PI);
      const y = cy + (Math.pow(Math.abs(2 * t - 1), 1.65) - .48) * height;
      points.push(seat(x, y, lift + radius * .24 * Math.sin(t * Math.PI * 2)));
    }
    tube(points);
  };
  for (let row = -1; row <= rows; row++) {
    for (let column = -1; column <= columns; column++) {
      const variation = Math.sin((row + 7) * 17.31 + (column + 11) * 5.97);
      const cx = -spec.rx * .97 + (column + .5 + (row % 2) * .5) * dx;
      const cy = -spec.ry * .97 + (row + .5) * dy;
      if (stitch === "basket") {
        const verticalOver = (row + column) % 2 === 0;
        for (const axis of [0, 1]) for (const strand of [-1, 1]) {
          const points: YarnPoint[] = [];
          for (let i = 0; i <= Math.max(4, curveSteps / 2); i++) {
            const t = i / Math.max(4, curveSteps / 2) - .5;
            const x = cx + (axis === 0 ? strand * dx * .19 : t * dx * 1.10);
            const y = cy + (axis === 0 ? t * dy * 1.10 : strand * dy * .19);
            const over = (axis === 0) === verticalOver;
            points.push(seat(x, y, over ? radius * (.50 + .35 * Math.cos(t * Math.PI)) : -radius * .28));
          }
          tube(points, radius * .84);
        }
      } else if (stitch === "shell") {
        // Rounded fans, with a crossing lower crown instead of a flat scallop icon.
        curve(cx, cy, dx * 1.30, dy * .90, radius * .12, variation * dx * .035);
        curve(cx, cy + dy * .28, dx * .78, dy * .72, radius * .24, -variation * dx * .025);
      } else {
        const compact = stitch === "herringbone";
        curve(cx, cy, dx * (compact ? 1.06 : 1.18), dy * (compact ? .84 : 1.06), variation * radius * .10, variation * dx * .035);
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
  const radius = spec.rx * 5 / 160;
  const columns = stitch === "basket" ? 10 : stitch === "shell" ? 12 : 16;
  const rows = Math.max(9, Math.round(columns * spec.ry / spec.rx * 1.12));
  const fractionAt = (x: number, y: number) => {
    const taper = 1 + spec.taper * y / spec.ry;
    return Math.pow(Math.pow(Math.abs(x / (spec.rx * taper)), spec.power) + Math.pow(Math.abs(y / spec.ry), spec.power), 1 / spec.power);
  };
  const seat = (x: number, y: number, lift: number) => crochetPanelPoint(family, x, y, lift);
  const tube = (points: YarnPoint[], thickness = radius) => appendCord(mesh, points, thickness, () => [0, 0, 1], (point) => fractionAt(point[0], point[1]) <= .974);
  fillCrochetPatch({ rx: spec.rx, ry: spec.ry, radius, columns, rows, seat, tube }, stitch);
  // A continuous sewn binding hides clipped loop ends at the rounded panel edge.
  const binding = familyContour(family).map(([x, y]) => seat(x * .953, y * .953, radius * .05));
  binding.push(binding[0]);
  tube(binding, radius * .78);
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
  const gaugeColumns = stitch === "basket" ? 10 : stitch === "shell" ? 12 : 16;
  const columns = Math.round(perimeter / (spec.rx * 1.94 / gaugeColumns));
  const depth = depthAt(family, 0);
  const rows = Math.max(3, Math.round(columns * depth / perimeter * 1.12));
  const radius = spec.rx * 5 / 160;
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
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
    ([, y, z]) => y < spec.ry * .90 && Math.abs(z) < depthAt(family, y) * .51, 8);
  fillCrochetPatch({ rx: perimeter * .5, ry: depth * .5, radius, columns, rows, seat, tube, curveSteps: 8 }, stitch);
  // Sewn piping covers the clipped ends where the gusset joins each panel.
  for (const side of [-1, 1]) {
    const seam = contour.map(([x, y]): YarnPoint => {
      const softness = softBodyOffset(family, x, y);
      return [x, y + softness.y, side * (depthAt(family, y) * .5 + softness.z)];
    });
    seam.push(seam[0]);
    appendCord(mesh, seam, radius * 1.02, () => [0, 0, side], ([, y]) => y < spec.ry * .90, 8);
  }
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
  const back = {
    positions: front.positions.map((v, i) => i % 3 === 2 ? -v : v),
    normals: front.normals.map((v, i) => i % 3 === 2 ? -v : v),
    uvs: front.uvs,
    indices: front.indices.map((v, i, indices) => i % 3 === 1 ? indices[i + 1] : i % 3 === 2 ? indices[i - 1] : v),
  };
  renderer.meshes.yarnFront = createMesh(renderer.gl, front);
  renderer.meshes.yarnBack = createMesh(renderer.gl, back);
  renderer.meshes.yarnSide = createMesh(renderer.gl, makeCrochetGusset(family, stitch));
  renderer.yarnKey = key;
}

function woodHandleBindingPaths(family: Exclude<Family, "">, z: number) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const transform = woodHandleMatrix(family, z);
  const side = z < 0 ? -1 : 1;
  const radius = spec.rx * 5 / 160 * .78;
  const coil = .042 + radius * .72;
  const turns = Math.round(Math.PI * .44 / (radius * 2.06));
  const start = Math.PI + .10, span = Math.PI - .20;
  const world = (x: number, y: number, depth: number): YarnPoint => [
    transform[0] * x + transform[4] * y + transform[8] * depth + transform[12],
    transform[1] * x + transform[5] * y + transform[9] * depth + transform[13],
    transform[2] * x + transform[6] * y + transform[10] * depth + transform[14],
  ];
  const at = (progress: number): YarnPoint => {
    const angle = start + span * progress;
    const phase = progress * turns * Math.PI * 2;
    const radial = normalize(Math.cos(angle) / .46, Math.sin(angle) / .42, 0);
    return world(.46 * Math.cos(angle) + radial[0] * coil * Math.cos(phase),
      .42 * Math.sin(angle) + radial[1] * coil * Math.cos(phase), side * coil * Math.sin(phase));
  };
  const winding = Array.from({ length: turns * 14 + 1 }, (_, i) => at(i / (turns * 14)));
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
  const guide = (point: YarnPoint): YarnPoint => {
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

function makeWoodHandleBinding(family: Exclude<Family, "">): FabricMesh {
  const mesh: FabricMesh = { positions: [], normals: [], uvs: [], indices: [] };
  for (const z of woodHandleDepthPlanes(family)) {
    const { winding, seams, radius, guide } = woodHandleBindingPaths(family, z);
    appendCord(mesh, winding, radius, guide, () => true, 8);
    for (const seam of seams) appendCord(mesh, seam, radius * .75, () => [0, 0, z < 0 ? -1 : 1], () => true, 8);
  }
  return mesh;
}

function ensureWoodHandleBinding(renderer: Renderer, family: Exclude<Family, "">) {
  if (renderer.woodBindingKey === family) return;
  const previous = renderer.meshes.woodBinding;
  if (previous) for (const buffer of [previous.position, previous.normal, previous.uv, previous.index]) renderer.gl.deleteBuffer(buffer);
  renderer.meshes.woodBinding = createMesh(renderer.gl, makeWoodHandleBinding(family));
  renderer.woodBindingKey = family;
}

type ClosedFlapSurface = {
  mesh: FabricMesh; contour: YarnPoint[]; rx: number; ry: number; centerY: number; thickness: number;
  sample: (x: number, y: number) => { z: number; normal: YarnPoint } | null;
};
// Eight immutable surfaces cover the four families and two constructions.
const closedFlapSurfaces = new Map<string, ClosedFlapSurface>();

function closedFlapSurface(family: Exclude<Family, "">, crochet: boolean): ClosedFlapSurface {
  const key = family + (crochet ? ":crochet" : ":leather");
  const cached = closedFlapSurfaces.get(key);
  if (cached) return cached;
  const profile = PROFILES[family];
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  // Preserve the calibrated front outline; only its depth is fitted to the bag.
  const base = crochet ? makeExtrudedContour(flapContour(), .04, .085) : makeExtrudedContour(flapContour(), 0.105, 0.085);
  const transform = matrix([0, profile.flapY, profile.frontZ + .13], profile.flapScale, [.02, 0, 0]);
  const outline = flapContour().map((_, index): Point => {
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
  const radius = spec.rx * 5 / 160;
  const gauge = stitch === "basket" ? 10 : stitch === "shell" ? 12 : 16;
  const columns = Math.max(4, Math.round(gauge * rx / spec.rx));
  const rows = Math.max(3, Math.round(columns * ry / rx * 1.12));
  const seat = (x: number, y: number, lift: number): YarnPoint => {
    const point = surface.sample(x, y + centerY);
    return [x, y + centerY, (point?.z ?? PROFILES[family].frontZ + .20) + radius * .62 + lift];
  };
  const tube = (points: YarnPoint[], thickness = radius) => appendCord(mesh, points, thickness,
    ([x, y]) => surface.sample(x, y)?.normal ?? [0, 0, 1],
    ([x, y]) => surface.sample(x, y) !== null);
  fillCrochetPatch({ rx, ry, radius, columns, rows, seat, tube }, stitch);
  const binding = surface.contour.map(([x, y]) => seat(x * .965, (y - centerY) * .965, radius * .04));
  binding.push(binding[0]);
  tube(binding, radius * .72);
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

function makeOpeningRim(family: Exclude<Family, "">, minor = 0.022, tube = 10) {
  const points = openingPath(family);
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let i = 0; i <= points.length; i++) {
    const point = points[i % points.length];
    const prev = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    const tangent = normalize(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]);
    const outward = normalize(-tangent[2], 0, tangent[0]);
    const up = normalize(
      tangent[1] * outward[2] - tangent[2] * outward[1],
      tangent[2] * outward[0] - tangent[0] * outward[2],
      tangent[0] * outward[1] - tangent[1] * outward[0],
    );
    for (let j = 0; j <= tube; j++) {
      const angle = j / tube * Math.PI * 2;
      const normal = normalize(...outward.map((v, axis) => v * Math.cos(angle) + up[axis] * Math.sin(angle)) as [number, number, number]);
      positions.push(...point.map((v, axis) => v + minor * normal[axis]));
      normals.push(...normal);
      uvs.push(i / points.length, j / tube);
      if (i < points.length && j < tube) {
        const a = i * (tube + 1) + j, b = a + tube + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  return { positions, normals, uvs, indices };
}

function makeOpeningInterior(family: Exclude<Family, "">) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const width = spec.rx;
  const depth = depthAt(family, spec.ry);
  const topY = spec.bodyY + spec.ry;
  const bottomY = topY - Math.min(.43, spec.ry * .6);
  const points = openingPath(family);
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const count = points.length;
  // The lining starts immediately under the same seam and descends into the bag.
  points.forEach(([x, y, z], i) => {
    const normal = normalize(-x / width, .06, -z / Math.max(depth * .5, .001));
    for (const [height, factor, v] of [[y - .018, .96, 0], [bottomY, .83, 1]] as const) {
      positions.push(x * factor, height, z * factor);
      normals.push(...normal);
      uvs.push(i / count, v);
    }
  });
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count, a = i * 2, b = j * 2;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const floorCenter = positions.length / 3;
  positions.push(0, bottomY, 0); normals.push(0, 1, 0); uvs.push(.5, .5);
  const floorRing = positions.length / 3;
  points.forEach(([x, , z]) => {
    positions.push(x * .83, bottomY, z * .83); normals.push(0, 1, 0);
    uvs.push(.5 + x / (width * 2), .5 + z / depth);
  });
  for (let i = 0; i < count; i++) indices.push(floorCenter, floorRing + (i + 1) % count, floorRing + i);
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
attribute vec2 aUv;
uniform mat4 uProjection,uView,uModel;
uniform mat3 uNormalMatrix;
uniform mediump float uRelief;
uniform mediump float uStitch;
varying vec3 vNormal,vWorld;
varying vec3 vTangent,vBitangent;
varying float vFaceWeight;
varying vec2 vUv;
${CROCHET_SURFACE}
void main(){
  float h=0.0;
  if(uRelief>0.0) h=knit(aUv,uStitch)*uRelief*.48;
  float frontFace=smoothstep(.45,.85,abs(aNormal.z));
  // The back keeps its outward normal; relief never bends it toward the front.
  float faceSign=aNormal.z<0.0?-1.0:1.0;
  vec3 sidedReliefNormal=vec3(aNormal.xy,abs(aNormal.z)*faceSign);
  vec4 world=uModel*vec4(aPosition+aNormal*h,1.0);
  vWorld=world.xyz;
  vNormal=normalize(uNormalMatrix*sidedReliefNormal);
  // The gusset has its own arc-length UVs, so its tangent follows the perimeter.
  vec3 localTangent=normalize(mix(vec3(-aNormal.y,aNormal.x,.001),vec3(1.0,0.0,0.0),frontFace));
  vec3 localBitangent=mix(vec3(0.0,0.0,-1.0),vec3(0.0,1.0,0.0),frontFace);
  vTangent=normalize(mat3(uModel)*localTangent);
  vBitangent=normalize(mat3(uModel)*localBitangent);
  vFaceWeight=frontFace;
  vUv=aUv;
  gl_Position=uProjection*uView*world;
}`;

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
varying float vFaceWeight;
varying vec2 vUv;
uniform vec3 uColor,uLight;
uniform float uMaterial;
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
void main(){
  vec3 n=normalize(vNormal);
  vec3 l=normalize(uLight);
  vec3 fill=normalize(vec3(.75,.25,.30));
  vec3 v=normalize(vec3(0.0,.02,5.0)-vWorld);
  float rough=.76,metal=0.0,detail=1.0,cordOcclusion=1.0;
  float fibreSheen=0.0;
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
    metal=.97; rough=.24;
  } else if(uMaterial<5.5){
    vec2 checker=floor(vUv*vec2(22.0,10.0));
    detail=mix(.56,.94,mod(checker.x+checker.y,2.0));
    rough=.95;
  } else if(uMaterial<6.5){
    detail=.88+.025*sin(vUv.x*118.0+vUv.y*97.0);
    rough=.96;
  } else {
    vec2 braidSlope;
    float braid=cordBraid(vUv,braidSlope);
    float resolved=braidVisibility(vUv);
    n=cordBraidNormal(n,braidSlope*resolved);
    detail=mix(.97,.88+.15*braid,resolved);
    cordOcclusion=mix(1.0,.88+.12*braid,resolved);
    rough=.80+.04*(1.0-braid)*resolved;
    fibreSheen=.018;
  }
  float ndl=max(dot(n,l),0.0);
  float fillLight=max(dot(n,fill),0.0);
  float facing=max(dot(n,v),0.0);
  vec3 base=pow(max(uColor,vec3(.001)),vec3(2.2))*detail;
  float cavity=.94+.06*facing;
  float illumination=.30+.66*ndl+.20*fillLight;
  vec3 f0=mix(vec3(.035),base,metal);
  vec3 color=base*illumination*cavity*cordOcclusion*(1.0-metal*.75);
  color+=specularGGX(n,l,v,rough,f0)*1.6;
  color+=vec3(fibreSheen)*pow(1.0-facing,2.0)*(.3+.7*ndl);
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

function createMesh(gl: WebGLRenderingContext, data: { positions: number[]; normals: number[]; uvs: number[]; indices: number[] }): Mesh {
  // WebGL 1 uses unsigned-short indices, including on older Android devices.
  if (data.positions.length / 3 > 65535) throw new Error("mesh-index-budget");
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
    },
    uniforms: {
      projection: req("uProjection"), view: req("uView"), model: req("uModel"), normalMatrix: req("uNormalMatrix"), color: req("uColor"), material: req("uMaterial"), stitch: req("uStitch"), relief: req("uRelief"), light: req("uLight"),
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
  gl.uniformMatrix3fv(uniforms.normalMatrix, false, normalMatrix(model));
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
  if (config.accent === "scarf" && config.handles.startsWith("wood")) {
    const model = woodHandleMatrix(family, woodHandleDepthPlanes(family)[1]);
    const angle = Math.PI - .16;
    const x = .46 * Math.cos(angle), y = .42 * Math.sin(angle), z = .055;
    return [model[0] * x + model[4] * y + model[8] * z + model[12],
      model[1] * x + model[5] * y + model[9] * z + model[13],
      model[2] * x + model[6] * y + model[10] * z + model[14]];
  }
  const x = spec.sideAnchor * (config.accent === "tassel" ? .91 : config.accent === "scarf" ? -.68 : .86);
  const y = config.accent === "tassel" ? .25 : config.accent === "scarf" ? .36 : .12;
  const cordRadius = spec.rx * 5 / 160;
  return [x, y, crochetPanelPoint(family, x, y - spec.bodyY)[2] + cordRadius * 1.75 + .018];
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
  stage.dataset.abagsCrochetOwner = canvas.dataset.abagsCrochetOwner || "";
  stage.dataset.abagsFidelityAccessoryAnchor = canvas.dataset.abagsFidelityAccessoryAnchor || "";
  stage.dataset.abagsFidelityAccessorySignature = canvas.dataset.abagsFidelityAccessorySignature || "";
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
  }
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
  const root = multiply(scale(zoom, zoom, zoom), multiply(rotX(rotation.x), rotY(rotation.y)));
  const body = config.color || "#b87880";
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
  const interiorColor = agataOpenWoodTote ? "#f0e7d9" : darken(openingColor, 0.58);
  // The red and brown wooden-handle versions share one silhouette and geometry.
  // The checked lining is visible when the customer rotates the same model to look inside.
  drawMesh(renderer, config.family ? meshes[config.family + "Interior"] : meshes.toteInterior, root, interiorColor, agataOpenWoodTote ? 5 : 6, stitch, 0);
  drawMesh(renderer, config.family ? meshes[config.family + "Rim"] : meshes.toteRim, root, openingColor, 3, stitch, 0);

  if (config.strap !== "none") {
    const metal = config.hardware === "silver" ? "#d7dbe0" : config.hardware === "black" ? "#29272a" : "#caa55d";
    const strapColor = config.strap === "chain" ? metal : config.strap === "leather" ? "#6b4738" : "#a77d87";
    const material = config.strap === "chain" ? 4 : config.strap === "leather" ? 2 : 3;
    const strapMesh = config.strap === "chain"
      ? (config.family ? meshes[config.family + "Chain"] : meshes.toteChain)
      : meshes[renderFamily + "Strap"];
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
      ensureWoodHandleBinding(renderer, renderFamily);
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
    const flapColor = config.flap === "leather-black" ? "#242124" : config.flap === "leather-cognac" ? "#7c5034" : config.flap === "suede-burgundy" ? "#803248" : body;
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
  if (config.flap !== "none") {
    const lockZ = (config.flap === "crochet" ? renderer.crochetFlapLockZ : renderer.flapLockZ) ?? profile.frontZ;
    drawMesh(renderer, meshes.sphere, multiply(root, matrix([0, profile.lockY, lockZ], [0.077, 0.050, 0.021], renderer.flapLockRotation)), metal, 4, 0);
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
    }
  }

  // Optional ornaments are drawn only by the synchronized accessory compositor.
  // Rendering them here as well created doubled bows/charms; this renderer owns
  // the bag body, flap, handles, shoulder strap and strap attachment hardware.
  // Do not add unconditional decorative hardware to an otherwise plain bag.

  const renderError = gl.getError();
  if (renderError !== gl.NO_ERROR) throw new Error(`webgl-render-error-${renderError}`);
  if (gl.isContextLost()) throw new Error("webgl-context-lost");

  canvas.dataset.abagsCrochetOwner = "webgl-yarn";
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
