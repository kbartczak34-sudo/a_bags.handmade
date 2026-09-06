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
const OPENING_VERSION = "calibrated-opening-depth-v2-deep-mouth-rim-aware";

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
  // The mouth sits deliberately below AgataTopRim's lower handmade row (0.790 * ry).
  // This prevents the rim from visually sealing the cavity while keeping the exterior silhouette untouched.
  const openingY = spec.ry * (family === "round" ? 0.765 : 0.755);
  const halfWidth = halfWidthAtY(spec, openingY) * 0.92;
  const frontSag = spec.ry * (family === "round" ? 0.052 : 0.060);
  const rearRise = spec.ry * (family === "round" ? 0.035 : 0.042);
  const deepDrop = spec.ry * (family === "round" ? 0.078 : 0.090);
  const frontZ = spec.depth / 2 + 0.020;
  const rearZ = -spec.depth / 2 + 0.018;
  const deepZ = -spec.depth * 0.16;
  const count = 38;
  const front: Point2[] = [];
  const rear: Point2[] = [];
  const deep: Point2[] = [];

  for (let index = 0; index <= count; index += 1) {
    const t = -1 + (index / count) * 2;
    const bow = 1 - t * t;
    const x = halfWidth * t;
    const frontPoint = project([x, openingY - frontSag * bow, frontZ], width, height, rotation, zoom);
    const rearPoint = project([x, openingY + rearRise * bow, rearZ], width, height, rotation, zoom);
    const deepPoint = project(
      [x * 0.91, openingY - deepDrop * (0.38 + 0.62 * bow), deepZ],
      width,
      height,
      rotation,
      zoom,
    );
    if (frontPoint && rearPoint && deepPoint) {
      front.push(frontPoint);
      rear.push(rearPoint);
      deep.push(deepPoint);
    }
  }
  if (front.length < 12 || rear.length !== front.length || deep.length !== front.length) return null;

  const path = new Path2D();
  path.moveTo(front[0].x, front[0].y);
  for (let index = 1; index < front.length; index += 1) path.lineTo(front[index].x, front[index].y);
  for (let index = rear.length - 1; index >= 0; index -= 1) path.lineTo(rear[index].x, rear[index].y);
  path.closePath();

  const corePath = new Path2D();
  corePath.moveTo(rear[0].x, rear[0].y);
  for (let index = 1; index < rear.length; index += 1) corePath.lineTo(rear[index].x, rear[index].y);
  for (let index = deep.length - 1; index >= 0; index -= 1) corePath.lineTo(deep[index].x, deep[index].y);
  corePath.closePath();

  const frontPath = new Path2D();
  frontPath.moveTo(front[0].x, front[0].y);
  for (let index = 1; index < front.length; index += 1) frontPath.lineTo(front[index].x, front[index].y);

  const rearPath = new Path2D();
  rearPath.moveTo(rear[0].x, rear[0].y);
  for (let index = 1; index < rear.length; index += 1) rearPath.lineTo(rear[index].x, rear[index].y);

  const deepPath = new Path2D();
  deepPath.moveTo(deep[0].x, deep[0].y);
  for (let index = 1; index < deep.length; index += 1) deepPath.lineTo(deep[index].x, deep[index].y);

  const all = [...front, ...rear, ...deep];
  const bounds = all.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxY: Math.max(acc.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
  return { path, corePath, frontPath, rearPath, deepPath, bounds };
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
  const yaw = Math.sin(rotation.y);
  const yawStrength = Math.abs(yaw);
  const tiltStrength = Math.max(0, -rotation.x);
  const depthStrength = Math.min(1, 0.80 + yawStrength * 0.15 + tiltStrength * 0.22);
  const gradient = context.createLinearGradient(0, opening.bounds.minY, 0, Math.max(opening.bounds.minY + 1, opening.bounds.maxY));
  gradient.addColorStop(0, `rgba(18,11,15,${0.72 * depthStrength})`);
  gradient.addColorStop(0.46, `rgba(27,17,22,${0.84 * depthStrength})`);
  gradient.addColorStop(1, `rgba(10,7,10,${0.93 * depthStrength})`);

  // Every V2 interior pixel is clipped to the calibrated Fidelity V4 front silhouette.
  // Apparent cavity depth may change with view, but it can never enlarge or reshape the real product outline.
  context.save();
  context.clip(bodyPath);

  context.save();
  context.shadowColor = `rgba(12,7,10,${0.40 * depthStrength})`;
  context.shadowBlur = 6.2 * unit;
  context.fillStyle = gradient;
  context.fill(opening.path);
  context.restore();

  // A second recessed plane makes the bag read as hollow rather than as a dark stripe painted on the front panel.
  const coreGradient = context.createLinearGradient(0, opening.bounds.minY, 0, opening.bounds.maxY);
  coreGradient.addColorStop(0, `rgba(14,8,11,${0.32 * depthStrength})`);
  coreGradient.addColorStop(0.56, `rgba(8,5,7,${0.70 * depthStrength})`);
  coreGradient.addColorStop(1, `rgba(5,3,5,${0.82 * depthStrength})`);
  context.fillStyle = coreGradient;
  context.fill(opening.corePath);

  // Side-biased occlusion follows yaw, strengthening the far interior wall in 3/4 views.
  const sideShade = context.createLinearGradient(opening.bounds.minX, 0, opening.bounds.maxX, 0);
  if (yaw >= 0) {
    sideShade.addColorStop(0, `rgba(8,5,7,${0.28 * yawStrength})`);
    sideShade.addColorStop(0.62, "rgba(8,5,7,0)");
    sideShade.addColorStop(1, `rgba(255,255,255,${0.025 * yawStrength})`);
  } else {
    sideShade.addColorStop(0, `rgba(255,255,255,${0.025 * yawStrength})`);
    sideShade.addColorStop(0.38, "rgba(8,5,7,0)");
    sideShade.addColorStop(1, `rgba(8,5,7,${0.28 * yawStrength})`);
  }
  context.fillStyle = sideShade;
  context.fill(opening.path);

  context.save();
  context.strokeStyle = mixedRgba(color, [16, 10, 13], 0.74, 0.56 * depthStrength);
  context.lineWidth = Math.max(1.25, 2.65 * unit);
  context.shadowColor = `rgba(9,5,7,${0.36 * depthStrength})`;
  context.shadowBlur = 3.0 * unit;
  context.stroke(opening.rearPath);
  context.restore();

  context.save();
  context.strokeStyle = `rgba(6,4,6,${0.36 * depthStrength})`;
  context.lineWidth = Math.max(1.15, 2.15 * unit);
  context.stroke(opening.deepPath);
  context.restore();

  context.save();
  context.translate(0, 1.35 * unit);
  context.strokeStyle = `rgba(15,9,12,${0.52 * depthStrength})`;
  context.lineWidth = Math.max(1.55, 3.55 * unit);
  context.shadowColor = `rgba(10,6,8,${0.22 * depthStrength})`;
  context.shadowBlur = 2.0 * unit;
  context.stroke(opening.frontPath);
  context.restore();

  context.strokeStyle = mixedRgba(color, [255, 255, 255], 0.44, 0.40);
  context.lineWidth = Math.max(0.82, 1.28 * unit);
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
