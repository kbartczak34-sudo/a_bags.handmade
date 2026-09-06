"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS } from "../lib/abags-fidelity-v4-family-spec";

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
const EDGE_VERSION = "handmade-body-edge-v1-inside-only";

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
    return [baseX * widthScale, y, spec.depth / 2 + 0.024] as Point3;
  });
}

function projectedContour(
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

  const center = points.reduce((acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }), { x: 0, y: 0 });
  return { path, points, center };
}

function drawDirectionalEdge(
  context: CanvasRenderingContext2D,
  points: Point2[],
  center: Point2,
  unit: number,
) {
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const midX = (current.x + next.x) * 0.5;
    const midY = (current.y + next.y) * 0.5;
    const lightSide = midY < center.y - 2 * unit || midX < center.x - 6 * unit;

    const segment = new Path2D();
    segment.moveTo(current.x, current.y);
    segment.lineTo(next.x, next.y);
    context.strokeStyle = lightSide ? "rgba(255,255,255,.16)" : "rgba(28,19,22,.15)";
    context.lineWidth = Math.max(0.72, (lightSide ? 1.15 : 1.65) * unit);
    context.stroke(segment);
  }
}

function drawCompressionMarks(
  context: CanvasRenderingContext2D,
  points: Point2[],
  center: Point2,
  unit: number,
) {
  for (let index = 1; index < points.length; index += 4) {
    const point = points[index];
    const dx = center.x - point.x;
    const dy = center.y - point.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = dx / length;
    const ny = dy / length;
    const inset = (2.1 + ((index * 13) % 5) * 0.22) * unit;

    context.beginPath();
    context.moveTo(point.x + nx * 0.55 * unit, point.y + ny * 0.55 * unit);
    context.lineTo(point.x + nx * inset, point.y + ny * inset);
    context.strokeStyle = "rgba(27,18,21,.085)";
    context.lineWidth = Math.max(0.46, 0.62 * unit);
    context.stroke();
  }
}

function paint(
  output: HTMLCanvasElement,
  source: HTMLCanvasElement,
  family: Exclude<Family, "">,
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

  const contour = projectedContour(family, width, height, rotation, zoom);
  if (!contour) return false;
  const unit = Math.max(0.72, Math.min(2.5, Math.min(width, height) / 720));

  // Every stroke is clipped inside the calibrated body contour. The visible silhouette
  // therefore remains byte-for-byte governed by the Fidelity V4 geometry.
  context.save();
  context.clip(contour.path);

  context.save();
  context.translate(1.05 * unit, 1.35 * unit);
  context.strokeStyle = "rgba(24,17,20,.18)";
  context.lineWidth = Math.max(2.4, 5.8 * unit);
  context.shadowColor = "rgba(22,15,18,.10)";
  context.shadowBlur = 2.8 * unit;
  context.stroke(contour.path);
  context.restore();

  drawDirectionalEdge(context, contour.points, contour.center, unit);
  drawCompressionMarks(context, contour.points, contour.center, unit);
  context.restore();
  return true;
}

export default function BagBuilderHandmadeEdgeFinish() {
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
      stage.removeAttribute("data-abags-handmade-edge");
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
      if (paint(output, source, family as Exclude<Family, "">, rotationRef.current, zoomRef.current)) {
        stage.dataset.abagsHandmadeEdge = EDGE_VERSION;
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
        "data-family", "data-abags-final3d", "data-abags-photo-true", "data-abags-fidelity3d-frame-at",
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
      stage.removeAttribute("data-abags-handmade-edge");
    };
  }, [layer]);

  if (!layer) return null;
  return createPortal(<canvas
    ref={canvasRef}
    className="abags-handmade-edge-surface"
    data-handmade-edge-version={EDGE_VERSION}
    aria-hidden="true"
  />, layer);
}
