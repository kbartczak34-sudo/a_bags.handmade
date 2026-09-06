"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS, type FidelityV4FamilySpec } from "../lib/abags-fidelity-v4-family-spec";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Stitch = "" | "classic" | "herringbone" | "basket" | "shell";
type Rotation = { x: number; y: number };
type TransformDetail = { rotation?: Rotation; zoom?: number };
type Point3 = [number, number, number];
type Point2 = { x: number; y: number };

type SideSurface = {
  path: Path2D;
  sign: -1 | 1;
  frontZ: number;
  rearZ: number;
  yMin: number;
  yMax: number;
  visibility: number;
};

const STAGE_SELECTOR = ".abags-bag-builder-stage";
const LAYER_SELECTOR = ".abags-fidelity3d-layer";
const SOURCE_SELECTOR = ".abags-fidelity3d-canvas";
const DEFAULT_ROTATION: Rotation = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const SIDE_VERSION = "sidewall-crochet-depth-v2-basket-over-under";
const MIN_SIDE_VISIBILITY = 0.22;

function project(point: Point3, width: number, height: number, rotation: Rotation, zoom: number): Point2 | null {
  const aspect = width / Math.max(1, height);
  const narrow = aspect < 0.82;
  const fit = narrow ? 0.92 : aspect < 1.15 ? 0.97 : 1;
  const rootScale = zoom * fit;
  const cameraZ = narrow ? -6.45 : aspect < 1.15 ? -5.85 : -5.25;
  const verticalOffset = narrow ? -0.08 : -0.03;
  let [x, y, z] = point.map((value) => value * rootScale) as Point3;

  const cx = Math.cos(rotation.x);
  const sx = Math.sin(rotation.x);
  [y, z] = [y * cx - z * sx, y * sx + z * cx];
  const cy = Math.cos(rotation.y);
  const sy = Math.sin(rotation.y);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy + cameraZ];
  y += verticalOffset;
  if (z >= -0.08) return null;

  const f = 1 / Math.tan((Math.PI / 5.15) / 2);
  return {
    x: ((((x * f / aspect) / -z) * 0.5) + 0.5) * width,
    y: (0.5 - (((y * f) / -z) * 0.5)) * height,
  };
}

function halfWidthAtY(spec: FidelityV4FamilySpec, y: number) {
  const relativeY = Math.min(0.997, Math.abs(y / spec.ry));
  const base = spec.rx * Math.pow(Math.max(0.0001, 1 - Math.pow(relativeY, spec.power)), 1 / spec.power);
  return base * (1 + spec.taper * (y / spec.ry));
}

function sidePoint(spec: FidelityV4FamilySpec, sign: -1 | 1, y: number, z: number): Point3 {
  return [sign * halfWidthAtY(spec, y), y, z];
}

function projectedSideSurface(
  family: Exclude<Family, "">,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
): SideSurface | null {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const yaw = Math.sin(rotation.y);
  const visibility = Math.abs(yaw);
  if (visibility < MIN_SIDE_VISIBILITY) return null;

  // Positive yaw exposes the negative-X wall to the camera; negative yaw exposes +X.
  const sign: -1 | 1 = yaw >= 0 ? -1 : 1;
  const frontZ = spec.depth / 2 - spec.bevel * 0.52;
  const rearZ = -spec.depth / 2 + spec.bevel * 0.52;
  const yMin = -spec.ry * 0.90;
  const yMax = spec.ry * 0.89;
  const count = family === "round" ? 46 : 42;
  const front: Point2[] = [];
  const rear: Point2[] = [];

  for (let index = 0; index <= count; index += 1) {
    const y = yMin + ((yMax - yMin) * index) / count;
    const a = project(sidePoint(spec, sign, y, frontZ), width, height, rotation, zoom);
    const b = project(sidePoint(spec, sign, y, rearZ), width, height, rotation, zoom);
    if (a && b) {
      front.push(a);
      rear.push(b);
    }
  }
  if (front.length < 12 || rear.length !== front.length) return null;

  const path = new Path2D();
  path.moveTo(front[0].x, front[0].y);
  for (let index = 1; index < front.length; index += 1) path.lineTo(front[index].x, front[index].y);
  for (let index = rear.length - 1; index >= 0; index -= 1) path.lineTo(rear[index].x, rear[index].y);
  path.closePath();

  return { path, sign, frontZ, rearZ, yMin, yMax, visibility };
}

function raisedStroke(
  context: CanvasRenderingContext2D,
  path: Path2D,
  width: number,
  unit: number,
  strength: number,
) {
  context.save();
  context.translate(0.70 * unit, 0.88 * unit);
  context.strokeStyle = `rgba(24,16,19,${0.28 * strength})`;
  context.lineWidth = width * 1.12;
  context.stroke(path);
  context.restore();

  context.save();
  context.translate(-0.44 * unit, -0.48 * unit);
  context.strokeStyle = `rgba(255,255,255,${0.24 * strength})`;
  context.lineWidth = width * 0.64;
  context.stroke(path);
  context.restore();
}

function cordRow(
  spec: FidelityV4FamilySpec,
  surface: SideSurface,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
  y: number,
  row: number,
) {
  const path = new Path2D();
  let started = false;
  const steps = 14;
  const direction = row % 2 === 0 ? 1 : -1;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const z = surface.rearZ + (surface.frontZ - surface.rearZ) * t;
    const tension = Math.sin(t * Math.PI) * spec.ry * 0.0045 * direction;
    const point = project(sidePoint(spec, surface.sign, y + tension, z), width, height, rotation, zoom);
    if (!point) continue;
    if (!started) {
      path.moveTo(point.x, point.y);
      started = true;
    } else {
      path.lineTo(point.x, point.y);
    }
  }
  return started ? path : null;
}

function connectorPath(
  spec: FidelityV4FamilySpec,
  surface: SideSurface,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
  points: Array<{ y: number; z: number }>,
) {
  const path = new Path2D();
  let started = false;
  for (const point3d of points) {
    const point = project(sidePoint(spec, surface.sign, point3d.y, point3d.z), width, height, rotation, zoom);
    if (!point) continue;
    if (!started) {
      path.moveTo(point.x, point.y);
      started = true;
    } else {
      path.lineTo(point.x, point.y);
    }
  }
  return started ? path : null;
}

function drawRows(
  context: CanvasRenderingContext2D,
  spec: FidelityV4FamilySpec,
  surface: SideSurface,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
  unit: number,
  strength: number,
) {
  const rows = Math.max(10, Math.round(spec.ry * 17));
  const step = (surface.yMax - surface.yMin) / rows;
  for (let row = 0; row <= rows; row += 1) {
    const y = surface.yMin + row * step;
    const path = cordRow(spec, surface, width, height, rotation, zoom, y, row);
    if (path) raisedStroke(context, path, Math.max(0.95, 2.85 * unit), unit, strength);
  }
  return { rows, step };
}

function drawClassic(
  context: CanvasRenderingContext2D,
  spec: FidelityV4FamilySpec,
  surface: SideSurface,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
  unit: number,
  strength: number,
  rows: number,
  step: number,
) {
  for (let row = 0; row < rows; row += 2) {
    const y0 = surface.yMin + row * step;
    const y1 = Math.min(surface.yMax, y0 + step);
    const centerZ = surface.rearZ + (surface.frontZ - surface.rearZ) * (0.30 + ((row * 7) % 5) * 0.10);
    const spread = spec.depth * 0.12;
    const path = connectorPath(spec, surface, width, height, rotation, zoom, [
      { y: y0, z: centerZ - spread },
      { y: (y0 + y1) * 0.5, z: centerZ },
      { y: y1, z: centerZ + spread },
    ]);
    if (path) raisedStroke(context, path, Math.max(0.72, 1.55 * unit), unit * 0.72, strength * 0.82);
  }
}

function drawHerringbone(
  context: CanvasRenderingContext2D,
  spec: FidelityV4FamilySpec,
  surface: SideSurface,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
  unit: number,
  strength: number,
  rows: number,
  step: number,
) {
  for (let row = 0; row < rows; row += 1) {
    const y0 = surface.yMin + row * step;
    const y1 = Math.min(surface.yMax, y0 + step * 0.92);
    const from = row % 2 === 0 ? 0.24 : 0.76;
    const to = 1 - from;
    const path = connectorPath(spec, surface, width, height, rotation, zoom, [
      { y: y0, z: surface.rearZ + (surface.frontZ - surface.rearZ) * from },
      { y: y1, z: surface.rearZ + (surface.frontZ - surface.rearZ) * to },
    ]);
    if (path) raisedStroke(context, path, Math.max(0.70, 1.42 * unit), unit * 0.66, strength * 0.78);
  }
}

function drawBasket(
  context: CanvasRenderingContext2D,
  spec: FidelityV4FamilySpec,
  surface: SideSurface,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
  unit: number,
  strength: number,
  rows: number,
  step: number,
) {
  // Basket stitch must read as interlaced cord bundles, not a continuous plaid grid.
  // The horizontal rows remain the wrapping cords; only alternating short vertical
  // bundles are raised above them at each crossing, producing a real over/under rhythm.
  const fractions = [0.32, 0.68];
  for (let row = 0; row < rows; row += 1) {
    const y0 = surface.yMin + row * step - step * 0.08;
    const y1 = Math.min(surface.yMax, y0 + step * 1.16);
    for (let column = 0; column < fractions.length; column += 1) {
      if ((row + column) % 2 !== 0) continue;
      const fraction = fractions[column];
      const centerZ = surface.rearZ + (surface.frontZ - surface.rearZ) * fraction;
      const bow = spec.depth * (row % 2 === 0 ? 0.018 : -0.018);
      const path = connectorPath(spec, surface, width, height, rotation, zoom, [
        { y: y0, z: centerZ - bow },
        { y: (y0 + y1) * 0.5, z: centerZ + bow },
        { y: y1, z: centerZ - bow },
      ]);
      if (path) raisedStroke(context, path, Math.max(0.90, 2.12 * unit), unit * 0.78, strength * 0.90);
    }
  }
}

function drawShell(
  context: CanvasRenderingContext2D,
  spec: FidelityV4FamilySpec,
  surface: SideSurface,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
  unit: number,
  strength: number,
  rows: number,
  step: number,
) {
  for (let row = 0; row < rows; row += 2) {
    const y = surface.yMin + row * step;
    for (const fraction of [0.30, 0.62]) {
      const z = surface.rearZ + (surface.frontZ - surface.rearZ) * fraction;
      const spread = spec.depth * 0.10;
      const p0 = project(sidePoint(spec, surface.sign, y, z - spread), width, height, rotation, zoom);
      const pc = project(sidePoint(spec, surface.sign, y + step * 0.72, z), width, height, rotation, zoom);
      const p1 = project(sidePoint(spec, surface.sign, y, z + spread), width, height, rotation, zoom);
      if (!p0 || !pc || !p1) continue;
      const path = new Path2D();
      path.moveTo(p0.x, p0.y);
      path.quadraticCurveTo(pc.x, pc.y, p1.x, p1.y);
      path.moveTo(pc.x, pc.y);
      const stem = project(sidePoint(spec, surface.sign, y + step * 1.06, z), width, height, rotation, zoom);
      if (stem) path.lineTo(stem.x, stem.y);
      raisedStroke(context, path, Math.max(0.72, 1.58 * unit), unit * 0.68, strength * 0.82);
    }
  }
}

function paint(
  output: HTMLCanvasElement,
  source: HTMLCanvasElement,
  family: Exclude<Family, "">,
  stitch: Stitch,
  rotation: Rotation,
  zoom: number,
) {
  const width = source.width;
  const height = source.height;
  if (width < 16 || height < 16) return false;
  if (output.width !== width) output.width = width;
  if (output.height !== height) output.height = height;

  const context = output.getContext("2d", { alpha: true });
  if (!context) return false;
  context.clearRect(0, 0, width, height);
  context.lineCap = "round";
  context.lineJoin = "round";

  const surface = projectedSideSurface(family, width, height, rotation, zoom);
  if (!surface) return false;
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const unit = Math.max(0.70, Math.min(2.35, Math.min(width, height) / 720));
  const normalizedVisibility = Math.min(1, Math.max(0, (surface.visibility - MIN_SIDE_VISIBILITY) / (1 - MIN_SIDE_VISIBILITY)));
  const strength = 0.36 + normalizedVisibility * 0.64;

  // All relief is clipped to the exact projected extrusion side wall. It changes light response only;
  // the Fidelity V4 body silhouette, depth, taper and accessory anchors remain untouched.
  context.save();
  context.clip(surface.path);
  context.globalAlpha = 0.34 + normalizedVisibility * 0.62;

  const { rows, step } = drawRows(context, spec, surface, width, height, rotation, zoom, unit, strength);
  if (stitch === "basket") {
    drawBasket(context, spec, surface, width, height, rotation, zoom, unit, strength, rows, step);
  } else if (stitch === "herringbone") {
    drawHerringbone(context, spec, surface, width, height, rotation, zoom, unit, strength, rows, step);
  } else if (stitch === "shell") {
    drawShell(context, spec, surface, width, height, rotation, zoom, unit, strength, rows, step);
  } else {
    drawClassic(context, spec, surface, width, height, rotation, zoom, unit, strength, rows, step);
  }

  context.restore();
  return true;
}

export default function BagBuilderSidewallCrochetDepth() {
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef<Rotation>(DEFAULT_ROTATION);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const frameRef = useRef<number | null>(null);

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
    const source = layer.querySelector<HTMLCanvasElement>(SOURCE_SELECTOR);
    const output = canvasRef.current;
    if (!stage || !source || !output) return;

    const clear = () => {
      output.getContext("2d")?.clearRect(0, 0, output.width, output.height);
      stage.removeAttribute("data-abags-sidewall-depth");
    };

    const paintFrame = () => {
      frameRef.current = null;
      const family = (stage.dataset.family || "") as Family;
      const stitch = (stage.dataset.stitch || "classic") as Stitch;
      if (
        stage.dataset.abagsFinal3d !== "ready" ||
        stage.dataset.abagsPhotoTrue === "active" ||
        !family ||
        Math.abs(Math.sin(rotationRef.current.y)) < MIN_SIDE_VISIBILITY
      ) {
        clear();
        return;
      }

      if (paint(output, source, family as Exclude<Family, "">, stitch, rotationRef.current, zoomRef.current)) {
        stage.dataset.abagsSidewallDepth = SIDE_VERSION;
      }
    };

    const schedule = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(paintFrame);
    };

    const syncTransform = () => {
      const x = Number(stage.dataset.abagsFidelity3dRotationX);
      const y = Number(stage.dataset.abagsFidelity3dRotationY);
      const zoom = Number(stage.dataset.abagsFidelity3dZoom);
      if (Number.isFinite(x) && Number.isFinite(y)) rotationRef.current = { x, y };
      if (Number.isFinite(zoom) && zoom > 0) zoomRef.current = zoom;
    };

    const onTransform = (event: Event) => {
      const detail = (event as CustomEvent<TransformDetail>).detail;
      if (detail?.rotation) rotationRef.current = detail.rotation;
      if (typeof detail?.zoom === "number" && detail.zoom > 0) zoomRef.current = detail.zoom;
      schedule();
    };

    syncTransform();
    const observer = new MutationObserver(() => {
      syncTransform();
      schedule();
    });
    observer.observe(stage, {
      attributes: true,
      attributeFilter: [
        "data-family", "data-stitch", "data-abags-final3d", "data-abags-photo-true", "data-abags-fidelity3d-frame-at",
        "data-abags-fidelity3d-rotation-x", "data-abags-fidelity3d-rotation-y", "data-abags-fidelity3d-zoom",
      ],
    });

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
      stage.removeAttribute("data-abags-sidewall-depth");
    };
  }, [layer]);

  if (!layer) return null;
  return createPortal(<canvas
    ref={canvasRef}
    className="abags-sidewall-crochet-depth"
    data-sidewall-crochet-version={SIDE_VERSION}
    aria-hidden="true"
  />, layer);
}
