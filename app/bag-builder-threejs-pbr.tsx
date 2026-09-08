"use client";

import { useEffect, useRef } from "react";
import type * as THREEType from "three";
import { getABagsThreeModelDefinition, hasRequiredABagsThreeMeshes } from "@/lib/abags-three-model-registry";

export type BagBuilderThreeJsPbrProps = Readonly<{
  family: string;
  color?: string;
  enabled?: boolean;
}>;

/**
 * Opt-in production GLB renderer. It never replaces the proven V4 renderer
 * unless the model exists and contains the complete physical mesh contract.
 */
export function BagBuilderThreeJsPbr({ family, color = "#d7c4ad", enabled = true }: BagBuilderThreeJsPbrProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !hostRef.current) return;

    let disposed = false;
    let renderer: THREEType.WebGLRenderer | null = null;
    let scene: THREEType.Scene | null = null;
    let camera: THREEType.PerspectiveCamera | null = null;
    let controls: { dispose: () => void; update: () => void } | null = null;
    let frame = 0;
    const host = hostRef.current;
    const definition = getABagsThreeModelDefinition(family);
    if (!definition) return;

    const boot = async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        const { RGBELoader } = await import("three/examples/jsm/loaders/RGBELoader.js");
        const { createABagsThreePbrMaterial } = await import("@/lib/abags-three-pbr");
        if (disposed) return;

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(host.clientWidth || 1, host.clientHeight || 1, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.domElement.dataset.abagsThreePbr = "ready";
        host.appendChild(renderer.domElement);

        scene = new THREE.Scene();
        scene.background = null;
        camera = new THREE.PerspectiveCamera(28, Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight), 0.01, 100);
        camera.position.set(0, 0.1, 3.4);
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enablePan = false;
        controls.minDistance = 2.2;
        controls.maxDistance = 5.5;
        controls.maxPolarAngle = Math.PI * 0.82;

        scene.add(new THREE.HemisphereLight(0xfff7ee, 0x6e6258, 2.0));
        const key = new THREE.DirectionalLight(0xfff4e8, 3.2);
        key.position.set(3, 4, 4);
        key.castShadow = true;
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xe5d7c7, 1.5);
        fill.position.set(-3, 1, 2);
        scene.add(fill);

        try {
          const env = await new RGBELoader().loadAsync("/3d/studio/abags-studio-1k.hdr");
          if (!disposed) {
            env.mapping = THREE.EquirectangularReflectionMapping;
            scene.environment = env;
          } else env.dispose();
        } catch {
          // Environment is an enhancement; the renderer remains functional without it.
        }

        const gltf = await new GLTFLoader().loadAsync(definition.asset.model);
        if (disposed) return;
        const names: string[] = [];
        gltf.scene.traverse((object) => { if (object.name) names.push(object.name); });
        if (!hasRequiredABagsThreeMeshes(names)) throw new Error("ABAGS_GLTF_MESH_CONTRACT_INVALID");

        const textureLoader = new THREE.TextureLoader();
        const base = await textureLoader.loadAsync(definition.asset.textures.basecolor);
        const normal = await textureLoader.loadAsync(definition.asset.textures.normal);
        const roughness = await textureLoader.loadAsync(definition.asset.textures.roughness);
        const metallic = await textureLoader.loadAsync(definition.asset.textures.metallic);
        const ao = await textureLoader.loadAsync(definition.asset.textures.ao);
        const maps = { baseColor: base, normal, roughness, metallic, ao };
        const material = createABagsThreePbrMaterial("cord", color, maps);

        gltf.scene.traverse((object) => {
          const mesh = object as THREEType.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.material = material;
          }
        });
        scene.add(gltf.scene);
        host.dataset.abagsThreeStatus = "active";

        const resize = () => {
          if (!renderer || !camera) return;
          const width = Math.max(1, host.clientWidth);
          const height = Math.max(1, host.clientHeight);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        };
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();

        const animate = () => {
          if (disposed || !renderer || !scene || !camera || !controls) return;
          controls.update();
          renderer.render(scene, camera);
          frame = requestAnimationFrame(animate);
        };
        animate();
      } catch {
        // Fail-safe: V4 remains visible. No user-facing error is rendered here.
        host.dataset.abagsThreeStatus = "fallback";
      }
    };

    void boot();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      controls?.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
      renderer = null;
      scene = null;
      camera = null;
      controls = null;
    };
  }, [color, enabled, family]);

  return <div ref={hostRef} aria-hidden="true" data-abags-three-pbr="container" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0 }} />;
}

export default BagBuilderThreeJsPbr;
