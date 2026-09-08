import * as THREE from "three";
import { getABagsPbrProfile, type ABagsMaterialKind } from "./abags-photoreal-materials";

export type ABagsThreePbrMaps = Readonly<{
  baseColor?: THREE.Texture | null;
  normal?: THREE.Texture | null;
  roughness?: THREE.Texture | null;
  metallic?: THREE.Texture | null;
  ao?: THREE.Texture | null;
  clearcoat?: THREE.Texture | null;
  clearcoatRoughness?: THREE.Texture | null;
  sheen?: THREE.Texture | null;
  height?: THREE.Texture | null;
}>;

export type ABagsThreeTextureUrls = Readonly<{
  basecolor: string;
  normal: string;
  roughness: string;
  metallic: string;
  ao: string;
}>;

function configureColorTexture(texture: THREE.Texture | null | undefined) {
  if (!texture) return;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
}

function configureDataTexture(texture: THREE.Texture | null | undefined) {
  if (!texture) return;
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
}

export async function loadABagsThreePbrMaps(urls: ABagsThreeTextureUrls): Promise<ABagsThreePbrMaps> {
  const loader = new THREE.TextureLoader();
  const load = (url: string) => loader.loadAsync(url);
  const [baseColor, normal, roughness, metallic, ao] = await Promise.all([
    load(urls.basecolor), load(urls.normal), load(urls.roughness), load(urls.metallic), load(urls.ao),
  ]);
  configureColorTexture(baseColor);
  [normal, roughness, metallic, ao].forEach(configureDataTexture);
  const maxAnisotropy = Math.min(8, 16);
  [baseColor, normal, roughness, metallic, ao].forEach((texture) => { texture.anisotropy = maxAnisotropy; texture.needsUpdate = true; });
  return { baseColor, normal, roughness, metallic, ao };
}

export function createABagsThreePbrMaterial(
  kind: ABagsMaterialKind,
  color: THREE.ColorRepresentation,
  maps: ABagsThreePbrMaps = {},
): THREE.MeshPhysicalMaterial {
  const profile = getABagsPbrProfile(kind);
  configureColorTexture(maps.baseColor);
  for (const texture of [maps.normal, maps.roughness, maps.metallic, maps.ao, maps.clearcoat, maps.clearcoatRoughness, maps.sheen, maps.height]) configureDataTexture(texture);
  const material = new THREE.MeshPhysicalMaterial({
    color,
    metalness: profile.metalness,
    roughness: profile.roughness,
    specularIntensity: profile.specular,
    clearcoat: profile.clearcoat,
    clearcoatRoughness: profile.clearcoatRoughness,
    sheen: profile.sheen,
    sheenRoughness: profile.sheenRoughness,
    map: maps.baseColor ?? null,
    normalMap: maps.normal ?? null,
    roughnessMap: maps.roughness ?? null,
    metalnessMap: maps.metallic ?? null,
    aoMap: maps.ao ?? null,
    clearcoatMap: maps.clearcoat ?? null,
    clearcoatRoughnessMap: maps.clearcoatRoughness ?? null,
    sheenColorMap: maps.sheen ?? null,
    displacementMap: maps.height ?? null,
    displacementScale: maps.height ? profile.microDetail * 0.012 : 0,
    envMapIntensity: profile.environmentIntensity,
  });
  if (maps.normal) material.normalScale.set(profile.normalScale, profile.normalScale);
  if (maps.ao) material.aoMapIntensity = Math.min(1.5, 0.65 + profile.microDetail * 0.35);
  return material;
}

export function disposeABagsPbrMaterial(material: THREE.Material) {
  const physical = material as THREE.MeshPhysicalMaterial;
  for (const value of Object.values(physical)) if (value instanceof THREE.Texture) value.dispose();
  material.dispose();
}
