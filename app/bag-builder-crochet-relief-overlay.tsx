"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS } from "../lib/abags-fidelity-v4-family-spec";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Stitch = "" | "classic" | "herringbone" | "basket" | "shell";
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
const RELIEF_VERSION = "stitch-depth-v2-handmade";

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
  return {
    path,
    bounds: { left, right, top, bottom, width: right - left, height: bottom - top } as Bounds,
  };
}

function deterministicVariation(row: number, column: number, salt = 0) {
  let value = Math.imul(row + 101, 374761393) ^ Math.imul(column + 211, 668265263) ^ Math.imul(salt + 17, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value ^= value >>> 16;
  return ((value >>> 0) / 4294967295) * 2 - 1;
}

function handmadeOffset(row: number, column: number, unit: number) {
  return {
    x: deterministicVariation(row, column, 1) * 1.35 * unit,
    y: deterministicVariation(row, column, 2) * 1.05 * unit,
    width: 1 + deterministicVariation(row, column, 3) * 0.075,
    lift: 1 + deterministicVariation(row, column, 4) * 0.065,
  };
}

function raisedStroke(context: CanvasRenderingContext2D, path: Path2D, lineWidth: number, unit: number, lift = 1) {
  context.save();
  context.translate(unit * 0.82 * lift, unit * 1.10 * lift);
  context.strokeStyle = "rgba(35,24,27,.27)";
  context.lineWidth = lineWidth * 1.12;
  context.stroke(path);
  context.restore();

  context.save();
  context.translate(-unit * 0.50 * lift, -unit * 0.54 * lift);
  context.strokeStyle = "rgba(255,255,255,.24)";
  context.lineWidth = lineWidth * 0.68;
  context.stroke(path);
  context.restore();
}

function fibreGlint(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  unit: number,
  row: number,
  column: number,
) {
  if (((row * 3 + column) & 3) !== 0) return;
  const length = (2.4 + (deterministicVariation(row, column, 8) + 1) * 0.9) * unit;
  const drift = deterministicVariation(row, column, 9) * 0.8 * unit;
  const normalX = -Math.sin(angle);
  const normalY = Math.cos(angle);
  const tangentX = Math.cos(angle);
  const tangentY = Math.sin(angle);
  context.beginPath();
  context.moveTo(x + normalX * drift - tangentX * length * 0.5, y + normalY * drift - tangentY * length * 0.5);
  context.lineTo(x + normalX * drift + tangentX * length * 0.5, y + normalY * drift + tangentY * length * 0.5);
  context.strokeStyle = "rgba(255,255,255,.17)";
  context.lineWidth = Math.max(0.45, 0.62 * unit);
  context.stroke();
}

function drawClassic(context: CanvasRenderingContext2D, bounds: Bounds, unit: number) {
  const stepX = 25 * unit;
  const stepY = 21 * unit;
  let row = -1;
  for (let y = bounds.top - stepY; y < bounds.bottom + stepY; y += stepY, row += 1) {
    let column = -1;
    for (let x = bounds.left - stepX; x < bounds.right + stepX; x += stepX, column += 1) {
      const variation = handmadeOffset(row, column, unit);
      const peak = 0.73 + deterministicVariation(row, column, 5) * 0.045;
      const left = x + variation.x;
      const top = y + variation.y;
      const path = new Path2D();
      path.moveTo(left, top);
      path.lineTo(left + stepX * 0.5, top + stepY * peak);
      path.lineTo(left + stepX, top + deterministicVariation(row, column, 6) * 0.7 * unit);
      raisedStroke(context, path, Math.max(1.1, 4.05 * unit * variation.width), unit, variation.lift);
      fibreGlint(context, left + stepX * 0.50, top + stepY * peak * 0.70, Math.PI * 0.23, unit, row, column);
    }
  }
}

function drawHerringbone(context: CanvasRenderingContext2D, bounds: Bounds, unit: number) {
  const stepX = 23 * unit;
  const stepY = 22 * unit;
  let column = -1;
  for (let x = bounds.left - stepX; x < bounds.right + stepX; x += stepX, column += 1) {
    const drift = deterministicVariation(0, column, 11) * 1.2 * unit;
    const post = new Path2D();
    post.moveTo(x + drift, bounds.top - stepY);
    post.bezierCurveTo(
      x - 1.8 * unit + drift,
      bounds.top + bounds.height * 0.33,
      x + 1.8 * unit + drift,
      bounds.top + bounds.height * 0.66,
      x + drift * 0.7,
      bounds.bottom + stepY,
    );
    raisedStroke(context, post, Math.max(1.1, 3.85 * unit * (1 + deterministicVariation(0, column, 12) * 0.06)), unit, 0.94);
  }
  let row = 0;
  for (let y = bounds.top; y < bounds.bottom + stepY; y += stepY, row += 1) {
    column = -1;
    for (let x = bounds.left - stepX; x < bounds.right + stepX; x += stepX, column += 1) {
      const variation = handmadeOffset(row, column, unit);
      const bridge = new Path2D();
      bridge.moveTo(x - stepX * 0.44 + variation.x, y - stepY * 0.30 + variation.y);
      bridge.lineTo(x + variation.x * 0.55, y + stepY * (0.20 + deterministicVariation(row, column, 13) * 0.035) + variation.y);
      bridge.lineTo(x + stepX * 0.44 + variation.x, y - stepY * 0.30 + variation.y * 0.65);
      raisedStroke(context, bridge, Math.max(1, 2.95 * unit * variation.width), unit * 0.82, variation.lift);
      fibreGlint(context, x + variation.x, y + stepY * 0.06 + variation.y, -Math.PI * 0.22, unit, row, column);
    }
  }
}

function drawBasket(context: CanvasRenderingContext2D, bounds: Bounds, unit: number) {
  const cell = 32 * unit;
  for (let row = -1, y = bounds.top - cell; y < bounds.bottom + cell; y += cell, row += 1) {
    for (let column = -1, x = bounds.left - cell; x < bounds.right + cell; x += cell, column += 1) {
      const variation = handmadeOffset(row, column, unit);
      const inset = (3.4 + deterministicVariation(row, column, 15) * 0.55) * unit;
      const splitA = 0.34 + deterministicVariation(row, column, 16) * 0.018;
      const splitB = 0.66 + deterministicVariation(row, column, 17) * 0.018;
      const horizontalFirst = (row + column) % 2 === 0;
      const horizontal = new Path2D();
      horizontal.moveTo(x + inset + variation.x, y + cell * splitA + variation.y);
      horizontal.lineTo(x + cell - inset + variation.x, y + cell * splitA + variation.y * 0.7);
      horizontal.moveTo(x + inset + variation.x, y + cell * splitB + variation.y * 0.65);
      horizontal.lineTo(x + cell - inset + variation.x, y + cell * splitB + variation.y);
      const vertical = new Path2D();
      vertical.moveTo(x + cell * splitA + variation.x, y + inset + variation.y);
      vertical.lineTo(x + cell * splitA + variation.x * 0.7, y + cell - inset + variation.y);
      vertical.moveTo(x + cell * splitB + variation.x * 0.65, y + inset + variation.y);
      vertical.lineTo(x + cell * splitB + variation.x, y + cell - inset + variation.y);
      raisedStroke(context, horizontalFirst ? vertical : horizontal, Math.max(1.0, 3.7 * unit * variation.width), unit * 0.72, variation.lift);
      raisedStroke(context, horizontalFirst ? horizontal : vertical, Math.max(1.1, 4.45 * unit * variation.width), unit, variation.lift);
      fibreGlint(context, x + cell * 0.50 + variation.x, y + cell * 0.34 + variation.y, horizontalFirst ? 0 : Math.PI / 2, unit, row, column);
    }
  }
}

function drawShell(context: CanvasRenderingContext2D, bounds: Bounds, unit: number) {
  const stepX = 35 * unit;
  const stepY = 27 * unit;
  for (let row = -1, y = bounds.top - stepY; y < bounds.bottom + stepY; y += stepY, row += 1) {
    const offset = row % 2 ? stepX * 0.5 : 0;
    let column = -1;
    for (let x = bounds.left - stepX + offset; x < bounds.right + stepX; x += stepX, column += 1) {
      const variation = handmadeOffset(row, column, unit);
      const radiusScale = 0.34 + deterministicVariation(row, column, 19) * 0.018;
      const centerX = x + variation.x;
      const centerY = y + variation.y;
      const path = new Path2D();
      path.arc(centerX, centerY + stepY * 0.46, stepX * radiusScale, Math.PI * 1.08, Math.PI * 1.92);
      path.moveTo(centerX, centerY + stepY * 0.06);
      path.lineTo(centerX, centerY + stepY * 0.70);
      path.moveTo(centerX - stepX * 0.20, centerY + stepY * 0.14);
      path.lineTo(centerX, centerY + stepY * 0.70);
      path.moveTo(centerX + stepX * 0.20, centerY + stepY * 0.14);
      path.lineTo(centerX, centerY + stepY * 0.70);
      raisedStroke(context, path, Math.max(1.0, 3.25 * unit * variation.width), unit * 0.82, variation.lift);
      fibreGlint(context, centerX, centerY + stepY * 0.33, Math.PI / 2, unit, row, column);
    }
  }
}

function paintRelief(
  output: HTMLCanvasElement,
  source: HTMLCanvasElement,
  family: Exclude<Family, "">,
  stitch: Stitch,
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

  const body = projectedPath(contour3d(family, 0.018), width, height, rotation, zoom);
  if (!body || body.bounds.width < 6 || body.bounds.height < 6) return false;

  const clipPath = new Path2D();
  clipPath.addPath(body.path);
  if (flap !== "none" && flap !== "crochet") {
    const flapPath = projectedPath(flapContour3d(family), width, height, rotation, zoom);
    if (flapPath) clipPath.addPath(flapPath.path);
  }

  context.save();
  context.clip(clipPath, flap !== "none" && flap !== "crochet" ? "evenodd" : "nonzero");
  const unit = Math.max(0.72, Math.min(2.7, Math.min(width, height) / 720));

  if (stitch === "herringbone") drawHerringbone(context, body.bounds, unit);
  else if (stitch === "basket") drawBasket(context, body.bounds, unit);
  else if (stitch === "shell") drawShell(context, body.bounds, unit);
  else drawClassic(context, body.bounds, unit);

  context.restore();
  return true;
}

export default function BagBuilderCrochetReliefOverlay() {
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef<Rotation>(DEFAULT_ROTATION);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const findLayer = () => {
      const next = document.querySelector<HTMLElement>(`${STAGE_SELECTOR} > ${LAYER_SELECTOR}`);
      setLayer((current) => (current === next ? current : next));
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

    const paint = () => {
      frameRef.current = null;
      const family = (stage.dataset.family || "") as Family;
      const stitch = (stage.dataset.stitch || "classic") as Stitch;
      if (stage.dataset.abagsFinal3d !== "ready" || !family) {
        output.getContext("2d")?.clearRect(0, 0, output.width, output.height);
        stage.removeAttribute("data-abags-crochet-relief");
        return;
      }

      const painted = paintRelief(
        output,
        source,
        family,
        stitch,
        stage.dataset.flap || "none",
        rotationRef.current,
        zoomRef.current,
      );
      if (painted) {
        stage.dataset.abagsCrochetRelief = "ready";
        stage.dataset.abagsCrochetReliefMode = stitch || "classic";
        stage.dataset.abagsCrochetReliefVersion = RELIEF_VERSION;
      }
    };

    const schedulePaint = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(paint);
    };

    const onTransform = (event: Event) => {
      const detail = (event as CustomEvent<TransformDetail>).detail;
      if (detail?.rotation) rotationRef.current = detail.rotation;
      if (typeof detail?.zoom === "number") zoomRef.current = detail.zoom;
      schedulePaint();
    };

    const observer = new MutationObserver(schedulePaint);
    observer.observe(stage, {
      attributes: true,
      attributeFilter: [
        "data-abags-final3d",
        "data-abags-fidelity3d-frame-at",
        "data-family",
        "data-stitch",
        "data-flap",
        "data-color",
      ],
    });

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedulePaint) : null;
    resizeObserver?.observe(layer);
    stage.addEventListener("abags:fidelity3d-transform", onTransform as EventListener);
    window.addEventListener("resize", schedulePaint);
    schedulePaint();

    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
      stage.removeEventListener("abags:fidelity3d-transform", onTransform as EventListener);
      window.removeEventListener("resize", schedulePaint);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      stage.removeAttribute("data-abags-crochet-relief");
      stage.removeAttribute("data-abags-crochet-relief-mode");
      stage.removeAttribute("data-abags-crochet-relief-version");
    };
  }, [layer]);

  if (!layer) return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      className="abags-crochet-relief-surface"
      data-abags-crochet-relief-surface={RELIEF_VERSION}
      aria-hidden="true"
    />,
    layer,
  );
}
