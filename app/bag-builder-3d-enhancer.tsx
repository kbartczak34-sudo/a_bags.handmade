"use client";

import { useEffect } from "react";

const MIN_SCALE = 0.45;
const MAX_SCALE = 1.15;
const DEFAULT_SCALE = 0.82;
const THREE_LAYER_CLASS = "abags-three-digital-twin-layer";
const THREE_READY_ATTR = "data-abags-three-ready";
const THREE_LOADING_ATTR = "data-abags-three-loading";
const REQUIRED_ASSET_KEYS = ["model", "basecolor", "normal", "roughness", "metallic", "ao"] as const;
const REQUIRED_MESHES = ["body", "flap", "handles", "strap", "hardware", "accessories"] as const;

type ThreeRuntime = typeof import("three");
type ThreeObject3D = import("three").Object3D;

function clamp(value: number) { return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value)); }
function distance(points: Array<{ x: number; y: number }>) { return points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); }
function familyModelId(family: string) {
  if (family === "tote") return "abags-tote-v1";
  if (family === "round") return "abags-round-v1";
  if (family === "bucket") return "abags-bucket-v1";
  if (family === "mini") return "abags-mini-v1";
  return null;
}
function assetUrls(modelId: string) {
  const root = `/3d/bags/${encodeURIComponent(modelId.trim())}`;
  return { model: `${root}/model.glb`, basecolor: `${root}/textures/basecolor.webp`, normal: `${root}/textures/normal.webp`, roughness: `${root}/textures/roughness.webp`, metallic: `${root}/textures/metallic.webp`, ao: `${root}/textures/ao.webp` } as const;
}
async function assetsExist(urls: ReturnType<typeof assetUrls>) {
  const results = await Promise.all(REQUIRED_ASSET_KEYS.map(async (key) => {
    try { return (await fetch(urls[key], { method: "HEAD", cache: "no-store" })).ok; } catch { return false; }
  }));
  return results.every(Boolean);
}
function materialKind(meshName: string) {
  const name = meshName.toLowerCase();
  if (name.includes("hardware") || name.includes("metal") || name.includes("zipper")) return "metal" as const;
  if (name.includes("flap") || name.includes("strap")) return "leather" as const;
  if (name.includes("handle")) return name.includes("wood") ? "wood" as const : "cord" as const;
  return "cord" as const;
}
function disposeObject(runtime: ThreeRuntime, root: ThreeObject3D) {
  root.traverse((object) => {
    const mesh = object as import("three").Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => material?.dispose());
  });
  void runtime;
}

async function mountThreeTwin(layer: HTMLElement) {
  if (layer.dataset.abagsThreeMounted === "true") return () => undefined;
  const modelId = familyModelId(layer.dataset.family ?? "");
  if (!modelId) return () => undefined;
  const urls = assetUrls(modelId);
  layer.setAttribute(THREE_LOADING_ATTR, "true");
  if (!(await assetsExist(urls))) {
    layer.removeAttribute(THREE_LOADING_ATTR);
    layer.dataset.abagsThreeFallback = "assets-missing";
    return () => undefined;
  }

  const [THREE, { GLTFLoader }, { RoomEnvironment }, { createABagsThreePbrMaterial, loadABagsThreePbrMaps }] = await Promise.all([
    import("three"),
    import("three/addons/loaders/GLTFLoader.js"),
    import("three/addons/environments/RoomEnvironment.js"),
    import("../lib/abags-three-pbr"),
  ]);

  const host = document.createElement("div");
  host.className = THREE_LAYER_CLASS;
  host.setAttribute("aria-label", "Fotorealistyczny podgląd Digital Twin A-Bags");
  host.style.cssText = "position:absolute;inset:0;z-index:3;pointer-events:auto;overflow:hidden;border-radius:inherit;background:transparent;";
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;";
  host.appendChild(canvas);
  layer.appendChild(host);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.5 : 2));
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
  camera.position.set(0, 0.1, 4.2);
  const environmentScene = new RoomEnvironment(renderer);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(environmentScene, 0.04).texture;
  environmentScene.dispose();
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xfff5ec, 2.2); key.position.set(3.5, 4.5, 5.5); key.castShadow = true; scene.add(key);
  const fill = new THREE.DirectionalLight(0xf3e5da, 0.85); fill.position.set(-4, 1.8, 3.2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.4); rim.position.set(1.5, 4, -4); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff8f3, 0x6d5a55, 0.55));

  const loader = new GLTFLoader();
  let root: ThreeObject3D | null = null;
  let disposed = false;
  try {
    const [gltf, maps] = await Promise.all([loader.loadAsync(urls.model), loadABagsThreePbrMaps(urls)]);
    if (disposed) { disposeObject(THREE, gltf.scene); Object.values(maps).forEach((texture) => texture?.dispose()); return () => undefined; }
    root = gltf.scene;
    const meshNames = new Set<string>();
    root.traverse((object) => { if ((object as import("three").Mesh).isMesh) meshNames.add(object.name.toLowerCase()); });
    if (!REQUIRED_MESHES.every((name) => meshNames.has(name))) {
      layer.dataset.abagsThreeFallback = "mesh-contract-failed";
      disposeObject(THREE, root);
      Object.values(maps).forEach((texture) => texture?.dispose());
      layer.removeAttribute(THREE_LOADING_ATTR);
      host.remove();
      renderer.dispose();
      return () => undefined;
    }
    root.traverse((object) => {
      const mesh = object as import("three").Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.material = createABagsThreePbrMaterial(materialKind(mesh.name || "body"), layer.dataset.color || "#E8DDCC", maps);
    });
    scene.add(root);
    layer.dataset.abagsThreeMounted = "true";
    layer.setAttribute(THREE_READY_ATTR, "true");
    layer.removeAttribute(THREE_LOADING_ATTR);
    layer.dataset.abagsThreeModel = modelId;
  } catch {
    layer.dataset.abagsThreeFallback = "load-failed";
    layer.removeAttribute(THREE_LOADING_ATTR);
    host.remove();
    renderer.dispose();
    return () => undefined;
  }

  const resize = () => {
    if (!document.body.contains(host)) return;
    const rect = host.getBoundingClientRect();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  let raf = 0;
  const animate = () => { if (disposed) return; raf = window.requestAnimationFrame(animate); renderer.render(scene, camera); };
  animate();

  const observer = new MutationObserver(() => {
    if (!root || disposed) return;
    const nextColor = layer.dataset.color || "#E8DDCC";
    root.traverse((object) => {
      const mesh = object as import("three").Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => { const physical = material as import("three").MeshPhysicalMaterial; if (!physical.map) physical.color?.set(nextColor); });
    });
  });
  observer.observe(layer, { attributes: true, attributeFilter: ["data-color"] });

  return () => {
    disposed = true;
    window.cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    observer.disconnect();
    if (root) { scene.remove(root); disposeObject(THREE, root); }
    renderer.dispose();
    scene.clear();
    host.remove();
    delete layer.dataset.abagsThreeMounted;
    delete layer.dataset.abagsThreeModel;
    layer.removeAttribute(THREE_READY_ATTR);
    layer.removeAttribute(THREE_LOADING_ATTR);
  };
}

export default function BagBuilder3DEnhancer() {
  useEffect(() => {
    const cleanups = new Map<HTMLElement, () => void>();
    let scanTimer: number | null = null;
    const enhance = (layer: HTMLElement) => {
      if (layer.dataset.abags3dEnhanced === "true") return;
      const canvas = layer.querySelector<HTMLCanvasElement>(".abags-real3d-canvas");
      const controls = layer.querySelector<HTMLElement>(".abags-real3d-controls");
      const chip = layer.querySelector<HTMLElement>(".abags-real3d-chip");
      if (!canvas || !controls) return;
      layer.dataset.abags3dEnhanced = "true";
      layer.style.setProperty("--abags-extra-scale", String(DEFAULT_SCALE));
      layer.style.position = layer.style.position || "relative";
      if (chip) chip.textContent = "DIGITAL TWIN · 360° · PINCH ZOOM";
      const viewButtons = Array.from(controls.querySelectorAll<HTMLButtonElement>("button")).slice(0, 3);
      const setActiveView = (index: number) => viewButtons.forEach((button, buttonIndex) => { button.classList.toggle("is-active", buttonIndex === index); button.setAttribute("aria-pressed", buttonIndex === index ? "true" : "false"); });
      const viewListeners = viewButtons.map((button, index) => { const listener = () => setActiveView(index); button.addEventListener("click", listener); return () => button.removeEventListener("click", listener); });
      const zoomPanel = document.createElement("div");
      zoomPanel.className = "abags-real3d-extended-zoom";
      zoomPanel.setAttribute("aria-label", "Sterowanie oddaleniem modelu 3D");
      zoomPanel.innerHTML = `<span class="abags-real3d-zoom-label">ODDAL / PRZYBLIŻ</span><button type="button" data-abags-zoom-out aria-label="Oddal model">−</button><input data-abags-zoom-range type="range" min="45" max="115" step="1" value="82" aria-label="Oddalenie modelu 3D" /><button type="button" data-abags-zoom-in aria-label="Przybliż model">+</button><button type="button" data-abags-zoom-reset aria-label="Przywróć domyślne oddalenie">82%</button>`;
      layer.appendChild(zoomPanel);
      const range = zoomPanel.querySelector<HTMLInputElement>("[data-abags-zoom-range]")!;
      const reset = zoomPanel.querySelector<HTMLButtonElement>("[data-abags-zoom-reset]")!;
      let scale = DEFAULT_SCALE;
      const applyScale = (next: number) => { scale = clamp(next); layer.style.setProperty("--abags-extra-scale", scale.toFixed(3)); range.value = String(Math.round(scale * 100)); reset.textContent = `${Math.round(scale * 100)}%`; };
      const zoomOut = () => applyScale(scale - 0.1); const zoomIn = () => applyScale(scale + 0.1); const zoomReset = () => applyScale(DEFAULT_SCALE); const zoomRange = () => applyScale(Number(range.value) / 100);
      zoomPanel.querySelector<HTMLButtonElement>("[data-abags-zoom-out]")!.addEventListener("click", zoomOut); zoomPanel.querySelector<HTMLButtonElement>("[data-abags-zoom-in]")!.addEventListener("click", zoomIn); reset.addEventListener("click", zoomReset); range.addEventListener("input", zoomRange);
      const pointers = new Map<number, { x: number; y: number }>(); let pinchStarted = false; let pinchDistance = 0; let pinchScale = scale;
      const pointerDown = (event: PointerEvent) => { pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointers.size >= 2) { pinchStarted = true; pinchDistance = distance(Array.from(pointers.values()).slice(0, 2)); pinchScale = scale; event.preventDefault(); event.stopPropagation(); } };
      const pointerMove = (event: PointerEvent) => { if (!pointers.has(event.pointerId)) return; pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (!pinchStarted || pointers.size < 2) return; const nextDistance = distance(Array.from(pointers.values()).slice(0, 2)); if (pinchDistance > 0) applyScale(pinchScale * (nextDistance / pinchDistance)); event.preventDefault(); event.stopPropagation(); };
      const pointerEnd = (event: PointerEvent) => { if (pinchStarted) { event.preventDefault(); event.stopPropagation(); } pointers.delete(event.pointerId); if (pointers.size === 0) { pinchStarted = false; pinchDistance = 0; } };
      canvas.addEventListener("pointerdown", pointerDown, true); canvas.addEventListener("pointermove", pointerMove, true); canvas.addEventListener("pointerup", pointerEnd, true); canvas.addEventListener("pointercancel", pointerEnd, true);
      let twinCleanup: (() => void) | null = null; let twinStarted = false;
      const startTwin = () => { if (twinStarted) return; twinStarted = true; void mountThreeTwin(layer).then((cleanup) => { twinCleanup = cleanup; }).catch(() => { layer.dataset.abagsThreeFallback = "runtime-error"; layer.removeAttribute(THREE_LOADING_ATTR); }); };
      startTwin();
      requestAnimationFrame(() => { viewButtons[1]?.click(); setActiveView(1); });
      const cleanup = () => { viewListeners.forEach((fn) => fn()); canvas.removeEventListener("pointerdown", pointerDown, true); canvas.removeEventListener("pointermove", pointerMove, true); canvas.removeEventListener("pointerup", pointerEnd, true); canvas.removeEventListener("pointercancel", pointerEnd, true); twinCleanup?.(); zoomPanel.remove(); layer.style.removeProperty("--abags-extra-scale"); delete layer.dataset.abags3dEnhanced; };
      cleanups.set(layer, cleanup);
    };
    const scan = () => { document.querySelectorAll<HTMLElement>(".abags-real3d-layer").forEach(enhance); for (const [layer, cleanup] of cleanups) { if (!document.body.contains(layer)) { cleanup(); cleanups.delete(layer); } } };
    const scheduleScan = () => { if (scanTimer !== null) window.cancelAnimationFrame(scanTimer); scanTimer = window.requestAnimationFrame(() => { scanTimer = null; scan(); }); };
    scan();
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); if (scanTimer !== null) window.cancelAnimationFrame(scanTimer); cleanups.forEach((cleanup) => cleanup()); cleanups.clear(); };
  }, []);
  return null;
}
