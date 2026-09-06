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

const STAGE_SELECTOR = ".abags-bag-builder-stage";
const LAYER_SELECTOR = ".abags-fidelity3d-layer";
const SOURCE_SELECTOR = ".abags-fidelity3d-canvas";
const DEFAULT_ROTATION: Rotation = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const FINISH_VERSION = "basket-cord-weave-v5-packed-over-under";

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

function lanePath(
  context: CanvasRenderingContext2D,
  bounds: Bounds,
  center: number,
  horizontal: boolean,
  wave: number,
  phase: number,
  unit: number,
) {
  context.beginPath();
  if (horizontal) {
    const start = bounds.left - 10 * unit;
    const end = bounds.right + 10 * unit;
    const span = end - start;
    context.moveTo(start, center);
    context.bezierCurveTo(
      start + span * 0.30,
      center + wave,
      start + span * 0.68,
      center - wave * 0.72,
      end,
      center + phase,
    );
  } else {
    const start = bounds.top - 10 * unit;
    const end = bounds.bottom + 10 * unit;
    const span = end - start;
    context.moveTo(center, start);
    context.bezierCurveTo(
      center + wave,
      start + span * 0.30,
      center - wave * 0.72,
      start + span * 0.68,
      center + phase,
      end,
    );
  }
}

function shortLanePath(
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

function strokeCord(
  context: CanvasRenderingContext2D,
  selectedColor: string,
  unit: number,
  alpha: number,
) {
  context.save();
  context.translate(0.60 * unit, 0.78 * unit);
  context.strokeStyle = "rgba(25,18,21,.20)";
  context.lineWidth = Math.max(1.3, 4.9 * unit);
  context.stroke();
  context.restore();

  context.strokeStyle = rgba(selectedColor, alpha);
  context.lineWidth = Math.max(1.1, 3.55 * unit);
  context.stroke();

  context.save();
  context.translate(-0.34 * unit, -0.42 * unit);
  context.strokeStyle = "rgba(255,255,255,.17)";
  context.lineWidth = Math.max(0.55, 0.78 * unit);
  context.stroke();
  context.restore();
}

function drawCordBundle(
  context: CanvasRenderingContext2D,
  bounds: Bounds,
  center: number,
  horizontal: boolean,
  lane: number,
  unit: number,
  selectedColor: string,
) {
  const strandSpacing = 2.35 * unit;
  for (let strand = -0.5; strand <= 0.5; strand += 1) {
    const drift = deterministicJitter(lane, strand < 0 ? 0 : 1, horizontal ? 31 : 37) * 0.30 * unit;
    const strandCenter = center + strand * strandSpacing + drift;
    const wave = deterministicJitter(lane, strand < 0 ? 0 : 1, horizontal ? 41 : 43) * 0.48 * unit;
    const phase = deterministicJitter(lane, strand < 0 ? 0 : 1, horizontal ? 47 : 53) * 0.34 * unit;
    lanePath(context, bounds, strandCenter, horizontal, wave, phase, unit);
    strokeCord(context, selectedColor, unit, 0.64);
  }
}

function drawCrossingShadow(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: number,
  overHorizontal: boolean,
) {
  context.save();
  context.translate(centerX, centerY);
  context.rotate(overHorizontal ? 0 : Math.PI / 2);
  const gradient = context.createRadialGradient(0, 1.2 * unit, 0, 0, 1.2 * unit, 7.8 * unit);
  gradient.addColorStop(0, "rgba(22,15,18,.30)");
  gradient.addColorStop(0.52, "rgba(22,15,18,.10)");
  gradient.addColorStop(1, "rgba(22,15,18,0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(0, 1.2 * unit, 8.8 * unit, 3.25 * unit, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawTopBundlePatch(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  cell: number,
  unit: number,
  horizontal: boolean,
  row: number,
  column: number,
  selectedColor: string,
) {
  const strandSpacing = 2.35 * unit;
  const halfLength = cell * 0.38;
  const baseBow = deterministicJitter(row, column, 61) * 0.48 * unit;

  for (let strand = -0.5; strand <= 0.5; strand += 1) {
    const strandIndex = strand < 0 ? 0 : 1;
    const offset = strand * strandSpacing + deterministicJitter(row, column, 67 + strandIndex) * 0.24 * unit;
    const bow = baseBow + deterministicJitter(row, column, 71 + strandIndex) * 0.18 * unit;
    shortLanePath(context, centerX, centerY, halfLength, offset, horizontal, bow);
    strokeCord(context, selectedColor, unit, 0.92);
  }
}

function drawPackedBasket(context: CanvasRenderingContext2D, bounds: Bounds, unit: number, selectedColor: string) {
  const cell = 31 * unit;
  const rows: number[] = [];
  const columns: number[] = [];

  let row = 0;
  for (let y = bounds.top - cell * 0.30; y <= bounds.bottom + cell * 0.30; y += cell, row += 1) {
    const centerY = y + deterministicJitter(row, 0, 79) * 0.62 * unit;
    rows.push(centerY);
    drawCordBundle(context, bounds, centerY, true, row, unit, selectedColor);
  }

  let column = 0;
  for (let x = bounds.left - cell * 0.30; x <= bounds.right + cell * 0.30; x += cell, column += 1) {
    const centerX = x + deterministicJitter(0, column, 83) * 0.62 * unit;
    columns.push(centerX);
    drawCordBundle(context, bounds, centerX, false, column, unit, selectedColor);
  }

  rows.forEach((centerY, rowIndex) => {
    columns.forEach((centerX, columnIndex) => {
      const overHorizontal = (rowIndex + columnIndex) % 2 === 0;
      const shiftedX = centerX + deterministicJitter(rowIndex, columnIndex, 89) * 0.38 * unit;
      const shiftedY = centerY + deterministicJitter(rowIndex, columnIndex, 97) * 0.38 * unit;
      drawCrossingShadow(context, shiftedX, shiftedY, unit, overHorizontal);
      drawTopBundlePatch(
        context,
        shiftedX,
        shiftedY,
        cell,
        unit,
        overHorizontal,
        rowIndex,
        columnIndex,
        selectedColor,
      );
    });
  });
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
  // V5 owns only the basket body material. The dense same-hue bed suppresses the sparse V4
  // honeycomb while preserving the exact Fidelity contour and leaving accessories untouched.
  context.fillStyle = rgba(selectedColor, 0.82);
  context.fill(body.path);

  const lightWash = context.createLinearGradient(body.bounds.left, body.bounds.top, body.bounds.right, body.bounds.bottom);
  lightWash.addColorStop(0, "rgba(255,255,255,.09)");
  lightWash.addColorStop(0.44, "rgba(255,255,255,0)");
  lightWash.addColorStop(1, "rgba(30,20,24,.08)");
  context.fillStyle = lightWash;
  context.fill(body.path);

  const unit = Math.max(0.72, Math.min(2.7, Math.min(width, height) / 720));
  drawPackedBasket(context, body.bounds, unit, selectedColor);
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

    const syncTransform = () => {
      const x = Number(stage.dataset.abagsFidelity3dRotationX);
      const y = Number(stage.dataset.abagsFidelity3dRotationY);
      const nextZoom = Number(stage.dataset.abagsFidelity3dZoom);
      if (Number.isFinite(x) && Number.isFinite(y)) rotationRef.current = { x, y };
      if (Number.isFinite(nextZoom) && nextZoom > 0) zoomRef.current = nextZoom;
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

      syncTransform();
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
      frameRef.current = null;
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
        background:transparent!important;opacity:1;mix-blend-mode:normal!important;
      }
      .abags-bag-builder-stage[data-abags-basket-weave-finish="${FINISH_VERSION}"] .abags-crochet-relief-surface {
        opacity:0!important;
      }
      @media (max-width:620px) {
        .abags-fidelity3d-layer > .abags-basket-weave-surface { opacity:1; }
      }
      @media (prefers-reduced-motion:reduce) {
        .abags-fidelity3d-layer > .abags-basket-weave-surface { transition:none!important; }
      }
    `}</style>
  </>, layer);
}