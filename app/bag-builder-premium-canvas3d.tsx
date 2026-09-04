"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EXACT_ATELIER_LIBRARY, EXACT_ATELIER_SPRITE_PARTS } from "../lib/exact-customizer-library";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Config = {
  family: Family;
  color: string;
  stitch: "" | "classic" | "herringbone" | "basket" | "shell";
  flap: "none" | "crochet" | "leather-black" | "leather-cognac" | "suede-burgundy";
  handles: "none" | "wood-light" | "wood-dark" | "crochet";
  strap: "none" | "leather" | "woven" | "chain";
  hardware: "gold" | "silver" | "black";
  accent: "none" | "tassel" | "scarf" | "charm";
};
type P3 = { x: number; y: number; z: number };
type P2 = { x: number; y: number; depth: number; scale: number };

type TextureSource = { image: HTMLImageElement; referenceIndex: number } | null;

const EMPTY: Config = { family: "", color: "", stitch: "", flap: "none", handles: "none", strap: "none", hardware: "gold", accent: "none" };
const DEFAULT_ROTATION = { x: -0.08, y: 0.42 };
const DEFAULT_ZOOM = 0.92;
const MIN_ZOOM = 0.42;
const MAX_ZOOM = 1.38;

const REFERENCE_FOR_FAMILY: Record<Exclude<Family, "">, string> = {
  tote: "pastel-tote-wood-bow",
  round: "cream-round-taupe-flap",
  bucket: "cream-burgundy-flap",
  mini: "small-multicolor-chain",
};

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function readConfig(stage: HTMLElement): Config {
  return {
    family: (stage.dataset.family || "") as Family,
    color: stage.dataset.color || "",
    stitch: (stage.dataset.stitch || "") as Config["stitch"],
    flap: (stage.dataset.flap || "none") as Config["flap"],
    handles: (stage.dataset.handles || "none") as Config["handles"],
    strap: (stage.dataset.strap || "none") as Config["strap"],
    hardware: (stage.dataset.hardware || "gold") as Config["hardware"],
    accent: (stage.dataset.accent || "none") as Config["accent"],
  };
}
function sameConfig(a: Config, b: Config) { return (Object.keys(a) as Array<keyof Config>).every((key) => a[key] === b[key]); }
function hexRgb(value: string) {
  const raw = value.replace("#", "").padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(raw || "e8ddcc", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function shade(value: string, amount: number) {
  const { r, g, b } = hexRgb(value);
  return `rgb(${clamp(Math.round(r + amount), 0, 255)},${clamp(Math.round(g + amount), 0, 255)},${clamp(Math.round(b + amount), 0, 255)})`;
}
function rgba(value: string, alpha: number) {
  const { r, g, b } = hexRgb(value);
  return `rgba(${r},${g},${b},${alpha})`;
}
function dims(family: Family) {
  if (family === "round") return { w: 1.05, h: 0.88, d: 0.43, taper: 0.03 };
  if (family === "bucket") return { w: 0.88, h: 1.08, d: 0.46, taper: 0.12 };
  if (family === "mini") return { w: 0.82, h: 0.75, d: 0.34, taper: 0.04 };
  return { w: 1.08, h: 0.92, d: 0.44, taper: 0.07 };
}
function outline(family: Exclude<Family, "">, z: number, segments = 60): P3[] {
  const { w, h, taper } = dims(family);
  const result: P3[] = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    let x = Math.cos(a) * w;
    let y = Math.sin(a) * h;
    if (family === "tote") {
      x = Math.sign(x) * Math.pow(Math.abs(x / w), 0.54) * w;
      y = Math.sign(y) * Math.pow(Math.abs(y / h), 0.53) * h;
      x *= 0.94 + taper * ((y + h) / (2 * h));
    } else if (family === "round") {
      x *= 0.98;
      y = Math.sign(y) * Math.pow(Math.abs(y / h), 0.8) * h;
    } else if (family === "bucket") {
      x *= y > 0 ? 0.82 : 1.02;
      y = Math.sign(y) * Math.pow(Math.abs(y / h), 0.7) * h;
    } else {
      x = Math.sign(x) * Math.pow(Math.abs(x / w), 0.62) * w;
      y = Math.sign(y) * Math.pow(Math.abs(y / h), 0.6) * h;
    }
    result.push({ x, y: y - 0.08, z });
  }
  return result;
}
function rotate(point: P3, rx: number, ry: number): P3 {
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const x1 = point.x * cy + point.z * sy;
  const z1 = -point.x * sy + point.z * cy;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  return { x: x1, y: point.y * cx - z1 * sx, z: point.y * sx + z1 * cx };
}
function project(point: P3, width: number, height: number, rotation: { x: number; y: number }, zoom: number): P2 {
  const p = rotate(point, rotation.x, rotation.y);
  const camera = 5.0;
  const perspective = 3.25 / Math.max(1.6, camera - p.z);
  const unit = Math.min(width, height) * 0.48 * zoom;
  return { x: width / 2 + p.x * unit * perspective, y: height * 0.55 - p.y * unit * perspective, depth: p.z, scale: perspective };
}
function polygon(ctx: CanvasRenderingContext2D, points: P2[]) {
  if (!points.length) return;
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}
function arch(rx: number, bottom: number, top: number, z: number, segments = 60): P3[] {
  const points: P3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = Math.PI - (i / segments) * Math.PI;
    points.push({ x: rx * Math.cos(t), y: bottom + (top - bottom) * Math.sin(t), z });
  }
  return points;
}
function stroke3d(ctx: CanvasRenderingContext2D, points: P3[], width: number, height: number, rotation: { x: number; y: number }, zoom: number, color: string | CanvasGradient, lineWidth: number, alpha = 1, dash: number[] = []) {
  const p = points.map((point) => project(point, width, height, rotation, zoom));
  if (!p.length) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y);
  p.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.4, lineWidth * zoom); ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (dash.length) ctx.setLineDash(dash);
  ctx.stroke(); ctx.restore();
}

async function loadAtelierSprite(signal: AbortSignal): Promise<HTMLImageElement | null> {
  try {
    const parts = await Promise.all(EXACT_ATELIER_SPRITE_PARTS.map(async (path) => {
      const response = await fetch(path, { cache: "force-cache", signal });
      if (!response.ok) throw new Error(path);
      return (await response.text()).trim();
    }));
    const binary = window.atob(parts.join(""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
    const image = new Image();
    image.decoding = "async";
    const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("atelier sprite"));
    });
    image.src = url;
    const result = await loaded;
    URL.revokeObjectURL(url);
    return result;
  } catch {
    return null;
  }
}

function textureSource(image: HTMLImageElement | null, family: Family): TextureSource {
  if (!image || !family) return null;
  const referenceId = REFERENCE_FOR_FAMILY[family];
  const reference = EXACT_ATELIER_LIBRARY.find((item) => item.id === referenceId);
  return reference ? { image, referenceIndex: reference.index } : null;
}

function makeCordTexture(source: TextureSource, color: string, stitch: Config["stitch"]) {
  const canvas = document.createElement("canvas"); canvas.width = 190; canvas.height = 190;
  const ctx = canvas.getContext("2d"); if (!ctx) return canvas;
  const base = color || "#e8ddcc";
  if (source) {
    const { image, referenceIndex } = source;
    const cellW = image.naturalWidth / 5, cellH = image.naturalHeight / 4;
    const col = referenceIndex % 5, row = Math.floor(referenceIndex / 5);
    // Central body crop intentionally avoids handles, hardware and scene background.
    const sx = col * cellW + cellW * 0.28;
    const sy = row * cellH + cellH * 0.43;
    const sw = cellW * 0.44, sh = cellH * 0.30;
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "color";
    ctx.fillStyle = base; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = 0.2;
    ctx.fillStyle = shade(base, -24); ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  } else {
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, shade(base, 30)); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, -28));
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // Cord relief pass: paired highlight/shadow strokes keep polyester smooth rather than fuzzy.
  ctx.globalAlpha = source ? 0.24 : 0.42;
  const spacing = stitch === "basket" ? 18 : stitch === "shell" ? 16 : 13;
  for (let y = -30; y < canvas.height + 30; y += spacing) {
    for (let x = -30; x < canvas.width + 30; x += spacing * 1.15) {
      ctx.lineCap = "round";
      if (stitch === "herringbone") {
        ctx.strokeStyle = "rgba(255,255,255,.48)"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x + 7, y); ctx.lineTo(x + 14, y + 7); ctx.stroke();
        ctx.strokeStyle = rgba(shade(base, -55), 0.42); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.lineTo(x + 7, y + 2); ctx.lineTo(x + 14, y + 9); ctx.stroke();
      } else if (stitch === "basket") {
        ctx.strokeStyle = "rgba(255,255,255,.42)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 12, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.stroke();
      } else if (stitch === "shell") {
        ctx.strokeStyle = "rgba(255,255,255,.44)"; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.arc(x, y, 7, Math.PI, 0); ctx.stroke();
        ctx.strokeStyle = rgba(shade(base, -55), 0.32); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y + 2, 7, Math.PI, 0); ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(255,255,255,.44)"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 5, y + 4); ctx.quadraticCurveTo(x, y - 5, x + 5, y + 4); ctx.stroke();
        ctx.strokeStyle = rgba(shade(base, -58), 0.3); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 5, y + 6); ctx.quadraticCurveTo(x, y - 3, x + 5, y + 6); ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
  return canvas;
}

function drawMetal(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, metal: string, ring = false) {
  ctx.save();
  if (ring) {
    const g = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
    g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.35, metal); g.addColorStop(1, shade(metal, -55));
    ctx.strokeStyle = g; ctx.lineWidth = Math.max(1.5, radius * 0.38); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
  } else {
    const g = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.45, 0.5, x, y, radius);
    g.addColorStop(0, "#fffbe9"); g.addColorStop(0.28, metal); g.addColorStop(0.78, shade(metal, -20)); g.addColorStop(1, shade(metal, -58));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(74,53,43,.18)"; ctx.lineWidth = 0.7; ctx.stroke();
  }
  ctx.restore();
}

function drawPremium(canvas: HTMLCanvasElement, config: Config, rotation: { x: number; y: number }, zoom: number, sprite: HTMLImageElement | null) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
  const pixelW = Math.round(width * dpr), pixelH = Math.round(height * dpr);
  if (canvas.width !== pixelW || canvas.height !== pixelH) { canvas.width = pixelW; canvas.height = pixelH; }
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
  if (!config.family) return;

  const family = config.family as Exclude<Family, "">;
  const { w, h, d } = dims(family);
  const body = config.color || "#e8ddcc";
  const front3 = outline(family, d), back3 = outline(family, -d);
  const front = front3.map((p) => project(p, width, height, rotation, zoom));
  const back = back3.map((p) => project(p, width, height, rotation, zoom));

  // Soft atelier ground shadow.
  ctx.save(); const shadow = ctx.createRadialGradient(width / 2, height * 0.84, 2, width / 2, height * 0.84, width * 0.22 * zoom);
  shadow.addColorStop(0, "rgba(79,54,58,.22)"); shadow.addColorStop(0.55, "rgba(79,54,58,.09)"); shadow.addColorStop(1, "rgba(79,54,58,0)");
  ctx.fillStyle = shadow; ctx.beginPath(); ctx.ellipse(width / 2, height * 0.84, width * 0.22 * zoom, height * 0.038 * zoom, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  // Shoulder strap is deliberately behind the bag and visually subordinate.
  if (config.strap !== "none") {
    const metal = config.hardware === "silver" ? "#c8cdd3" : config.hardware === "black" ? "#2a292b" : "#b99555";
    const strapColor = config.strap === "chain" ? metal : config.strap === "leather" ? "#6b4739" : "#9b7681";
    const strap = arch(w * 1.08, h * 0.40, h * 1.88, -d * 1.08, 68);
    ctx.save(); ctx.shadowColor = "rgba(45,29,32,.12)"; ctx.shadowBlur = 4;
    stroke3d(ctx, strap, width, height, rotation, zoom, strapColor, config.strap === "chain" ? 4.2 : 7.2, 0.72, config.strap === "chain" ? [2.2, 4] : []); ctx.restore();
  }

  // Back and sides establish volume without cartoon outlines.
  polygon(ctx, back); ctx.fillStyle = shade(body, -48); ctx.fill();
  const faces = front.map((_, i) => { const j = (i + 1) % front.length; return [back[i], back[j], front[j], front[i]]; });
  faces.forEach((face, index) => { polygon(ctx, face); const t = index / Math.max(1, faces.length - 1); ctx.fillStyle = shade(body, -44 + Math.round(t * 31)); ctx.fill(); });

  polygon(ctx, front);
  const baseGradient = ctx.createLinearGradient(Math.min(...front.map((p) => p.x)), Math.min(...front.map((p) => p.y)), Math.max(...front.map((p) => p.x)), Math.max(...front.map((p) => p.y)));
  baseGradient.addColorStop(0, shade(body, 28)); baseGradient.addColorStop(0.38, shade(body, 9)); baseGradient.addColorStop(0.67, body); baseGradient.addColorStop(1, shade(body, -34));
  ctx.fillStyle = baseGradient; ctx.shadowColor = "rgba(53,36,40,.17)"; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;

  // Real atelier photo contributes only microtexture, not product geometry or accessories.
  ctx.save(); polygon(ctx, front); ctx.clip();
  const texture = makeCordTexture(textureSource(sprite, family), body, config.stitch || "classic");
  const pattern = ctx.createPattern(texture, "repeat");
  if (pattern) { ctx.globalAlpha = 0.72; ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = pattern; ctx.fillRect(0, 0, width, height); }
  ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = 0.10; const shine = ctx.createLinearGradient(width * 0.32, 0, width * 0.68, height); shine.addColorStop(0, "rgba(255,255,255,.72)"); shine.addColorStop(0.42, "rgba(255,255,255,.08)"); shine.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = shine; ctx.fillRect(0, 0, width, height);
  ctx.restore();
  ctx.strokeStyle = rgba(shade(body, -55), 0.45); ctx.lineWidth = 1.15; polygon(ctx, front); ctx.stroke();

  // Opening is a shallow lip, not another handle-like arch.
  const topY = h * 0.78;
  const left = project({ x: -w * 0.72, y: topY, z: d + 0.02 }, width, height, rotation, zoom);
  const center = project({ x: 0, y: topY + h * 0.075, z: d + 0.04 }, width, height, rotation, zoom);
  const right = project({ x: w * 0.72, y: topY, z: d + 0.02 }, width, height, rotation, zoom);
  ctx.save(); ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.quadraticCurveTo(center.x, center.y, right.x, right.y); ctx.strokeStyle = rgba(shade(body, -48), 0.72); ctx.lineWidth = Math.max(2, 4.2 * zoom); ctx.lineCap = "round"; ctx.stroke(); ctx.strokeStyle = "rgba(255,255,255,.34)"; ctx.lineWidth = Math.max(1, 1.7 * zoom); ctx.stroke(); ctx.restore();

  // One hero handle. A real bag may have two handles, but the rear one is occluded in this merchandising view.
  if (config.handles !== "none") {
    const handle = arch(w * 0.67, h * 0.70, h * 1.46, d + 0.075, 70);
    if (config.handles.startsWith("wood")) {
      const light = config.handles === "wood-light" ? "#c99a63" : "#603321";
      const woodGradient = ctx.createLinearGradient(width * 0.32, height * 0.23, width * 0.67, height * 0.38);
      woodGradient.addColorStop(0, shade(light, -35)); woodGradient.addColorStop(0.26, shade(light, 28)); woodGradient.addColorStop(0.58, light); woodGradient.addColorStop(1, shade(light, -38));
      stroke3d(ctx, handle, width, height, rotation, zoom, "rgba(66,40,28,.18)", 18.5, 0.8);
      stroke3d(ctx, handle, width, height, rotation, zoom, woodGradient, 14.4, 1);
      stroke3d(ctx, handle, width, height, rotation, zoom, "rgba(255,239,210,.34)", 2.2, 0.9);
    } else {
      stroke3d(ctx, handle, width, height, rotation, zoom, rgba(shade(body, -46), 0.44), 16.5, 1);
      stroke3d(ctx, handle, width, height, rotation, zoom, body, 12.7, 1);
      stroke3d(ctx, handle, width, height, rotation, zoom, "rgba(255,255,255,.26)", 2.1, 1);
    }
  }

  // Flap sits on the body with material-specific rendering.
  if (config.flap !== "none") {
    const z = d + 0.115;
    const flap3: P3[] = [
      { x: -w * 0.78, y: h * 0.59, z }, { x: -w * 0.64, y: h * 0.10, z: z + 0.02 },
      { x: 0, y: -h * 0.07, z: z + 0.045 }, { x: w * 0.64, y: h * 0.10, z: z + 0.02 },
      { x: w * 0.78, y: h * 0.59, z }, { x: 0, y: h * 0.73, z },
    ];
    const flap = flap3.map((p) => project(p, width, height, rotation, zoom)); polygon(ctx, flap);
    const flapColor = config.flap === "leather-black" ? "#282427" : config.flap === "leather-cognac" ? "#805438" : config.flap === "suede-burgundy" ? "#77394b" : body;
    const fg = ctx.createLinearGradient(0, Math.min(...flap.map((p) => p.y)), 0, Math.max(...flap.map((p) => p.y)));
    fg.addColorStop(0, shade(flapColor, config.flap === "crochet" ? 20 : 12)); fg.addColorStop(0.55, flapColor); fg.addColorStop(1, shade(flapColor, -28)); ctx.fillStyle = fg; ctx.fill();
    if (config.flap === "crochet") {
      ctx.save(); polygon(ctx, flap); ctx.clip(); const fp = ctx.createPattern(makeCordTexture(textureSource(sprite, family), body, config.stitch || "classic"), "repeat"); if (fp) { ctx.globalAlpha = 0.58; ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = fp; ctx.fillRect(0, 0, width, height); } ctx.restore();
    } else {
      ctx.save(); polygon(ctx, flap); ctx.clip(); ctx.globalAlpha = 0.12; ctx.fillStyle = "#fff"; for (let x = 0; x < width; x += 8) ctx.fillRect(x, 0, 1, height); ctx.restore();
    }
    ctx.strokeStyle = rgba(shade(flapColor, -48), 0.46); ctx.lineWidth = 1.2; polygon(ctx, flap); ctx.stroke();
  }

  const metal = config.hardware === "silver" ? "#c8cdd3" : config.hardware === "black" ? "#302e31" : "#b99555";
  const lock = project({ x: 0, y: config.flap !== "none" ? h * 0.18 : -h * 0.48, z: d + 0.17 }, width, height, rotation, zoom);
  drawMetal(ctx, lock.x, lock.y, Math.max(3.2, 5.4 * zoom * lock.scale * 1.6), metal);
  if (config.strap !== "none") {
    [-1, 1].forEach((side) => { const p = project({ x: side * w * 0.88, y: h * 0.43, z: d * 0.72 }, width, height, rotation, zoom); drawMetal(ctx, p.x, p.y, Math.max(2.5, 4.1 * zoom * p.scale * 1.55), metal, true); });
  }

  // Small woven brand plate.
  const badge = project({ x: 0, y: -h * 0.61, z: d + 0.11 }, width, height, rotation, zoom);
  ctx.save(); ctx.translate(badge.x, badge.y); const bw = 22 * zoom * badge.scale, bh = 6 * zoom * badge.scale; ctx.fillStyle = rgba(metal, 0.82); ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, Math.max(1, bh / 2)); ctx.fill(); ctx.restore();

  if (config.accent === "scarf") {
    const p = project({ x: -w * 0.64, y: h * 0.67, z: d + 0.14 }, width, height, rotation, zoom);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-0.2 + rotation.y * 0.05); ctx.globalAlpha = 0.94;
    const sg = ctx.createLinearGradient(-20, -10, 20, 12); sg.addColorStop(0, "#f1c6d1"); sg.addColorStop(0.55, "#d9899f"); sg.addColorStop(1, "#a95d74"); ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(-7, 0, 13 * zoom, 6 * zoom, -0.45, 0, Math.PI * 2); ctx.ellipse(8, 1, 12 * zoom, 5.5 * zoom, 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2, 5); ctx.quadraticCurveTo(-8, 24 * zoom, -3, 31 * zoom); ctx.lineTo(5, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#9f586c"; ctx.beginPath(); ctx.arc(0, 2, 3.8 * zoom, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  } else if (config.accent === "tassel") {
    const top = project({ x: -w * 0.82, y: h * 0.34, z: d + 0.12 }, width, height, rotation, zoom);
    const bottom = project({ x: -w * 0.88, y: -h * 0.40, z: d + 0.10 }, width, height, rotation, zoom);
    ctx.save(); ctx.strokeStyle = shade(body, -16); ctx.lineCap = "round"; ctx.lineWidth = Math.max(2, 3.6 * zoom);
    for (let i = -2; i <= 2; i += 1) { ctx.beginPath(); ctx.moveTo(top.x + i * 1.5, top.y); ctx.quadraticCurveTo((top.x + bottom.x) / 2 + i * 2, (top.y + bottom.y) / 2, bottom.x + i * 2, bottom.y); ctx.stroke(); } ctx.restore();
  } else if (config.accent === "charm") {
    const p = project({ x: w * 0.84, y: h * 0.12, z: d + 0.14 }, width, height, rotation, zoom); drawMetal(ctx, p.x, p.y, Math.max(2.8, 4.4 * zoom), metal, true); ctx.save(); ctx.fillStyle = "#b87880"; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(p.x, p.y + 9 * zoom, 4.5 * zoom, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}

export default function BagBuilderPremiumCanvas3D() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState<Config>(EMPTY);
  const [rotation, setRotation] = useState(DEFAULT_ROTATION);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [sprite, setSprite] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    const find = () => setStage((current) => { const next = document.querySelector<HTMLElement>(".abags-bag-builder-stage"); return current === next ? current : next; });
    find(); const observer = new MutationObserver(find); observer.observe(document.body, { childList: true, subtree: true }); return () => observer.disconnect();
  }, []);

  useEffect(() => { const controller = new AbortController(); void loadAtelierSprite(controller.signal).then(setSprite); return () => controller.abort(); }, []);

  useEffect(() => {
    if (!stage) return;
    let timer = 0;
    const syncMode = () => {
      if (stage.getAttribute("data-abags-pro3d-ready") === "true") {
        window.clearTimeout(timer); setEnabled(false); stage.classList.remove("abags-canvas3d-active", "abags-premium-canvas3d-active"); stage.removeAttribute("data-abags-canvas3d-ready");
      } else {
        window.clearTimeout(timer); timer = window.setTimeout(() => {
          if (stage.getAttribute("data-abags-pro3d-ready") !== "true") { setEnabled(true); stage.classList.add("abags-canvas3d-active", "abags-premium-canvas3d-active"); stage.setAttribute("data-abags-canvas3d-ready", "premium-v2"); }
        }, 650);
      }
    };
    syncMode(); const observer = new MutationObserver(syncMode); observer.observe(stage, { attributes: true, attributeFilter: ["data-abags-pro3d-ready"] });
    return () => { window.clearTimeout(timer); observer.disconnect(); stage.classList.remove("abags-canvas3d-active", "abags-premium-canvas3d-active"); stage.removeAttribute("data-abags-canvas3d-ready"); };
  }, [stage]);

  useEffect(() => {
    if (!stage) return;
    const sync = () => setConfig((current) => { const next = readConfig(stage); return sameConfig(current, next) ? current : next; });
    sync(); const observer = new MutationObserver(sync); observer.observe(stage, { attributes: true, attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"] }); return () => observer.disconnect();
  }, [stage]);

  useEffect(() => {
    if (!enabled) return; const canvas = canvasRef.current; if (!canvas) return;
    let frame = requestAnimationFrame(() => drawPremium(canvas, config, rotation, zoom, sprite));
    const redraw = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => drawPremium(canvas, config, rotation, zoom, sprite)); };
    window.addEventListener("resize", redraw); return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", redraw); };
  }, [enabled, config, rotation, zoom, sprite]);

  const label = useMemo(() => config.family ? "Interaktywny premium podgląd 3D torebki A-Bags" : "Wybierz fason, aby rozpocząć", [config.family]);
  if (!stage || !enabled) return null;
  const distance = () => { const pts = Array.from(pointers.current.values()); return pts.length < 2 ? 0 : Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); };
  const setView = (view: "front" | "three" | "side") => setRotation(view === "front" ? { x: -0.02, y: 0 } : view === "side" ? { x: -0.06, y: Math.PI / 2 } : DEFAULT_ROTATION);

  return createPortal(<div className="abags-canvas3d-layer abags-premium-canvas3d-layer" data-abags-interactive3d="canvas" data-abags-premium-renderer="photo-textured-v2">
    <canvas ref={canvasRef} className="abags-canvas3d-canvas abags-premium-canvas3d-canvas" aria-label={label}
      onPointerDown={(event) => { event.preventDefault(); pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); event.currentTarget.setPointerCapture?.(event.pointerId); if (pointers.current.size >= 2) { pinch.current = { distance: distance(), zoom }; drag.current = null; } else drag.current = { x: event.clientX, y: event.clientY, rx: rotation.x, ry: rotation.y }; }}
      onPointerMove={(event) => { if (!pointers.current.has(event.pointerId)) return; event.preventDefault(); pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointers.current.size >= 2 && pinch.current) { const next = distance(); if (pinch.current.distance > 0) setZoom(clamp(pinch.current.zoom * (next / pinch.current.distance), MIN_ZOOM, MAX_ZOOM)); return; } if (!drag.current) return; setRotation({ x: clamp(drag.current.rx + (event.clientY - drag.current.y) * 0.007, -0.62, 0.42), y: drag.current.ry + (event.clientX - drag.current.x) * 0.011 }); }}
      onPointerUp={(event) => { pointers.current.delete(event.pointerId); if (pointers.current.size < 2) pinch.current = null; if (!pointers.current.size) drag.current = null; }}
      onPointerCancel={(event) => { pointers.current.delete(event.pointerId); pinch.current = null; drag.current = null; }}
      onWheel={(event) => { event.preventDefault(); setZoom((value) => clamp(value - event.deltaY * 0.0008, MIN_ZOOM, MAX_ZOOM)); }} />
    <div className="abags-canvas3d-chip">PREMIUM PODGLĄD · REALNA TEKSTURA ATELIER</div>
    <div className="abags-canvas3d-views" aria-label="Widok modelu 3D"><button type="button" onClick={() => setView("front")}>Przód</button><button type="button" onClick={() => setView("three")}>3/4</button><button type="button" onClick={() => setView("side")}>Bok</button></div>
    <div className="abags-canvas3d-zoom" aria-label="Zoom modelu 3D"><button type="button" onClick={() => setZoom((value) => clamp(value - 0.1, MIN_ZOOM, MAX_ZOOM))} aria-label="Oddal model">−</button><input type="range" min={42} max={138} value={Math.round(zoom * 100)} onChange={(event) => setZoom(clamp(Number(event.currentTarget.value) / 100, MIN_ZOOM, MAX_ZOOM))} aria-label="Skala modelu 3D" /><button type="button" onClick={() => setZoom((value) => clamp(value + 0.1, MIN_ZOOM, MAX_ZOOM))} aria-label="Przybliż model">+</button><button type="button" className="abags-canvas3d-reset" onClick={() => { setRotation(DEFAULT_ROTATION); setZoom(DEFAULT_ZOOM); }}>{Math.round(zoom * 100)}%</button></div>
    <p className="abags-canvas3d-hint">Przeciągnij, aby obracać · uszczypnij, aby przybliżać. Tekstura korpusu czerpie mikrod detal z rzeczywistych produktów atelier.</p>
  </div>, stage);
}
