"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { createABagsThreeAssetPaths, isABagsThreeMeshName } from "../lib/abags-threejs-asset-contract";
import { getABagsMaterialKind, getABagsPbrProfile } from "../lib/abags-photoreal-materials";
import { useBagBuilderClientState } from "./bag-builder-config-store";

type Props = { className?: string; modelId?: string };

type BuilderConfig = ReturnType<typeof useBagBuilderClientState>["config"];
type PbrTextures = Awaited<ReturnType<typeof loadPbrTextures>>;

const HDRI_URL = "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/textures/equirectangular/royal_esplanade_1k.hdr";
const HARDWARE_COLORS: Record<BuilderConfig["hardware"], THREE.ColorRepresentation> = {
  gold: "#C7962F",
  silver: "#C5CAD4",
  black: "#28282B",
};

function textureLoader(url: string) {
  return new THREE.TextureLoader().loadAsync(url).then((texture) => {
    texture.flipY = false;
    return texture;
  });
}

async function loadPbrTextures(paths: ReturnType<typeof createABagsThreeAssetPaths>["textures"]) {
  const [basecolor, normal, roughness, metallic, ao] = await Promise.all([
    textureLoader(paths.basecolor),
    textureLoader(paths.normal),
    textureLoader(paths.roughness),
    textureLoader(paths.metallic),
    textureLoader(paths.ao),
  ]);
  basecolor.colorSpace = THREE.SRGBColorSpace;
  return { basecolor, normal, roughness, metallic, ao };
}

function disposeTexture(texture: THREE.Texture | null | undefined, disposed: Set<THREE.Texture>) {
  if (!texture || disposed.has(texture)) return;
  disposed.add(texture);
  texture.dispose();
}

function disposeObject(root: THREE.Object3D) {
  const disposed = new Set<THREE.Texture>();
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshPhysicalMaterial) {
        disposeTexture(material.map, disposed);
        disposeTexture(material.normalMap, disposed);
        disposeTexture(material.roughnessMap, disposed);
        disposeTexture(material.metalnessMap, disposed);
        disposeTexture(material.aoMap, disposed);
        disposeTexture(material.clearcoatNormalMap, disposed);
      }
      material.dispose();
    }
  });
}

function partFromMeshName(name: string): ReturnType<typeof isABagsThreeMeshName> extends never ? never : "body" | "flap" | "handles" | "strap" | "hardware" | "accessories" | null {
  const match = name.toLowerCase().match(/^(body|flap|handles|strap|hardware|accessories)(?:$|[-_])/);
  const part = match?.[1];
  return part && isABagsThreeMeshName(part) ? part : null;
}

function partMaterialKind(part: Exclude<ReturnType<typeof partFromMeshName>, null>, config: BuilderConfig) {
  if (part === "body" || part === "accessories") return "cord" as const;
  if (part === "hardware") return "metal" as const;
  if (part === "handles") return config.handles === "crochet" ? "cord" as const : "wood" as const;
  if (part === "strap") return config.strap === "woven" ? "cord" as const : config.strap === "chain" ? "metal" as const : "leather" as const;
  return "leather" as const;
}

function partVisible(part: Exclude<ReturnType<typeof partFromMeshName>, null>, config: BuilderConfig) {
  if (part === "flap") return config.flap !== "none";
  if (part === "handles") return config.handles !== "none";
  if (part === "strap") return config.strap !== "none";
  if (part === "accessories") return config.accent !== "none";
  return true;
}

function partColor(part: Exclude<ReturnType<typeof partFromMeshName>, null>, config: BuilderConfig) {
  if (part === "hardware") return new THREE.Color(HARDWARE_COLORS[config.hardware]);
  if (part === "flap") {
    if (config.flap === "leather-black") return new THREE.Color("#222124");
    if (config.flap === "leather-cognac") return new THREE.Color("#65493D");
    if (config.flap === "suede-burgundy") return new THREE.Color("#6F2732");
  }
  if (part === "handles" && config.handles === "wood-dark") return new THREE.Color("#5E3D2D");
  if (part === "handles" && config.handles === "wood-light") return new THREE.Color("#CFA77B");
  return new THREE.Color(config.color || "#E8DDCC");
}

function applyMaterial(mesh: THREE.Mesh, config: BuilderConfig, textures: PbrTextures) {
  const part = partFromMeshName(mesh.name);
  if (!part) return false;
  mesh.visible = partVisible(part, config);
  if (!mesh.visible) return true;

  const kind = partMaterialKind(part, config);
  const profile = getABagsPbrProfile(getABagsMaterialKind(kind));
  mesh.material = new THREE.MeshPhysicalMaterial({
    color: partColor(part, config),
    map: textures.basecolor,
    normalMap: textures.normal,
    normalScale: new THREE.Vector2(profile.normalScale, profile.normalScale),
    roughnessMap: textures.roughness,
    metalnessMap: textures.metallic,
    aoMap: mesh.geometry.getAttribute("uv1") ? textures.ao : null,
    roughness: profile.roughness,
    metalness: profile.metalness,
    specularIntensity: profile.specular,
    clearcoat: profile.clearcoat,
    clearcoatRoughness: profile.clearcoatRoughness,
    sheen: profile.sheen,
    sheenRoughness: profile.sheenRoughness,
    envMapIntensity: profile.environmentIntensity,
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.abagsPart = part;
  mesh.userData.abagsPbrKind = kind;
  return true;
}

export function BagBuilderThreeJsStage({ className, modelId }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const state = useBagBuilderClientState();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.dataset.abagsThreejs = "v1";
    renderer.domElement.dataset.abagsThreejsReady = "loading";
    mount.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eee7dd");
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
    camera.position.set(0, 0.15, 4.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2.4;
    controls.maxDistance = 8;
    controls.minPolarAngle = Math.PI * 0.25;
    controls.maxPolarAngle = Math.PI * 0.75;
    controls.target.set(0, 0.1, 0);

    const key = new THREE.DirectionalLight(0xfff8ed, 2.6);
    key.position.set(3.5, 4.5, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdde9ff, 1.4);
    fill.position.set(-4, 2, 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffe5cf, 2.0);
    rim.position.set(0, 4, -4);
    scene.add(rim);
    scene.add(new THREE.HemisphereLight(0xfff4e7, 0x7d6e66, 1.6));

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(8, 96),
      new THREE.MeshStandardMaterial({ color: 0xd7cec2, roughness: 0.92, metalness: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.4;
    floor.receiveShadow = true;
    scene.add(floor);

    let mountedModel: THREE.Object3D | null = null;
    let environment: THREE.Texture | null = null;
    let disposed = false;

    const boot = async () => {
      const resolvedModelId = (modelId || state.config.baseProductId || state.config.family || "").trim();
      if (!resolvedModelId) {
        renderer.domElement.dataset.abagsThreejsReady = "idle";
        return;
      }

      const asset = createABagsThreeAssetPaths(resolvedModelId);
      try {
        const [loadedEnvironment, gltf, textures] = await Promise.all([
          new RGBELoader().loadAsync(HDRI_URL),
          new GLTFLoader().loadAsync(asset.glb),
          loadPbrTextures(asset.textures),
        ]);
        if (disposed) {
          loadedEnvironment.dispose();
          return;
        }

        loadedEnvironment.mapping = THREE.EquirectangularReflectionMapping;
        environment = loadedEnvironment;
        scene.environment = loadedEnvironment;

        const model = gltf.scene.clone(true);
        const found = new Set<string>();
        model.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          if (applyMaterial(child, state.config, textures)) found.add(child.userData.abagsPart as string);
        });

        scene.add(model);
        mountedModel = model;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z) || 1;
        model.scale.setScalar(2.55 / maxSize);
        box.setFromObject(model);
        model.position.sub(box.getCenter(new THREE.Vector3()));
        model.position.y = -0.25;

        renderer.domElement.dataset.abagsThreejsReady = "true";
        renderer.domElement.dataset.abagsThreejsModel = resolvedModelId;
        renderer.domElement.dataset.abagsThreejsMeshes = [...found].filter(Boolean).sort().join(",");
        renderer.domElement.dataset.abagsThreejsMeshCoverage = String(found.size / 6);
      } catch (error) {
        renderer.domElement.dataset.abagsThreejsReady = "fallback";
        renderer.domElement.dataset.abagsThreejsError = error instanceof Error ? error.message : "asset-load-failed";
      }
    };

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();
    void boot();

    let raf = 0;
    const animate = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      controls.dispose();
      if (mountedModel) {
        scene.remove(mountedModel);
        disposeObject(mountedModel);
      }
      environment?.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [modelId, state.config.baseProductId, state.config.color, state.config.family, state.config.hardware, state.config.flap, state.config.handles, state.config.strap, state.config.accent]);

  return <div ref={mountRef} className={className} data-abags-threejs-stage="v1" aria-label="Podgląd 3D konfiguratora" />;
}
