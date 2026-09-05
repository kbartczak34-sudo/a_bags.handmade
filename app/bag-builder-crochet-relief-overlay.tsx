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

function raisedStroke(context: CanvasRenderingContext2D, path: Path2D, lineWidth: number, unit: number) {
  context.save();
  context.translate(unit * 0.9, unit * 1.25);
  context.strokeStyle = "rgba(35,24,27,.30)";
  context.lineWidth = lineWidth * 1.16;
  context.stroke(path);
  context.restore();

  context.save();
  context.translate(-unit * 0.58, -unit * 0.62);
  context.strokeStyle = "rgba(255,255,255,.27)";
  context.lineWidth = lineWidth * 0.72;
  context.stroke(path);
  context.restore();
}

function drawClassic(context: CanvasRenderingContext2D, bounds: Bounds, unit: number) {
  const stepX = 31 * unit;
  const stepY = 26 * unit;
  for (let y = bounds.top - stepY; y < bounds.bottom + stepY; y += stepY) {
    for (let x = bounds.left - stepX; x < bounds.right + stepX; x += stepX) {
      const path = new Path2D();
      path.moveTo(x, y);
      path.lineTo(x + stepX * 0.5, y + stepY * 0.78);
      path.lineTo(x + stepX, y);
      raisedStroke(context, path, Math.max(1.2, 4.6 * unit), unit);
    }
  }
}

function drawHerringbone(context: CanvasRenderingContext2D, bounds: Bounds, unit: number) {
  const stepX = 27 * unit;
  const stepY = 26 * unit;
  for (let x = bounds.left - stepX; x < bounds.right + stepX; x += stepX) {
    const post = new Path2D();
    post.moveTo(x, bounds.top - stepY);
    post.bezierCurveTo(x - 2.2 * unit, bounds.top + bounds.height * 0.33, x + 2.2 * unit, bounds.top + bounds.height * 0.66, x, bounds.bottom + stepY);
    raisedStroke(context, post, Math.max(1.2, 4.4 * unit), unit);
  }
  for (let y = bounds.top; y < bounds.bottom + stepY; y += stepY) {
    for (let x = bounds.left - stepX; x < bounds.right + stepX; x += stepX) {
      const bridge = new Path2D();
      bridge.moveTo(x - stepX * 0.44, y - stepY * 0.30);
      bridge.lineTo(x, y + stepY * 0.22);
      bridge.lineTo(x + stepX * 0.44, y - stepY * 0.30);
      raisedStroke(context, bridge, Math.max(1, 3.3 * unit), unit * 0.82);
    }
  }
}

function drawBasket(context: CanvasRenderingContext2D, bounds: Bounds, unit: number) {
  const cell = 38 * unit;
  for (let row = -1, y = bounds.top - cell; y < bounds.bottom + cell; y += cell, row += 1) {
    for (let column = -1, x = bounds.left - cell; x < bounds.right + cell; x += cell, column += 1) {
      const horizontalFirst = (row + column) % 2 === 0;
      const horizontal = new Path2D();
      horizontal.moveTo(x + 4 * unit, y + cell * 0.34);
      horizontal.lineTo(x + cell - 4 * unit, y + cell * 0.34);
      horizontal.moveTo(x + 4 * unit, y + cell * 0.66);
      horizontal.lineTo(x + cell - 4 * unit, y + cell * 0.66);
      const vertical = new Path2D();
      vertical.moveTo(x + cell * 0.34, y + 4 * unit);
      vertical.lineTo(x + cell * 0.34, y + cell - 4 * unit);
      vertical.moveTo(x + cell * 0.66, y + 4 * unit);
      vertical.lineTo(x + cell * 0.66, y + cell - 4 * unit);
      raisedStroke(context, horizontalFirst ? vertical : horizontal, Math.max(1.1, 4.2 * unit), unit * 0.72);
      raisedStroke(context, horizontalFirst ? horizontal : vertical, Math.max(1.2, 5.0 * unit), unit);
    }
  }
}

function drawShell(context: CanvasRenderingContext2D, bounds: Bounds, unit: number) {
  const stepX = 42 * unit;
  const stepY = 31 * unit;
  for (let row = -1, y = bounds.top - stepY; y < bounds.bottom + stepY; y += stepY, row += 1) {
    const offset = row % 2 ? stepX * 0.5 : 0;
    for (let x = bounds.left - stepX + offset; x < bounds.right + stepX; x += stepX) {
      const path = new Path2D();
      path.arc(x, y + stepY * 0.46, stepX * 0.36, Math.PI * 1.08, Math.PI * 1.92);
      path.moveTo(x, y + stepY * 0.06);
      path.lineTo(x, y + stepY * 0.70);
      path.moveTo(x - stepX * 0.20, y + stepY * 0.14);
      path.lineTo(x, y + stepY * 0.70);
      path.moveTo(x + stepX * 0.20, y + stepY * 0.14);
      path.lineTo(x, y + stepY * 0.70);
      raisedStroke(context, path, Math.max(1.1, 3.7 * unit), unit * 0.82);
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
    };
  }, [layer]);

  if (!layer) return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      className="abags-crochet-relief-surface"
      data-abags-crochet-relief-surface="stitch-depth-v1"
      aria-hidden="true"
    />,
    layer,
  );
}
