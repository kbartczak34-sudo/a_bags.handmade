"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS } from "../lib/abags-fidelity-v4-family-spec";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Rotation = { x: number; y: number };
type Point3 = [number, number, number];
type Point2 = { x: number; y: number; scale: number };
type TransformDetail = { rotation?: Rotation; zoom?: number };
type Config = { family: Family; handles: string; flap: string };

const DEFAULT_ROTATION: Rotation = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const FINISH_VERSION = "rigid-natural-material-v2-flap-depth";

function readConfig(stage: HTMLElement): Config {
  return {
    family: (stage.dataset.family || "") as Family,
    handles: stage.dataset.handles || "none",
    flap: stage.dataset.flap || "none",
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

function handleArc(family: Exclude<Family, "">, front = true) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const handleZ = (front ? 1 : -1) * (spec.depth / 2 + 0.055);
  return Array.from({ length: 57 }, (_, index) => {
    const progress = index / 56;
    const angle = Math.PI - progress * Math.PI;
    return [
      0.67 * Math.cos(angle) * spec.handleScale[0],
      spec.topY - 0.01 + 0.50 * Math.sin(angle) * spec.handleScale[1],
      handleZ,
    ] as Point3;
  });
}

function flapContour(family: Exclude<Family, "">) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const centerY = spec.flapY ?? 0.29;
  const rx = 0.80 * spec.flapScale[0];
  const ry = 0.36 * spec.flapScale[1];
  return Array.from({ length: 45 }, (_, index) => {
    const angle = (index / 44) * Math.PI * 2;
    return [rx * Math.cos(angle), centerY + ry * Math.sin(angle), spec.depth / 2 + 0.145] as Point3;
  });
}

function projectedPath(points: Point3[], width: number, height: number, rotation: Rotation, zoom: number) {
  const output = new Path2D();
  let started = false;
  const projected: Point2[] = [];
  for (const point of points) {
    const p = project(point, width, height, rotation, zoom);
    if (!p) continue;
    projected.push(p);
    if (!started) {
      output.moveTo(p.x, p.y);
      started = true;
    } else {
      output.lineTo(p.x, p.y);
    }
  }
  return { path: output, projected, started };
}

function drawWoodHandle(
  context: CanvasRenderingContext2D,
  family: Exclude<Family, "">,
  handles: string,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
) {
  const arc = handleArc(family, true);
  const { path, projected, started } = projectedPath(arc, width, height, rotation, zoom);
  if (!started || projected.length < 8) return;
  const unit = Math.max(0.8, Math.min(width, height) / 720) * zoom;
  const dark = handles === "wood-dark";

  context.save();
  context.translate(0.9 * unit, 1.2 * unit);
  context.strokeStyle = dark ? "rgba(32,18,12,.27)" : "rgba(76,52,25,.22)";
  context.lineWidth = Math.max(5.2, 11.2 * unit);
  context.lineCap = "round";
  context.stroke(path);
  context.restore();

  context.strokeStyle = dark ? "rgba(86,52,35,.94)" : "rgba(205,170,110,.76)";
  context.lineWidth = Math.max(4.2, 9.0 * unit);
  context.lineCap = "round";
  context.stroke(path);

  context.save();
  context.translate(-0.55 * unit, -0.72 * unit);
  context.strokeStyle = dark ? "rgba(239,202,164,.22)" : "rgba(255,244,214,.42)";
  context.lineWidth = Math.max(0.8, 1.55 * unit);
  context.stroke(path);
  context.restore();

  for (let index = 2; index < projected.length - 2; index += 3) {
    const point = projected[index];
    const next = projected[index + 1];
    const angle = Math.atan2(next.y - point.y, next.x - point.x);
    const tangentX = Math.cos(angle);
    const tangentY = Math.sin(angle);
    const length = (3.0 + 2.4 * (0.5 + 0.5 * Math.sin(index * 1.73))) * unit * point.scale;
    const offset = Math.sin(index * 2.17) * 1.35 * unit;
    const normalX = -tangentY;
    const normalY = tangentX;
    context.beginPath();
    context.moveTo(point.x - tangentX * length * 0.5 + normalX * offset, point.y - tangentY * length * 0.5 + normalY * offset);
    context.lineTo(point.x + tangentX * length * 0.5 + normalX * offset, point.y + tangentY * length * 0.5 + normalY * offset);
    context.strokeStyle = dark ? "rgba(34,19,13,.23)" : "rgba(111,75,36,.22)";
    context.lineWidth = Math.max(0.5, 0.82 * unit);
    context.stroke();
  }
}

function drawFlapContactDepth(
  context: CanvasRenderingContext2D,
  path: Path2D,
  unit: number,
  crochet: boolean,
  suede: boolean,
) {
  context.save();
  context.translate(1.15 * unit, 1.65 * unit);
  context.strokeStyle = crochet
    ? "rgba(30,22,25,.22)"
    : suede
      ? "rgba(32,11,19,.24)"
      : "rgba(29,18,14,.20)";
  context.lineWidth = Math.max(1.8, (crochet ? 4.0 : 3.4) * unit);
  context.shadowColor = crochet ? "rgba(27,18,22,.16)" : "rgba(20,12,12,.13)";
  context.shadowBlur = 3.6 * unit;
  context.stroke(path);
  context.restore();
}

function drawCrochetFlapCrown(
  context: CanvasRenderingContext2D,
  path: Path2D,
  left: number,
  right: number,
  top: number,
  bottom: number,
  unit: number,
) {
  context.save();
  context.clip(path);

  const crown = context.createRadialGradient(
    left + (right - left) * 0.34,
    top + (bottom - top) * 0.24,
    0,
    left + (right - left) * 0.48,
    top + (bottom - top) * 0.43,
    Math.max(8, (right - left) * 0.72),
  );
  crown.addColorStop(0, "rgba(255,255,255,.17)");
  crown.addColorStop(0.42, "rgba(255,255,255,.055)");
  crown.addColorStop(0.72, "rgba(34,24,28,.035)");
  crown.addColorStop(1, "rgba(28,19,23,.14)");
  context.fillStyle = crown;
  context.fillRect(left - 2, top - 2, right - left + 4, bottom - top + 4);

  const lowerDepth = context.createLinearGradient(left, top, left, bottom);
  lowerDepth.addColorStop(0, "rgba(255,255,255,.035)");
  lowerDepth.addColorStop(0.58, "rgba(255,255,255,0)");
  lowerDepth.addColorStop(1, "rgba(24,17,20,.13)");
  context.fillStyle = lowerDepth;
  context.fillRect(left - 2, top - 2, right - left + 4, bottom - top + 4);
  context.restore();

  context.save();
  context.translate(-0.42 * unit, -0.48 * unit);
  context.strokeStyle = "rgba(255,255,255,.19)";
  context.lineWidth = Math.max(0.62, 1.02 * unit);
  context.stroke(path);
  context.restore();
}

function drawFlapMaterial(
  context: CanvasRenderingContext2D,
  family: Exclude<Family, "">,
  flap: string,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
) {
  if (flap === "none") return;
  const contour = flapContour(family);
  const { path, projected, started } = projectedPath(contour, width, height, rotation, zoom);
  if (!started || projected.length < 8) return;
  path.closePath();
  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const unit = Math.max(0.8, Math.min(width, height) / 720) * zoom;
  const crochet = flap === "crochet";
  const suede = flap === "suede-burgundy";

  // Surface-only contact depth: the calibrated WebGL mesh remains the sole flap geometry.
  drawFlapContactDepth(context, path, unit, crochet, suede);

  if (crochet) {
    // Crochet uses neutral light/occlusion only. The selected cord colour and stitch
    // stay owned by the verified WebGL material, avoiding any recolouring of the bag.
    drawCrochetFlapCrown(context, path, left, right, top, bottom, unit);
    return;
  }

  context.save();
  context.clip(path);

  const gradient = context.createLinearGradient(left, top, right, bottom);
  if (suede) {
    gradient.addColorStop(0, "rgba(255,229,232,.10)");
    gradient.addColorStop(0.48, "rgba(54,20,30,.05)");
    gradient.addColorStop(1, "rgba(27,10,18,.20)");
  } else {
    gradient.addColorStop(0, "rgba(255,247,238,.18)");
    gradient.addColorStop(0.52, "rgba(255,255,255,.03)");
    gradient.addColorStop(1, "rgba(28,15,12,.17)");
  }
  context.fillStyle = gradient;
  context.fillRect(left - 2, top - 2, right - left + 4, bottom - top + 4);

  const step = suede ? 5.5 * unit : 8.5 * unit;
  for (let y = top - step; y < bottom + step; y += step) {
    const wobble = Math.sin((y - top) * 0.13) * 2.2 * unit;
    context.beginPath();
    context.moveTo(left - 8 * unit, y + wobble);
    context.bezierCurveTo(
      left + (right - left) * 0.33,
      y - 1.8 * unit,
      left + (right - left) * 0.66,
      y + 1.6 * unit,
      right + 8 * unit,
      y - wobble * 0.35,
    );
    context.strokeStyle = suede ? "rgba(255,236,239,.055)" : "rgba(255,247,238,.075)";
    context.lineWidth = suede ? Math.max(0.45, 0.7 * unit) : Math.max(0.5, 0.8 * unit);
    context.stroke();
  }

  if (suede) {
    for (let x = left; x < right; x += 7 * unit) {
      context.beginPath();
      context.moveTo(x, top);
      context.lineTo(x + 2.2 * unit, bottom);
      context.strokeStyle = "rgba(34,12,21,.045)";
      context.lineWidth = Math.max(0.45, 0.65 * unit);
      context.stroke();
    }
  } else {
    context.save();
    context.translate(-0.55 * unit, -0.65 * unit);
    context.strokeStyle = "rgba(255,255,255,.24)";
    context.lineWidth = Math.max(0.8, 1.35 * unit);
    context.stroke(path);
    context.restore();
  }

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
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.lineCap = "round";
  context.lineJoin = "round";
  return { context, width, height };
}

function paint(canvas: HTMLCanvasElement, stage: HTMLElement, config: Config, rotation: Rotation, zoom: number) {
  const prepared = prepareCanvas(canvas, stage);
  if (!prepared || !config.family || stage.dataset.abagsFinal3d !== "ready") {
    stage.removeAttribute("data-abags-rigid-material-finish");
    return;
  }
  const { context, width, height } = prepared;
  const family = config.family as Exclude<Family, "">;
  if (config.handles === "wood-light" || config.handles === "wood-dark") {
    drawWoodHandle(context, family, config.handles, width, height, rotation, zoom);
  }
  drawFlapMaterial(context, family, config.flap, width, height, rotation, zoom);
  stage.dataset.abagsRigidMaterialFinish = FINISH_VERSION;
}

export default function BagBuilderRigidMaterialFinish() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
    const config = { current: readConfig(stage) };
    const rotation = { current: { ...DEFAULT_ROTATION } };
    const zoom = { current: DEFAULT_ZOOM };
    let frame = 0;

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        const canvas = canvasRef.current;
        if (canvas) paint(canvas, stage, config.current, rotation.current, zoom.current);
      });
    };

    const syncTransform = () => {
      const x = Number(stage.dataset.abagsFidelity3dRotationX);
      const y = Number(stage.dataset.abagsFidelity3dRotationY);
      const nextZoom = Number(stage.dataset.abagsFidelity3dZoom);
      if (Number.isFinite(x) && Number.isFinite(y)) rotation.current = { x, y };
      if (Number.isFinite(nextZoom) && nextZoom > 0) zoom.current = nextZoom;
    };

    const onTransform = (event: Event) => {
      const detail = (event as CustomEvent<TransformDetail>).detail;
      if (detail?.rotation) rotation.current = detail.rotation;
      if (typeof detail?.zoom === "number" && detail.zoom > 0) zoom.current = detail.zoom;
      schedule();
    };

    syncTransform();
    const observer = new MutationObserver(() => {
      config.current = readConfig(stage);
      syncTransform();
      schedule();
    });
    observer.observe(stage, {
      attributes: true,
      attributeFilter: [
        "data-family", "data-handles", "data-flap", "data-abags-final3d",
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
      if (frame) cancelAnimationFrame(frame);
      stage.removeAttribute("data-abags-rigid-material-finish");
    };
  }, [stage]);

  if (!stage) return null;
  return createPortal(<>
    <canvas ref={canvasRef} className="abags-rigid-material-finish" aria-hidden="true" />
    <style jsx global>{`
      .abags-bag-builder-stage > .abags-rigid-material-finish {
        position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
        z-index:273!important;pointer-events:none!important;touch-action:none!important;background:transparent!important;
      }
    `}</style>
  </>, stage);
}
