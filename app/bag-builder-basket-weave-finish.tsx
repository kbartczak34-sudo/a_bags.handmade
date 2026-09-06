"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS } from "../lib/abags-fidelity-v4-family-spec";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Rotation = { x: number; y: number };
type TransformDetail = { rotation?: Rotation; zoom?: number };
type Point3 = [number, number, number];
type Point2 = { x: number; y: number };
type Bounds = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type BundleLayer = "under" | "over";

const STAGE_SELECTOR = ".abags-bag-builder-stage";
const LAYER_SELECTOR = ".abags-fidelity3d-layer";
const SOURCE_SELECTOR = ".abags-fidelity3d-canvas";
const DEFAULT_ROTATION: Rotation = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const FINISH_VERSION = "basket-cord-weave-v2-over-under";

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
  };
}

function contour3d(family: Exclude<Family, "">, zOffset = 0): Point3[] {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const count = family === "round" ? 64 : 68;
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const exponent = 2 / spec.power;
    const y = Math.sign(s) * spec.ry * Math.pow(Math.abs(s), exponent);
    const baseX = Math.sign(c) * spec.rx * Math.pow(Math.abs(c), exponent);
    const widthScale = 1 + spec.taper * (y / spec.ry);
    return [baseX * widthScale, y, spec.depth / 2 + zOffset] as Point3;
  });
}

function flapContour3d(family: Exclude<Family, "">): Point3[] {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const centerY = spec.flapY ?? 0.29;
  const rx = 0.80 * spec.flapScale[0];
  const ry = 0.36 * spec.flapScale[1];
  return Array.from({ length: 44 }, (_, index) => {
    const angle = (index / 44) * Math.PI * 2;
    return [rx * Math.cos(angle), centerY + ry * Math.sin(angle), spec.depth / 2 + 0.145] as Point3;
  });
}

function projectedPath(points: Point3[], width: number, height: number, rotation: Rotation, zoom: number) {
  const projected = points
    .map((point) => project(point, width, height, rotation, zoom))
    .filter((point): point is Point2 => Boolean(point));
  if (projected.length < 3) return null;

  const path = new Path2D();
  path.moveTo(projected[0].x, projected[0].y);
  for (let index = 1; index < projected.length; index += 1) path.lineTo(projected[index].x, projected[index].y);
  path.closePath();

  const xs = projected.map((point) => point.x);
  const ys = projected.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { path, bounds: { left, right, top, bottom, width: right - left, height: bottom - top } as Bounds };
}

function rgba(hex: string, alpha: number) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "E8DDCC";
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
}

function deterministicJitter(row: number, column: number, salt: number) {
  let value = Math.imul(row + 37, 73856093) ^ Math.imul(column + 61, 19349663) ^ Math.imul(salt + 11, 83492791);
  value ^= value >>> 13;
  value = Math.imul(value, 1274126177);
  value ^= value >>> 16;
  return ((value >>> 0) / 4294967295) * 2 - 1;
}

function cordPath(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  halfLength: number,
  offset: number,
  horizontal: boolean,
  bow: number,
) {
  context.beginPath();
  if (horizontal) {
    context.moveTo(centerX - halfLength, centerY + offset);
    context.quadraticCurveTo(centerX, centerY + offset - bow, centerX + halfLength, centerY + offset);
  } else {
    context.moveTo(centerX + offset, centerY - halfLength);
    context.quadraticCurveTo(centerX + offset + bow, centerY, centerX + offset, centerY + halfLength);
  }
}

function drawCordBundle(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  cell: number,
  unit: number,
  horizontal: boolean,
  row: number,
  column: number,
  selectedColor: string,
  layer: BundleLayer,
) {
  const over = layer === "over";
  const halfLength = cell * (over ? 0.34 : 0.305);
  const spacing = 5.45 * unit;
  const shadowWidth = Math.max(1.4, (over ? 6.8 : 5.45) * unit);
  const bodyWidth = Math.max(1.2, (over ? 4.75 : 3.85) * unit);
  const highlightWidth = Math.max(0.65, (over ? 1.22 : 0.82) * unit);
  const bundleBow = deterministicJitter(row, column, 2) * (over ? 1.05 : 0.72) * unit;

  for (let strand = -1; strand <= 1; strand += 1) {
    const strandDrift = deterministicJitter(row, column, 7 + strand) * 0.38 * unit;
    const offset = strand * spacing + strandDrift;
    const bow = bundleBow + deterministicJitter(row, column, 13 + strand) * 0.22 * unit;

    context.save();
    context.translate((over ? 1.15 : 0.72) * unit, (over ? 1.5 : 0.88) * unit);
    cordPath(context, centerX, centerY, halfLength, offset, horizontal, bow);
    context.strokeStyle = over ? "rgba(30,21,24,.29)" : "rgba(30,21,24,.14)";
    context.lineWidth = shadowWidth;
    context.stroke();
    context.restore();

    cordPath(context, centerX, centerY, halfLength, offset, horizontal, bow);
    context.strokeStyle = rgba(selectedColor, over ? 0.34 : 0.20);
    context.lineWidth = bodyWidth;
    context.stroke();

    context.save();
    context.translate(-(over ? 0.74 : 0.46) * unit, -(over ? 0.84 : 0.52) * unit);
    cordPath(context, centerX, centerY, halfLength, offset, horizontal, bow);
    context.strokeStyle = over ? "rgba(255,255,255,.32)" : "rgba(255,255,255,.13)";
    context.lineWidth = highlightWidth;
    context.stroke();
    context.restore();
  }
}

function drawCrossingOcclusion(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: number,
  overHorizontal: boolean,
) {
  context.save();
  context.translate(centerX, centerY);
  context.rotate(overHorizontal ? Math.PI / 2 : 0);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 8.6 * unit);
  gradient.addColorStop(0, "rgba(26,18,21,.24)");
  gradient.addColorStop(0.55, "rgba(26,18,21,.10)");
  gradient.addColorStop(1, "rgba(26,18,21,0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(0, 0, 8.6 * unit, 3.55 * unit, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBasketWeave(context: CanvasRenderingContext2D, bounds: Bounds, unit: number, selectedColor: string) {
  const cell = 48 * unit;
  let row = 0;
  for (let y = bounds.top - cell * 0.5; y < bounds.bottom + cell * 0.5; y += cell, row += 1) {
    let column = 0;
    for (let x = bounds.left - cell * 0.5; x < bounds.right + cell * 0.5; x += cell, column += 1) {
      const centerX = x + cell * 0.5 + deterministicJitter(row, column, 19) * 0.7 * unit;
      const centerY = y + cell * 0.5 + deterministicJitter(row, column, 23) * 0.7 * unit;
      const overHorizontal = (row + column) % 2 === 0;

      drawCordBundle(context, centerX, centerY, cell, unit, !overHorizontal, row, column, selectedColor, "under");
      drawCrossingOcclusion(context, centerX, centerY, unit, overHorizontal);
      drawCordBundle(context, centerX, centerY, cell, unit, overHorizontal, row, column, selectedColor, "over");
    }
  }
}

function paint(
  output: HTMLCanvasElement,
  source: HTMLCanvasElement,
  stage: HTMLElement,
  family: Exclude<Family, "">,
  flap: string,
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

  const body = projectedPath(contour3d(family, 0.020), width, height, rotation, zoom);
  if (!body || body.bounds.width < 6 || body.bounds.height < 6) return false;

  const clipPath = new Path2D();
  clipPath.addPath(body.path);
  const excludesRigidFlap = flap !== "none" && flap !== "crochet";
  if (excludesRigidFlap) {
    const flapPath = projectedPath(flapContour3d(family), width, height, rotation, zoom);
    if (flapPath) clipPath.addPath(flapPath.path);
  }

  context.save();
  context.clip(clipPath, excludesRigidFlap ? "evenodd" : "nonzero");

  const selectedColor = stage.dataset.color || "#E8DDCC";
  // Same-hue veil lowers the old shader-grid contrast while keeping the selected cord hue.
  // It is intentionally translucent so calibrated WebGL volume and edge lighting remain visible.
  context.fillStyle = rgba(selectedColor, 0.16);
  context.fill(body.path);

  const unit = Math.max(0.72, Math.min(2.7, Math.min(width, height) / 720));
  drawBasketWeave(context, body.bounds, unit, selectedColor);
  context.restore();
  return true;
}

export default function BagBuilderBasketWeaveFinish() {
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
      stage.removeAttribute("data-abags-basket-weave-finish");
    };

    const paintFrame = () => {
      frameRef.current = null;
      const family = (stage.dataset.family || "") as Family;
      const stitch = stage.dataset.stitch || "classic";
      if (
        stage.dataset.abagsFinal3d !== "ready" ||
        stage.dataset.abagsPhotoTrue === "active" ||
        stitch !== "basket" ||
        !family
      ) {
        clear();
        return;
      }

      const painted = paint(
        output,
        source,
        stage,
        family as Exclude<Family, "">,
        stage.dataset.flap || "none",
        rotationRef.current,
        zoomRef.current,
      );
      if (painted) stage.dataset.abagsBasketWeaveFinish = FINISH_VERSION;
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

    const syncTransform = () => {
      const x = Number(stage.dataset.abagsFidelity3dRotationX);
      const y = Number(stage.dataset.abagsFidelity3dRotationY);
      const nextZoom = Number(stage.dataset.abagsFidelity3dZoom);
      if (Number.isFinite(x) && Number.isFinite(y)) rotationRef.current = { x, y };
      if (Number.isFinite(nextZoom) && nextZoom > 0) zoomRef.current = nextZoom;
    };

    syncTransform();
    const observer = new MutationObserver(() => {
      syncTransform();
      schedule();
    });
    observer.observe(stage, {
      attributes: true,
      attributeFilter: [
        "data-abags-final3d", "data-abags-fidelity3d-frame-at", "data-abags-photo-true",
        "data-family", "data-stitch", "data-flap", "data-color",
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
      stage.removeAttribute("data-abags-basket-weave-finish");
    };
  }, [layer]);

  if (!layer) return null;
  return createPortal(<>
    <canvas ref={canvasRef} className="abags-basket-weave-surface" aria-hidden="true" />
    <style jsx global>{`
      .abags-fidelity3d-layer > .abags-basket-weave-surface {
        position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
        z-index:4!important;pointer-events:none!important;touch-action:none!important;
        background:transparent!important;opacity:.92;mix-blend-mode:normal!important;
      }
      .abags-bag-builder-stage[data-abags-basket-weave-finish="${FINISH_VERSION}"] .abags-crochet-relief-surface {
        opacity:.10!important;
      }
      @media (max-width:620px) {
        .abags-fidelity3d-layer > .abags-basket-weave-surface { opacity:.86; }
        .abags-bag-builder-stage[data-abags-basket-weave-finish="${FINISH_VERSION}"] .abags-crochet-relief-surface {
          opacity:.07!important;
        }
      }
      @media (prefers-reduced-motion:reduce) {
        .abags-fidelity3d-layer > .abags-basket-weave-surface { transition:none!important; }
      }
    `}</style>
  </>, layer);
}
