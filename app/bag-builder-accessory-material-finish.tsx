"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_ACCESSORY_VISUAL } from "../lib/abags-accessory-fidelity";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS } from "../lib/abags-fidelity-v4-family-spec";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Rotation = { x: number; y: number };
type TransformDetail = { rotation?: Rotation; zoom?: number };
type Point3 = [number, number, number];
type Point2 = { x: number; y: number; scale: number };
type Config = { family: Family; strap: string; hardware: string; flap: string };

type HardwarePalette = { shadow: string; mid: string; highlight: string };

const DEFAULT_ROTATION: Rotation = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const FINISH_VERSION = "accessory-material-finish-v1";

function readConfig(stage: HTMLElement): Config {
  return {
    family: (stage.dataset.family || "") as Family,
    strap: stage.dataset.strap || "none",
    hardware: stage.dataset.hardware || "gold",
    flap: stage.dataset.flap || "none",
  };
}

function hardwarePalette(value: string): HardwarePalette {
  if (value === "silver") return {
    shadow: "rgba(68,79,88,.55)",
    mid: "rgba(191,204,214,.72)",
    highlight: "rgba(255,255,255,.92)",
  };
  if (value === "black") return {
    shadow: "rgba(0,0,0,.72)",
    mid: "rgba(67,65,70,.78)",
    highlight: "rgba(224,224,230,.48)",
  };
  return {
    shadow: "rgba(91,62,20,.54)",
    mid: "rgba(204,163,84,.76)",
    highlight: "rgba(255,241,190,.92)",
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

function strapArc(family: Exclude<Family, "">) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const archHeight = Math.max(0.78, spec.ry * 1.25);
  const baseZ = spec.depth / 2 + 0.055;
  const depthBow = Math.max(ABAGS_ACCESSORY_VISUAL.strapDepthBowMin, spec.depth * ABAGS_ACCESSORY_VISUAL.strapDepthBowRatio);
  return Array.from({ length: 49 }, (_, index) => {
    const t = index / 48;
    const angle = Math.PI - t * Math.PI;
    return [
      spec.sideAnchor * Math.cos(angle),
      spec.ringY + archHeight * Math.sin(angle),
      baseZ + depthBow * Math.sin(angle),
    ] as Point3;
  });
}

function strokeProjectedPath(
  context: CanvasRenderingContext2D,
  points: Point3[],
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
) {
  let started = false;
  context.beginPath();
  for (const point of points) {
    const projected = project(point, width, height, rotation, zoom);
    if (!projected) continue;
    if (!started) {
      context.moveTo(projected.x, projected.y);
      started = true;
    } else {
      context.lineTo(projected.x, projected.y);
    }
  }
  return started;
}

function drawChainSpecular(
  context: CanvasRenderingContext2D,
  arc: Point3[],
  palette: HardwarePalette,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
) {
  const scale = Math.max(0.8, Math.min(width, height) / 720) * zoom;
  const linkCount = ABAGS_ACCESSORY_VISUAL.chainLinks;
  for (let index = 0; index < linkCount; index += 1) {
    const arcIndex = Math.round((index / Math.max(1, linkCount - 1)) * (arc.length - 1));
    const center = project(arc[arcIndex], width, height, rotation, zoom);
    if (!center) continue;
    const next = project(arc[Math.min(arc.length - 1, arcIndex + 1)], width, height, rotation, zoom) ?? center;
    const angle = Math.atan2(next.y - center.y, next.x - center.x) + (index % 2 ? Math.PI / 2 : 0);
    const rx = 5.4 * scale * center.scale;
    const ry = 3.2 * scale * center.scale;

    context.save();
    context.translate(center.x, center.y);
    context.rotate(angle);

    context.beginPath();
    context.ellipse(0.45 * scale, 0.65 * scale, rx, ry, 0, 0.1 * Math.PI, 1.05 * Math.PI);
    context.strokeStyle = palette.shadow;
    context.lineWidth = Math.max(0.7, 1.05 * scale * center.scale);
    context.stroke();

    context.beginPath();
    context.ellipse(-0.35 * scale, -0.45 * scale, rx, ry, 0, 1.08 * Math.PI, 1.72 * Math.PI);
    context.strokeStyle = palette.highlight;
    context.lineWidth = Math.max(0.55, 0.75 * scale * center.scale);
    context.stroke();

    if (index % 4 === 0) {
      context.beginPath();
      context.arc(-rx * 0.28, -ry * 0.42, Math.max(0.45, 0.72 * scale * center.scale), 0, Math.PI * 2);
      context.fillStyle = palette.highlight;
      context.fill();
    }
    context.restore();
  }
}

function drawLeatherFinish(
  context: CanvasRenderingContext2D,
  arc: Point3[],
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
) {
  const scale = Math.max(0.8, Math.min(width, height) / 720) * zoom;
  context.save();
  context.translate(0.8 * scale, 1.05 * scale);
  if (strokeProjectedPath(context, arc, width, height, rotation, zoom)) {
    context.strokeStyle = "rgba(35,18,13,.26)";
    context.lineWidth = Math.max(1.4, 2.8 * scale);
    context.lineCap = "round";
    context.stroke();
  }
  context.restore();

  context.save();
  context.translate(-0.5 * scale, -0.7 * scale);
  if (strokeProjectedPath(context, arc, width, height, rotation, zoom)) {
    context.strokeStyle = "rgba(255,246,236,.28)";
    context.lineWidth = Math.max(0.75, 1.25 * scale);
    context.lineCap = "round";
    context.stroke();
  }
  context.restore();
}

function drawWovenFinish(
  context: CanvasRenderingContext2D,
  arc: Point3[],
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
) {
  const scale = Math.max(0.8, Math.min(width, height) / 720) * zoom;
  for (let index = 2; index < arc.length - 2; index += 3) {
    const center = project(arc[index], width, height, rotation, zoom);
    const next = project(arc[index + 1], width, height, rotation, zoom);
    if (!center || !next) continue;
    const tangent = Math.atan2(next.y - center.y, next.x - center.x);
    const cross = tangent + Math.PI / 2 + (index % 2 ? 0.22 : -0.22);
    const half = 3.1 * scale * center.scale;
    const dx = Math.cos(cross) * half;
    const dy = Math.sin(cross) * half;

    context.beginPath();
    context.moveTo(center.x - dx + 0.7 * scale, center.y - dy + 0.9 * scale);
    context.lineTo(center.x + dx + 0.7 * scale, center.y + dy + 0.9 * scale);
    context.strokeStyle = "rgba(47,26,31,.18)";
    context.lineWidth = Math.max(0.65, 1.05 * scale);
    context.stroke();

    context.beginPath();
    context.moveTo(center.x - dx - 0.45 * scale, center.y - dy - 0.55 * scale);
    context.lineTo(center.x + dx - 0.45 * scale, center.y + dy - 0.55 * scale);
    context.strokeStyle = "rgba(255,244,239,.36)";
    context.lineWidth = Math.max(0.55, 0.8 * scale);
    context.stroke();
  }
}

function drawAnchorContact(
  context: CanvasRenderingContext2D,
  arc: Point3[],
  palette: HardwarePalette,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
) {
  const scale = Math.max(0.8, Math.min(width, height) / 720) * zoom;
  for (const endpoint of [arc[0], arc[arc.length - 1]]) {
    const point = project(endpoint, width, height, rotation, zoom);
    if (!point) continue;
    const radius = Math.max(3.1, 4.8 * scale * point.scale);

    context.beginPath();
    context.arc(point.x + 0.8 * scale, point.y + 1.0 * scale, radius, 0.08 * Math.PI, 0.92 * Math.PI);
    context.strokeStyle = "rgba(28,19,20,.32)";
    context.lineWidth = Math.max(0.9, 1.45 * scale);
    context.stroke();

    context.beginPath();
    context.arc(point.x - 0.45 * scale, point.y - 0.55 * scale, radius, 1.08 * Math.PI, 1.78 * Math.PI);
    context.strokeStyle = palette.highlight;
    context.lineWidth = Math.max(0.7, 1.0 * scale);
    context.stroke();
  }
}

function drawSnapGlint(
  context: CanvasRenderingContext2D,
  config: Config,
  palette: HardwarePalette,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
) {
  if (!config.family || config.flap === "none") return;
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[config.family as Exclude<Family, "">];
  const point = project([0, (spec.flapY ?? 0.29) - 0.22, spec.depth / 2 + 0.176], width, height, rotation, zoom);
  if (!point) return;
  const scale = Math.max(0.8, Math.min(width, height) / 720) * zoom * point.scale;
  context.beginPath();
  context.arc(point.x - 0.9 * scale, point.y - 1.0 * scale, Math.max(0.65, 0.95 * scale), 0, Math.PI * 2);
  context.fillStyle = palette.highlight;
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

function paint(
  backCanvas: HTMLCanvasElement,
  frontCanvas: HTMLCanvasElement,
  stage: HTMLElement,
  config: Config,
  rotation: Rotation,
  zoom: number,
) {
  const back = prepareCanvas(backCanvas, stage);
  const front = prepareCanvas(frontCanvas, stage);
  if (!back || !front || !config.family || stage.dataset.abagsFinal3d !== "ready") {
    stage.removeAttribute("data-abags-accessory-material-finish");
    return;
  }

  const palette = hardwarePalette(config.hardware);
  const arc = strapArc(config.family as Exclude<Family, "">);
  if (config.strap === "chain") drawChainSpecular(back.context, arc, palette, back.width, back.height, rotation, zoom);
  else if (config.strap === "leather") drawLeatherFinish(back.context, arc, back.width, back.height, rotation, zoom);
  else if (config.strap === "woven") drawWovenFinish(back.context, arc, back.width, back.height, rotation, zoom);

  if (config.strap !== "none") drawAnchorContact(front.context, arc, palette, front.width, front.height, rotation, zoom);
  drawSnapGlint(front.context, config, palette, front.width, front.height, rotation, zoom);
  stage.dataset.abagsAccessoryMaterialFinish = FINISH_VERSION;
}

export default function BagBuilderAccessoryMaterialFinish() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
        const backCanvas = backCanvasRef.current;
        const frontCanvas = frontCanvasRef.current;
        if (backCanvas && frontCanvas) paint(backCanvas, frontCanvas, stage, config.current, rotation.current, zoom.current);
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
        "data-family", "data-strap", "data-hardware", "data-flap", "data-abags-final3d",
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
      stage.removeAttribute("data-abags-accessory-material-finish");
    };
  }, [stage]);

  if (!stage) return null;
  return createPortal(<>
    <canvas ref={backCanvasRef} className="abags-accessory-material-finish abags-accessory-material-finish-back" aria-hidden="true" />
    <canvas ref={frontCanvasRef} className="abags-accessory-material-finish abags-accessory-material-finish-front" aria-hidden="true" />
    <style jsx global>{`
      .abags-bag-builder-stage > .abags-accessory-material-finish {
        position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
        pointer-events:none!important;touch-action:none!important;background:transparent!important;
      }
      .abags-bag-builder-stage > .abags-accessory-material-finish-back { z-index:9!important; }
      .abags-bag-builder-stage > .abags-accessory-material-finish-front { z-index:272!important; }
    `}</style>
  </>, stage);
}
