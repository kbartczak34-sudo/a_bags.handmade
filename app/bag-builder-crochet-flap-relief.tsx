"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS } from "../lib/abags-fidelity-v4-family-spec";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Rotation = { x: number; y: number };
type TransformDetail = { rotation?: Rotation; zoom?: number };
type Point3 = [number, number, number];
type Point2 = { x: number; y: number; scale: number };
type Bounds = { left: number; right: number; top: number; bottom: number; width: number; height: number };

const DEFAULT_ROTATION: Rotation = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const RELIEF_VERSION = "crochet-flap-stitch-v1";

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

function flapContour(family: Exclude<Family, "">): Point3[] {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const centerY = spec.flapY ?? 0.29;
  const rx = 0.80 * spec.flapScale[0];
  const ry = 0.36 * spec.flapScale[1];
  return Array.from({ length: 60 }, (_, index) => {
    const angle = (index / 60) * Math.PI * 2;
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
  const projected = flapContour(family)
    .map((point) => project(point, width, height, rotation, zoom))
    .filter((point): point is Point2 => Boolean(point));
  if (projected.length < 8) return null;

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

function strokeRelief(context: CanvasRenderingContext2D, path: Path2D, width: number, unit: number, strength = 1) {
  context.save();
  context.translate(0.72 * unit, 0.95 * unit);
  context.strokeStyle = `rgba(25,18,21,${0.24 * strength})`;
  context.lineWidth = Math.max(1.05, width * 1.52);
  context.stroke(path);
  context.restore();

  context.strokeStyle = `rgba(45,31,36,${0.12 * strength})`;
  context.lineWidth = Math.max(0.9, width);
  context.stroke(path);

  context.save();
  context.translate(-0.48 * unit, -0.52 * unit);
  context.strokeStyle = `rgba(255,255,255,${0.25 * strength})`;
  context.lineWidth = Math.max(0.55, width * 0.34);
  context.stroke(path);
  context.restore();
}

function drawClassic(context: CanvasRenderingContext2D, bounds: Bounds, unit: number) {
  const stepX = 18 * unit;
  const stepY = 17 * unit;
  for (let y = bounds.top - stepY; y < bounds.bottom + stepY; y += stepY) {
    for (let x = bounds.left - stepX; x < bounds.right + stepX; x += stepX) {
      const path = new Path2D();
      path.moveTo(x - 6.1 * unit, y - 4.8 * unit);
      path.quadraticCurveTo(x - 2.2 * unit, y + 1.4 * unit, x, y + 5.4 * unit);
      path.quadraticCurveTo(x + 2.2 * unit, y + 1.4 * unit, x + 6.1 * unit, y - 4.8 * unit);
      strokeRelief(context, path, 3.3 * unit, unit, 0.92);
    }
  }
}

function drawHerringbone(context: CanvasRenderingContext2D, bounds: Bounds, unit: number) {
  const stepX = 17 * unit;
  const stepY = 15 * unit;
  for (let x = bounds.left - stepX; x < bounds.right + stepX; x += stepX) {
    const post = new Path2D();
    post.moveTo(x, bounds.top - 5 * unit);
    post.lineTo(x, bounds.bottom + 5 * unit);
    strokeRelief(context, post, 3.0 * unit, unit, 0.76);
    let row = 0;
    for (let y = bounds.top - stepY; y < bounds.bottom + stepY; y += stepY, row += 1) {
      const bridge = new Path2D();
      const direction = row % 2 ? -1 : 1;
      bridge.moveTo(x - 6.4 * unit, y - 3.8 * unit * direction);
      bridge.quadraticCurveTo(x, y + 1.3 * unit * direction, x + 6.4 * unit, y + 3.8 * unit * direction);
      strokeRelief(context, bridge, 2.5 * unit, unit, 0.72);
    }
  }
}

function drawBasket(context: CanvasRenderingContext2D, bounds: Bounds, unit: number) {
  const cell = 22 * unit;
  let row = 0;
  for (let y = bounds.top - cell; y < bounds.bottom + cell; y += cell, row += 1) {
    let column = 0;
    for (let x = bounds.left - cell; x < bounds.right + cell; x += cell, column += 1) {
      const horizontal = (row + column) % 2 === 0;
      for (let strand = -1; strand <= 1; strand += 1) {
        const offset = strand * 3.4 * unit;
        const path = new Path2D();
        if (horizontal) {
          path.moveTo(x - 8.8 * unit, y + offset);
          path.quadraticCurveTo(x, y + offset - 0.8 * unit, x + 8.8 * unit, y + offset);
        } else {
          path.moveTo(x + offset, y - 8.8 * unit);
          path.quadraticCurveTo(x + offset + 0.8 * unit, y, x + offset, y + 8.8 * unit);
        }
        strokeRelief(context, path, 2.3 * unit, unit, 0.78);
      }
    }
  }
}

function drawShell(context: CanvasRenderingContext2D, bounds: Bounds, unit: number) {
  const stepX = 24 * unit;
  const stepY = 19 * unit;
  let row = 0;
  for (let y = bounds.top - stepY; y < bounds.bottom + stepY; y += stepY, row += 1) {
    const shift = row % 2 ? stepX * 0.5 : 0;
    for (let x = bounds.left - stepX + shift; x < bounds.right + stepX; x += stepX) {
      for (let spoke = -1; spoke <= 1; spoke += 1) {
        const path = new Path2D();
        path.moveTo(x, y + 5.7 * unit);
        path.quadraticCurveTo(x + spoke * 5.2 * unit, y + 0.4 * unit, x + spoke * 7.0 * unit, y - 4.6 * unit);
        strokeRelief(context, path, 2.25 * unit, unit, 0.70);
      }
      const arc = new Path2D();
      arc.arc(x, y + 0.2 * unit, 7.0 * unit, Math.PI * 1.08, Math.PI * 1.92);
      strokeRelief(context, arc, 2.25 * unit, unit, 0.74);
    }
  }
}

function drawStitch(
  context: CanvasRenderingContext2D,
  bounds: Bounds,
  stitch: string,
  unit: number,
) {
  if (stitch === "herringbone") drawHerringbone(context, bounds, unit);
  else if (stitch === "basket") drawBasket(context, bounds, unit);
  else if (stitch === "shell") drawShell(context, bounds, unit);
  else drawClassic(context, bounds, unit);
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

export default function BagBuilderCrochetFlapRelief() {
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
      stage.removeAttribute("data-abags-crochet-flap-relief");
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
      const flap = projectedFlap(family as Exclude<Family, "">, width, height, rotationRef.current, zoomRef.current);
      if (!flap) {
        clear();
        return;
      }

      const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family as Exclude<Family, "">];
      const snap = project([0, (spec.flapY ?? 0.29) - 0.22, spec.depth / 2 + 0.176], width, height, rotationRef.current, zoomRef.current);
      const unit = Math.max(0.78, Math.min(width, height) / 720) * zoomRef.current;
      const mask = new Path2D();
      mask.addPath(flap.path);
      if (snap) {
        const snapHole = new Path2D();
        snapHole.arc(snap.x, snap.y, Math.max(5.3, 6.8 * unit * snap.scale), 0, Math.PI * 2);
        mask.addPath(snapHole);
      }

      context.save();
      context.clip(mask, snap ? "evenodd" : "nonzero");
      drawStitch(context, flap.bounds, stage.dataset.stitch || "classic", unit);
      context.restore();
      stage.dataset.abagsCrochetFlapRelief = RELIEF_VERSION;
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
        "data-family", "data-flap", "data-stitch", "data-abags-final3d", "data-abags-photo-true",
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
      stage.removeAttribute("data-abags-crochet-flap-relief");
    };
  }, [stage]);

  if (!stage) return null;
  return createPortal(<>
    <canvas ref={canvasRef} className="abags-crochet-flap-relief" data-crochet-flap-relief={RELIEF_VERSION} aria-hidden="true" />
    <style jsx global>{`
      .abags-bag-builder-stage > .abags-crochet-flap-relief {
        position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
        z-index:275!important;pointer-events:none!important;touch-action:none!important;background:transparent!important;
        opacity:.92;
      }
      @media (max-width:620px) {
        .abags-bag-builder-stage > .abags-crochet-flap-relief { opacity:.86; }
      }
      @media (prefers-reduced-motion:reduce) {
        .abags-bag-builder-stage > .abags-crochet-flap-relief { transition:none!important; }
      }
    `}</style>
  </>, stage);
}
