"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { createABagsThreeAssetPaths, isABagsThreeMeshName } from "../lib/abags-threejs-asset-contract";
import { getABagsPbrProfile, getABagsMaterialKind } from "../lib/abags-photoreal-materials";
import { useBagBuilderClientState } from "./bag-builder-config-store";

type Props = {
  className?: string;
  modelId?: string;
};

const HDRI_URL = "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/textures/equirectangular/royal_esplanade_1k.hdr";

function hexColor(value: string) {
  return new THREE.Color(value || "#e8ddcc");
}

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

function disposeObject(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "clearcoatNormalMap"] as const) {
        const value = material[key as keyof typeof material];
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

export function BagBuilderThreeJsStage({ className, modelId }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const state = useBagBuilderClientState();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
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
    let disposed = false;

    const applyMaterial = (mesh: THREE.Mesh, color: THREE.Color, kind: ReturnType<typeof getABagsMaterialKind>, textures: Awaited<ReturnType<typeof loadPbrTextures>>) => {
      const profile = getABagsPbrProfile(kind);
      const map = textures.basecolor.clone();
      map.needsUpdate = true;
      const material = new THREE.MeshPhysicalMaterial({
        color,
        map,
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
      mesh.material = material;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    };

    const boot = async () => {
      const resolvedModelId = (modelId || state.config.baseProductId || state.config.family || "").trim();
      if (!resolvedModelId) {
        renderer.domElement.dataset.abagsThreejsReady = "idle";
        return;
      }

      const asset = createABagsThreeAssetPaths(resolvedModelId);
      try {
        await new RGBELoader().loadAsync(HDRI_URL).then((environment) => {
          environment.mapping = THREE.EquirectangularReflectionMapping;
          scene.environment = environment;
        });

        const [{ scene: gltfScene }, textures] = await Promise.all([
          new GLTFLoader().loadAsync(asset.glb),
          loadPbrTextures(asset.textures),
        ]);
        if (disposed) return;

        const model = gltfScene.clone(true);
        const found = new Set<string>();
        model.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          const match = child.name.toLowerCase().match(/^(body|flap|handles|strap|hardware|accessories)(?:$|[-_])/);
          const part = match?.[1];
          if (!part || !isABagsThreeMeshName(part)) return;
          found.add(part);
          const kind = getABagsMaterialKind(
            part === "body" || part === "accessories"
              ? "cord"
              : part === "hardware"
                ? state.config.hardware === "gold" || state.config.hardware === "silver" || state.config.hardware === "black" ? "metal" : "metal"
                : part === "strap"
                  ? "leather"
                  : part === "handles"
                    ? "wood"
                    : "leather",
          );
          applyMaterial(child, hexColor(state.config.color), kind, textures);
        });

        model.position.set(0, 0, 0);
        model.scale.setScalar(1);
        scene.add(model);
        mountedModel = model;

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z) || 1;
        const scaleFactor = 2.55 / maxSize;
        model.scale.setScalar(scaleFactor);
        box.setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.position.y = -0.25;

        renderer.domElement.dataset.abagsThreejsReady = "true";
        renderer.domElement.dataset.abagsThreejsModel = resolvedModelId;
        renderer.domElement.dataset.abagsThreejsMeshes = [...found].sort().join(",");
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

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    void boot();

    const onFrame = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(onFrame);
    };
    const frame = requestAnimationFrame(onFrame);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      if (mountedModel) {
        scene.remove(mountedModel);
        disposeObject(mountedModel);
      }
      scene.environment?.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [modelId, state.config.baseProductId, state.config.color, state.config.family, state.config.hardware]);

  return <div ref={mountRef} className={className} data-abags-threejs-stage="v1" aria-label="Podgląd 3D konfiguratora" />;
}
