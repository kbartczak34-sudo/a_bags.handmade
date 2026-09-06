"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS, type FidelityV4FamilySpec } from "../lib/abags-fidelity-v4-family-spec";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Rotation = { x: number; y: number };
type TransformDetail = { rotation?: Rotation; zoom?: number };
type Point3 = [number, number, number];
type Point2 = { x: number; y: number };

const STAGE_SELECTOR = ".abags-bag-builder-stage";
const LAYER_SELECTOR = ".abags-fidelity3d-layer";
const SOURCE_SELECTOR = ".abags-fidelity3d-canvas";
const DEFAULT_ROTATION: Rotation = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const OPENING_VERSION = "calibrated-opening-depth-v1-inside-only";

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

function contour3d(family: Exclude<Family, "">): Point3[] {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const count = family === "round" ? 72 : 76;
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const exponent = 2 / spec.power;
    const y = Math.sign(s) * spec.ry * Math.pow(Math.abs(s), exponent);
    const baseX = Math.sign(c) * spec.rx * Math.pow(Math.abs(c), exponent);
    const widthScale = 1 + spec.taper * (y / spec.ry);
    return [baseX * widthScale, y, spec.depth / 2 + 0.026] as Point3;
  });
}

function projectedBodyPath(
  family: Exclude<Family, "">,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
) {
  const points = contour3d(family)
    .map((point) => project(point, width, height, rotation, zoom))
    .filter((point): point is Point2 => Boolean(point));
  if (points.length < 12) return null;

  const path = new Path2D();
  path.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) path.lineTo(points[index].x, points[index].y);
  path.closePath();
  return path;
}

function halfWidthAtY(spec: FidelityV4FamilySpec, y: number) {
  const relativeY = Math.min(0.995, Math.abs(y / spec.ry));
  const ellipseWidth = spec.rx * Math.pow(Math.max(0.0001, 1 - Math.pow(relativeY, spec.power)), 1 / spec.power);
  return ellipseWidth * (1 + spec.taper * (y / spec.ry));
}

function openingGeometry(
  family: Exclude<Family, "">,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const openingY = spec.ry * (family === "round" ? 0.82 : 0.84);
  const halfWidth = halfWidthAtY(spec, openingY) * 0.90;
  const sag = spec.ry * (family === "round" ? 0.030 : 0.036);
  const frontZ = spec.depth / 2 + 0.030;
  const rearZ = -spec.depth / 2 + 0.012;
  const count = 34;
  const front: Point2[] = [];
  const rear: Point2[] = [];

  for (let index = 0; index <= count; index += 1) {
    const t = -1 + (index / count) * 2;
    const bow = 1 - t * t;
    const x = halfWidth * t;
    const frontPoint = project([x, openingY - sag * bow, frontZ], width, height, rotation, zoom);
    const rearPoint = project([x, openingY + sag * 0.24 * bow, rearZ], width, height, rotation, zoom);
    if (frontPoint && rearPoint) {
      front.push(frontPoint);
      rear.push(rearPoint);
    }
  }
  if (front.length < 12 || rear.length !== front.length) return null;

  const path = new Path2D();
  path.moveTo(front[0].x, front[0].y);
  for (let index = 1; index < front.length; index += 1) path.lineTo(front[index].x, front[index].y);
  for (let index = rear.length - 1; index >= 0; index -= 1) path.lineTo(rear[index].x, rear[index].y);
  path.closePath();

  const frontPath = new Path2D();
  frontPath.moveTo(front[0].x, front[0].y);
  for (let index = 1; index < front.length; index += 1) frontPath.lineTo(front[index].x, front[index].y);

  const rearPath = new Path2D();
  rearPath.moveTo(rear[0].x, rear[0].y);
  for (let index = 1; index < rear.length; index += 1) rearPath.lineTo(rear[index].x, rear[index].y);

  const all = [...front, ...rear];
  const bounds = all.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxY: Math.max(acc.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
  return { path, frontPath, rearPath, bounds };
}

function parseHex(value: string) {
  const raw = value.replace("#", "").trim();
  const normalized = raw.length === 3 ? raw.split("").map((char) => char + char).join("") : raw;
  const parsed = Number.parseInt(normalized.padEnd(6, "0").slice(0, 6) || "eadfd7", 16);
  return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 };
}

function mixChannel(source: number, target: number, amount: number) {
  return Math.round(source * (1 - amount) + target * amount);
}

function mixedRgba(color: string, target: [number, number, number], amount: number, alpha: number) {
  const source = parseHex(color || "#eadfd7");
  return `rgba(${mixChannel(source.r, target[0], amount)},${mixChannel(source.g, target[1], amount)},${mixChannel(source.b, target[2], amount)},${alpha})`;
}

function paint(
  output: HTMLCanvasElement,
  source: HTMLCanvasElement,
  family: Exclude<Family, "">,
  color: string,
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

  const bodyPath = projectedBodyPath(family, width, height, rotation, zoom);
  const opening = openingGeometry(family, width, height, rotation, zoom);
  if (!bodyPath || !opening) return false;

  const unit = Math.max(0.72, Math.min(2.4, Math.min(width, height) / 720));
  const yawStrength = Math.abs(Math.sin(rotation.y));
  const depthStrength = Math.min(1, 0.72 + yawStrength * 0.20 + Math.max(0, -rotation.x) * 0.24);
  const gradient = context.createLinearGradient(0, opening.bounds.minY, 0, Math.max(opening.bounds.minY + 1, opening.bounds.maxY));
  gradient.addColorStop(0, `rgba(19,12,16,${0.68 * depthStrength})`);
  gradient.addColorStop(0.52, `rgba(31,19,24,${0.76 * depthStrength})`);
  gradient.addColorStop(1, `rgba(13,9,12,${0.88 * depthStrength})`);

  // The entire mouth treatment is clipped to the calibrated Fidelity V4 front silhouette.
  // It creates only apparent interior depth and can never enlarge or reshape the real product outline.
  context.save();
  context.clip(bodyPath);

  context.save();
  context.shadowColor = `rgba(16,10,13,${0.34 * depthStrength})`;
  context.shadowBlur = 5.4 * unit;
  context.fillStyle = gradient;
  context.fill(opening.path);
  context.restore();

  context.save();
  context.strokeStyle = mixedRgba(color, [18, 12, 15], 0.70, 0.48 * depthStrength);
  context.lineWidth = Math.max(1.2, 2.45 * unit);
  context.shadowColor = `rgba(12,8,10,${0.30 * depthStrength})`;
  context.shadowBlur = 2.6 * unit;
  context.stroke(opening.rearPath);
  context.restore();

  context.save();
  context.translate(0, 1.15 * unit);
  context.strokeStyle = `rgba(19,12,15,${0.38 * depthStrength})`;
  context.lineWidth = Math.max(1.5, 3.25 * unit);
  context.stroke(opening.frontPath);
  context.restore();

  context.strokeStyle = mixedRgba(color, [255, 255, 255], 0.46, 0.34);
  context.lineWidth = Math.max(0.8, 1.22 * unit);
  context.stroke(opening.frontPath);

  context.restore();
  return true;
}

export default function BagBuilderOpeningDepth() {
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
      stage.removeAttribute("data-abags-opening-depth");
    };

    const paintFrame = () => {
      frameRef.current = null;
      const family = (stage.dataset.family || "") as Family;
      if (
        stage.dataset.abagsFinal3d !== "ready" ||
        stage.dataset.abagsPhotoTrue === "active" ||
        !family
      ) {
        clear();
        return;
      }

      if (paint(
        output,
        source,
        family as Exclude<Family, "">,
        stage.dataset.color || "#eadfd7",
        rotationRef.current,
        zoomRef.current,
      )) {
        stage.dataset.abagsOpeningDepth = OPENING_VERSION;
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
        "data-family", "data-color", "data-flap", "data-abags-final3d", "data-abags-photo-true",
        "data-abags-fidelity3d-frame-at", "data-abags-fidelity3d-rotation-x", "data-abags-fidelity3d-rotation-y",
        "data-abags-fidelity3d-zoom",
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
      stage.removeAttribute("data-abags-opening-depth");
    };
  }, [layer]);

  if (!layer) return null;
  return createPortal(<canvas
    ref={canvasRef}
    className="abags-opening-depth-surface"
    data-opening-depth-version={OPENING_VERSION}
    aria-hidden="true"
  />, layer);
}
