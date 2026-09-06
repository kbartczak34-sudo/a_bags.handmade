"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS } from "../lib/abags-fidelity-v4-family-spec";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Rotation = { x: number; y: number };
type TransformDetail = { rotation?: Rotation; zoom?: number };
type Point3 = [number, number, number];
type Point2 = { x: number; y: number; scale: number };
type Bounds = { left: number; right: number; top: number; bottom: number };

const STAGE_SELECTOR = ".abags-bag-builder-stage";
const DEFAULT_ROTATION: Rotation = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const DENSITY_VERSION = "crochet-flap-density-v1-solid-cord";

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
    x: (((x * f / aspect) / -z) * 0.5 + 0.5) * width,
    y: (0.5 - ((y * f) / -z) * 0.5) * height,
    scale: Math.max(0.25, Math.min(2.2, (f / -z) * rootScale)),
  };
}

function projectedFlap(
  family: Exclude<Family, "">,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const centerY = spec.flapY ?? 0.29;
  const rx = 0.80 * spec.flapScale[0];
  const ry = 0.36 * spec.flapScale[1];
  const z = spec.depth / 2 + 0.145;
  const points = Array.from({ length: 60 }, (_, index) => {
    const angle = (index / 60) * Math.PI * 2;
    return project([rx * Math.cos(angle), centerY + ry * Math.sin(angle), z], width, height, rotation, zoom);
  }).filter((point): point is Point2 => Boolean(point));

  if (points.length < 8) return null;
  const path = new Path2D();
  path.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) path.lineTo(points[index].x, points[index].y);
  path.closePath();

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const bounds: Bounds = {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
  return { path, bounds };
}

function parseColor(value: string) {
  const raw = value.replace("#", "").trim();
  const normalized = raw.length === 3 ? raw.split("").map((part) => part + part).join("") : raw;
  const numeric = Number.parseInt(normalized.padEnd(6, "0").slice(0, 6) || "eadfd7", 16);
  return { r: (numeric >> 16) & 255, g: (numeric >> 8) & 255, b: numeric & 255 };
}

function mix(source: number, target: number, amount: number) {
  return Math.round(source * (1 - amount) + target * amount);
}

function rgba(color: string, target: [number, number, number], amount: number, alpha: number) {
  const source = parseColor(color || "#eadfd7");
  return `rgba(${mix(source.r, target[0], amount)},${mix(source.g, target[1], amount)},${mix(source.b, target[2], amount)},${alpha})`;
}

function paintDensity(
  context: CanvasRenderingContext2D,
  flap: { path: Path2D; bounds: Bounds },
  selectedColor: string,
  unit: number,
  snap: Point2 | null,
) {
  const { left, right, top, bottom } = flap.bounds;
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);

  const mask = new Path2D();
  mask.addPath(flap.path);
  if (snap) {
    const snapHole = new Path2D();
    snapHole.arc(snap.x, snap.y, Math.max(5.2, 6.7 * unit * snap.scale), 0, Math.PI * 2);
    mask.addPath(snapHole);
  }

  context.save();
  context.clip(mask, snap ? "evenodd" : "nonzero");

  // This backing adds optical cord density only. It is deliberately color-linked to the
  // selected polyester cord and never changes the calibrated flap geometry or stitch layout.
  context.fillStyle = rgba(selectedColor, [255, 255, 255], 0.025, 0.78);
  context.fillRect(left - 4 * unit, top - 4 * unit, width + 8 * unit, height + 8 * unit);

  const crown = context.createRadialGradient(
    left + width * 0.30,
    top + height * 0.22,
    0,
    left + width * 0.46,
    top + height * 0.42,
    Math.max(8, width * 0.72),
  );
  crown.addColorStop(0, rgba(selectedColor, [255, 255, 255], 0.34, 0.18));
  crown.addColorStop(0.46, rgba(selectedColor, [255, 255, 255], 0.08, 0.07));
  crown.addColorStop(0.76, rgba(selectedColor, [24, 17, 20], 0.12, 0.055));
  crown.addColorStop(1, rgba(selectedColor, [20, 14, 17], 0.32, 0.14));
  context.fillStyle = crown;
  context.fillRect(left - 4 * unit, top - 4 * unit, width + 8 * unit, height + 8 * unit);

  const lowerDepth = context.createLinearGradient(0, top, 0, bottom);
  lowerDepth.addColorStop(0, "rgba(255,255,255,.035)");
  lowerDepth.addColorStop(0.48, "rgba(255,255,255,0)");
  lowerDepth.addColorStop(0.82, "rgba(36,25,29,.055)");
  lowerDepth.addColorStop(1, "rgba(24,17,20,.14)");
  context.fillStyle = lowerDepth;
  context.fillRect(left - 4 * unit, top - 4 * unit, width + 8 * unit, height + 8 * unit);

  context.restore();

  context.save();
  context.translate(0.5 * unit, 0.7 * unit);
  context.strokeStyle = "rgba(30,21,24,.18)";
  context.lineWidth = Math.max(1.1, 2.4 * unit);
  context.stroke(flap.path);
  context.restore();

  context.save();
  context.translate(-0.32 * unit, -0.38 * unit);
  context.strokeStyle = "rgba(255,255,255,.15)";
  context.lineWidth = Math.max(0.65, 1.0 * unit);
  context.stroke(flap.path);
  context.restore();
}

function prepareCanvas(canvas: HTMLCanvasElement, stage: HTMLElement) {
  const bounds = stage.getBoundingClientRect();
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const dprCap = window.innerWidth <= 620 ? 1.5 : 2;
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  const pixelWidth = Math.max(2, Math.round(width * dpr));
  const pixelHeight = Math.max(2, Math.round(height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return null;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.lineCap = "round";
  context.lineJoin = "round";
  return { context, width, height };
}

export default function BagBuilderCrochetFlapDensity() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef<Rotation>(DEFAULT_ROTATION);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const findStage = () => {
      const next = document.querySelector<HTMLElement>(`.abags-vc-dialog.abags-vc-builder-active ${STAGE_SELECTOR}`);
      setStage((current) => current === next ? current : next);
    };
    findStage();
    const observer = new MutationObserver(findStage);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!stage) return;

    const clear = () => {
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      stage.removeAttribute("data-abags-crochet-flap-density");
    };

    const paintFrame = () => {
      frameRef.current = null;
      const canvas = canvasRef.current;
      const family = (stage.dataset.family || "") as Family;
      if (
        !canvas ||
        !family ||
        stage.dataset.flap !== "crochet" ||
        stage.dataset.abagsFinal3d !== "ready" ||
        stage.dataset.abagsPhotoTrue === "active"
      ) {
        clear();
        return;
      }

      const prepared = prepareCanvas(canvas, stage);
      if (!prepared) return;
      const { context, width, height } = prepared;
      const calibrated = projectedFlap(family as Exclude<Family, "">, width, height, rotationRef.current, zoomRef.current);
      if (!calibrated) {
        clear();
        return;
      }

      const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family as Exclude<Family, "">];
      const snap = project(
        [0, (spec.flapY ?? 0.29) - 0.22, spec.depth / 2 + 0.176],
        width,
        height,
        rotationRef.current,
        zoomRef.current,
      );
      const unit = Math.max(0.78, Math.min(width, height) / 720) * zoomRef.current;
      paintDensity(context, calibrated, stage.dataset.color || "#eadfd7", unit, snap);
      stage.dataset.abagsCrochetFlapDensity = DENSITY_VERSION;
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
        "data-abags-fidelity3d-rotation-x", "data-abags-fidelity3d-rotation-y", "data-abags-fidelity3d-zoom",
      ],
    });

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    resizeObserver?.observe(stage);
    stage.addEventListener("abags:fidelity3d-transform", onTransform as EventListener);
    window.addEventListener("resize", schedule);
    schedule();

    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
      stage.removeEventListener("abags:fidelity3d-transform", onTransform as EventListener);
      window.removeEventListener("resize", schedule);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      stage.removeAttribute("data-abags-crochet-flap-density");
    };
  }, [stage]);

  if (!stage) return null;
  return createPortal(
    <canvas
      ref={canvasRef}
      className="abags-crochet-flap-density"
      data-crochet-flap-density-version={DENSITY_VERSION}
      aria-hidden="true"
    />,
    stage,
  );
}
