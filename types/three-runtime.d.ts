declare module "three" {
  export type ColorRepresentation = string | number;
  export const SRGBColorSpace: string;
  export const NoColorSpace: string;
  export const RepeatWrapping: number;
  export class Texture { colorSpace: string; wrapS: number; wrapT: number; anisotropy: number; needsUpdate: boolean; dispose(): void; }
  export class Material { dispose(): void; }
  export class MeshPhysicalMaterial extends Material {
    color: { set(value: ColorRepresentation): void };
    normalScale: { set(x: number, y: number): void };
    aoMapIntensity: number;
    map: Texture | null;
  }
  export class Object3D {
    name: string;
    rotation: { y: number };
    traverse(callback: (object: Object3D) => void): void;
  }
  export class Mesh extends Object3D {
    isMesh: boolean;
    geometry: { dispose(): void };
    material: Material | Material[];
    castShadow: boolean;
    receiveShadow: boolean;
  }
  export class WebGLRenderer {
    constructor(options?: Record<string, unknown>);
    outputColorSpace: string;
    toneMapping: number;
    toneMappingExposure: number;
    shadowMap: { enabled: boolean };
    setPixelRatio(value: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    render(scene: Scene, camera: PerspectiveCamera): void;
    dispose(): void;
  }
  export class Scene extends Object3D { environment: Texture | null; clear(): void; add(...objects: Object3D[]): void; remove(...objects: Object3D[]): void; }
  export class PerspectiveCamera extends Object3D { aspect: number; constructor(fov: number, aspect: number, near: number, far: number); position: { set(x: number, y: number, z: number): void }; updateProjectionMatrix(): void; }
  export class DirectionalLight extends Object3D { constructor(color: ColorRepresentation, intensity?: number); position: { set(x: number, y: number, z: number): void }; castShadow: boolean; }
  export class HemisphereLight extends Object3D { constructor(skyColor: ColorRepresentation, groundColor: ColorRepresentation, intensity?: number); }
  export class PMREMGenerator { constructor(renderer: WebGLRenderer); fromScene(scene: Object3D, sigma?: number): { texture: Texture }; dispose(): void; }
  export class TextureLoader { loadAsync(url: string): Promise<Texture>; }
  export const ACESFilmicToneMapping: number;
}

declare module "three/addons/loaders/GLTFLoader.js" {
  import type { Object3D } from "three";
  export class GLTFLoader { loadAsync(url: string): Promise<{ scene: Object3D }>; }
}

declare module "three/addons/controls/OrbitControls.js" {
  import type { PerspectiveCamera } from "three";
  export class OrbitControls {
    constructor(camera: PerspectiveCamera, domElement: HTMLCanvasElement);
    enableDamping: boolean;
    dampingFactor: number;
    enablePan: boolean;
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    target: { set(x: number, y: number, z: number): void };
    update(): void;
    dispose(): void;
  }
}

declare module "three/addons/environments/RoomEnvironment.js" {
  import type { WebGLRenderer, Object3D } from "three";
  export class RoomEnvironment extends Object3D { constructor(renderer: WebGLRenderer); dispose(): void; }
}
