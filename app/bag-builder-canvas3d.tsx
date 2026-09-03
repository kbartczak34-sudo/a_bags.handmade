"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Config = {
  family: "" | "tote" | "round" | "bucket" | "mini";
  color: string;
  stitch: "" | "classic" | "herringbone" | "basket" | "shell";
  flap: "none" | "crochet" | "leather-black" | "leather-cognac" | "suede-burgundy";
  handles: "none" | "wood-light" | "wood-dark" | "crochet";
  strap: "none" | "leather" | "woven" | "chain";
  hardware: "gold" | "silver" | "black";
  accent: "none" | "tassel" | "scarf" | "charm";
};

type Point3 = { x: number; y: number; z: number };
type Point2 = { x: number; y: number; depth: number; scale: number };

const EMPTY: Config = {
  family: "",
  color: "",
  stitch: "",
  flap: "none",
  handles: "none",
  strap: "none",
  hardware: "gold",
  accent: "none",
};

const DEFAULT_ROTATION = { x: -0.12, y: 0.68 };
const DEFAULT_ZOOM = 0.82;
const MIN_ZOOM = 0.34;
const MAX_ZOOM = 1.45;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readConfig(stage: HTMLElement): Config {
  return {
    family: (stage.dataset.family || "") as Config["family"],
    color: stage.dataset.color || "",
    stitch: (stage.dataset.stitch || "") as Config["stitch"],
    flap: (stage.dataset.flap || "none") as Config["flap"],
    handles: (stage.dataset.handles || "none") as Config["handles"],
    strap: (stage.dataset.strap || "none") as Config["strap"],
    hardware: (stage.dataset.hardware || "gold") as Config["hardware"],
    accent: (stage.dataset.accent || "none") as Config["accent"],
  };
}

function sameConfig(a: Config, b: Config) {
  return (Object.keys(a) as Array<keyof Config>).every((key) => a[key] === b[key]);
}

function rgba(hex: string, alpha = 1) {
  const raw = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(raw || "e8ddcc", 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

function shade(hex: string, amount: number) {
  const raw = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(raw || "e8ddcc", 16);
  const r = clamp(((value >> 16) & 255) + amount, 0, 255);
  const g = clamp(((value >> 8) & 255) + amount, 0, 255);
  const b = clamp((value & 255) + amount, 0, 255);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function dims(family: Config["family"]) {
  if (family === "round") return { w: 1.12, h: 0.93, d: 0.46, round: 0.42 };
  if (family === "bucket") return { w: 0.93, h: 1.13, d: 0.5, round: 0.26 };
  if (family === "mini") return { w: 0.82, h: 0.86, d: 0.38, round: 0.25 };
  return { w: 1.08, h: 1.0, d: 0.47, round: 0.19 };
}

function outline(family: Config["family"], z: number, segments = 48): Point3[] {
  const { w, h, round } = dims(family);
  const points: Point3[] = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    let x = Math.cos(a) * w;
    let y = Math.sin(a) * h;
    if (family === "tote") {
      const px = Math.sign(x) * Math.pow(Math.abs(x / w), 0.6) * w;
      const py = Math.sign(y) * Math.pow(Math.abs(y / h), 0.56) * h;
      x = px * (y > 0 ? 0.97 : 0.88 + 0.09 * ((y + h) / (2 * h)));
      y = py;
    } else if (family === "bucket") {
      x *= y > 0 ? 0.84 : 0.97;
      y = Math.sign(y) * Math.pow(Math.abs(y / h), 0.72) * h;
    } else if (family === "round") {
      x *= 0.9 + round * Math.sin((a + Math.PI / 2) * 0.5) ** 2;
      y = Math.sign(y) * Math.pow(Math.abs(y / h), 0.82) * h;
    } else {
      x = Math.sign(x) * Math.pow(Math.abs(x / w), 0.68) * w;
      y = Math.sign(y) * Math.pow(Math.abs(y / h), 0.64) * h;
    }
    points.push({ x, y: y - 0.08, z });
  }
  return points;
}

function rotate(point: Point3, rx: number, ry: number): Point3 {
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const x1 = point.x * cy + point.z * sy;
  const z1 = -point.x * sy + point.z * cy;
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  return {
    x: x1,
    y: point.y * cx - z1 * sx,
    z: point.y * sx + z1 * cx,
  };
}

function project(point: Point3, width: number, height: number, rotation: { x: number; y: number }, zoom: number): Point2 {
  const p = rotate(point, rotation.x, rotation.y);
  const camera = 4.8;
  const perspective = 3.2 / Math.max(1.4, camera - p.z);
  const unit = Math.min(width, height) * 0.43 * zoom;
  return {
    x: width / 2 + p.x * unit * perspective,
    y: height * 0.52 - p.y * unit * perspective,
    depth: p.z,
    scale: perspective,
  };
}

function pathPolygon(ctx: CanvasRenderingContext2D, points: Point2[]) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function drawStitch(ctx: CanvasRenderingContext2D, polygon: Point2[], config: Config, width: number, height: number) {
  if (!config.color || !config.stitch || polygon.length < 3) return;
  ctx.save();
  pathPolygon(ctx, polygon);
  ctx.clip();
  const spacing = Math.max(9, Math.min(width, height) * 0.028);
  ctx.globalAlpha = 0.42;
  ctx.lineWidth = Math.max(1.2, spacing * 0.13);
  ctx.strokeStyle = rgba(shade(config.color, 72).replace("rgb", "#"), 0.7);
  // Use two contrast passes so the cord structure remains visible at all colours.
  const dark = shade(config.color, -48);
  const light = shade(config.color, 76);
  if (config.stitch === "herringbone") {
    for (let y = -height; y < height * 2; y += spacing) {
      for (let x = -width; x < width * 2; x += spacing * 1.2) {
        ctx.strokeStyle = rgba("#ffffff", 0.28);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + spacing * 0.55, y + spacing * 0.55); ctx.lineTo(x + spacing * 1.1, y); ctx.stroke();
        ctx.strokeStyle = dark; ctx.globalAlpha = 0.25;
        ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + spacing * 0.55, y + spacing * 0.55 + 2); ctx.lineTo(x + spacing * 1.1, y + 2); ctx.stroke();
      }
    }
  } else if (config.stitch === "basket") {
    ctx.strokeStyle = light; ctx.globalAlpha = 0.25;
    for (let x = -width; x < width * 2; x += spacing) { ctx.beginPath(); ctx.moveTo(x, -height); ctx.lineTo(x, height * 2); ctx.stroke(); }
    for (let y = -height; y < height * 2; y += spacing) { ctx.beginPath(); ctx.moveTo(-width, y); ctx.lineTo(width * 2, y); ctx.stroke(); }
    ctx.strokeStyle = dark; ctx.globalAlpha = 0.18;
    for (let x = -width + 2; x < width * 2; x += spacing) { ctx.beginPath(); ctx.moveTo(x, -height); ctx.lineTo(x, height * 2); ctx.stroke(); }
  } else if (config.stitch === "shell") {
    ctx.strokeStyle = light; ctx.globalAlpha = 0.3;
    for (let y = -height; y < height * 2; y += spacing * 0.9) {
      for (let x = -width; x < width * 2; x += spacing * 1.2) {
        ctx.beginPath();
        ctx.arc(x, y, spacing * 0.55, Math.PI, 0);
        ctx.stroke();
      }
    }
  } else {
    ctx.strokeStyle = light; ctx.globalAlpha = 0.3;
    for (let y = -height; y < height * 2; y += spacing * 0.72) {
      for (let x = -width; x < width * 2; x += spacing * 0.9) {
        ctx.beginPath();
        ctx.moveTo(x - spacing * 0.35, y + spacing * 0.32);
        ctx.quadraticCurveTo(x, y - spacing * 0.32, x + spacing * 0.35, y + spacing * 0.32);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawLine3D(
  ctx: CanvasRenderingContext2D,
  points: Point3[],
  width: number,
  height: number,
  rotation: { x: number; y: number },
  zoom: number,
  color: string,
  lineWidth: number,
  dash: number[] = [],
) {
  const p = points.map((point) => project(point, width, height, rotation, zoom));
  if (!p.length) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length; i += 1) ctx.lineTo(p[i].x, p[i].y);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, lineWidth * zoom);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (dash.length) ctx.setLineDash(dash);
  ctx.shadowColor = "rgba(48,28,33,.18)";
  ctx.shadowBlur = 5;
  ctx.stroke();
  ctx.restore();
}

function arch(rx: number, bottom: number, top: number, z: number, segments = 44): Point3[] {
  const points: Point3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = Math.PI - (i / segments) * Math.PI;
    points.push({ x: rx * Math.cos(t), y: bottom + (top - bottom) * Math.sin(t), z });
  }
  return points;
}

function drawCanvas(canvas: HTMLCanvasElement, config: Config, rotation: { x: number; y: number }, zoom: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const pixelW = Math.round(width * dpr);
  const pixelH = Math.round(height * dpr);
  if (canvas.width !== pixelW || canvas.height !== pixelH) { canvas.width = pixelW; canvas.height = pixelH; }
  const raw = canvas.getContext("2d");
  if (!raw) return;
  raw.setTransform(dpr, 0, 0, dpr, 0, 0);
  raw.clearRect(0, 0, width, height);
  if (!config.family) return;

  const { d, w, h } = dims(config.family);
  const front3 = outline(config.family, d);
  const back3 = outline(config.family, -d);
  const front = front3.map((p) => project(p, width, height, rotation, zoom));
  const back = back3.map((p) => project(p, width, height, rotation, zoom));
  const body = config.color || "#ded5cd";

  // Ground shadow tracks zoom and yaw so movement is unmistakable.
  raw.save();
  raw.globalAlpha = 0.18;
  raw.fillStyle = "#5a4245";
  raw.beginPath();
  raw.ellipse(width / 2 + Math.sin(rotation.y) * width * 0.03, height * 0.84, width * 0.21 * zoom, height * 0.026 * zoom, 0, 0, Math.PI * 2);
  raw.fill();
  raw.restore();

  const sideFaces = front.map((_, i) => {
    const j = (i + 1) % front.length;
    return { points: [back[i], back[j], front[j], front[i]], depth: (back[i].depth + back[j].depth + front[i].depth + front[j].depth) / 4 };
  }).sort((a, b) => a.depth - b.depth);

  pathPolygon(raw, back);
  raw.fillStyle = shade(body, -58);
  raw.fill();
  raw.strokeStyle = shade(body, -78);
  raw.lineWidth = 2;
  raw.stroke();

  sideFaces.forEach((face, index) => {
    pathPolygon(raw, face.points);
    const light = Math.round(-45 + (index / Math.max(1, sideFaces.length - 1)) * 38);
    raw.fillStyle = shade(body, light);
    raw.fill();
    raw.strokeStyle = rgba("#2e2024", 0.12);
    raw.lineWidth = 0.8;
    raw.stroke();
  });

  pathPolygon(raw, front);
  const gradient = raw.createLinearGradient(0, Math.min(...front.map((p) => p.y)), width, Math.max(...front.map((p) => p.y)));
  gradient.addColorStop(0, shade(body, 24));
  gradient.addColorStop(0.46, body);
  gradient.addColorStop(1, shade(body, -35));
  raw.fillStyle = gradient;
  raw.shadowColor = "rgba(48,28,33,.18)";
  raw.shadowBlur = 9;
  raw.fill();
  raw.shadowBlur = 0;
  raw.strokeStyle = shade(body, -70);
  raw.lineWidth = 2.2;
  raw.stroke();
  drawStitch(raw, front, config, width, height);

  // Top rim makes the actual depth visible even at small yaw angles.
  const rimFront = arch(w * 0.78, h * 0.79, h * 1.08, d + 0.03, 34);
  const rimBack = arch(w * 0.78, h * 0.79, h * 1.08, -d - 0.03, 34);
  drawLine3D(raw, rimBack, width, height, rotation, zoom, shade(body, -55), 8);
  drawLine3D(raw, rimFront, width, height, rotation, zoom, shade(body, 12), 9);

  if (config.strap !== "none") {
    const color = config.strap === "chain"
      ? (config.hardware === "silver" ? "#d2d6dc" : config.hardware === "black" ? "#262326" : "#c9a45b")
      : config.strap === "leather" ? "#65483b" : "#a77b89";
    const strap = arch(w * 1.16, h * 0.45, h * 2.08, -d * 0.68, 54);
    drawLine3D(raw, strap, width, height, rotation, zoom, color, config.strap === "chain" ? 6 : 13, config.strap === "chain" ? [3, 5] : []);
  }

  if (config.handles !== "none") {
    const handleColor = config.handles === "wood-light" ? "#cf9f66" : config.handles === "wood-dark" ? "#5b2d1e" : body;
    const frontHandle = arch(w * 0.72, h * 0.72, h * 1.55, d + 0.05, 42);
    const backHandle = arch(w * 0.72, h * 0.72, h * 1.55, -d - 0.05, 42);
    drawLine3D(raw, backHandle, width, height, rotation, zoom, shade(handleColor, -35), 14);
    drawLine3D(raw, frontHandle, width, height, rotation, zoom, handleColor, 16);
  }

  if (config.flap !== "none") {
    const flapColor = config.flap === "leather-black" ? "#242124" : config.flap === "leather-cognac" ? "#7b4f34" : config.flap === "suede-burgundy" ? "#7f3043" : body;
    const z = d + 0.11;
    const flap3: Point3[] = [
      { x: -w * 0.8, y: h * 0.64, z },
      { x: -w * 0.7, y: h * 0.1, z: z + 0.02 },
      { x: 0, y: -h * 0.05, z: z + 0.04 },
      { x: w * 0.7, y: h * 0.1, z: z + 0.02 },
      { x: w * 0.8, y: h * 0.64, z },
      { x: 0, y: h * 0.78, z },
    ];
    const flap = flap3.map((p) => project(p, width, height, rotation, zoom));
    pathPolygon(raw, flap);
    const fg = raw.createLinearGradient(0, Math.min(...flap.map((p) => p.y)), 0, Math.max(...flap.map((p) => p.y)));
    fg.addColorStop(0, shade(flapColor, 24)); fg.addColorStop(1, shade(flapColor, -28));
    raw.fillStyle = fg; raw.fill();
    raw.strokeStyle = shade(flapColor, -52); raw.lineWidth = 2; raw.stroke();
    const seam = flap3.slice(0, 5).map((p) => ({ ...p, z: p.z + 0.012, y: p.y + 0.06 })).map((p) => project(p, width, height, rotation, zoom));
    raw.save(); raw.setLineDash([4, 5]); raw.strokeStyle = rgba("#ffffff", 0.32); raw.lineWidth = 1; raw.beginPath(); raw.moveTo(seam[0].x, seam[0].y); seam.slice(1).forEach((p) => raw.lineTo(p.x, p.y)); raw.stroke(); raw.restore();
  }

  const metal = config.hardware === "silver" ? "#d8dce1" : config.hardware === "black" ? "#2c292c" : "#c9a45b";
  const hardwarePoints: Point3[] = [
    { x: 0, y: config.flap !== "none" ? h * 0.22 : -h * 0.52, z: d + 0.18 },
    { x: -w * 0.88, y: h * 0.45, z: d * 0.7 },
    { x: w * 0.88, y: h * 0.45, z: d * 0.7 },
  ];
  hardwarePoints.forEach((point, index) => {
    const p = project(point, width, height, rotation, zoom);
    const radius = (index === 0 ? 10 : 7) * zoom * p.scale * 1.6;
    const mg = raw.createRadialGradient(p.x - radius * 0.35, p.y - radius * 0.35, 1, p.x, p.y, radius);
    mg.addColorStop(0, "#fff7d9"); mg.addColorStop(0.25, metal); mg.addColorStop(1, shade(metal, -55));
    raw.fillStyle = mg; raw.beginPath(); raw.arc(p.x, p.y, Math.max(4, radius), 0, Math.PI * 2); raw.fill();
  });

  if (config.accent === "tassel") {
    const top = project({ x: -w * 0.92, y: h * 0.36, z: d + 0.1 }, width, height, rotation, zoom);
    const bottom = project({ x: -w * 1.0, y: -h * 0.62, z: d + 0.08 }, width, height, rotation, zoom);
    raw.strokeStyle = body; raw.lineWidth = Math.max(6, 10 * zoom); raw.lineCap = "round";
    for (let i = -2; i <= 2; i += 1) { raw.beginPath(); raw.moveTo(top.x + i * 3, top.y); raw.lineTo(bottom.x + i * 4, bottom.y); raw.stroke(); }
  } else if (config.accent === "scarf") {
    const p = project({ x: -w * 0.75, y: h * 0.6, z: d + 0.17 }, width, height, rotation, zoom);
    raw.save(); raw.translate(p.x, p.y); raw.rotate(-0.3 + rotation.y * 0.08); raw.fillStyle = "#e3a0b0"; raw.beginPath(); raw.ellipse(-8, 0, 18 * zoom, 9 * zoom, -0.4, 0, Math.PI * 2); raw.ellipse(10, 1, 17 * zoom, 8 * zoom, 0.45, 0, Math.PI * 2); raw.fill(); raw.fillStyle = "#c56e87"; raw.beginPath(); raw.arc(0, 2, 6 * zoom, 0, Math.PI * 2); raw.fill(); raw.restore();
  } else if (config.accent === "charm") {
    const p = project({ x: w * 0.92, y: h * 0.1, z: d + 0.15 }, width, height, rotation, zoom);
    raw.fillStyle = "#b87880"; raw.beginPath(); raw.arc(p.x, p.y, 9 * zoom, 0, Math.PI * 2); raw.fill();
  }
}

export default function BagBuilderCanvas3D() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<Config>(EMPTY);
  const [rotation, setRotation] = useState(DEFAULT_ROTATION);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

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
    let timer = 0;
    const syncMode = () => {
      if (stage.getAttribute("data-abags-pro3d-ready") === "true") {
        window.clearTimeout(timer);
        setEnabled(false);
        stage.classList.remove("abags-canvas3d-active");
        stage.removeAttribute("data-abags-canvas3d-ready");
      } else {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (stage.getAttribute("data-abags-pro3d-ready") !== "true") {
            setEnabled(true);
            stage.classList.add("abags-canvas3d-active");
            stage.setAttribute("data-abags-canvas3d-ready", "true");
          }
        }, 650);
      }
    };
    syncMode();
    const observer = new MutationObserver(syncMode);
    observer.observe(stage, { attributes: true, attributeFilter: ["data-abags-pro3d-ready"] });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      stage.classList.remove("abags-canvas3d-active");
      stage.removeAttribute("data-abags-canvas3d-ready");
    };
  }, [stage]);

  useEffect(() => {
    if (!stage) return;
    const sync = () => setConfig((current) => {
      const next = readConfig(stage);
      return sameConfig(current, next) ? current : next;
    });
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(stage, { attributes: true, attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"] });
    return () => observer.disconnect();
  }, [stage]);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = requestAnimationFrame(() => drawCanvas(canvas, config, rotation, zoom));
    const redraw = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => drawCanvas(canvas, config, rotation, zoom)); };
    window.addEventListener("resize", redraw);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", redraw); };
  }, [enabled, config, rotation, zoom]);

  const label = useMemo(() => config.family ? "Interaktywny model 3D torebki" : "Wybierz fason, aby rozpocząć", [config.family]);
  if (!stage || !enabled) return null;

  const distance = () => {
    const pts = Array.from(pointers.current.values());
    return pts.length < 2 ? 0 : Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };
  const setView = (view: "front" | "three" | "side") => setRotation(view === "front" ? { x: -0.03, y: 0 } : view === "side" ? { x: -0.08, y: Math.PI / 2 } : DEFAULT_ROTATION);

  return createPortal(<div className="abags-canvas3d-layer" data-abags-interactive3d="canvas">
    <canvas
      ref={canvasRef}
      className="abags-canvas3d-canvas"
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        event.currentTarget.setPointerCapture?.(event.pointerId);
        if (pointers.current.size >= 2) { pinch.current = { distance: distance(), zoom }; drag.current = null; }
        else drag.current = { x: event.clientX, y: event.clientY, rx: rotation.x, ry: rotation.y };
      }}
      onPointerMove={(event) => {
        if (!pointers.current.has(event.pointerId)) return;
        event.preventDefault();
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.current.size >= 2 && pinch.current) {
          const next = distance();
          if (pinch.current.distance > 0) setZoom(clamp(pinch.current.zoom * (next / pinch.current.distance), MIN_ZOOM, MAX_ZOOM));
          return;
        }
        if (!drag.current) return;
        setRotation({
          x: clamp(drag.current.rx + (event.clientY - drag.current.y) * 0.008, -0.7, 0.55),
          y: drag.current.ry + (event.clientX - drag.current.x) * 0.012,
        });
      }}
      onPointerUp={(event) => { pointers.current.delete(event.pointerId); if (pointers.current.size < 2) pinch.current = null; if (!pointers.current.size) drag.current = null; }}
      onPointerCancel={(event) => { pointers.current.delete(event.pointerId); pinch.current = null; drag.current = null; }}
    />
    <div className="abags-canvas3d-chip">MODEL 3D · OBRÓT 360° · ZOOM</div>
    <div className="abags-canvas3d-views" aria-label="Widok modelu 3D">
      <button type="button" onClick={() => setView("front")}>Przód</button>
      <button type="button" onClick={() => setView("three")}>3/4</button>
      <button type="button" onClick={() => setView("side")}>Bok</button>
    </div>
    <div className="abags-canvas3d-zoom" aria-label="Zoom modelu 3D">
      <button type="button" onClick={() => setZoom((value) => clamp(value - 0.12, MIN_ZOOM, MAX_ZOOM))} aria-label="Oddal model">−</button>
      <input type="range" min={34} max={145} value={Math.round(zoom * 100)} onChange={(event) => setZoom(clamp(Number(event.currentTarget.value) / 100, MIN_ZOOM, MAX_ZOOM))} aria-label="Skala modelu 3D" />
      <button type="button" onClick={() => setZoom((value) => clamp(value + 0.12, MIN_ZOOM, MAX_ZOOM))} aria-label="Przybliż model">+</button>
      <button type="button" className="abags-canvas3d-reset" onClick={() => { setRotation(DEFAULT_ROTATION); setZoom(DEFAULT_ZOOM); }}>{Math.round(zoom * 100)}%</button>
    </div>
    <p className="abags-canvas3d-hint">Przeciągnij palcem, aby obracać · uszczypnij dwoma palcami, aby przybliżać i oddalać.</p>
  </div>, stage);
}
