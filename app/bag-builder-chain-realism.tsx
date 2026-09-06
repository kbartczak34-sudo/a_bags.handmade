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
type ProjectedArc = { points: Point2[]; cumulative: number[]; total: number };
type HardwarePalette = { shadow: string; mid: string; highlight: string; glint: string };

const STAGE_SELECTOR = ".abags-vc-dialog.abags-vc-builder-active .abags-bag-builder-stage";
const DEFAULT_ROTATION: Rotation = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const CHAIN_VERSION = "chain-metal-v2-continuous";
const REALISTIC_LINK_COUNT = 38;
const SHOULDER_START = 17;
const SHOULDER_END = 32;

function hardwarePalette(value: string): HardwarePalette {
  if (value === "silver") return {
    shadow: "rgba(58,68,78,.72)",
    mid: "rgba(183,197,208,.98)",
    highlight: "rgba(251,254,255,.94)",
    glint: "rgba(255,255,255,.98)",
  };
  if (value === "black") return {
    shadow: "rgba(4,4,5,.84)",
    mid: "rgba(54,54,60,.98)",
    highlight: "rgba(151,153,164,.72)",
    glint: "rgba(218,220,228,.80)",
  };
  return {
    shadow: "rgba(91,60,16,.68)",
    mid: "rgba(198,155,72,.98)",
    highlight: "rgba(255,231,160,.92)",
    glint: "rgba(255,248,220,.98)",
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

function projectArcByDistance(
  arc: Point3[],
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
): ProjectedArc | null {
  const points = arc
    .map((point) => project(point, width, height, rotation, zoom))
    .filter((point): point is Point2 => Boolean(point));
  if (points.length < 2) return null;

  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    cumulative.push(cumulative[index - 1] + Math.hypot(current.x - previous.x, current.y - previous.y));
  }
  const total = cumulative[cumulative.length - 1];
  return total > 1 ? { points, cumulative, total } : null;
}

function sampleProjectedArc(projected: ProjectedArc, distance: number): Point2 {
  const target = Math.max(0, Math.min(projected.total, distance));
  let segment = 1;
  while (segment < projected.cumulative.length && projected.cumulative[segment] < target) segment += 1;
  if (segment >= projected.points.length) return projected.points[projected.points.length - 1];

  const startDistance = projected.cumulative[segment - 1];
  const endDistance = projected.cumulative[segment];
  const span = Math.max(0.0001, endDistance - startDistance);
  const mix = (target - startDistance) / span;
  const start = projected.points[segment - 1];
  const end = projected.points[segment];
  return {
    x: start.x + (end.x - start.x) * mix,
    y: start.y + (end.y - start.y) * mix,
    scale: start.scale + (end.scale - start.scale) * mix,
  };
}

function drawMetalLinks(
  context: CanvasRenderingContext2D,
  arc: Point3[],
  palette: HardwarePalette,
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
) {
  const scale = Math.max(0.8, Math.min(width, height) / 720) * zoom;
  const projected = projectArcByDistance(arc, width, height, rotation, zoom);
  if (!projected) return;
  const shoulderStart = SHOULDER_START / (arc.length - 1);
  const shoulderEnd = SHOULDER_END / (arc.length - 1);

  for (let index = 0; index < REALISTIC_LINK_COUNT; index += 1) {
    const fraction = index / Math.max(1, REALISTIC_LINK_COUNT - 1);
    if (fraction >= shoulderStart && fraction <= shoulderEnd) continue;

    const distance = fraction * projected.total;
    const center = sampleProjectedArc(projected, distance);
    const tangentDistance = Math.max(1.8, projected.total / (REALISTIC_LINK_COUNT * 2.4));
    const previous = sampleProjectedArc(projected, distance - tangentDistance);
    const next = sampleProjectedArc(projected, distance + tangentDistance);
    const tangent = Math.atan2(next.y - previous.y, next.x - previous.x);
    const linkAngle = tangent + (index % 2 ? Math.PI / 2 : 0) + (index % 3 - 1) * 0.028;
    const rx = 3.72 * scale * center.scale;
    const ry = 2.10 * scale * center.scale;

    context.save();
    context.translate(center.x, center.y);
    context.rotate(linkAngle);

    const metal = context.createLinearGradient(-rx, -ry, rx, ry);
    metal.addColorStop(0, palette.highlight);
    metal.addColorStop(0.28, palette.mid);
    metal.addColorStop(0.58, palette.shadow);
    metal.addColorStop(0.82, palette.mid);
    metal.addColorStop(1, palette.highlight);

    context.beginPath();
    context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    context.strokeStyle = metal;
    context.lineWidth = Math.max(0.78, 1.10 * scale * center.scale);
    context.stroke();

    context.beginPath();
    context.ellipse(0.30 * scale, 0.36 * scale, rx, ry, 0, 0.12 * Math.PI, 0.96 * Math.PI);
    context.strokeStyle = palette.shadow;
    context.lineWidth = Math.max(0.48, 0.66 * scale * center.scale);
    context.stroke();

    context.beginPath();
    context.ellipse(-0.22 * scale, -0.27 * scale, rx, ry, 0, 1.08 * Math.PI, 1.72 * Math.PI);
    context.strokeStyle = palette.highlight;
    context.lineWidth = Math.max(0.40, 0.54 * scale * center.scale);
    context.stroke();

    if (index % 6 === 0) {
      context.beginPath();
      context.arc(-rx * 0.30, -ry * 0.38, Math.max(0.30, 0.44 * scale * center.scale), 0, Math.PI * 2);
      context.fillStyle = palette.glint;
      context.fill();
    }
    context.restore();
  }
}

function drawShoulderLeather(
  context: CanvasRenderingContext2D,
  arc: Point3[],
  width: number,
  height: number,
  rotation: Rotation,
  zoom: number,
) {
  const scale = Math.max(0.8, Math.min(width, height) / 720) * zoom;
  const shoulder = arc.slice(SHOULDER_START, SHOULDER_END + 1);

  context.save();
  context.translate(0.92 * scale, 1.08 * scale);
  if (strokeProjectedPath(context, shoulder, width, height, rotation, zoom)) {
    context.strokeStyle = "rgba(38,20,14,.34)";
    context.lineWidth = Math.max(4.2, 7.4 * scale);
    context.lineCap = "round";
    context.stroke();
  }
  context.restore();

  if (strokeProjectedPath(context, shoulder, width, height, rotation, zoom)) {
    const leather = context.createLinearGradient(0, 0, width, height);
    leather.addColorStop(0, "rgba(124,82,59,.98)");
    leather.addColorStop(0.48, "rgba(93,56,41,.98)");
    leather.addColorStop(1, "rgba(132,88,61,.98)");
    context.strokeStyle = leather;
    context.lineWidth = Math.max(3.7, 6.35 * scale);
    context.lineCap = "round";
    context.stroke();
  }

  context.save();
  context.translate(-0.52 * scale, -0.58 * scale);
  if (strokeProjectedPath(context, shoulder, width, height, rotation, zoom)) {
    context.strokeStyle = "rgba(255,229,207,.34)";
    context.lineWidth = Math.max(0.64, 1.02 * scale);
    context.lineCap = "round";
    context.stroke();
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

function paint(
  canvas: HTMLCanvasElement,
  stage: HTMLElement,
  family: Exclude<Family, "">,
  hardware: string,
  rotation: Rotation,
  zoom: number,
) {
  const prepared = prepareCanvas(canvas, stage);
  if (!prepared || stage.dataset.abagsFinal3d !== "ready" || stage.dataset.strap !== "chain" || stage.dataset.abagsPhotoTrue === "active") {
    stage.removeAttribute("data-abags-chain-realism");
    return;
  }

  const arc = strapArc(family);
  const palette = hardwarePalette(hardware);
  drawMetalLinks(prepared.context, arc, palette, prepared.width, prepared.height, rotation, zoom);
  drawShoulderLeather(prepared.context, arc, prepared.width, prepared.height, rotation, zoom);
  stage.dataset.abagsChainRealism = CHAIN_VERSION;
}

export default function BagBuilderChainRealism() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef<Rotation>(DEFAULT_ROTATION);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const find = () => {
      const next = document.querySelector<HTMLElement>(STAGE_SELECTOR);
      setStage((current) => current === next ? current : next);
    };
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!stage) return;
    const schedule = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const canvas = canvasRef.current;
        const family = (stage.dataset.family || "") as Family;
        if (!canvas || !family) {
          stage.removeAttribute("data-abags-chain-realism");
          return;
        }
        paint(canvas, stage, family as Exclude<Family, "">, stage.dataset.hardware || "gold", rotationRef.current, zoomRef.current);
      });
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
        "data-family", "data-strap", "data-hardware", "data-abags-final3d", "data-abags-photo-true",
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
      stage.removeAttribute("data-abags-chain-realism");
    };
  }, [stage]);

  if (!stage) return null;
  return createPortal(<>
    <canvas ref={canvasRef} className="abags-chain-realism" data-chain-version={CHAIN_VERSION} aria-hidden="true" />
    <style jsx global>{`
      .abags-bag-builder-stage > .abags-chain-realism {
        position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
        z-index:10!important;pointer-events:none!important;touch-action:none!important;background:transparent!important;
      }
      .abags-bag-builder-stage[data-abags-chain-realism="${CHAIN_VERSION}"] > .abags-accessory-fidelity-back,
      .abags-bag-builder-stage[data-abags-chain-realism="${CHAIN_VERSION}"] > .abags-accessory-material-finish-back {
        opacity:0!important;
      }
      @media (prefers-reduced-motion:reduce) {
        .abags-bag-builder-stage > .abags-chain-realism { transition:none!important; }
      }
    `}</style>
  </>, stage);
}
