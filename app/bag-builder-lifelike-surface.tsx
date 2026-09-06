"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const STAGE_SELECTOR = ".abags-bag-builder-stage";
const LAYER_SELECTOR = ".abags-fidelity3d-layer";
const BASE_SOURCE_SELECTOR = ".abags-fidelity3d-canvas";
const AGATA_SOURCE_SELECTOR = ".abags-agata-cord-webgl";
const AGATA_SURFACE_VERSION = "agata-cord-webgl-v1-photo-calibrated";

function createFibrePattern() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  let seed = 0x2a6b73d;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineCap = "round";

  for (let index = 0; index < 86; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const length = 8 + random() * 22;
    const rise = (random() - 0.5) * 4;
    const light = index % 3 !== 0;
    context.strokeStyle = light
      ? `rgba(255,255,255,${0.018 + random() * 0.028})`
      : `rgba(42,29,32,${0.012 + random() * 0.018})`;
    context.lineWidth = 0.45 + random() * 0.7;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + length * 0.52, y + rise, x + length, y + rise * 0.35);
    context.stroke();
  }

  return canvas;
}

function paintLifelikeSurface(
  output: HTMLCanvasElement,
  source: HTMLCanvasElement,
  fibrePattern: HTMLCanvasElement,
) {
  const width = source.width;
  const height = source.height;
  if (width < 2 || height < 2) return false;

  if (output.width !== width) output.width = width;
  if (output.height !== height) output.height = height;

  const context = output.getContext("2d", { alpha: true });
  if (!context) return false;

  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);

  // Neutral photographic lighting only: it strengthens perceived cord depth without
  // recolouring the customer's selected Pimiotki polyester cord.
  context.globalCompositeOperation = "source-atop";

  const keyLight = context.createRadialGradient(
    width * 0.34,
    height * 0.2,
    0,
    width * 0.34,
    height * 0.2,
    Math.max(width, height) * 0.72,
  );
  keyLight.addColorStop(0, "rgba(255,255,255,0.105)");
  keyLight.addColorStop(0.42, "rgba(255,255,255,0.045)");
  keyLight.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = keyLight;
  context.fillRect(0, 0, width, height);

  const bodyDepth = context.createLinearGradient(0, height * 0.12, 0, height);
  bodyDepth.addColorStop(0, "rgba(38,25,29,0)");
  bodyDepth.addColorStop(0.64, "rgba(38,25,29,0.012)");
  bodyDepth.addColorStop(1, "rgba(38,25,29,0.07)");
  context.fillStyle = bodyDepth;
  context.fillRect(0, 0, width, height);

  const edgeDepth = context.createRadialGradient(
    width * 0.5,
    height * 0.46,
    Math.min(width, height) * 0.18,
    width * 0.5,
    height * 0.46,
    Math.max(width, height) * 0.66,
  );
  edgeDepth.addColorStop(0, "rgba(31,22,24,0)");
  edgeDepth.addColorStop(0.7, "rgba(31,22,24,0.008)");
  edgeDepth.addColorStop(1, "rgba(31,22,24,0.045)");
  context.fillStyle = edgeDepth;
  context.fillRect(0, 0, width, height);

  const pattern = context.createPattern(fibrePattern, "repeat");
  if (pattern) {
    context.globalAlpha = 0.58;
    context.fillStyle = pattern;
    context.fillRect(0, 0, width, height);
    context.globalAlpha = 1;
  }

  // A very narrow neutral sheen gives polyester cord its characteristic soft glint.
  const sheen = context.createLinearGradient(width * 0.15, 0, width * 0.78, height);
  sheen.addColorStop(0, "rgba(255,255,255,0)");
  sheen.addColorStop(0.42, "rgba(255,255,255,0.018)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0.052)");
  sheen.addColorStop(0.58, "rgba(255,255,255,0.012)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = sheen;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  return true;
}

function selectMaterialSource(layer: HTMLElement, stage: HTMLElement) {
  const agataReady = stage.dataset.abagsAgataCordWebgl === AGATA_SURFACE_VERSION;
  if (agataReady) {
    const agata = layer.querySelector<HTMLCanvasElement>(AGATA_SOURCE_SELECTOR);
    if (agata && agata.width >= 2 && agata.height >= 2) return { canvas: agata, name: "agata-webgl-photo-calibrated" };
  }

  const base = layer.querySelector<HTMLCanvasElement>(BASE_SOURCE_SELECTOR);
  return base ? { canvas: base, name: "calibrated-webgl-v4" } : null;
}

export default function BagBuilderLifelikeSurface() {
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const patternRef = useRef<HTMLCanvasElement | null>(null);
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
    const output = canvasRef.current;
    if (!stage || !output) return;

    if (!patternRef.current) patternRef.current = createFibrePattern();

    const clear = () => {
      output.getContext("2d")?.clearRect(0, 0, output.width, output.height);
      stage.removeAttribute("data-abags-lifelike");
      stage.removeAttribute("data-abags-lifelike-source");
    };

    const paint = () => {
      frameRef.current = null;
      if (stage.dataset.abagsFinal3d !== "ready" || stage.dataset.abagsPhotoTrue === "active") {
        clear();
        return;
      }

      const selected = selectMaterialSource(layer, stage);
      if (!selected) {
        clear();
        return;
      }

      const painted = paintLifelikeSurface(output, selected.canvas, patternRef.current!);
      if (painted) {
        stage.dataset.abagsLifelike = "ready";
        stage.dataset.abagsLifelikeSource = selected.name;
      }
    };

    const schedulePaint = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(paint);
    };

    const observer = new MutationObserver(schedulePaint);
    observer.observe(stage, {
      attributes: true,
      attributeFilter: [
        "data-abags-final3d",
        "data-abags-fidelity3d-frame-at",
        "data-abags-agata-cord-webgl",
        "data-abags-photo-true",
        "data-builder-signature",
        "data-color",
        "data-stitch",
        "data-flap",
        "data-handles",
        "data-strap",
        "data-hardware",
        "data-accent",
      ],
    });

    stage.addEventListener("abags:fidelity3d-transform", schedulePaint as EventListener);
    window.addEventListener("resize", schedulePaint);
    schedulePaint();

    return () => {
      observer.disconnect();
      stage.removeEventListener("abags:fidelity3d-transform", schedulePaint as EventListener);
      window.removeEventListener("resize", schedulePaint);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      stage.removeAttribute("data-abags-lifelike");
      stage.removeAttribute("data-abags-lifelike-source");
    };
  }, [layer]);

  if (!layer) return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      className="abags-lifelike-surface"
      data-abags-lifelike-surface="polyester-photo-pass-v1"
      aria-hidden="true"
    />,
    layer,
  );
}
