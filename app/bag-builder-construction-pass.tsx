"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Config = {
  family: Family;
  color: string;
  flap: string;
  handles: string;
  strap: string;
  hardware: string;
};
type View = { rx: number; ry: number; zoom: number };
type Point = { x: number; y: number };

const DEFAULT_VIEW: View = { rx: -0.08, ry: 0.52, zoom: 0.8 };
const MIN_ZOOM = 0.34;
const MAX_ZOOM = 1.45;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readConfig(stage: HTMLElement): Config {
  return {
    family: (stage.dataset.family || "") as Family,
    color: stage.dataset.color || "#e8ddcc",
    flap: stage.dataset.flap || "none",
    handles: stage.dataset.handles || "none",
    strap: stage.dataset.strap || "none",
    hardware: stage.dataset.hardware || "gold",
  };
}

function sameConfig(a: Config, b: Config) {
  return a.family === b.family && a.color === b.color && a.flap === b.flap && a.handles === b.handles && a.strap === b.strap && a.hardware === b.hardware;
}

function familyMetrics(family: Family) {
  if (family === "round") return { w: 0.95, h: 0.78, cy: 0.53, side: 0.84, bottom: 0.83, top: 0.78, gusset: 0.13 };
  if (family === "bucket") return { w: 0.82, h: 0.96, cy: 0.51, side: 0.78, bottom: 0.91, top: 0.68, gusset: 0.14 };
  if (family === "mini") return { w: 0.69, h: 0.72, cy: 0.53, side: 0.82, bottom: 0.87, top: 0.76, gusset: 0.12 };
  return { w: 0.91, h: 0.87, cy: 0.51, side: 0.9, bottom: 0.94, top: 0.9, gusset: 0.12 };
}

function bounds(width: number, height: number, family: Family, view: View) {
  const m = familyMetrics(family);
  const yaw = Math.cos(view.ry);
  const foreshorten = 0.34 + Math.abs(yaw) * 0.66;
  const halfW = width * 0.31 * m.w * foreshorten * (view.zoom / 0.8);
  const halfH = height * 0.43 * m.h * (view.zoom / 0.8);
  const cx = width * 0.5 + Math.sin(view.ry) * width * 0.018;
  const cy = height * m.cy + Math.sin(view.rx) * height * 0.035;
  return { ...m, cx, cy, halfW, halfH, left: cx - halfW, right: cx + halfW, topY: cy - halfH, bottomY: cy + halfH, yaw: view.ry };
}

function strokePath(ctx: CanvasRenderingContext2D, points: Point[], color: string, width: number, dash: number[] = []) {
  if (points.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (dash.length) ctx.setLineDash(dash);
  ctx.stroke();
  ctx.restore();
}

function metalTone(hardware: string) {
  if (hardware === "silver") return "rgba(222,226,231,.9)";
  if (hardware === "black") return "rgba(47,44,48,.92)";
  return "rgba(202,165,93,.94)";
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.4, radius * 0.28);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawConstruction(canvas: HTMLCanvasElement, config: Config, view: View) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const pw = Math.round(width * dpr);
  const ph = Math.round(height * dpr);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (!config.family) return;

  const b = bounds(width, height, config.family, view);
  const perspectiveSide = Math.abs(Math.sin(view.ry));
  const nearRight = Math.sin(view.ry) >= 0;
  const seam = "rgba(58,37,43,.32)";
  const seamLight = "rgba(255,255,255,.32)";
  const metal = metalTone(config.hardware);

  // Upper mouth/rim: slightly compressed at 3/4 and side views.
  ctx.save();
  ctx.translate(b.cx, b.topY + b.halfH * 0.16);
  ctx.scale(1, 0.34 + perspectiveSide * 0.12);
  ctx.strokeStyle = seam;
  ctx.lineWidth = Math.max(1.1, 2.2 * view.zoom);
  ctx.beginPath();
  ctx.ellipse(0, 0, b.halfW * b.top, b.halfW * 0.17, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = seamLight;
  ctx.lineWidth = Math.max(0.8, 1.2 * view.zoom);
  ctx.beginPath();
  ctx.ellipse(0, -1.5, b.halfW * b.top * 0.97, b.halfW * 0.14, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Side gusset construction only becomes pronounced once the bag rotates away from front view.
  if (perspectiveSide > 0.08) {
    const nearX = nearRight ? b.right : b.left;
    const direction = nearRight ? -1 : 1;
    const inset = b.halfW * (0.045 + b.gusset * perspectiveSide);
    const top = { x: nearX + direction * inset, y: b.topY + b.halfH * 0.22 };
    const mid = { x: nearX + direction * inset * 1.4, y: b.cy + b.halfH * 0.08 };
    const bottom = { x: nearX + direction * inset * 2.2, y: b.bottomY - b.halfH * 0.16 };
    strokePath(ctx, [top, mid, bottom], `rgba(55,35,40,${0.2 + perspectiveSide * 0.34})`, Math.max(1.1, 2.2 * view.zoom));
    strokePath(ctx, [
      { x: top.x + direction * 2, y: top.y },
      { x: mid.x + direction * 2, y: mid.y },
      { x: bottom.x + direction * 2, y: bottom.y },
    ], `rgba(255,255,255,${0.12 + perspectiveSide * 0.15})`, Math.max(0.7, 1.1 * view.zoom));
  }

  // Bottom/base seam gives the bag a constructed base rather than a flat cut-off silhouette.
  ctx.save();
  ctx.strokeStyle = seam;
  ctx.lineWidth = Math.max(1.1, 2.4 * view.zoom);
  ctx.beginPath();
  ctx.ellipse(b.cx, b.bottomY - b.halfH * 0.12, b.halfW * b.bottom * 0.76, b.halfH * (0.07 + perspectiveSide * 0.025), 0, 0.05 * Math.PI, 0.95 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = seamLight;
  ctx.lineWidth = Math.max(0.7, 1.1 * view.zoom);
  ctx.beginPath();
  ctx.ellipse(b.cx, b.bottomY - b.halfH * 0.14, b.halfW * b.bottom * 0.73, b.halfH * 0.05, 0, 0.08 * Math.PI, 0.92 * Math.PI);
  ctx.stroke();
  ctx.restore();

  // Handle attachment tabs/rings are family-specific and stay attached to the upper construction line.
  if (config.handles !== "none") {
    const tabY = b.topY + b.halfH * (config.family === "round" ? 0.28 : 0.2);
    const tabX = b.halfW * (config.family === "bucket" ? 0.46 : 0.55);
    const wood = config.handles.startsWith("wood-");
    [-1, 1].forEach((sign) => {
      const x = b.cx + sign * tabX;
      if (wood) {
        ctx.save();
        ctx.fillStyle = "rgba(92,57,42,.72)";
        ctx.strokeStyle = "rgba(255,255,255,.22)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x - 9 * view.zoom, tabY - 7 * view.zoom, 18 * view.zoom, 25 * view.zoom, 6 * view.zoom);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        drawRing(ctx, x, tabY + 6 * view.zoom, 5.5 * view.zoom, metal, 0.96);
      } else {
        drawRing(ctx, x, tabY + 5 * view.zoom, 5 * view.zoom, "rgba(74,48,54,.4)", 0.88);
      }
    });
  }

  // Strap anchors live on the side seam rather than floating over the front face.
  if (config.strap !== "none") {
    const anchorY = b.topY + b.halfH * 0.34;
    const outward = b.halfW * (0.94 + perspectiveSide * 0.04);
    const alphaNear = 0.98;
    const alphaFar = 0.46 + (1 - perspectiveSide) * 0.28;
    drawRing(ctx, b.cx - outward, anchorY, 7 * view.zoom, metal, nearRight ? alphaFar : alphaNear);
    drawRing(ctx, b.cx + outward, anchorY, 7 * view.zoom, metal, nearRight ? alphaNear : alphaFar);
    ctx.save();
    ctx.strokeStyle = "rgba(72,47,54,.3)";
    ctx.lineWidth = Math.max(1.1, 2.4 * view.zoom);
    ctx.beginPath();
    ctx.moveTo(b.cx - outward + 7 * view.zoom, anchorY + 4 * view.zoom);
    ctx.lineTo(b.cx - b.halfW * 0.84, anchorY + b.halfH * 0.15);
    ctx.moveTo(b.cx + outward - 7 * view.zoom, anchorY + 4 * view.zoom);
    ctx.lineTo(b.cx + b.halfW * 0.84, anchorY + b.halfH * 0.15);
    ctx.stroke();
    ctx.restore();
  }

  // Flap edge piping + stitch line follow the same proportions as the live flap geometry.
  if (config.flap !== "none") {
    const flapTop = b.topY + b.halfH * 0.24;
    const flapBottom = b.topY + b.halfH * (config.family === "round" ? 0.88 : 0.82);
    const flapHalf = b.halfW * (config.family === "mini" ? 0.62 : 0.68);
    ctx.save();
    ctx.strokeStyle = "rgba(48,31,35,.34)";
    ctx.lineWidth = Math.max(1.1, 2 * view.zoom);
    ctx.beginPath();
    ctx.moveTo(b.cx - flapHalf, flapTop + 4 * view.zoom);
    ctx.quadraticCurveTo(b.cx, flapTop - b.halfH * 0.08, b.cx + flapHalf, flapTop + 4 * view.zoom);
    ctx.quadraticCurveTo(b.cx + flapHalf * 0.86, flapBottom, b.cx, flapBottom + b.halfH * 0.08);
    ctx.quadraticCurveTo(b.cx - flapHalf * 0.86, flapBottom, b.cx - flapHalf, flapTop + 4 * view.zoom);
    ctx.stroke();
    ctx.setLineDash([4 * view.zoom, 5 * view.zoom]);
    ctx.strokeStyle = "rgba(255,255,255,.36)";
    ctx.lineWidth = Math.max(0.8, 1.2 * view.zoom);
    ctx.beginPath();
    ctx.moveTo(b.cx - flapHalf * 0.9, flapTop + 8 * view.zoom);
    ctx.quadraticCurveTo(b.cx, flapTop - b.halfH * 0.055, b.cx + flapHalf * 0.9, flapTop + 8 * view.zoom);
    ctx.quadraticCurveTo(b.cx + flapHalf * 0.77, flapBottom - 5 * view.zoom, b.cx, flapBottom + b.halfH * 0.045);
    ctx.quadraticCurveTo(b.cx - flapHalf * 0.77, flapBottom - 5 * view.zoom, b.cx - flapHalf * 0.9, flapTop + 8 * view.zoom);
    ctx.stroke();
    ctx.restore();
  }
}

export default function BagBuilderConstructionPass() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [config, setConfig] = useState<Config>({ family: "", color: "#e8ddcc", flap: "none", handles: "none", strap: "none", hardware: "gold" });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<View>({ ...DEFAULT_VIEW });
  const dragRef = useRef<{ id: number; x: number; y: number; rx: number; ry: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const frameRef = useRef(0);

  useEffect(() => {
    const find = () => setStage((current) => {
      const next = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
      return current === next ? current : next;
    });
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!stage) return;
    const sync = () => setConfig((current) => {
      const next = readConfig(stage);
      return sameConfig(current, next) ? current : next;
    });
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(stage, { attributes: true, attributeFilter: ["data-family", "data-color", "data-flap", "data-handles", "data-strap", "data-hardware"] });
    return () => observer.disconnect();
  }, [stage]);

  useEffect(() => {
    if (!stage) return;
    const redraw = () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        if (canvasRef.current) drawConstruction(canvasRef.current, readConfig(stage), viewRef.current);
      });
    };
    const distance = () => {
      const pts = Array.from(pointersRef.current.values());
      return pts.length < 2 ? 0 : Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };
    const pointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof HTMLCanvasElement)) return;
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointersRef.current.size >= 2) pinchRef.current = { distance: distance(), zoom: viewRef.current.zoom };
      else dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, rx: viewRef.current.rx, ry: viewRef.current.ry };
    };
    const pointerMove = (event: PointerEvent) => {
      if (pointersRef.current.has(event.pointerId)) pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointersRef.current.size >= 2 && pinchRef.current) {
        const next = distance();
        if (pinchRef.current.distance > 0) viewRef.current.zoom = clamp(pinchRef.current.zoom * next / pinchRef.current.distance, MIN_ZOOM, MAX_ZOOM);
      } else if (dragRef.current?.id === event.pointerId) {
        viewRef.current.rx = clamp(dragRef.current.rx + (event.clientY - dragRef.current.y) * 0.008, -0.72, 0.56);
        viewRef.current.ry = dragRef.current.ry + (event.clientX - dragRef.current.x) * 0.012;
      }
      redraw();
    };
    const pointerEnd = (event: PointerEvent) => {
      pointersRef.current.delete(event.pointerId);
      if (pointersRef.current.size < 2) pinchRef.current = null;
      if (dragRef.current?.id === event.pointerId) dragRef.current = null;
    };
    const click = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest?.("button");
      if (!(button instanceof HTMLButtonElement)) return;
      const text = button.textContent?.trim();
      if (text === "Przód") viewRef.current = { ...viewRef.current, rx: -0.02, ry: 0 };
      else if (text === "3/4") viewRef.current = { ...DEFAULT_VIEW };
      else if (text === "Bok") viewRef.current = { ...viewRef.current, rx: -0.07, ry: Math.PI / 2 };
      else if (button.classList.contains("abags-pro3d-reset") || button.classList.contains("abags-canvas3d-reset")) viewRef.current = { ...DEFAULT_VIEW };
      else return;
      redraw();
    };
    const input = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "range") return;
      const percent = Number(input.value);
      if (Number.isFinite(percent)) viewRef.current.zoom = clamp(percent / 100, MIN_ZOOM, MAX_ZOOM);
      redraw();
    };
    const wheel = (event: WheelEvent) => {
      if (!(event.target instanceof HTMLCanvasElement)) return;
      viewRef.current.zoom = clamp(viewRef.current.zoom - event.deltaY * 0.0008, MIN_ZOOM, MAX_ZOOM);
      redraw();
    };

    stage.addEventListener("pointerdown", pointerDown, true);
    stage.addEventListener("pointermove", pointerMove, true);
    stage.addEventListener("pointerup", pointerEnd, true);
    stage.addEventListener("pointercancel", pointerEnd, true);
    stage.addEventListener("click", click, true);
    stage.addEventListener("input", input, true);
    stage.addEventListener("wheel", wheel, { capture: true, passive: true });
    window.addEventListener("resize", redraw);
    stage.classList.add("abags-construction-pass-active");
    stage.setAttribute("data-abags-construction-pass", "atelier-v1");
    redraw();

    return () => {
      cancelAnimationFrame(frameRef.current);
      stage.removeEventListener("pointerdown", pointerDown, true);
      stage.removeEventListener("pointermove", pointerMove, true);
      stage.removeEventListener("pointerup", pointerEnd, true);
      stage.removeEventListener("pointercancel", pointerEnd, true);
      stage.removeEventListener("click", click, true);
      stage.removeEventListener("input", input, true);
      stage.removeEventListener("wheel", wheel, true);
      window.removeEventListener("resize", redraw);
      stage.classList.remove("abags-construction-pass-active");
      stage.removeAttribute("data-abags-construction-pass");
    };
  }, [stage]);

  useEffect(() => {
    if (!stage || !canvasRef.current) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => drawConstruction(canvasRef.current!, config, viewRef.current));
    return () => cancelAnimationFrame(frameRef.current);
  }, [config, stage]);

  if (!stage) return null;
  return createPortal(
    <div className="abags-construction-pass" aria-hidden="true" data-abags-construction-calibration="true">
      <canvas ref={canvasRef} className="abags-construction-pass-canvas" />
    </div>,
    stage,
  );
}
