import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

export const PBR_MAPS = ["basecolor", "normal", "roughness", "metallic", "ao"];

export class ABagsPbrTextureEngine {
  constructor(renderer) {
    this.renderer = renderer;
    this.loader = new THREE.TextureLoader();
    this.hdrLoader = new RGBELoader();
    this.cache = new Map();
  }

  async loadMap(url, colorSpace = THREE.NoColorSpace) {
    if (this.cache.has(url)) return this.cache.get(url);
    const texture = await this.loader.loadAsync(url);
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.cache.set(url, texture);
    return texture;
  }

  async loadSet(paths) {
    const [baseColor, normal, roughness, metallic, ao] = await Promise.all([
      this.loadMap(paths.basecolor, THREE.SRGBColorSpace),
      this.loadMap(paths.normal),
      this.loadMap(paths.roughness),
      this.loadMap(paths.metallic),
      this.loadMap(paths.ao),
    ]);
    return { baseColor, normal, roughness, metallic, ao };
  }

  createMaterial({ maps, profile, color = 0xffffff }) {
    const material = new THREE.MeshPhysicalMaterial({
      color,
      map: maps?.baseColor ?? null,
      normalMap: maps?.normal ?? null,
      roughnessMap: maps?.roughness ?? null,
      metalnessMap: maps?.metallic ?? null,
      aoMap: maps?.ao ?? null,
      metalness: profile?.metalness ?? 0,
      roughness: profile?.roughness ?? 0.8,
      clearcoat: profile?.clearcoat ?? 0,
      clearcoatRoughness: profile?.clearcoatRoughness ?? 0.5,
      sheen: profile?.sheen ?? 0,
      sheenRoughness: profile?.sheenRoughness ?? 0.5,
      envMapIntensity: profile?.environmentIntensity ?? 1,
    });
    if (maps?.normal) {
      material.normalScale.setScalar(profile?.normalScale ?? 1);
    }
    return material;
  }

  async loadStudioEnvironment(url) {
    const environment = await this.hdrLoader.loadAsync(url);
    environment.mapping = THREE.EquirectangularReflectionMapping;
    return environment;
  }

  dispose() {
    for (const texture of this.cache.values()) texture.dispose();
    this.cache.clear();
  }
}
