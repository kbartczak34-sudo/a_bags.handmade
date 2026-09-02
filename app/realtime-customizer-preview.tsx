"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type RealtimeConfig = {
  color: string;
  stitch: string;
  handles: string;
  hardware: string;
  strap: string;
  accent: string;
};

type Snapshot = {
  imageUrl: string;
  productName: string;
  config: RealtimeConfig;
  showBase: boolean;
};

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };

const EMPTY_CONFIG: RealtimeConfig = { color: "", stitch: "", handles: "", hardware: "", strap: "", accent: "" };
const TARGET_COLORS: Record<string, string> = {
  "natural-bez": "#d8c3a8",
  "pudrowy-roz": "#d9a3aa",
  "gleboki-granat": "#24324d",
  "czekoladowy-braz": "#65493d",
  musztardowy: "#c7962f",
  czarny: "#242224",
};
const HARDWARE_COLORS: Record<string, string> = { zlote: "#c9a24f", srebrne: "#d4d8dd", czarne: "#2c292d" };

function clamp(value: number, min = 0, max = 1) { return Math.min(max, Math.max(min, value)); }
function normalize(value: string) { return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function hexToRgb(hex: string): RGB { const n = Number.parseInt(hex.replace("#", ""), 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
function rgbToHsl(r: number, g: number, b: number): HSL { const rn = r / 255, gn = g / 255, bn = b / 255, max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), d = max - min; let h = 0; if (d) { if (max === rn) h = ((gn - bn) / d) % 6; else if (max === gn) h = (bn - rn) / d + 2; else h = (rn - gn) / d + 4; h *= 60; if (h < 0) h += 360; } const l = (max + min) / 2; const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); return { h, s, l }; }
function hslToRgb(h: number, s: number, l: number): RGB { const c = (1 - Math.abs(2 * l - 1)) * s, hh = h / 60, x = c * (1 - Math.abs((hh % 2) - 1)); let rn = 0, gn = 0, bn = 0; if (hh < 1) [rn, gn] = [c, x]; else if (hh < 2) [rn, gn] = [x, c]; else if (hh < 3) [gn, bn] = [c, x]; else if (hh < 4) [gn, bn] = [x, c]; else if (hh < 5) [rn, bn] = [x, c]; else [rn, bn] = [c, x]; const m = l - c / 2; return { r: Math.round((rn + m) * 255), g: Math.round((gn + m) * 255), b: Math.round((bn + m) * 255) }; }
function hueDistance(a: number, b: number) { const d = Math.abs(a - b); return Math.min(d, 360 - d); }

function representativeBodyColor(data: Uint8ClampedArray, width: number, height: number) {
  const bins = new Array(25).fill(0) as number[];
  for (let y = Math.floor(height * 0.42); y < Math.floor(height * 0.86); y += 5) {
    for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x += 5) {
      const i = (y * width + x) * 4, hsl = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      if (hsl.l > 0.93) continue;
      if (hsl.l < 0.28) bins[24] += 1.5;
      if (hsl.s > 0.16 && hsl.l > 0.12 && hsl.l < 0.9) bins[Math.min(23, Math.floor(hsl.h / 15))] += 0.35 + hsl.s;
    }
  }
  let best = 0; for (let i = 1; i < bins.length; i += 1) if (bins[i] > bins[best]) best = i;
  return best === 24 ? { dark: true, hue: 0 } : { dark: false, hue: best * 15 + 7.5 };
}

function recolorBody(ctx: CanvasRenderingContext2D, width: number, height: number, targetHex: string) {
  let imageData: ImageData; try { imageData = ctx.getImageData(0, 0, width, height); } catch { return; }
  const t = hexToRgb(targetHex), target = rgbToHsl(t.r, t.g, t.b), representative = representativeBodyColor(imageData.data, width, height), data = imageData.data;
  const left = width * 0.14, right = width * 0.86, top = height * 0.24, bottom = height * 0.9, cx = width * 0.5, cy = height * 0.58, rx = width * 0.38, ry = height * 0.4;
  for (let y = Math.floor(top); y < Math.min(height, Math.ceil(bottom)); y += 1) for (let x = Math.floor(left); x < Math.min(width, Math.ceil(right)); x += 1) {
    if (((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2) > 1.18) continue;
    const i = (y * width + x) * 4; if (data[i + 3] < 10) continue;
    const current = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const belongs = representative.dark ? current.l < 0.48 && (current.s < 0.72 || current.l < 0.28) : current.s > 0.12 && hueDistance(current.h, representative.hue) < 42;
    if (!belongs) continue;
    const targetLight = target.l < 0.2 ? clamp(current.l * 0.5, 0.035, 0.36) : target.l > 0.68 ? clamp(current.l * 0.62 + 0.28, 0.22, 0.88) : clamp(current.l * 0.82 + target.l * 0.16, 0.09, 0.78);
    const rgb = hslToRgb(target.h, clamp(target.s * 0.92 + current.s * 0.08), targetLight), strength = representative.dark ? 0.82 : 0.88;
    data[i] = Math.round(data[i] * (1 - strength) + rgb.r * strength); data[i + 1] = Math.round(data[i + 1] * (1 - strength) + rgb.g * strength); data[i + 2] = Math.round(data[i + 2] * (1 - strength) + rgb.b * strength);
  }
  ctx.putImageData(imageData, 0, 0);
}

function roundedBodyPath(ctx: CanvasRenderingContext2D, width: number, height: number) { ctx.beginPath(); ctx.roundRect(width * 0.18, height * 0.31, width * 0.64, height * 0.53, Math.min(width, height) * 0.08); }
function drawStitchCue(ctx: CanvasRenderingContext2D, width: number, height: number, stitch: string) {
  if (!stitch) return; ctx.save(); roundedBodyPath(ctx, width, height); ctx.clip(); ctx.globalAlpha = 0.15; ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1, width * 0.0022); const seed = stitch.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3, step = Math.max(16, Math.round(width * 0.035));
  if (seed === 0) for (let x = -height; x < width + height; x += step) { ctx.beginPath(); ctx.moveTo(x, height * 0.28); ctx.lineTo(x + height * 0.5, height * 0.86); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + height * 0.5, height * 0.28); ctx.lineTo(x, height * 0.86); ctx.stroke(); }
  else if (seed === 1) for (let y = height * 0.34; y < height * 0.84; y += step) for (let x = width * 0.2; x < width * 0.82; x += step) { ctx.beginPath(); ctx.arc(x, y, step * 0.32, Math.PI, 0); ctx.stroke(); }
  else for (let x = width * 0.2; x < width * 0.82; x += step) { ctx.beginPath(); ctx.moveTo(x, height * 0.32); ctx.lineTo(x + step * 0.42, height * 0.84); ctx.stroke(); }
  ctx.restore();
}
function drawChain(ctx: CanvasRenderingContext2D, points: Array<[number, number]>, hardware: string, width: number) { ctx.save(); ctx.strokeStyle = HARDWARE_COLORS[hardware] ?? HARDWARE_COLORS.zlote; ctx.lineWidth = Math.max(2, width * 0.004); for (let i = 0; i < points.length - 1; i += 1) { const [x1, y1] = points[i], [x2, y2] = points[i + 1], dx = x2 - x1, dy = y2 - y1, dist = Math.hypot(dx, dy), steps = Math.max(1, Math.floor(dist / (width * 0.022))); for (let s = 0; s <= steps; s += 1) { const q = s / steps, x = x1 + dx * q, y = y1 + dy * q; ctx.beginPath(); ctx.ellipse(x, y, width * 0.012, width * 0.0065, Math.atan2(dy, dx) + (s % 2 ? Math.PI / 2 : 0), 0, Math.PI * 2); ctx.stroke(); } } ctx.restore(); }
function drawAccessories(ctx: CanvasRenderingContext2D, width: number, height: number, config: RealtimeConfig) {
  const hardware = HARDWARE_COLORS[config.hardware] ?? HARDWARE_COLORS.zlote; ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (config.handles === "drewniane") { const gradient = ctx.createLinearGradient(width * 0.34, height * 0.1, width * 0.68, height * 0.36); gradient.addColorStop(0, "#f3d49a"); gradient.addColorStop(0.5, "#d5a968"); gradient.addColorStop(1, "#f1d8a9"); ctx.strokeStyle = gradient; ctx.lineWidth = Math.max(10, width * 0.032); ctx.beginPath(); ctx.ellipse(width * 0.5, height * 0.29, width * 0.18, height * 0.19, 0, Math.PI, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = "rgba(110,72,38,.45)"; ctx.lineWidth = Math.max(2, width * 0.003); ctx.beginPath(); ctx.ellipse(width * 0.5, height * 0.29, width * 0.18, height * 0.19, 0, Math.PI, Math.PI * 2); ctx.stroke(); }
  else if (config.handles === "lancuszek") drawChain(ctx, [[width * 0.34, height * 0.31], [width * 0.5, height * 0.17], [width * 0.66, height * 0.31]], config.hardware, width);
  ctx.fillStyle = hardware; for (const x of [0.22, 0.78]) { ctx.beginPath(); ctx.arc(width * x, height * 0.36, width * 0.012, 0, Math.PI * 2); ctx.fill(); }
  if (config.strap === "regulowany") { ctx.strokeStyle = "rgba(56,43,43,.9)"; ctx.lineWidth = Math.max(10, width * 0.027); ctx.beginPath(); ctx.moveTo(width * 0.8, height * 0.38); ctx.bezierCurveTo(width * 0.94, height * 0.55, width * 0.92, height * 0.8, width * 0.72, height * 0.92); ctx.stroke(); ctx.strokeStyle = hardware; ctx.lineWidth = Math.max(2, width * 0.004); ctx.strokeRect(width * 0.82, height * 0.55, width * 0.045, height * 0.06); }
  else if (config.strap === "lancuszek-premium") drawChain(ctx, [[width * 0.79, height * 0.37], [width * 0.9, height * 0.63], [width * 0.79, height * 0.9], [width * 0.58, height * 0.94]], config.hardware, width);
  if (config.accent === "chwost") { const x = width * 0.3, top = height * 0.39, bottom = height * 0.72; ctx.fillStyle = "#8a5c68"; ctx.beginPath(); ctx.arc(x, top, width * 0.026, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#8a5c68"; ctx.lineWidth = Math.max(2, width * 0.004); for (let i = -6; i <= 6; i += 1) { ctx.beginPath(); ctx.moveTo(x + i * width * 0.006, top + width * 0.022); ctx.lineTo(x + i * width * 0.011, bottom); ctx.stroke(); } }
  else if (config.accent === "apaszka") { const x = width * 0.31, y = height * 0.37; ctx.fillStyle = "rgba(226,170,178,.94)"; ctx.strokeStyle = "#6e4e61"; ctx.lineWidth = Math.max(2, width * 0.003); ctx.beginPath(); ctx.ellipse(x - width * 0.055, y, width * 0.075, height * 0.04, -0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x + width * 0.055, y, width * 0.075, height * 0.04, 0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - width * 0.014, y + height * 0.025); ctx.lineTo(x - width * 0.08, y + height * 0.28); ctx.lineTo(x, y + height * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + width * 0.014, y + height * 0.025); ctx.lineTo(x + width * 0.09, y + height * 0.25); ctx.lineTo(x + width * 0.01, y + height * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (config.accent === "zawieszka") { const x = width * 0.75, y = height * 0.46; ctx.fillStyle = hardware; ctx.beginPath(); ctx.arc(x, y, width * 0.026, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#f2d7dc"; ctx.beginPath(); ctx.moveTo(x, y + width * 0.006); ctx.bezierCurveTo(x - width * 0.03, y - width * 0.018, x - width * 0.03, y + width * 0.018, x, y + width * 0.045); ctx.bezierCurveTo(x + width * 0.03, y + width * 0.018, x + width * 0.03, y - width * 0.018, x, y + width * 0.006); ctx.fill(); }
  ctx.restore();
}

function valueFromButton(dialog: HTMLElement, fieldsetIndex: number) { return dialog.querySelector<HTMLButtonElement>(`.abags-vc-controls fieldset:nth-child(${fieldsetIndex}) button.is-active`)?.textContent ?? ""; }
function parseSnapshot(dialog: HTMLElement): Snapshot | null {
  const preview = dialog.querySelector<HTMLElement>(".abags-vc-preview"), base = preview?.querySelector<HTMLImageElement>(".abags-vc-base"); if (!preview || !base?.src) return null;
  const modelButton = dialog.querySelector<HTMLButtonElement>(".abags-vc-controls fieldset:nth-child(1) button.is-active"), productName = modelButton?.querySelector("strong")?.textContent?.trim() || base.alt.replace(/^Bazowy model\s*/i, "") || "A-Bags";
  const colorText = normalize(valueFromButton(dialog, 2)), handlesText = normalize(valueFromButton(dialog, 4)), hardwareText = normalize(valueFromButton(dialog, 5)), strapText = normalize(valueFromButton(dialog, 6)), accentText = normalize(valueFromButton(dialog, 7));
  const color = colorText.includes("naturalny-bez") ? "natural-bez" : colorText.includes("pudrowy-roz") ? "pudrowy-roz" : colorText.includes("gleboki-granat") ? "gleboki-granat" : colorText.includes("czekoladowy-braz") ? "czekoladowy-braz" : colorText.includes("musztardowy") ? "musztardowy" : colorText.includes("czarny") ? "czarny" : "";
  const handles = handlesText.includes("drewniane") ? "drewniane" : handlesText.includes("lancuszek") ? "lancuszek" : handlesText ? "klasyczne" : "";
  const hardware = hardwareText.includes("srebrne") ? "srebrne" : hardwareText.includes("czarne") ? "czarne" : hardwareText ? "zlote" : "";
  const strap = strapText.includes("lancuszek-premium") ? "lancuszek-premium" : strapText.includes("regulowany") ? "regulowany" : strapText ? "bez-paska" : "";
  const accent = accentText.includes("chwost") ? "chwost" : accentText.includes("apaszka") || accentText.includes("kokarda") ? "apaszka" : accentText.includes("zawieszka") ? "zawieszka" : accentText ? "bez-ozdoby" : "";
  return { imageUrl: base.src, productName, config: { color, stitch: normalize(valueFromButton(dialog, 3)), handles, hardware, strap, accent }, showBase: preview.classList.contains("is-showing-base") };
}

function LiveCanvas({ snapshot }: { snapshot: Snapshot }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !snapshot.imageUrl || snapshot.showBase) return; let cancelled = false; const image = new Image(); image.decoding = "async";
    image.onload = () => { if (cancelled) return; const maxSide = 820, scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height)), width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale)), height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale)); canvas.width = width; canvas.height = height; const ctx = canvas.getContext("2d", { willReadFrequently: true }); if (!ctx) return; ctx.clearRect(0, 0, width, height); ctx.drawImage(image, 0, 0, width, height); const target = TARGET_COLORS[snapshot.config.color]; if (target) recolorBody(ctx, width, height, target); drawStitchCue(ctx, width, height, snapshot.config.stitch); drawAccessories(ctx, width, height, snapshot.config); };
    image.onerror = () => canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height); image.src = snapshot.imageUrl; return () => { cancelled = true; image.onload = null; image.onerror = null; };
  }, [snapshot]);
  if (snapshot.showBase) return null;
  return <><canvas ref={canvasRef} className="abags-realtime-preview" data-abags-realtime-preview="true" role="img" aria-label={`Podgląd personalizacji na żywo: ${snapshot.productName}`} /><div className="abags-realtime-preview-badge">Live · render pikselowy</div></>;
}

export default function RealtimeCustomizerPreview() {
  const [mount, setMount] = useState<HTMLElement | null>(null); const [snapshot, setSnapshot] = useState<Snapshot | null>(null); const lastKey = useRef("");
  useEffect(() => {
    let frame = 0;
    const sync = () => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(() => { const dialog = document.querySelector<HTMLElement>(".abags-vc-dialog"), preview = dialog?.querySelector<HTMLElement>(".abags-vc-preview") ?? null; setMount((current) => current === preview ? current : preview); if (!dialog || !preview) { if (lastKey.current) { lastKey.current = ""; setSnapshot(null); } return; } const next = parseSnapshot(dialog); const key = next ? JSON.stringify(next) : ""; if (key !== lastKey.current) { lastKey.current = key; setSnapshot(next); } preview.classList.toggle("has-realtime-renderer", Boolean(next && !next.showBase)); }); };
    sync(); const observer = new MutationObserver(sync); observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "src"] }); document.addEventListener("click", sync, true); return () => { window.cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener("click", sync, true); document.querySelector(".abags-vc-preview")?.classList.remove("has-realtime-renderer"); };
  }, []);
  if (!mount || !snapshot) return null;
  return createPortal(<LiveCanvas snapshot={snapshot} />, mount);
}
