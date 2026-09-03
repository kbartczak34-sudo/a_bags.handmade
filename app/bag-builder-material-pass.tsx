"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Stitch = "" | "classic" | "herringbone" | "basket" | "shell";
type Config = {
  family: Family;
  color: string;
  stitch: Stitch;
  flap: string;
  handles: string;
  strap: string;
  hardware: string;
};

type ViewState = {
  rx: number;
  ry: number;
  zoom: number;
};

type Point = { x: number; y: number };

const DEFAULT_VIEW: ViewState = { rx: -0.08, ry: 0.52, zoom: 0.8 };
const MIN_ZOOM = 0.34;
const MAX_ZOOM = 1.45;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readConfig(stage: HTMLElement): Config {
  return {
    family: (stage.dataset.family || "") as Family,
    color: stage.dataset.color || "#e8ddcc",
    stitch: (stage.dataset.stitch || "classic") as Stitch,
    flap: stage.dataset.flap || "none",
    handles: stage.dataset.handles || "none",
    strap: stage.dataset.strap || "none",
    hardware: stage.dataset.hardware || "gold",
  };
}

function sameConfig(a: Config, b: Config) {
  return a.family === b.family && a.color === b.color && a.stitch === b.stitch && a.flap === b.flap && a.handles === b.handles && a.strap === b.strap && a.hardware === b.hardware;
}

function hexRgb(value: string) {
  const raw = value.replace("#", "").padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(raw || "e8ddcc", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function colorShift(value: string, amount: number, alpha = 1) {
  const { r, g, b } = hexRgb(value);
  return `rgba(${clamp(Math.round(r + amount), 0, 255)},${clamp(Math.round(g + amount), 0, 255)},${clamp(Math.round(b + amount), 0, 255)},${alpha})`;
}

function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function familySize(family: Family) {
  if (family === "round") return { w: 0.95, h: 0.78, y: 0.53, radius: 0.48 };
  if (family === "bucket") return { w: 0.82, h: 0.96, y: 0.51, radius: 0.28 };
  if (family === "mini") return { w: 0.69, h: 0.72, y: 0.53, radius: 0.27 };
  return { w: 0.91, h: 0.87, y: 0.51, radius: 0.2 };
}

function silhouette(ctx: CanvasRenderingContext2D, width: number, height: number, family: Family, view: ViewState) {
  const size = familySize(family);
  const yaw = Math.cos(view.ry);
  const foreshorten = 0.34 + Math.abs(yaw) * 0.66;
  const w = width * 0.31 * size.w * foreshorten * (view.zoom / 0.8);
  const h = height * 0.43 * size.h * (view.zoom / 0.8);
  const cx = width * 0.5 + Math.sin(view.ry) * width * 0.018;
  const cy = height * size.y + Math.sin(view.rx) * height * 0.035;
  const left = cx - w;
  const top = cy - h;
  const right = cx + w;
  const bottom = cy + h;

  ctx.beginPath();
  if (family === "round") {
    ctx.moveTo(left + w * 0.2, top + h * 0.16);
    ctx.quadraticCurveTo(cx, top - h * 0.07, right - w * 0.2, top + h * 0.16);
    ctx.quadraticCurveTo(right + w * 0.05, cy + h * 0.35, cx + w * 0.42, bottom - h * 0.08);
    ctx.quadraticCurveTo(cx, bottom + h * 0.08, cx - w * 0.42, bottom - h * 0.08);
    ctx.quadraticCurveTo(left - w * 0.05, cy + h * 0.35, left + w * 0.2, top + h * 0.16);
  } else if (family === "bucket") {
    ctx.moveTo(left + w * 0.14, top);
    ctx.quadraticCurveTo(cx, top - h * 0.04, right - w * 0.14, top);
    ctx.lineTo(right, bottom - h * 0.08);
    ctx.quadraticCurveTo(cx, bottom + h * 0.04, left, bottom - h * 0.08);
    ctx.closePath();
  } else {
    const r = Math.min(w, h) * size.radius;
    ctx.roundRect(left, top, w * 2, h * 2, r);
  }
  ctx.closePath();
  return { left, top, right, bottom, cx, cy, w, h, foreshorten };
}

function drawYarn(ctx: CanvasRenderingContext2D, bounds: ReturnType<typeof silhouette>, config: Config, width: number, height: number) {
  ctx.save();
  ctx.clip();
  const spacing = Math.max(8, Math.min(width, height) * 0.021);
  const dark = colorShift(config.color, -56, 0.23);
  const light = colorShift(config.color, 92, 0.31);
  const fiber = colorShift(config.color, 118, 0.22);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (config.stitch === "herringbone") {
    ctx.lineWidth = Math.max(1, spacing * 0.16);
    for (let y = bounds.top - spacing; y <= bounds.bottom + spacing; y += spacing * 0.72) {
      for (let x = bounds.left - spacing; x <= bounds.right + spacing; x += spacing * 1.15) {
        ctx.strokeStyle = dark;
        ctx.beginPath();
        ctx.moveTo(x, y + spacing * 0.12);
        ctx.lineTo(x + spacing * 0.55, y + spacing * 0.56);
        ctx.lineTo(x + spacing * 1.1, y + spacing * 0.12);
        ctx.stroke();
        ctx.strokeStyle = light;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + spacing * 0.55, y + spacing * 0.44);
        ctx.lineTo(x + spacing * 1.1, y);
        ctx.stroke();
      }
    }
  } else if (config.stitch === "basket") {
    ctx.lineWidth = Math.max(1.1, spacing * 0.2);
    for (let y = bounds.top; y <= bounds.bottom; y += spacing) {
      ctx.strokeStyle = light;
      ctx.beginPath(); ctx.moveTo(bounds.left, y); ctx.lineTo(bounds.right, y); ctx.stroke();
      ctx.strokeStyle = dark;
      ctx.beginPath(); ctx.moveTo(bounds.left, y + spacing * 0.19); ctx.lineTo(bounds.right, y + spacing * 0.19); ctx.stroke();
    }
    for (let x = bounds.left; x <= bounds.right; x += spacing) {
      ctx.strokeStyle = fiber;
      ctx.beginPath(); ctx.moveTo(x, bounds.top); ctx.lineTo(x, bounds.bottom); ctx.stroke();
    }
  } else if (config.stitch === "shell") {
    ctx.lineWidth = Math.max(1.1, spacing * 0.16);
    for (let y = bounds.top; y <= bounds.bottom + spacing; y += spacing * 0.72) {
      for (let x = bounds.left - spacing; x <= bounds.right + spacing; x += spacing * 1.25) {
        ctx.strokeStyle = dark;
        ctx.beginPath(); ctx.arc(x, y + 2, spacing * 0.58, Math.PI, 0); ctx.stroke();
        ctx.strokeStyle = light;
        ctx.beginPath(); ctx.arc(x, y, spacing * 0.55, Math.PI, 0); ctx.stroke();
      }
    }
  } else {
    ctx.lineWidth = Math.max(1, spacing * 0.15);
    for (let y = bounds.top; y <= bounds.bottom + spacing; y += spacing * 0.62) {
      for (let x = bounds.left - spacing; x <= bounds.right + spacing; x += spacing * 0.82) {
        ctx.strokeStyle = dark;
        ctx.beginPath();
        ctx.moveTo(x - spacing * 0.3, y + spacing * 0.3);
        ctx.quadraticCurveTo(x, y - spacing * 0.35, x + spacing * 0.3, y + spacing * 0.3);
        ctx.stroke();
        ctx.strokeStyle = light;
        ctx.beginPath();
        ctx.moveTo(x - spacing * 0.26, y + spacing * 0.2);
        ctx.quadraticCurveTo(x, y - spacing * 0.27, x + spacing * 0.26, y + spacing * 0.2);
        ctx.stroke();
      }
    }
  }

  const random = mulberry(6119 + config.color.length * 17 + config.stitch.length * 53);
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 170; i += 1) {
    const x = bounds.left + random() * (bounds.right - bounds.left);
    const y = bounds.top + random() * (bounds.bottom - bounds.top);
    const length = 2 + random() * 7;
    ctx.strokeStyle = random() > 0.46 ? fiber : dark;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + length * 0.45, y - 1.2, x + length, y + (random() - 0.5) * 2.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLeatherGrain(ctx: CanvasRenderingContext2D, bounds: ReturnType<typeof silhouette>, config: Config) {
  if (!config.flap.startsWith("leather") && !config.flap.startsWith("suede")) return;
  const flapTop = bounds.top + bounds.h * 0.08;
  const flapBottom = bounds.top + bounds.h * 0.8;
  const flapLeft = bounds.cx - bounds.w * 0.68;
  const flapRight = bounds.cx + bounds.w * 0.68;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(flapLeft, flapTop + bounds.h * 0.12);
  ctx.quadraticCurveTo(bounds.cx, flapTop - bounds.h * 0.08, flapRight, flapTop + bounds.h * 0.12);
  ctx.quadraticCurveTo(bounds.cx + bounds.w * 0.56, flapBottom, bounds.cx, flapBottom + bounds.h * 0.08);
  ctx.quadraticCurveTo(bounds.cx - bounds.w * 0.56, flapBottom, flapLeft, flapTop + bounds.h * 0.12);
  ctx.clip();
  const random = mulberry(config.flap.length * 913);
  const suede = config.flap.startsWith("suede");
  ctx.globalCompositeOperation = "soft-light";
  for (let i = 0; i < 260; i += 1) {
    const x = flapLeft + random() * (flapRight - flapLeft);
    const y = flapTop + random() * (flapBottom - flapTop);
    const r = suede ? 0.5 + random() * 1.5 : 0.35 + random() * 1.05;
    ctx.fillStyle = random() > 0.5 ? `rgba(255,255,255,${suede ? 0.09 : 0.12})` : `rgba(24,16,18,${suede ? 0.08 : 0.1})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawWoodGrain(ctx: CanvasRenderingContext2D, bounds: ReturnType<typeof silhouette>, config: Config) {
  if (!config.handles.startsWith("wood-")) return;
  const dark = config.handles === "wood-dark" ? "rgba(47,20,11,.27)" : "rgba(112,68,30,.2)";
  const light = config.handles === "wood-dark" ? "rgba(229,174,110,.16)" : "rgba(255,235,188,.28)";
  const rx = bounds.w * 0.72;
  const ry = bounds.h * 0.76;
  const baseY = bounds.top + bounds.h * 0.12;
  ctx.save();
  ctx.lineCap = "round";
  for (let pass = 0; pass < 7; pass += 1) {
    const offset = (pass - 3) * 1.8;
    ctx.strokeStyle = pass % 2 ? dark : light;
    ctx.lineWidth = pass % 2 ? 0.8 : 1.1;
    ctx.beginPath();
    for (let i = 0; i <= 44; i += 1) {
      const t = Math.PI - (i / 44) * Math.PI;
      const x = bounds.cx + Math.cos(t) * (rx + offset);
      const y = baseY - Math.sin(t) * (ry * 0.58) + Math.sin(t * 5 + pass) * 0.7;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawMetalGlints(ctx: CanvasRenderingContext2D, bounds: ReturnType<typeof silhouette>, config: Config, light: Point) {
  const tone = config.hardware === "silver" ? "rgba(245,250,255,.58)" : config.hardware === "black" ? "rgba(255,255,255,.24)" : "rgba(255,244,190,.62)";
  const points: Point[] = [
    { x: bounds.cx, y: bounds.cy + bounds.h * 0.18 },
    { x: bounds.left + bounds.w * 0.16, y: bounds.top + bounds.h * 0.38 },
    { x: bounds.right - bounds.w * 0.16, y: bounds.top + bounds.h * 0.38 },
  ];
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  points.forEach((point, index) => {
    const dx = point.x - light.x;
    const dy = point.y - light.y;
    const influence = clamp(1 - Math.hypot(dx, dy) / Math.max(bounds.w * 2.8, 1), 0.18, 1);
    const radius = (index === 0 ? 10 : 7) * influence;
    const gradient = ctx.createRadialGradient(point.x - radius * 0.3, point.y - radius * 0.35, 0, point.x, point.y, radius);
    gradient.addColorStop(0, tone);
    gradient.addColorStop(0.3, tone);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

function render(canvas: HTMLCanvasElement, config: Config, view: ViewState, lightNorm: Point) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (!config.family) return;

  const bounds = silhouette(ctx, width, height, config.family, view);
  drawYarn(ctx, bounds, config, width, height);
  drawLeatherGrain(ctx, bounds, config);
  drawWoodGrain(ctx, bounds, config);
  drawMetalGlints(ctx, bounds, config, { x: lightNorm.x * width, y: lightNorm.y * height });

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const lx = lightNorm.x * width;
  const ly = lightNorm.y * height;
  const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.min(width, height) * 0.42);
  glow.addColorStop(0, "rgba(255,250,242,.14)");
  glow.addColorStop(0.52, "rgba(255,246,236,.045)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export default function BagBuilderMaterialPass() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [config, setConfig] = useState<Config>({ family: "", color: "#e8ddcc", stitch: "classic", flap: "none", handles: "none", strap: "none", hardware: "gold" });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<ViewState>({ ...DEFAULT_VIEW });
  const lightRef = useRef<Point>({ x: 0.34, y: 0.24 });
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
    observer.observe(stage, { attributes: true, attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware"] });
    return () => observer.disconnect();
  }, [stage]);

  useEffect(() => {
    if (!stage) return;
    const redraw = () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        if (canvasRef.current) render(canvasRef.current, readConfig(stage), viewRef.current, lightRef.current);
      });
    };
    const distance = () => {
      const points = Array.from(pointersRef.current.values());
      return points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    };
    const pointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof HTMLCanvasElement)) return;
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointersRef.current.size >= 2) pinchRef.current = { distance: distance(), zoom: viewRef.current.zoom };
      else dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, rx: viewRef.current.rx, ry: viewRef.current.ry };
    };
    const pointerMove = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      lightRef.current = {
        x: clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0.08, 0.92),
        y: clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0.08, 0.86),
      };
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
    const wheel = (event: WheelEvent) => {
      if (!(event.target instanceof HTMLCanvasElement)) return;
      viewRef.current.zoom = clamp(viewRef.current.zoom - event.deltaY * 0.0008, MIN_ZOOM, MAX_ZOOM);
      redraw();
    };
    const click = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest?.("button");
      if (!(button instanceof HTMLButtonElement)) return;
      const text = button.textContent?.trim();
      if (text === "Przód") viewRef.current = { ...viewRef.current, rx: -0.02, ry: 0 };
      else if (text === "3/4") viewRef.current = { ...viewRef.current, rx: -0.08, ry: 0.52 };
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
    const resize = () => redraw();

    stage.addEventListener("pointerdown", pointerDown, true);
    stage.addEventListener("pointermove", pointerMove, true);
    stage.addEventListener("pointerup", pointerEnd, true);
    stage.addEventListener("pointercancel", pointerEnd, true);
    stage.addEventListener("wheel", wheel, { capture: true, passive: true });
    stage.addEventListener("click", click, true);
    stage.addEventListener("input", input, true);
    window.addEventListener("resize", resize);
    stage.classList.add("abags-material-pass-active");
    stage.setAttribute("data-abags-material-pass", "procedural-v1");
    redraw();

    return () => {
      cancelAnimationFrame(frameRef.current);
      stage.removeEventListener("pointerdown", pointerDown, true);
      stage.removeEventListener("pointermove", pointerMove, true);
      stage.removeEventListener("pointerup", pointerEnd, true);
      stage.removeEventListener("pointercancel", pointerEnd, true);
      stage.removeEventListener("wheel", wheel, true);
      stage.removeEventListener("click", click, true);
      stage.removeEventListener("input", input, true);
      window.removeEventListener("resize", resize);
      stage.classList.remove("abags-material-pass-active");
      stage.removeAttribute("data-abags-material-pass");
    };
  }, [stage]);

  useEffect(() => {
    if (!stage || !canvasRef.current) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => render(canvasRef.current!, config, viewRef.current, lightRef.current));
    return () => cancelAnimationFrame(frameRef.current);
  }, [config, stage]);

  if (!stage) return null;
  return createPortal(
    <div className="abags-material-pass" aria-hidden="true" data-abags-material-realism="true">
      <canvas ref={canvasRef} className="abags-material-pass-canvas" />
      <div className="abags-material-pass-vignette" />
    </div>,
    stage,
  );
}
