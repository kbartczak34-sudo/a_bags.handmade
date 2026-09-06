"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS } from "../lib/abags-fidelity-v4-family-spec";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Rotation = { x: number; y: number };
type TransformDetail = { rotation?: Rotation; zoom?: number };
type Point3 = [number, number, number];
type Point2 = { x: number; y: number; scale: number };
type HardwarePalette = { shadow: string; mid: string; highlight: string; hot: string };

const DEFAULT_ROTATION: Rotation = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const FINISH_VERSION = "flap-realism-v1-calibrated-surface";

function hardwarePalette(value: string): HardwarePalette {
  if (value === "silver") return {
    shadow: "rgba(54,66,76,.82)",
    mid: "rgba(190,204,214,.96)",
    highlight: "rgba(246,252,255,.96)",
    hot: "rgba(255,255,255,.99)",
  };
  if (value === "black") return {
    shadow: "rgba(0,0,0,.90)",
    mid: "rgba(54,53,58,.97)",
    highlight: "rgba(178,181,189,.72)",
    hot: "rgba(238,239,244,.86)",
  };
  return {
    shadow: "rgba(86,56,14,.82)",
    mid: "rgba(203,158,69,.97)",
    highlight: "rgba(250,222,143,.98)",
    hot: "rgba(255,247,207,.99)",
  };
}

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
  const ndcX = (x * f / aspect) / -z;
  const ndcY = (y * f) / -z;
  return {
    x: (ndcX * 0.5 + 0.5) * width,
    y: (0.5 - ndcY * 0.5) * height,
    scale: Math.max(0.25, Math.min(2.2, (f / -z) * rootScale)),
  };
}

function flapContour(family: Exclude<Family, "">): Point3[] {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const centerY = spec.flapY ?? 0.29;
  const rx = 0.80 * spec.flapScale[0];
  const ry = 0.36 * spec.flapScale[1];
  return Array.from({ length: 56 }, (_, index) => {
    const angle = (index / 56) * Math.PI * 2;
    return [rx * Math.cos(angle), centerY + ry * Math.sin(angle), spec.depth / 2 + 0.145] as Point3;
  });
}

function projectedFlap(
  family: Exclude<Family, "">,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
) {
  const points = flapContour(family)
    .map((point) => project(point, width, height, rotation, zoom))
    .filter((point): point is Point2 => Boolean(point));
  if (points.length < 8) return null;

  const path = new Path2D();
  path.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) path.lineTo(points[index].x, points[index].y);
  path.closePath();

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    path,
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

function drawFlapSurfaceProfile(
  context: CanvasRenderingContext2D,
  path: Path2D,
  bounds: { left: number; right: number; top: number; bottom: number },
  flap: string,
  unit: number,
) {
  const crochet = flap === "crochet";
  const suede = flap === "suede-burgundy";

  // Apparent thickness only: never moves or rescales the calibrated WebGL flap mesh.
  context.save();
  context.translate(1.25 * unit, 1.85 * unit);
  context.strokeStyle = crochet
    ? "rgba(28,20,23,.27)"
    : suede
      ? "rgba(29,10,17,.30)"
      : "rgba(30,17,12,.28)";
  context.lineWidth = Math.max(2.0, (crochet ? 4.4 : 3.8) * unit);
  context.shadowColor = "rgba(22,15,17,.18)";
  context.shadowBlur = 4.4 * unit;
  context.stroke(path);
  context.restore();

  context.save();
  context.clip(path);

  const crown = context.createRadialGradient(
    bounds.left + (bounds.right - bounds.left) * 0.30,
    bounds.top + (bounds.bottom - bounds.top) * 0.20,
    0,
    bounds.left + (bounds.right - bounds.left) * 0.52,
    bounds.top + (bounds.bottom - bounds.top) * 0.46,
    Math.max(10, (bounds.right - bounds.left) * 0.72),
  );
  crown.addColorStop(0, crochet ? "rgba(255,255,255,.22)" : suede ? "rgba(255,238,241,.14)" : "rgba(255,248,239,.20)");
  crown.addColorStop(0.42, "rgba(255,255,255,.045)");
  crown.addColorStop(0.72, "rgba(31,21,24,.025)");
  crown.addColorStop(1, crochet ? "rgba(28,19,23,.17)" : suede ? "rgba(25,8,15,.22)" : "rgba(27,15,11,.19)");
  context.fillStyle = crown;
  context.fillRect(bounds.left - 3, bounds.top - 3, bounds.right - bounds.left + 6, bounds.bottom - bounds.top + 6);

  const lowerEdge = context.createLinearGradient(bounds.left, bounds.top, bounds.left, bounds.bottom);
  lowerEdge.addColorStop(0, "rgba(255,255,255,.045)");
  lowerEdge.addColorStop(0.56, "rgba(255,255,255,0)");
  lowerEdge.addColorStop(0.82, crochet ? "rgba(35,24,28,.055)" : "rgba(30,17,15,.075)");
  lowerEdge.addColorStop(1, crochet ? "rgba(27,18,22,.16)" : suede ? "rgba(24,8,15,.20)" : "rgba(27,14,10,.18)");
  context.fillStyle = lowerEdge;
  context.fillRect(bounds.left - 3, bounds.top - 3, bounds.right - bounds.left + 6, bounds.bottom - bounds.top + 6);

  if (!crochet) {
    const grainStep = (suede ? 5.2 : 8.4) * unit;
    for (let y = bounds.top + grainStep; y < bounds.bottom; y += grainStep) {
      context.beginPath();
      context.moveTo(bounds.left - 4 * unit, y + Math.sin(y * 0.11) * 1.5 * unit);
      context.bezierCurveTo(
        bounds.left + (bounds.right - bounds.left) * 0.35,
        y - 1.1 * unit,
        bounds.left + (bounds.right - bounds.left) * 0.68,
        y + 1.2 * unit,
        bounds.right + 4 * unit,
        y,
      );
      context.strokeStyle = suede ? "rgba(255,240,242,.050)" : "rgba(255,247,239,.070)";
      context.lineWidth = Math.max(0.44, 0.66 * unit);
      context.stroke();
    }
  }
  context.restore();

  context.save();
  context.translate(-0.48 * unit, -0.58 * unit);
  context.strokeStyle = crochet ? "rgba(255,255,255,.22)" : "rgba(255,249,242,.25)";
  context.lineWidth = Math.max(0.7, 1.10 * unit);
  context.stroke(path);
  context.restore();
}

function drawSnapFinish(
  context: CanvasRenderingContext2D,
  family: Exclude<Family, "">,
  hardware: string,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const snap = project([0, (spec.flapY ?? 0.29) - 0.22, spec.depth / 2 + 0.176], width, height, rotation, zoom);
  if (!snap) return;

  const unit = Math.max(0.8, Math.min(width, height) / 720) * zoom * snap.scale;
  const radius = Math.max(2.8, 3.65 * unit);
  const palette = hardwarePalette(hardware);

  context.beginPath();
  context.ellipse(snap.x + 0.9 * unit, snap.y + 1.15 * unit, radius * 1.02, radius * 0.92, 0, 0, Math.PI * 2);
  context.fillStyle = "rgba(19,14,14,.26)";
  context.fill();

  const metal = context.createRadialGradient(
    snap.x - radius * 0.34,
    snap.y - radius * 0.38,
    radius * 0.08,
    snap.x,
    snap.y,
    radius * 1.05,
  );
  metal.addColorStop(0, palette.hot);
  metal.addColorStop(0.22, palette.highlight);
  metal.addColorStop(0.52, palette.mid);
  metal.addColorStop(0.79, palette.shadow);
  metal.addColorStop(1, palette.highlight);
  context.beginPath();
  context.arc(snap.x, snap.y, radius, 0, Math.PI * 2);
  context.fillStyle = metal;
  context.fill();

  context.beginPath();
  context.arc(snap.x + 0.35 * unit, snap.y + 0.42 * unit, radius * 0.58, 0.10 * Math.PI, 1.02 * Math.PI);
  context.strokeStyle = palette.shadow;
  context.lineWidth = Math.max(0.72, 0.92 * unit);
  context.stroke();

  context.beginPath();
  context.arc(snap.x - 0.42 * unit, snap.y - 0.46 * unit, radius * 0.72, 1.08 * Math.PI, 1.72 * Math.PI);
  context.strokeStyle = palette.hot;
  context.lineWidth = Math.max(0.62, 0.78 * unit);
  context.stroke();

  context.beginPath();
  context.arc(snap.x - radius * 0.28, snap.y - radius * 0.30, Math.max(0.62, 0.78 * unit), 0, Math.PI * 2);
  context.fillStyle = palette.hot;
  context.fill();
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
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.lineCap = "round";
  context.lineJoin = "round";
  return { context, width, height };
}

export default function BagBuilderFlapRealism() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef<Rotation>(DEFAULT_ROTATION);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const find = () => {
      const next = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-vc-builder-active .abags-bag-builder-stage");
      setStage((current) => current === next ? current : next);
    };
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!stage) return;

    const clear = () => {
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      stage.removeAttribute("data-abags-flap-realism");
    };

    const paintFrame = () => {
      frameRef.current = null;
      const canvas = canvasRef.current;
      const family = (stage.dataset.family || "") as Family;
      const flap = stage.dataset.flap || "none";
      if (
        !canvas ||
        !family ||
        flap === "none" ||
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
      const unit = Math.max(0.8, Math.min(width, height) / 720) * zoomRef.current;
      drawFlapSurfaceProfile(context, calibrated.path, calibrated, flap, unit);
      drawSnapFinish(
        context,
        family as Exclude<Family, "">,
        stage.dataset.hardware || "gold",
        width,
        height,
        rotationRef.current,
        zoomRef.current,
      );
      stage.dataset.abagsFlapRealism = FINISH_VERSION;
    };

    const schedule = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(paintFrame);
    };

    const syncTransform = () => {
      const x = Number(stage.dataset.abagsFidelity3dRotationX);
      const y = Number(stage.dataset.abagsFidelity3dRotationY);
      const nextZoom = Number(stage.dataset.abagsFidelity3dZoom);
      if (Number.isFinite(x) && Number.isFinite(y)) rotationRef.current = { x, y };
      if (Number.isFinite(nextZoom) && nextZoom > 0) zoomRef.current = nextZoom;
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
        "data-family", "data-flap", "data-hardware", "data-abags-final3d", "data-abags-photo-true",
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
      stage.removeAttribute("data-abags-flap-realism");
    };
  }, [stage]);

  if (!stage) return null;
  return createPortal(<>
    <canvas ref={canvasRef} className="abags-flap-realism" data-flap-realism-version={FINISH_VERSION} aria-hidden="true" />
    <style jsx global>{`
      .abags-bag-builder-stage > .abags-flap-realism {
        position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
        z-index:274!important;pointer-events:none!important;touch-action:none!important;background:transparent!important;
      }
      @media (prefers-reduced-motion:reduce) {
        .abags-bag-builder-stage > .abags-flap-realism { transition:none!important; }
      }
    `}</style>
  </>, stage);
}
