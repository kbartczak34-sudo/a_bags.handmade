"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Stitch = "" | "classic" | "herringbone" | "basket" | "shell";
type Flap = "none" | "crochet" | "leather-black" | "leather-cognac" | "suede-burgundy";
type Handles = "none" | "wood-light" | "wood-dark" | "crochet";
type Strap = "none" | "leather" | "woven" | "chain";
type Hardware = "gold" | "silver" | "black";
type Accent = "none" | "tassel" | "scarf" | "charm";

type Config = {
  family: Family;
  color: string;
  stitch: Stitch;
  flap: Flap;
  handles: Handles;
  strap: Strap;
  hardware: Hardware;
  accent: Accent;
};

type Mesh = {
  position: WebGLBuffer;
  normal: WebGLBuffer;
  uv: WebGLBuffer;
  count: number;
};

type Renderer = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  meshes: Record<string, Mesh>;
  attribs: { position: number; normal: number; uv: number };
  uniforms: {
    projection: WebGLUniformLocation;
    view: WebGLUniformLocation;
    model: WebGLUniformLocation;
    color: WebGLUniformLocation;
    stitch: WebGLUniformLocation;
    material: WebGLUniformLocation;
    light: WebGLUniformLocation;
  };
};

type Point = [number, number];

const EMPTY: Config = {
  family: "",
  color: "",
  stitch: "",
  flap: "none",
  handles: "none",
  strap: "none",
  hardware: "gold",
  accent: "none",
};

const DEFAULT_ROTATION = { x: -0.08, y: 0.55 };
const DEFAULT_ZOOM = 0.88;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.38;

const VERTEX = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec2 vUv;
void main(){
  vec4 world=uModel*vec4(aPosition,1.0);
  vWorld=world.xyz;
  vNormal=normalize(mat3(uModel)*aNormal);
  vUv=aUv;
  gl_Position=uProjection*uView*world;
}`;

const FRAGMENT = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec2 vUv;
uniform vec3 uColor;
uniform float uStitch;
uniform float uMaterial;
uniform vec3 uLight;
float stitchPattern(vec2 uv,float mode){
  if(mode<.5){
    return .76+.14*sin((uv.x*.9+uv.y)*82.0)+.06*sin(uv.x*164.0);
  }
  if(mode<1.5){
    vec2 p=fract(uv*vec2(13.0,15.0));
    float a=1.0-smoothstep(.06,.25,abs(p.x-p.y));
    float b=1.0-smoothstep(.06,.25,abs(1.0-p.x-p.y));
    return .7+.25*max(a,b);
  }
  if(mode<2.5){
    vec2 p=fract(uv*12.0);
    float x=1.0-smoothstep(.09,.3,abs(p.x-.5));
    float y=1.0-smoothstep(.09,.3,abs(p.y-.5));
    return .7+.24*max(x,y);
  }
  return .76+.16*sin(uv.x*48.0+sin(uv.y*27.0)*3.0)+.06*sin(uv.y*54.0);
}
void main(){
  vec3 n=normalize(vNormal);
  vec3 l=normalize(uLight);
  vec3 v=normalize(vec3(0.0,.15,5.0)-vWorld);
  vec3 h=normalize(l+v);
  float diffuse=max(dot(n,l),0.0);
  float rim=pow(1.0-max(dot(n,v),0.0),2.2);
  float detail=1.0;
  float rough=.88;
  float metallic=0.0;
  if(uMaterial<.5){detail=stitchPattern(vUv,uStitch);rough=.9;}
  else if(uMaterial<1.5){detail=.88+.1*sin(vUv.y*90.0);rough=.42;}
  else if(uMaterial<2.5){detail=1.0;rough=.13;metallic=.92;}
  else{detail=.82+.13*sin(vUv.x*42.0)*sin(vUv.y*31.0);rough=.72;}
  float specular=pow(max(dot(n,h),0.0),mix(82.0,10.0,rough))*mix(.12,.92,metallic);
  vec3 base=uColor*detail;
  vec3 lit=base*(.32+.78*diffuse)+vec3(specular)+base*.09*(1.0-diffuse)+base*.09*rim;
  gl_FragColor=vec4(pow(lit,vec3(.96)),1.0);
}`;

function readConfig(stage: HTMLElement): Config {
  return {
    family: (stage.dataset.family || "") as Family,
    color: stage.dataset.color || "",
    stitch: (stage.dataset.stitch || "") as Stitch,
    flap: (stage.dataset.flap || "none") as Flap,
    handles: (stage.dataset.handles || "none") as Handles,
    strap: (stage.dataset.strap || "none") as Strap,
    hardware: (stage.dataset.hardware || "gold") as Hardware,
    accent: (stage.dataset.accent || "none") as Accent,
  };
}

function sameConfig(a: Config, b: Config) {
  return (Object.keys(a) as Array<keyof Config>).every((key) => a[key] === b[key]);
}

function configSignature(config: Config) {
  return [config.family, config.color, config.stitch, config.flap, config.handles, config.strap, config.hardware, config.accent].join("|");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalize(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function hex(value: string): [number, number, number] {
  const raw = value.replace("#", "").padEnd(6, "0").slice(0, 6);
  const parsed = Number.parseInt(raw || "eadfd7", 16);
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255];
}

function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function multiply(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

function translation(x: number, y: number, z: number) {
  const out = identity();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

function scale(x: number, y: number, z: number) {
  const out = identity();
  out[0] = x;
  out[5] = y;
  out[10] = z;
  return out;
}

function rotX(angle: number) {
  const out = identity();
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  out[5] = cosine;
  out[6] = sine;
  out[9] = -sine;
  out[10] = cosine;
  return out;
}

function rotY(angle: number) {
  const out = identity();
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  out[0] = cosine;
  out[2] = -sine;
  out[8] = sine;
  out[10] = cosine;
  return out;
}

function rotZ(angle: number) {
  const out = identity();
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  out[0] = cosine;
  out[1] = sine;
  out[4] = -sine;
  out[5] = cosine;
  return out;
}

function matrix(position: [number, number, number], size: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) {
  return multiply(
    translation(...position),
    multiply(rotZ(rotation[2]), multiply(rotY(rotation[1]), multiply(rotX(rotation[0]), scale(...size)))),
  );
}

function perspective(fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function familyContour(family: Exclude<Family, "">): Point[] {
  if (family === "tote") return [[-1.02, -.82], [1.02, -.82], [.93, .82], [-.93, .82]];
  if (family === "bucket") return [[-.78, -.9], [.78, -.9], [.96, .77], [-.96, .77]];
  if (family === "mini") return [[-.75, -.66], [.75, -.66], [.79, .5], [.58, .72], [-.58, .72], [-.79, .5]];
  return Array.from({ length: 28 }, (_, index) => {
    const angle = (index / 28) * Math.PI * 2;
    return [Math.cos(angle) * .92, Math.sin(angle) * .9] as Point;
  });
}

function extrudedPolygon(contour: Point[], depth: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const half = depth / 2;
  const push = (point: Point, z: number, normal: [number, number, number]) => {
    positions.push(point[0], point[1], z);
    normals.push(...normal);
    uvs.push(point[0] * .5 + .5, point[1] * .5 + .5);
  };

  for (let index = 1; index < contour.length - 1; index += 1) {
    push(contour[0], half, [0, 0, 1]);
    push(contour[index], half, [0, 0, 1]);
    push(contour[index + 1], half, [0, 0, 1]);
    push(contour[0], -half, [0, 0, -1]);
    push(contour[index + 1], -half, [0, 0, -1]);
    push(contour[index], -half, [0, 0, -1]);
  }

  for (let index = 0; index < contour.length; index += 1) {
    const next = (index + 1) % contour.length;
    const a = contour[index];
    const b = contour[next];
    const sideNormal = normalize(b[1] - a[1], -(b[0] - a[0]), 0);
    push(a, half, sideNormal);
    push(b, half, sideNormal);
    push(b, -half, sideNormal);
    push(a, half, sideNormal);
    push(b, -half, sideNormal);
    push(a, -half, sideNormal);
  }
  return { positions, normals, uvs };
}

function tubeArc(rx: number, ry: number, minor: number, full = false, segments = 52, tubeSegments = 8) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const point = (segment: number, ring: number) => {
    const progress = segment / segments;
    const angle = full ? progress * Math.PI * 2 : Math.PI - progress * Math.PI;
    const cx = rx * Math.cos(angle);
    const cy = ry * Math.sin(angle);
    const tangentX = -rx * Math.sin(angle);
    const tangentY = ry * Math.cos(angle);
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    const ux = tangentX / tangentLength;
    const uy = tangentY / tangentLength;
    const ringAngle = (ring / tubeSegments) * Math.PI * 2;
    const cosine = Math.cos(ringAngle);
    const sine = Math.sin(ringAngle);
    const normal = normalize(-uy * cosine, ux * cosine, sine);
    return {
      position: [cx + minor * normal[0], cy + minor * normal[1], minor * normal[2]] as [number, number, number],
      normal,
      uv: [progress, ring / tubeSegments] as [number, number],
    };
  };
  const add = (vertex: ReturnType<typeof point>) => {
    positions.push(...vertex.position);
    normals.push(...vertex.normal);
    uvs.push(...vertex.uv);
  };
  for (let segment = 0; segment < segments; segment += 1) {
    for (let ring = 0; ring < tubeSegments; ring += 1) {
      const a = point(segment, ring);
      const b = point(segment + 1, ring);
      const c = point(segment + 1, ring + 1);
      const d = point(segment, ring + 1);
      add(a); add(b); add(c); add(a); add(c); add(d);
    }
  }
  return { positions, normals, uvs };
}

function sphereMesh(rows = 12, columns = 18) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const point = (row: number, column: number) => {
    const theta = -Math.PI / 2 + (Math.PI * row) / rows;
    const phi = (Math.PI * 2 * column) / columns;
    const normal = normalize(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi));
    return { position: normal, normal, uv: [column / columns, row / rows] as [number, number] };
  };
  const add = (vertex: ReturnType<typeof point>) => {
    positions.push(...vertex.position);
    normals.push(...vertex.normal);
    uvs.push(...vertex.uv);
  };
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = point(row, column);
      const b = point(row + 1, column);
      const c = point(row + 1, column + 1);
      const d = point(row, column + 1);
      add(a); add(b); add(c); add(a); add(c); add(d);
    }
  }
  return { positions, normals, uvs };
}

function createMesh(gl: WebGLRenderingContext, data: { positions: number[]; normals: number[]; uvs: number[] }): Mesh {
  const position = gl.createBuffer();
  const normal = gl.createBuffer();
  const uv = gl.createBuffer();
  if (!position || !normal || !uv) throw new Error("Nie udało się utworzyć buforów WebGL.");
  gl.bindBuffer(gl.ARRAY_BUFFER, position);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, normal);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, uv);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.uvs), gl.STATIC_DRAW);
  return { position, normal, uv, count: data.positions.length / 3 };
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Nie udało się utworzyć shadera WebGL.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Błąd kompilacji shadera.");
  return shader;
}

function init(canvas: HTMLCanvasElement): Renderer {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer:true, powerPreference: "high-performance" });
  if (!gl) throw new Error("WebGL nie jest dostępny na tym urządzeniu.");
  const program = gl.createProgram();
  if (!program) throw new Error("Nie udało się utworzyć programu WebGL.");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Błąd linkowania WebGL.");
  gl.useProgram(program);
  const attribute = (name: string) => {
    const location = gl.getAttribLocation(program, name);
    if (location < 0) throw new Error(`Brak atrybutu ${name}.`);
    return location;
  };
  const uniform = (name: string) => {
    const location = gl.getUniformLocation(program, name);
    if (location === null) throw new Error(`Brak uniformu ${name}.`);
    return location;
  };
  return {
    gl,
    program,
    attribs: { position: attribute("aPosition"), normal: attribute("aNormal"), uv: attribute("aUv") },
    uniforms: {
      projection: uniform("uProjection"),
      view: uniform("uView"),
      model: uniform("uModel"),
      color: uniform("uColor"),
      stitch: uniform("uStitch"),
      material: uniform("uMaterial"),
      light: uniform("uLight"),
    },
    meshes: {
      tote: createMesh(gl, extrudedPolygon(familyContour("tote"), .58)),
      round: createMesh(gl, extrudedPolygon(familyContour("round"), .62)),
      bucket: createMesh(gl, extrudedPolygon(familyContour("bucket"), .64)),
      mini: createMesh(gl, extrudedPolygon(familyContour("mini"), .5)),
      flap: createMesh(gl, extrudedPolygon([[-.78, -.4], [.78, -.4], [.72, .4], [-.72, .4]], .09)),
      handle: createMesh(gl, tubeArc(.72, .72, .07)),
      strap: createMesh(gl, tubeArc(1.18, 1.55, .045)),
      ring: createMesh(gl, tubeArc(.14, .14, .027, true, 38, 8)),
      sphere: createMesh(gl, sphereMesh()),
    },
  };
}

function drawMesh(renderer: Renderer, mesh: Mesh, model: Float32Array, color: string, stitch: number, material: number) {
  const { gl, attribs, uniforms } = renderer;
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position);
  gl.enableVertexAttribArray(attribs.position);
  gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal);
  gl.enableVertexAttribArray(attribs.normal);
  gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv);
  gl.enableVertexAttribArray(attribs.uv);
  gl.vertexAttribPointer(attribs.uv, 2, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix4fv(uniforms.model, false, model);
  gl.uniform3fv(uniforms.color, new Float32Array(hex(color)));
  gl.uniform1f(uniforms.stitch, stitch);
  gl.uniform1f(uniforms.material, material);
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
}

function stitchId(stitch: Stitch) {
  return stitch === "herringbone" ? 1 : stitch === "basket" ? 2 : stitch === "shell" ? 3 : 0;
}

function draw(renderer: Renderer, canvas: HTMLCanvasElement, config: Config, rotation: { x: number; y: number }, zoom: number) {
  const { gl, uniforms, meshes } = renderer;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(2, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(2, Math.floor(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);
  gl.useProgram(renderer.program);
  gl.uniformMatrix4fv(uniforms.projection, false, perspective(Math.PI / 5, width / height, .1, 100));
  gl.uniformMatrix4fv(uniforms.view, false, translation(0, -.02, -5));
  gl.uniform3fv(uniforms.light, new Float32Array([-.48, .9, 1.1]));
  if (!config.family) {
    gl.finish();
    return;
  }

  const root = multiply(rotY(rotation.y), multiply(rotX(rotation.x), scale(zoom, zoom, zoom)));
  const bodyColor = config.color || "#eadfd7";
  const stitch = stitchId(config.stitch);
  const depth = config.family === "mini" ? .5 : config.family === "round" ? .62 : config.family === "bucket" ? .64 : .58;
  const topY = config.family === "bucket" ? .88 : config.family === "mini" ? .74 : config.family === "round" ? .78 : .9;
  const hardware = config.hardware === "silver" ? "#d5d9dd" : config.hardware === "black" ? "#2a292b" : "#c9a354";

  if (config.strap !== "none") {
    const strapColor = config.strap === "chain" ? hardware : config.strap === "leather" ? "#76503d" : "#9a7580";
    drawMesh(renderer, meshes.strap, multiply(root, matrix([0, .18, -.34], [.94, .98, 1])), strapColor, stitch, config.strap === "chain" ? 2 : config.strap === "leather" ? 1 : 3);
  }

  drawMesh(renderer, meshes[config.family], root, bodyColor, stitch, 0);

  if (config.handles !== "none") {
    const handleColor = config.handles === "wood-dark" ? "#60402f" : config.handles === "wood-light" ? "#d7b985" : bodyColor;
    const handleMaterial = config.handles === "crochet" ? 0 : 1;
    drawMesh(renderer, meshes.handle, multiply(root, matrix([0, topY - .06, .04], [config.family === "mini" ? .72 : .9, config.family === "mini" ? .7 : .88, 1])), handleColor, stitch, handleMaterial);
  }

  if (config.flap !== "none") {
    const flapColor = config.flap === "leather-black" ? "#292426" : config.flap === "leather-cognac" ? "#9a6345" : config.flap === "suede-burgundy" ? "#773c4b" : bodyColor;
    const flapMaterial = config.flap === "crochet" ? 0 : 1;
    drawMesh(renderer, meshes.flap, multiply(root, matrix([0, .31, depth / 2 + .075], [config.family === "mini" ? .72 : .88, config.family === "round" ? .7 : .88, 1], [.05, 0, 0])), flapColor, stitch, flapMaterial);
    drawMesh(renderer, meshes.sphere, multiply(root, matrix([0, .08, depth / 2 + .19], [.085, .085, .055])), hardware, 0, 2);
  }

  if (config.handles !== "none" || config.strap !== "none") {
    const side = config.family === "mini" ? .69 : config.family === "bucket" ? .82 : .9;
    drawMesh(renderer, meshes.ring, multiply(root, matrix([-side, .48, depth / 2 + .02], [.72, .72, .72], [0, Math.PI / 2, 0])), hardware, 0, 2);
    drawMesh(renderer, meshes.ring, multiply(root, matrix([side, .48, depth / 2 + .02], [.72, .72, .72], [0, Math.PI / 2, 0])), hardware, 0, 2);
  }

  if (config.accent === "charm") {
    drawMesh(renderer, meshes.sphere, multiply(root, matrix([.78, .08, depth / 2 + .22], [.12, .12, .07])), "#b86f82", 0, 2);
  } else if (config.accent === "tassel") {
    drawMesh(renderer, meshes.sphere, multiply(root, matrix([.82, .28, depth / 2 + .18], [.08, .08, .06])), hardware, 0, 2);
    drawMesh(renderer, meshes.strap, multiply(root, matrix([.78, -.52, depth / 2 + .2], [.16, .3, .4], [0, 0, -.12])), bodyColor, stitch, 0);
  } else if (config.accent === "scarf") {
    drawMesh(renderer, meshes.flap, multiply(root, matrix([-.66, .4, depth / 2 + .22], [.25, .42, .18], [0, 0, .45])), "#efb7c5", 0, 3);
    drawMesh(renderer, meshes.flap, multiply(root, matrix([-.48, .24, depth / 2 + .23], [.2, .34, .16], [0, 0, -.38])), "#c66f89", 0, 3);
  }

  gl.finish();
}

function currentStage() {
  return document.querySelector<HTMLElement>(".abags-bag-builder-stage");
}

export default function BagBuilderFinalWebGL3D() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [config, setConfig] = useState<Config>(EMPTY);
  const [rotation, setRotation] = useState(DEFAULT_ROTATION);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [view, setViewState] = useState<"front" | "three" | "side">("three");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    const find = () => {
      const next = currentStage();
      setPortalTarget((current) => current === next ? current : next);
    };
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!portalTarget) return;
    const sync = () => setConfig((current) => {
      const next = readConfig(portalTarget);
      return sameConfig(current, next) ? current : next;
    });
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(portalTarget, {
      attributes: true,
      attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"],
    });
    return () => observer.disconnect();
  }, [portalTarget]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const target = currentStage();
    if (!portalTarget || !canvas || !target || rendererRef.current) return;
    try {
      rendererRef.current = init(canvas);
      target.classList.add("abags-pro3d-active", "abags-fidelity3d-active");
      target.dataset.abagsPro3dReady = "true";
      target.dataset.abagsFidelity3dReady="variable-depth-v2";
      target.removeAttribute("data-abags-fidelity3d-error");
    } catch (error) {
      rendererRef.current = null;
      target.dataset.abagsFidelity3dError = error instanceof Error ? error.message.slice(0, 160) : "init-failed";
      target.removeAttribute("data-abags-fidelity3d-ready");
    }
    return () => {
      rendererRef.current = null;
      target.classList.remove("abags-pro3d-active", "abags-fidelity3d-active");
      target.removeAttribute("data-abags-pro3d-ready");
      target.removeAttribute("data-abags-fidelity3d-ready");
      target.removeAttribute("data-abags-fidelity3d-frame");
      target.removeAttribute("data-abags-fidelity3d-frame-at");
      target.removeAttribute("data-abags-fidelity3d-error");
    };
  }, [portalTarget]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    const target = currentStage();
    if (!renderer || !canvas || !target || !portalTarget) return;
    const paint = () => {
      try {
        draw(renderer, canvas, config, rotation, zoom);
        if (config.family) {
          target.dataset.abagsFidelity3dFrame=configSignature(config);
          target.dataset.abagsFidelity3dFrameAt = String(Date.now());
        } else {
          target.removeAttribute("data-abags-fidelity3d-frame");
          target.removeAttribute("data-abags-fidelity3d-frame-at");
        }
        target.removeAttribute("data-abags-fidelity3d-error");
      } catch (error) {
        target.dataset.abagsFidelity3dError = error instanceof Error ? error.message.slice(0, 160) : "draw-failed";
        target.removeAttribute("data-abags-fidelity3d-frame");
      }
    };
    let frame = requestAnimationFrame(paint);
    const redraw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    };
    window.addEventListener("resize", redraw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", redraw);
    };
  }, [config, rotation, zoom, portalTarget]);

  const pointerDistance = () => {
    const points = Array.from(pointers.current.values());
    return points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const setView = (next: "front" | "three" | "side") => {
    setViewState(next);
    setRotation(next === "front" ? { x: -.02, y: 0 } : next === "side" ? { x: -.04, y: Math.PI / 2 } : DEFAULT_ROTATION);
  };

  const label = config.family ? "Interaktywny model 3D A-Bags" : "Wybierz fason, aby rozpocząć model 3D";

  if (!portalTarget) return null;

  return createPortal(
    <div className="abags-pro3d-layer abags-fidelity3d-layer" data-abags-pro3d data-abags-fidelity3d data-abags-final-webgl="v2">
      <canvas
        ref={canvasRef}
        className="abags-pro3d-canvas abags-fidelity3d-canvas"
        aria-label={label}
        onPointerDown={(event) => {
          event.preventDefault();
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          event.currentTarget.setPointerCapture?.(event.pointerId);
          if (pointers.current.size >= 2) {
            pinch.current = { distance: pointerDistance(), zoom };
            drag.current = null;
          } else {
            drag.current = { x: event.clientX, y: event.clientY, rx: rotation.x, ry: rotation.y };
          }
        }}
        onPointerMove={(event) => {
          if (!pointers.current.has(event.pointerId)) return;
          event.preventDefault();
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (pointers.current.size >= 2 && pinch.current) {
            const nextDistance = pointerDistance();
            if (pinch.current.distance > 0) setZoom(clamp(pinch.current.zoom * (nextDistance / pinch.current.distance), MIN_ZOOM, MAX_ZOOM));
            return;
          }
          if (!drag.current) return;
          setViewState("three");
          setRotation({
            x: clamp(drag.current.rx + (event.clientY - drag.current.y) * .008, -.68, .52),
            y: drag.current.ry + (event.clientX - drag.current.x) * .012,
          });
        }}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
          if (pointers.current.size < 2) pinch.current = null;
          if (!pointers.current.size) drag.current = null;
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          pinch.current = null;
          drag.current = null;
        }}
        onWheel={(event) => {
          event.preventDefault();
          setZoom((value) => clamp(value - event.deltaY * .0008, MIN_ZOOM, MAX_ZOOM));
        }}
      />
      <div className="abags-pro3d-chip">A-BAGS REALTIME 3D</div>
      <div className="abags-pro3d-view-controls" aria-label="Widok modelu 3D">
        <button type="button" aria-pressed={view === "front"} onClick={() => setView("front")}>Przód</button>
        <button type="button" aria-pressed={view === "three"} onClick={() => setView("three")}>3/4</button>
        <button type="button" aria-pressed={view === "side"} onClick={() => setView("side")}>Bok</button>
      </div>
      <div className="abags-pro3d-zoom" aria-label="Powiększenie modelu 3D">
        <button type="button" aria-label="Pomniejsz" onClick={() => setZoom((value) => clamp(value - .08, MIN_ZOOM, MAX_ZOOM))}>−</button>
        <input aria-label="Powiększenie" type="range" min={MIN_ZOOM} max={MAX_ZOOM} step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
        <button type="button" aria-label="Powiększ" onClick={() => setZoom((value) => clamp(value + .08, MIN_ZOOM, MAX_ZOOM))}>+</button>
        <button type="button" onClick={() => { setZoom(DEFAULT_ZOOM); setView("three"); }}>Reset</button>
      </div>
      <p className="abags-pro3d-hint">Przeciągnij, aby obrócić · uszczypnij, aby przybliżyć</p>
    </div>,
    portalTarget,
  );
}
