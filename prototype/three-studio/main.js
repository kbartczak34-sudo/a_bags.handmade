import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

const viewport = document.querySelector("#viewport");
const statusDot = document.querySelector("#status-dot");
const statusText = document.querySelector("#status-text");
const statusMeta = document.querySelector("#status-meta");

const THREE_VERSION = "0.185.1";
const HDRI_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/textures/equirectangular/royal_esplanade_1k.hdr`;

function setStatus(message, state = "pending", meta = "") {
  statusText.textContent = message;
  statusMeta.textContent = meta;
  statusDot.classList.toggle("ready", state === "ready");
  statusDot.classList.toggle("error", state === "error");
}

if (!viewport) {
  throw new Error("Three.js studio viewport was not found.");
}

setStatus("Tworzę fotorealistyczne studio…", "pending", "WebGL2 · ACES Filmic · Retina");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xefe7dd);

const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
camera.position.set(0, 0.35, 4.8);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0xefe7dd, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.debug.checkShaderErrors = true;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minDistance = 2.6;
controls.maxDistance = 7.2;
controls.minPolarAngle = Math.PI * 0.28;
controls.maxPolarAngle = Math.PI * 0.68;
controls.target.set(0, 0.15, 0);

const studioKey = new THREE.DirectionalLight(0xfff8ee, 1.9);
studioKey.position.set(3.6, 5.2, 4.5);
studioKey.castShadow = true;
studioKey.shadow.mapSize.set(2048, 2048);
studioKey.shadow.camera.near = 0.1;
studioKey.shadow.camera.far = 15;
studioKey.shadow.camera.left = -4;
studioKey.shadow.camera.right = 4;
studioKey.shadow.camera.top = 4;
studioKey.shadow.camera.bottom = -4;
studioKey.shadow.bias = -0.0002;
scene.add(studioKey);

const studioFill = new THREE.DirectionalLight(0xe7eef7, 0.55);
studioFill.position.set(-4.0, 2.4, 2.8);
scene.add(studioFill);

const rimLight = new THREE.DirectionalLight(0xffe6cc, 1.1);
rimLight.position.set(0.5, 4.8, -4.5);
scene.add(rimLight);

scene.add(new THREE.HemisphereLight(0xfaf3ea, 0x8c7d70, 0.32));

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({
    color: 0xd8cec3,
    roughness: 0.62,
    metalness: 0,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.28;
floor.receiveShadow = true;
scene.add(floor);

const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(1.12, 1.22, 0.32, 96),
  new THREE.MeshPhysicalMaterial({
    color: 0xe9dfd4,
    roughness: 0.58,
    metalness: 0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.44,
    envMapIntensity: 0.5,
  }),
);
pedestal.position.y = -1.08;
pedestal.receiveShadow = true;
pedestal.castShadow = true;
scene.add(pedestal);

const demoGroup = new THREE.Group();
demoGroup.position.y = 0.02;
scene.add(demoGroup);

const demoBody = new THREE.Mesh(
  new THREE.SphereGeometry(0.96, 96, 64),
  new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x8f6753),
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.32,
    sheen: 0.12,
    sheenRoughness: 0.48,
    envMapIntensity: 1.18,
  }),
);
demoBody.scale.set(1.0, 1.22, 0.72);
demoBody.castShadow = true;
demoBody.receiveShadow = true;
demoGroup.add(demoBody);

const demoTop = new THREE.Mesh(
  new THREE.TorusGeometry(0.78, 0.035, 16, 96),
  new THREE.MeshPhysicalMaterial({
    color: 0xb38a61,
    roughness: 0.2,
    metalness: 0.68,
    clearcoat: 0.34,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.35,
  }),
);
demoTop.rotation.x = Math.PI / 2;
demoTop.position.y = 0.91;
demoTop.scale.set(1, 0.72, 1);
demoTop.castShadow = true;
demoGroup.add(demoTop);

const strap = new THREE.Mesh(
  new THREE.TorusGeometry(1.05, 0.055, 18, 128, Math.PI * 1.42),
  new THREE.MeshPhysicalMaterial({
    color: 0x4d3b32,
    roughness: 0.72,
    metalness: 0,
    sheen: 0.1,
    sheenRoughness: 0.62,
    envMapIntensity: 0.72,
  }),
);
strap.rotation.x = Math.PI / 2;
strap.rotation.z = -0.36;
strap.position.set(0.06, 0.72, -0.08);
strap.scale.set(1, 0.82, 1);
strap.castShadow = true;
demoGroup.add(strap);

let environmentTexture = null;

function resize() {
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
}

async function loadStudioEnvironment() {
  const loader = new RGBELoader();
  const texture = await loader.loadAsync(HDRI_URL);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
  environmentTexture = texture;
}

function render(time) {
  controls.update();
  demoGroup.rotation.y = Math.sin(time * 0.00016) * 0.065;
  renderer.render(scene, camera);
}

window.addEventListener("resize", resize, { passive: true });

try {
  await loadStudioEnvironment();
  resize();
  renderer.setAnimationLoop(render);

  window.__ABAGS_THREE_STUDIO_STAGE1__ = {
    version: THREE_VERSION,
    renderer: "WebGLRenderer",
    toneMapping: "ACESFilmicToneMapping",
    outputColorSpace: "SRGBColorSpace",
    pixelRatioCap: 2,
    hdri: HDRI_URL,
    sceneEnvironmentReady: Boolean(environmentTexture),
  };

  setStatus("Studio gotowe", "ready", "HDRI · ACES Filmic · Retina · WebGL2");
} catch (error) {
  console.error("A-Bags Three.js Stage 1 failed to initialize", error);
  setStatus("Nie udało się załadować HDRI", "error", "Sprawdź połączenie z CDN");
}

window.addEventListener("beforeunload", () => {
  renderer.setAnimationLoop(null);
  controls.dispose();
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    }
  });
  environmentTexture?.dispose();
  renderer.dispose();
  delete window.__ABAGS_THREE_STUDIO_STAGE1__;
});
