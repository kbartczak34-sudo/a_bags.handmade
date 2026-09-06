"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS, type FidelityV4FamilySpec } from "../lib/abags-fidelity-v4-family-spec";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Rotation = { x: number; y: number };
type TransformDetail = { rotation?: Rotation; zoom?: number };
type Point3 = [number, number, number];
type Point2 = { x: number; y: number; scale: number };
type ProjectedLoop = { path: Path2D; left: Point2; crown: Point2; right: Point2 };
type ProjectedBody = { path: Path2D; left: number; right: number; top: number; bottom: number };

const STAGE_SELECTOR = ".abags-bag-builder-stage";
const LAYER_SELECTOR = ".abags-fidelity3d-layer";
const SOURCE_SELECTOR = ".abags-fidelity3d-canvas";
const DEFAULT_ROTATION: Rotation = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const RIM_VERSION = "agata-handmade-top-rim-v2-corner-depth-seated";

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
    scale: Math.max(0.25, Math.min(2.2, (f / -z) * rootScale)),
  };
}

function contourPoint(spec: FidelityV4FamilySpec, angle: number, z: number): Point3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const exponent = 2 / spec.power;
  const y = Math.sign(s) * spec.ry * Math.pow(Math.abs(s), exponent);
  const baseX = Math.sign(c) * spec.rx * Math.pow(Math.abs(c), exponent);
  return [baseX * (1 + spec.taper * (y / spec.ry)), y, z];
}

function projectedBody(
  spec: FidelityV4FamilySpec,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
): ProjectedBody | null {
  const z = spec.depth / 2 + 0.052;
  const points: Point2[] = [];
  for (let index = 0; index < 72; index += 1) {
    const point = project(contourPoint(spec, (index / 72) * Math.PI * 2, z), width, height, rotation, zoom);
    if (point) points.push(point);
  }
  if (points.length < 20) return null;
  const path = new Path2D();
  path.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) path.lineTo(points[index].x, points[index].y);
  path.closePath();
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { path, left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

function rgba(value: string, alpha: number) {
  const normalized = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : "E4A9B5";
  const integer = Number.parseInt(normalized, 16);
  const red = (integer >> 16) & 255;
  const green = (integer >> 8) & 255;
  const blue = integer & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
}

function deterministicJitter(index: number, row: number, salt: number) {
  let value = Math.imul(index + 41, 73856093) ^ Math.imul(row + 17, 19349663) ^ Math.imul(salt + 23, 83492791);
  value ^= value >>> 13;
  value = Math.imul(value, 1274126177);
  value ^= value >>> 16;
  return ((value >>> 0) / 4294967295) * 2 - 1;
}

function loopPath(
  spec: FidelityV4FamilySpec,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
  centerX: number,
  halfSpan: number,
  y: number,
  z: number,
  row: number,
): ProjectedLoop | null {
  const left = project([centerX - halfSpan, y, z], width, height, rotation, zoom);
  const shoulderLeft = project(
    [centerX - halfSpan * 0.42, y + spec.ry * (row === 0 ? 0.035 : 0.026), z + 0.006],
    width,
    height,
    rotation,
    zoom,
  );
  const crown = project(
    [centerX, y + spec.ry * (row === 0 ? 0.055 : 0.042), z + 0.010],
    width,
    height,
    rotation,
    zoom,
  );
  const shoulderRight = project(
    [centerX + halfSpan * 0.42, y + spec.ry * (row === 0 ? 0.035 : 0.026), z + 0.006],
    width,
    height,
    rotation,
    zoom,
  );
  const right = project([centerX + halfSpan, y, z], width, height, rotation, zoom);
  if (!left || !shoulderLeft || !crown || !shoulderRight || !right) return null;

  const path = new Path2D();
  path.moveTo(left.x, left.y);
  path.bezierCurveTo(shoulderLeft.x, shoulderLeft.y, crown.x - 0.6 * crown.scale, crown.y, crown.x, crown.y);
  path.bezierCurveTo(crown.x + 0.6 * crown.scale, crown.y, shoulderRight.x, shoulderRight.y, right.x, right.y);
  return { path, left, crown, right };
}

function crossingPath(
  spec: FidelityV4FamilySpec,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
  centerX: number,
  halfSpan: number,
  y: number,
  z: number,
  direction: number,
) {
  const start = project([centerX - halfSpan * direction, y - spec.ry * 0.020, z - 0.004], width, height, rotation, zoom);
  const middle = project([centerX, y + spec.ry * 0.030, z + 0.012], width, height, rotation, zoom);
  const end = project([centerX + halfSpan * direction, y - spec.ry * 0.020, z - 0.004], width, height, rotation, zoom);
  if (!start || !middle || !end) return null;
  const path = new Path2D();
  path.moveTo(start.x, start.y);
  path.quadraticCurveTo(middle.x, middle.y, end.x, end.y);
  return path;
}

function drawContactPocket(
  context: CanvasRenderingContext2D,
  loop: ProjectedLoop,
  unit: number,
  strength: number,
) {
  const seat = new Path2D();
  seat.moveTo(loop.left.x, loop.left.y + 0.70 * unit);
  seat.quadraticCurveTo(loop.crown.x, loop.crown.y + 2.65 * unit, loop.right.x, loop.right.y + 0.70 * unit);
  context.save();
  context.strokeStyle = `rgba(15,9,12,${0.20 * strength})`;
  context.lineWidth = Math.max(1.0, 2.15 * unit);
  context.shadowColor = `rgba(10,6,8,${0.18 * strength})`;
  context.shadowBlur = 2.2 * unit;
  context.stroke(seat);
  context.restore();
}

function strokeCord(
  context: CanvasRenderingContext2D,
  path: Path2D,
  unit: number,
  selectedColor: string,
  strength: number,
) {
  context.save();
  context.translate(0.78 * unit, 1.04 * unit);
  context.strokeStyle = `rgba(18,12,14,${0.36 * strength})`;
  context.lineWidth = Math.max(1.45, 6.10 * unit);
  context.stroke(path);
  context.restore();

  context.strokeStyle = rgba(selectedColor, 0.98);
  context.lineWidth = Math.max(1.30, 4.92 * unit);
  context.stroke(path);

  context.save();
  context.translate(-0.46 * unit, -0.52 * unit);
  context.strokeStyle = `rgba(255,255,255,${0.25 * strength})`;
  context.lineWidth = Math.max(0.58, 1.02 * unit);
  context.stroke(path);
  context.restore();

  // Fine deterministic filament glint keeps the polyester cord from reading as a flat painted ribbon.
  context.save();
  context.setLineDash([1.15 * unit, 2.35 * unit]);
  context.lineDashOffset = 0.45 * unit;
  context.strokeStyle = `rgba(255,255,255,${0.075 * strength})`;
  context.lineWidth = Math.max(0.38, 0.46 * unit);
  context.stroke(path);
  context.restore();
}

function drawRim(
  context: CanvasRenderingContext2D,
  spec: FidelityV4FamilySpec,
  body: ProjectedBody,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
  selectedColor: string,
) {
  const unit = Math.max(0.72, Math.min(2.0, Math.min(width, height) / 720)) * zoom;
  const z = spec.depth / 2 + 0.070;
  const span = spec.rx * 0.78;
  const count = Math.max(7, Math.round(spec.rx * 8.5));
  const step = (span * 2) / count;
  const half = step * 0.59;
  const yaw = Math.sin(rotation.y);
  const yawStrength = 0.74 + Math.min(0.26, Math.abs(yaw) * 0.26);

  context.save();
  context.clip(body.path);
  context.lineCap = "round";
  context.lineJoin = "round";

  // V2 keeps only a restrained central contact seam. OpeningDepth V2 owns the cavity itself;
  // localized loop-seat shadows below replace the old full-width dark strip.
  const seamLeft = project([-span * 0.72, spec.ry * 0.760, z - 0.020], width, height, rotation, zoom);
  const seamCenter = project([0, spec.ry * 0.752, z - 0.022], width, height, rotation, zoom);
  const seamRight = project([span * 0.72, spec.ry * 0.760, z - 0.020], width, height, rotation, zoom);
  if (seamLeft && seamCenter && seamRight) {
    const seam = new Path2D();
    seam.moveTo(seamLeft.x, seamLeft.y);
    seam.quadraticCurveTo(seamCenter.x, seamCenter.y, seamRight.x, seamRight.y);
    context.strokeStyle = "rgba(19,12,15,.14)";
    context.lineWidth = Math.max(0.85, 1.65 * unit);
    context.stroke(seam);
  }

  for (let row = 0; row < 2; row += 1) {
    const baseY = spec.ry * (row === 0 ? 0.855 : 0.790);
    const baseZ = z + (row === 0 ? 0.012 : 0.0);
    const shift = row === 0 ? step * 0.50 : 0;

    for (let index = -1; index <= count; index += 1) {
      const centerX = -span + index * step + shift;
      if (centerX < -span - half || centerX > span + half) continue;

      const normalizedX = Math.max(-1, Math.min(1, centerX / Math.max(span, 0.001)));
      const edgeTurn = Math.pow(Math.min(1, Math.abs(normalizedX)), 1.65);
      const handmadeY = deterministicJitter(index, row, 31) * spec.ry * 0.0032;
      const handmadeZ = deterministicJitter(index, row, 47) * 0.0032;
      // Receding Z at both ends makes the front rim turn naturally into the sidewall in 3/4 views.
      // Because the canvas remains clipped to body.path, this depth cue cannot alter the outer silhouette.
      const rowY = baseY + handmadeY;
      const rowZ = baseZ - edgeTurn * spec.depth * 0.055 + handmadeZ;
      const nearSideBias = 1 + yaw * normalizedX * 0.075;
      const centerCrown = 1 - edgeTurn * 0.10;
      const strength = yawStrength * nearSideBias * centerCrown * (row === 0 ? 1 : 0.90);

      const loop = loopPath(spec, width, height, rotation, zoom, centerX, half, rowY, rowZ, row);
      if (!loop) continue;
      drawContactPocket(context, loop, unit, strength);
      strokeCord(context, loop.path, unit, selectedColor, strength);

      // Short crossing strand preserves the handmade over/under braid without rebuilding a flat sheet.
      const crossing = crossingPath(
        spec,
        width,
        height,
        rotation,
        zoom,
        centerX,
        half * 0.70,
        rowY - spec.ry * 0.016,
        rowZ + 0.006,
        (index + row) % 2 === 0 ? 1 : -1,
      );
      if (crossing) strokeCord(context, crossing, unit * 0.78, selectedColor, strength * 0.70);
    }
  }

  context.restore();
}

function prepareCanvas(canvas: HTMLCanvasElement, source: HTMLCanvasElement) {
  const width = source.width;
  const height = source.height;
  if (width < 16 || height < 16) return null;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return null;
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

export default function BagBuilderAgataTopRim() {
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef<Rotation>(DEFAULT_ROTATION);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const find = () => {
      const stage = document.querySelector<HTMLElement>(STAGE_SELECTOR);
      const next = stage?.querySelector<HTMLElement>(`:scope > ${LAYER_SELECTOR}`) ?? null;
      setLayer((current) => current === next ? current : next);
    };
    find();
    const observer = new MutationObserver(find);
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
      stage.removeAttribute("data-abags-agata-top-rim");
    };

    const syncTransform = () => {
      const x = Number(stage.dataset.abagsFidelity3dRotationX);
      const y = Number(stage.dataset.abagsFidelity3dRotationY);
      const zoom = Number(stage.dataset.abagsFidelity3dZoom);
      if (Number.isFinite(x) && Number.isFinite(y)) rotationRef.current = { x, y };
      if (Number.isFinite(zoom) && zoom > 0) zoomRef.current = zoom;
    };

    const paintFrame = () => {
      frameRef.current = null;
      if (stage.dataset.abagsPhotoTrue === "active" || stage.dataset.abagsFinal3d !== "ready") {
        clear();
        return;
      }
      const family = (stage.dataset.family || "") as Family;
      if (!family) {
        clear();
        return;
      }
      const prepared = prepareCanvas(output, source);
      if (!prepared) return;
      const { context, width, height } = prepared;
      syncTransform();
      const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family as Exclude<Family, "">];
      const body = projectedBody(spec, width, height, rotationRef.current, zoomRef.current);
      if (!body) {
        clear();
        return;
      }
      drawRim(
        context,
        spec,
        body,
        width,
        height,
        rotationRef.current,
        zoomRef.current,
        stage.dataset.color || "#E4A9B5",
      );
      stage.dataset.abagsAgataTopRim = RIM_VERSION;
    };

    const schedule = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(paintFrame);
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
        "data-family", "data-color", "data-abags-final3d", "data-abags-photo-true", "data-abags-fidelity3d-frame-at",
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
      frameRef.current = null;
      stage.removeAttribute("data-abags-agata-top-rim");
    };
  }, [layer]);

  if (!layer) return null;
  return createPortal(
    <canvas ref={canvasRef} className="abags-agata-top-rim" data-agata-top-rim-version={RIM_VERSION} aria-hidden="true" />,
    layer,
  );
}
