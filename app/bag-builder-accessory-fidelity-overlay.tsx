"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_ACCESSORY_FIDELITY_VERSION, ABAGS_ACCESSORY_VISUAL } from "../lib/abags-accessory-fidelity";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS } from "../lib/abags-fidelity-v4-family-spec";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Config = { family: Family; color: string; stitch: string; flap: string; handles: string; strap: string; hardware: string; accent: string };
type Rotation = { x: number; y: number };
type Point3 = [number, number, number];
type Point2 = { x: number; y: number; scale: number };

const DEFAULT_ROTATION: Rotation = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.42;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readConfig(stage: HTMLElement): Config {
  return {
    family: (stage.dataset.family || "") as Family,
    color: stage.dataset.color || "#E8DDCC",
    stitch: stage.dataset.stitch || "classic",
    flap: stage.dataset.flap || "none",
    handles: stage.dataset.handles || "none",
    strap: stage.dataset.strap || "none",
    hardware: stage.dataset.hardware || "gold",
    accent: stage.dataset.accent || "none",
  };
}

function hardwareColor(value: string) {
  if (value === "silver") return "#D5D9DD";
  if (value === "black") return "#2A292B";
  return "#C9A354";
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

function path3d(ctx: CanvasRenderingContext2D, points: Point3[], width: number, height: number, rotation: Rotation, zoom: number) {
  let started = false;
  ctx.beginPath();
  for (const point of points) {
    const p = project(point, width, height, rotation, zoom);
    if (!p) continue;
    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
    else ctx.lineTo(p.x, p.y);
  }
  return started;
}

function strapArc(family: Exclude<Family, "">) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const archHeight = Math.max(0.78, spec.ry * 1.25);
  return Array.from({ length: 49 }, (_, index) => {
    const t = index / 48;
    const angle = Math.PI - t * Math.PI;
    return [spec.sideAnchor * Math.cos(angle), spec.ringY + archHeight * Math.sin(angle), spec.depth / 2 + 0.055] as Point3;
  });
}

function flapContour(family: Exclude<Family, "">) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const centerY = spec.flapY ?? 0.29;
  const rx = 0.80 * spec.flapScale[0];
  const ry = 0.36 * spec.flapScale[1];
  return Array.from({ length: 37 }, (_, index) => {
    const angle = (index / 36) * Math.PI * 2;
    return [rx * Math.cos(angle), centerY + ry * Math.sin(angle), spec.depth / 2 + 0.142] as Point3;
  });
}

function drawStrap(ctx: CanvasRenderingContext2D, config: Config, width: number, height: number, rotation: Rotation, zoom: number) {
  if (!config.family || config.strap === "none") return;
  const arc = strapArc(config.family as Exclude<Family, "">);
  const scale = Math.max(0.8, Math.min(width, height) / 720) * zoom;

  if (config.strap === "chain") {
    const hardware = hardwareColor(config.hardware);
    const linkCount = ABAGS_ACCESSORY_VISUAL.chainLinks;
    for (let index = 0; index < linkCount; index += 1) {
      const arcIndex = Math.round((index / (linkCount - 1)) * (arc.length - 1));
      const center = project(arc[arcIndex], width, height, rotation, zoom);
      if (!center) continue;
      const next = project(arc[Math.min(arc.length - 1, arcIndex + 1)], width, height, rotation, zoom) ?? center;
      const angle = Math.atan2(next.y - center.y, next.x - center.x) + (index % 2 ? Math.PI / 2 : 0);
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.4 * scale * center.scale, 3.2 * scale * center.scale, 0, 0, Math.PI * 2);
      ctx.strokeStyle = hardware;
      ctx.lineWidth = Math.max(1.2, 1.45 * scale * center.scale);
      ctx.stroke();
      ctx.restore();
    }
    // Real A-Bags chain references use a comfortable leather shoulder section.
    if (path3d(ctx, arc.slice(18, 31), width, height, rotation, zoom)) {
      ctx.strokeStyle = "#76503D";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(4, 6.5 * scale);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.26)";
      ctx.lineWidth = Math.max(1, 1.2 * scale);
      ctx.stroke();
    }
    return;
  }

  if (!path3d(ctx, arc, width, height, rotation, zoom)) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (config.strap === "leather") {
    ctx.strokeStyle = "#704A3B";
    ctx.lineWidth = Math.max(5, 9 * scale);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.20)";
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#8A666C";
    ctx.lineWidth = Math.max(6, 10 * scale);
    ctx.stroke();
    ctx.setLineDash([...ABAGS_ACCESSORY_VISUAL.wovenDash]);
    ctx.strokeStyle = "#EBD9C7";
    ctx.lineWidth = Math.max(2, 3.2 * scale);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawFlapDetail(ctx: CanvasRenderingContext2D, config: Config, width: number, height: number, rotation: Rotation, zoom: number) {
  if (!config.family || config.flap === "none") return;
  const family = config.family as Exclude<Family, "">;
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  const scale = Math.max(0.8, Math.min(width, height) / 720) * zoom;
  if (path3d(ctx, flapContour(family), width, height, rotation, zoom)) {
    const leather = config.flap.includes("leather") || config.flap.includes("suede");
    ctx.strokeStyle = leather ? "rgba(255,246,236,.70)" : "rgba(65,43,47,.28)";
    ctx.lineWidth = Math.max(1.2, 1.8 * scale);
    if (leather) ctx.setLineDash([...ABAGS_ACCESSORY_VISUAL.leatherSeamDash]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const snap = project([0, (spec.flapY ?? 0.29) - 0.22, spec.depth / 2 + 0.176], width, height, rotation, zoom);
  if (!snap) return;
  ctx.beginPath();
  ctx.arc(snap.x, snap.y, Math.max(2.2, 3.2 * scale * snap.scale), 0, Math.PI * 2);
  ctx.fillStyle = hardwareColor(config.hardware);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(snap.x - 0.7 * scale, snap.y - 0.8 * scale, Math.max(0.7, 0.9 * scale), 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.62)";
  ctx.fill();
}

function drawTassel(ctx: CanvasRenderingContext2D, config: Config, width: number, height: number, rotation: Rotation, zoom: number) {
  if (!config.family) return;
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[config.family as Exclude<Family, "">];
  const anchor: Point3 = [spec.sideAnchor * 0.91, 0.25, spec.depth / 2 + 0.19];
  const top = project(anchor, width, height, rotation, zoom);
  if (!top) return;
  const scale = Math.max(0.8, Math.min(width, height) / 720) * zoom;
  const hardware = hardwareColor(config.hardware);
  ctx.beginPath();
  ctx.arc(top.x, top.y, Math.max(3, 4.1 * scale * top.scale), 0, Math.PI * 2);
  ctx.fillStyle = hardware;
  ctx.fill();

  const fringeCount = ABAGS_ACCESSORY_VISUAL.tasselFringes;
  for (let index = 0; index < fringeCount; index += 1) {
    const spread = (index - (fringeCount - 1) / 2) * 0.022;
    const end = project([anchor[0] + spread, anchor[1] - 0.48 - Math.abs(spread) * 0.7, anchor[2] + (index % 2 ? 0.018 : -0.006)], width, height, rotation, zoom);
    if (!end) continue;
    ctx.beginPath();
    ctx.moveTo(top.x + spread * 10 * scale, top.y + 5 * scale);
    ctx.quadraticCurveTo((top.x + end.x) / 2 + spread * 34 * scale, (top.y + end.y) / 2, end.x, end.y);
    ctx.strokeStyle = config.color || "#E4A9B5";
    ctx.lineWidth = Math.max(1.2, 2.2 * scale * top.scale);
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(top.x - 6 * scale, top.y + 3 * scale);
  ctx.lineTo(top.x + 6 * scale, top.y + 3 * scale);
  ctx.lineTo(top.x + 4.5 * scale, top.y + 10 * scale);
  ctx.lineTo(top.x - 4.5 * scale, top.y + 10 * scale);
  ctx.closePath();
  ctx.fillStyle = hardware;
  ctx.fill();
}

function drawScarf(ctx: CanvasRenderingContext2D, config: Config, width: number, height: number, rotation: Rotation, zoom: number) {
  if (!config.family) return;
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[config.family as Exclude<Family, "">];
  const anchor3: Point3 = [-spec.sideAnchor * 0.68, 0.36, spec.depth / 2 + 0.19];
  const anchor = project(anchor3, width, height, rotation, zoom);
  if (!anchor) return;
  const scale = Math.max(0.8, Math.min(width, height) / 720) * zoom * anchor.scale;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#D7839A";
  ctx.lineWidth = Math.max(4.5, 7.5 * scale);
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.bezierCurveTo(anchor.x - 22 * scale, anchor.y - 19 * scale, anchor.x - 35 * scale, anchor.y + 4 * scale, anchor.x - 13 * scale, anchor.y + 8 * scale);
  ctx.bezierCurveTo(anchor.x - 4 * scale, anchor.y + 9 * scale, anchor.x - 2 * scale, anchor.y + 2 * scale, anchor.x, anchor.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.bezierCurveTo(anchor.x + 20 * scale, anchor.y - 16 * scale, anchor.x + 33 * scale, anchor.y + 4 * scale, anchor.x + 12 * scale, anchor.y + 9 * scale);
  ctx.bezierCurveTo(anchor.x + 4 * scale, anchor.y + 10 * scale, anchor.x + 2 * scale, anchor.y + 2 * scale, anchor.x, anchor.y);
  ctx.stroke();

  const tails = [
    project([anchor3[0] - 0.17, anchor3[1] - 0.48, anchor3[2] + 0.01], width, height, rotation, zoom),
    project([anchor3[0] + 0.13, anchor3[1] - 0.42, anchor3[2] + 0.025], width, height, rotation, zoom),
  ];
  tails.forEach((tail, index) => {
    if (!tail) return;
    ctx.beginPath();
    ctx.moveTo(anchor.x + (index ? 2 : -2) * scale, anchor.y + 4 * scale);
    ctx.quadraticCurveTo((anchor.x + tail.x) / 2 + (index ? 9 : -9) * scale, (anchor.y + tail.y) / 2, tail.x, tail.y);
    ctx.strokeStyle = index ? "#C66F89" : "#EFB7C5";
    ctx.lineWidth = Math.max(5, 8 * scale);
    ctx.stroke();
    ctx.setLineDash([4 * scale, 5 * scale]);
    ctx.strokeStyle = "rgba(255,244,236,.74)";
    ctx.lineWidth = Math.max(1, 1.4 * scale);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  ctx.beginPath();
  ctx.arc(anchor.x, anchor.y, Math.max(4, 6.6 * scale), 0, Math.PI * 2);
  ctx.fillStyle = "#B96780";
  ctx.fill();
  ctx.restore();
}

function drawCharm(ctx: CanvasRenderingContext2D, config: Config, width: number, height: number, rotation: Rotation, zoom: number) {
  if (!config.family) return;
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[config.family as Exclude<Family, "">];
  const anchor3: Point3 = [spec.sideAnchor * 0.86, 0.12, spec.depth / 2 + 0.19];
  const anchor = project(anchor3, width, height, rotation, zoom);
  const drop = project([anchor3[0], anchor3[1] - 0.30, anchor3[2] + 0.02], width, height, rotation, zoom);
  if (!anchor || !drop) return;
  const scale = Math.max(0.8, Math.min(width, height) / 720) * zoom * anchor.scale;
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.lineTo(drop.x, drop.y);
  ctx.strokeStyle = hardwareColor(config.hardware);
  ctx.lineWidth = Math.max(1.3, 2 * scale);
  ctx.stroke();

  const colors = ["#B86F82", "#8E7DB8", "#4F9B9B"];
  for (let index = 0; index < ABAGS_ACCESSORY_VISUAL.charmStones; index += 1) {
    const angle = (Math.PI * 2 * index) / ABAGS_ACCESSORY_VISUAL.charmStones - Math.PI / 2;
    const x = drop.x + Math.cos(angle) * 7 * scale;
    const y = drop.y + Math.sin(angle) * 6 * scale;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2.5, 4.2 * scale), 0, Math.PI * 2);
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - 1.2 * scale, y - 1.4 * scale, Math.max(0.7, 1.1 * scale), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.68)";
    ctx.fill();
  }
}

function prepareCanvas(canvas: HTMLCanvasElement, stage: HTMLElement) {
  const bounds = stage.getBoundingClientRect();
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(2, Math.round(width * dpr));
  const pixelHeight = Math.max(2, Math.round(height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function paint(backCanvas: HTMLCanvasElement, frontCanvas: HTMLCanvasElement, stage: HTMLElement, config: Config, rotation: Rotation, zoom: number) {
  const back = prepareCanvas(backCanvas, stage);
  const front = prepareCanvas(frontCanvas, stage);
  if (!back || !front || !config.family) return;

  // Depth ownership: straps/chains sit behind the bag body; flap finishing and hanging
  // accents sit above the WebGL body. This avoids both flat stickers and duplicate geometry.
  back.ctx.save();
  drawStrap(back.ctx, config, back.width, back.height, rotation, zoom);
  back.ctx.restore();

  front.ctx.save();
  drawFlapDetail(front.ctx, config, front.width, front.height, rotation, zoom);
  if (config.accent === "tassel") drawTassel(front.ctx, config, front.width, front.height, rotation, zoom);
  else if (config.accent === "scarf") drawScarf(front.ctx, config, front.width, front.height, rotation, zoom);
  else if (config.accent === "charm") drawCharm(front.ctx, config, front.width, front.height, rotation, zoom);
  front.ctx.restore();
}

export default function BagBuilderAccessoryFidelityOverlay() {
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
    const pointers = new Map<number, { x: number; y: number }>();
    let drag: { x: number; y: number; rx: number; ry: number } | null = null;
    let pinch: { distance: number; zoom: number } | null = null;
    let frame = 0;
    let boundCanvas: HTMLCanvasElement | null = null;

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        const backCanvas = backCanvasRef.current;
        const frontCanvas = frontCanvasRef.current;
        if (backCanvas && frontCanvas) paint(backCanvas, frontCanvas, stage, config.current, rotation.current, zoom.current);
      });
    };
    const distance = () => {
      const values = Array.from(pointers.values());
      return values.length < 2 ? 0 : Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
    };
    const onPointerDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) { pinch = { distance: distance(), zoom: zoom.current }; drag = null; }
      else drag = { x: event.clientX, y: event.clientY, rx: rotation.current.x, ry: rotation.current.y };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2 && pinch) {
        const next = distance();
        if (pinch.distance > 0) zoom.current = clamp(pinch.zoom * (next / pinch.distance), MIN_ZOOM, MAX_ZOOM);
      } else if (drag) {
        rotation.current = { x: clamp(drag.rx + (event.clientY - drag.y) * 0.008, -0.64, 0.48), y: drag.ry + (event.clientX - drag.x) * 0.012 };
      }
      schedule();
    };
    const onPointerEnd = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!pointers.size) drag = null;
    };
    const onWheel = (event: WheelEvent) => {
      zoom.current = clamp(zoom.current - event.deltaY * 0.0008, MIN_ZOOM, MAX_ZOOM);
      schedule();
    };

    const bindPrimaryCanvas = () => {
      const next = stage.querySelector<HTMLCanvasElement>(".abags-fidelity3d-canvas");
      if (next === boundCanvas) return;
      if (boundCanvas) {
        boundCanvas.removeEventListener("pointerdown", onPointerDown);
        boundCanvas.removeEventListener("pointermove", onPointerMove);
        boundCanvas.removeEventListener("pointerup", onPointerEnd);
        boundCanvas.removeEventListener("pointercancel", onPointerEnd);
        boundCanvas.removeEventListener("wheel", onWheel);
      }
      boundCanvas = next;
      if (boundCanvas) {
        boundCanvas.addEventListener("pointerdown", onPointerDown);
        boundCanvas.addEventListener("pointermove", onPointerMove);
        boundCanvas.addEventListener("pointerup", onPointerEnd);
        boundCanvas.addEventListener("pointercancel", onPointerEnd);
        boundCanvas.addEventListener("wheel", onWheel, { passive: true });
      }
    };

    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button");
      if (!button || !stage.contains(button)) return;
      const text = button.textContent?.trim();
      if (text === "Przód") rotation.current = { x: -0.02, y: 0 };
      else if (text === "3/4") rotation.current = { ...DEFAULT_ROTATION };
      else if (text === "Bok") rotation.current = { x: -0.035, y: Math.PI / 2 };
      else if (text === "−") zoom.current = clamp(zoom.current - 0.08, MIN_ZOOM, MAX_ZOOM);
      else if (text === "+") zoom.current = clamp(zoom.current + 0.08, MIN_ZOOM, MAX_ZOOM);
      else if (text === "Reset") { zoom.current = DEFAULT_ZOOM; rotation.current = { ...DEFAULT_ROTATION }; }
      else return;
      schedule();
    };
    const onInput = (event: Event) => {
      const input = event.target as HTMLInputElement | null;
      if (!input?.matches(".abags-pro3d-zoom input[type=range]")) return;
      zoom.current = clamp(Number(input.value) || DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM);
      schedule();
    };

    const observer = new MutationObserver(() => { config.current = readConfig(stage); bindPrimaryCanvas(); schedule(); });
    observer.observe(stage, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"] });
    const resize = new ResizeObserver(schedule);
    resize.observe(stage);
    stage.addEventListener("click", onClick, true);
    stage.addEventListener("input", onInput, true);
    bindPrimaryCanvas();
    schedule();

    return () => {
      observer.disconnect();
      resize.disconnect();
      stage.removeEventListener("click", onClick, true);
      stage.removeEventListener("input", onInput, true);
      if (boundCanvas) {
        boundCanvas.removeEventListener("pointerdown", onPointerDown);
        boundCanvas.removeEventListener("pointermove", onPointerMove);
        boundCanvas.removeEventListener("pointerup", onPointerEnd);
        boundCanvas.removeEventListener("pointercancel", onPointerEnd);
        boundCanvas.removeEventListener("wheel", onWheel);
      }
      if (frame) cancelAnimationFrame(frame);
    };
  }, [stage]);

  if (!stage) return null;
  return createPortal(<>
    <canvas ref={backCanvasRef} className="abags-accessory-fidelity-canvas abags-accessory-fidelity-back" data-abags-accessory-fidelity={ABAGS_ACCESSORY_FIDELITY_VERSION} data-accessory-depth="back" aria-hidden="true" />
    <canvas ref={frontCanvasRef} className="abags-accessory-fidelity-canvas abags-accessory-fidelity-front" data-abags-accessory-fidelity={ABAGS_ACCESSORY_FIDELITY_VERSION} data-accessory-depth="front" aria-hidden="true" />
    <style jsx global>{`
      .abags-bag-builder-stage > .abags-accessory-fidelity-canvas {
        position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
        pointer-events:none!important;background:transparent!important;
      }
      .abags-bag-builder-stage > .abags-accessory-fidelity-back { z-index:8!important; }
      .abags-bag-builder-stage > .abags-accessory-fidelity-front { z-index:271!important; }
    `}</style>
  </>, stage);
}
