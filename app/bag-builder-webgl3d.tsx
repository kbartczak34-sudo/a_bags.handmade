"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type BuilderConfig = {
  family: "" | "tote" | "round" | "bucket" | "mini";
  color: string;
  stitch: "" | "classic" | "herringbone" | "basket" | "shell";
  flap: "none" | "crochet" | "leather-black" | "leather-cognac" | "suede-burgundy";
  handles: "none" | "wood-light" | "wood-dark" | "crochet";
  strap: "none" | "leather" | "woven" | "chain";
  hardware: "gold" | "silver" | "black";
  accent: "none" | "tassel" | "scarf" | "charm";
};

type Mesh = {
  position: WebGLBuffer;
  normal: WebGLBuffer;
  uv: WebGLBuffer;
  index: WebGLBuffer;
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
    pattern: WebGLUniformLocation;
    metalness: WebGLUniformLocation;
    light: WebGLUniformLocation;
  };
};

const EMPTY: BuilderConfig = {
  family: "",
  color: "",
  stitch: "",
  flap: "none",
  handles: "none",
  strap: "none",
  hardware: "gold",
  accent: "none",
};

function readConfig(stage: HTMLElement): BuilderConfig {
  return {
    family: (stage.dataset.family ?? "") as BuilderConfig["family"],
    color: stage.dataset.color ?? "",
    stitch: (stage.dataset.stitch ?? "") as BuilderConfig["stitch"],
    flap: (stage.dataset.flap ?? "none") as BuilderConfig["flap"],
    handles: (stage.dataset.handles ?? "none") as BuilderConfig["handles"],
    strap: (stage.dataset.strap ?? "none") as BuilderConfig["strap"],
    hardware: (stage.dataset.hardware ?? "gold") as BuilderConfig["hardware"],
    accent: (stage.dataset.accent ?? "none") as BuilderConfig["accent"],
  };
}

function sameConfig(a: BuilderConfig, b: BuilderConfig) {
  return a.family === b.family && a.color === b.color && a.stitch === b.stitch && a.flap === b.flap && a.handles === b.handles && a.strap === b.strap && a.hardware === b.hardware && a.accent === b.accent;
}

function hexToRgb(value: string): [number, number, number] {
  const raw = value.replace("#", "");
  const hex = raw.length === 3 ? raw.split("").map((part) => part + part).join("") : raw.padEnd(6, "0").slice(0, 6);
  const number = Number.parseInt(hex || "e8ddcc", 16);
  return [((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255];
}

function signedPow(value: number, power: number) {
  return Math.sign(value) * Math.pow(Math.abs(value), power);
}

function normalize(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function makeSuperellipsoid(a: number, b: number, c: number, e1: number, e2: number, rows = 30, columns = 44) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const theta = -Math.PI / 2 + Math.PI * row / rows;
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    for (let column = 0; column <= columns; column += 1) {
      const phi = -Math.PI + Math.PI * 2 * column / columns;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      const x = a * signedPow(ct, e1) * signedPow(cp, e2);
      const y = b * signedPow(st, e1);
      const z = c * signedPow(ct, e1) * signedPow(sp, e2);
      positions.push(x, y, z);
      const [nx, ny, nz] = normalize(x / (a * a), y / (b * b), z / (c * c));
      normals.push(nx, ny, nz);
      uvs.push(column / columns, 1 - row / rows);
    }
  }
  const stride = columns + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a0 = row * stride + column;
      const b0 = a0 + stride;
      indices.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
    }
  }
  return { positions, normals, uvs, indices };
}

function makeTorus(major: number, minor: number, majorSegments = 64, minorSegments = 12) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= majorSegments; i += 1) {
    const u = i / majorSegments * Math.PI * 2;
    for (let j = 0; j <= minorSegments; j += 1) {
      const v = j / minorSegments * Math.PI * 2;
      const cosV = Math.cos(v);
      const x = (major + minor * cosV) * Math.cos(u);
      const y = (major + minor * cosV) * Math.sin(u);
      const z = minor * Math.sin(v);
      positions.push(x, y, z);
      normals.push(Math.cos(u) * cosV, Math.sin(u) * cosV, Math.sin(v));
      uvs.push(i / majorSegments, j / minorSegments);
    }
  }
  const stride = minorSegments + 1;
  for (let i = 0; i < majorSegments; i += 1) {
    for (let j = 0; j < minorSegments; j += 1) {
      const a0 = i * stride + j;
      const b0 = (i + 1) * stride + j;
      indices.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
    }
  }
  return { positions, normals, uvs, indices };
}

function makeCone(radius = .17, height = .68, segments = 30) {
  const positions: number[] = [0, height / 2, 0, 0, -height / 2, 0];
  const normals: number[] = [0, 1, 0, 0, -1, 0];
  const uvs: number[] = [.5, 1, .5, 0];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = i / segments * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    positions.push(x, -height / 2, z);
    const [nx, ny, nz] = normalize(x, radius / height, z);
    normals.push(nx, ny, nz);
    uvs.push(i / segments, 0);
    if (i < segments) indices.push(0, 2 + i, 2 + i + 1);
  }
  return { positions, normals, uvs, indices };
}

function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function multiply(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

function translation(x: number, y: number, z: number) {
  const out = identity();
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

function scale(x: number, y: number, z: number) {
  const out = identity();
  out[0] = x; out[5] = y; out[10] = z;
  return out;
}

function rotationX(angle: number) {
  const out = identity();
  const c = Math.cos(angle); const s = Math.sin(angle);
  out[5] = c; out[6] = s; out[9] = -s; out[10] = c;
  return out;
}

function rotationY(angle: number) {
  const out = identity();
  const c = Math.cos(angle); const s = Math.sin(angle);
  out[0] = c; out[2] = -s; out[8] = s; out[10] = c;
  return out;
}

function rotationZ(angle: number) {
  const out = identity();
  const c = Math.cos(angle); const s = Math.sin(angle);
  out[0] = c; out[1] = s; out[4] = -s; out[5] = c;
  return out;
}

function perspective(fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) / (near - far); out[11] = -1; out[14] = (2 * far * near) / (near - far);
  return out;
}

function localMatrix(position: [number, number, number], size: [number, number, number], rot: [number, number, number] = [0, 0, 0]) {
  return multiply(translation(...position), multiply(rotationZ(rot[2]), multiply(rotationY(rot[1]), multiply(rotationX(rot[0]), scale(...size)))));
}

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
uniform float uPattern;
uniform float uMetalness;
uniform vec3 uLight;
float yarnPattern(vec2 uv,float mode){
  if(mode>8.0) return .52;
  float a=0.0;
  if(mode<.5){
    float line=sin((uv.x*1.12+uv.y*.72)*115.0);
    float twist=sin((uv.x*.55-uv.y)*58.0);
    a=.52+.23*line+.12*twist;
  }else if(mode<1.5){
    vec2 p=fract(uv*vec2(19.0,18.0));
    float left=abs(p.x-p.y);
    float right=abs((1.0-p.x)-p.y);
    a=.42+.46*(1.0-smoothstep(.08,.24,min(left,right)));
  }else if(mode<2.5){
    vec2 p=fract(uv*vec2(18.0,18.0));
    float gx=1.0-smoothstep(.16,.34,abs(p.x-.5));
    float gy=1.0-smoothstep(.16,.34,abs(p.y-.5));
    a=.4+.36*max(gx,gy);
  }else{
    float wave=sin(uv.x*70.0+sin(uv.y*34.0)*2.8);
    float rows=sin(uv.y*46.0);
    a=.5+.26*wave+.12*rows;
  }
  return clamp(a,0.08,1.0);
}
void main(){
  vec3 n=normalize(vNormal);
  vec3 l=normalize(uLight);
  float diffuse=max(dot(n,l),0.0);
  float rim=pow(1.0-max(dot(n,vec3(0.0,0.0,1.0)),0.0),2.2);
  float yarn=yarnPattern(vUv,uPattern);
  vec3 base=uColor*(.76+.34*yarn);
  float spec=pow(max(dot(reflect(-l,n),normalize(vec3(0.0,0.0,4.6)-vWorld)),0.0),mix(18.0,70.0,uMetalness));
  vec3 color=base*(.48+.62*diffuse)+vec3(.09)*rim;
  color+=vec3(spec)*mix(.08,.68,uMetalness);
  gl_FragColor=vec4(color,1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile");
  return shader;
}

function createMesh(gl: WebGLRenderingContext, data: { positions: number[]; normals: number[]; uvs: number[]; indices: number[] }): Mesh {
  const position = gl.createBuffer(); const normal = gl.createBuffer(); const uv = gl.createBuffer(); const index = gl.createBuffer();
  if (!position || !normal || !uv || !index) throw new Error("buffer");
  gl.bindBuffer(gl.ARRAY_BUFFER, position); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, normal); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, uv); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.uvs), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);
  return { position, normal, uv, index, count: data.indices.length };
}

function initRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false });
  if (!gl) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
  gl.useProgram(program);
  const required = (name: string) => {
    const location = gl.getUniformLocation(program, name);
    if (!location) throw new Error(`uniform ${name}`);
    return location;
  };
  return {
    gl,
    program,
    meshes: {
      tote: createMesh(gl, makeSuperellipsoid(1.16, 1.12, .36, .3, .28)),
      round: createMesh(gl, makeSuperellipsoid(1.17, .98, .38, .58, .54)),
      bucket: createMesh(gl, makeSuperellipsoid(1.02, 1.22, .37, .34, .3)),
      mini: createMesh(gl, makeSuperellipsoid(.9, .95, .31, .34, .31)),
      flap: createMesh(gl, makeSuperellipsoid(1, .52, .1, .35, .3, 22, 36)),
      sphere: createMesh(gl, makeSuperellipsoid(1, 1, 1, 1, 1, 18, 28)),
      torus: createMesh(gl, makeTorus(.78, .065)),
      thinTorus: createMesh(gl, makeTorus(.9, .035)),
      cone: createMesh(gl, makeCone()),
      ribbon: createMesh(gl, makeSuperellipsoid(.48, .12, .035, .35, .32, 16, 28)),
    },
    attribs: {
      position: gl.getAttribLocation(program, "aPosition"),
      normal: gl.getAttribLocation(program, "aNormal"),
      uv: gl.getAttribLocation(program, "aUv"),
    },
    uniforms: {
      projection: required("uProjection"), view: required("uView"), model: required("uModel"), color: required("uColor"), pattern: required("uPattern"), metalness: required("uMetalness"), light: required("uLight"),
    },
  };
}

function drawMesh(renderer: Renderer, mesh: Mesh, model: Float32Array, color: string, pattern: number, metalness = 0) {
  const { gl, attribs, uniforms } = renderer;
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position); gl.enableVertexAttribArray(attribs.position); gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal); gl.enableVertexAttribArray(attribs.normal); gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uv); gl.enableVertexAttribArray(attribs.uv); gl.vertexAttribPointer(attribs.uv, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
  gl.uniformMatrix4fv(uniforms.model, false, model);
  gl.uniform3fv(uniforms.color, hexToRgb(color));
  gl.uniform1f(uniforms.pattern, pattern);
  gl.uniform1f(uniforms.metalness, metalness);
  gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
}

function patternFor(stitch: BuilderConfig["stitch"]) {
  if (stitch === "herringbone") return 1;
  if (stitch === "basket") return 2;
  if (stitch === "shell") return 3;
  return 0;
}

function familyScale(family: BuilderConfig["family"]): [number, number, number] {
  if (family === "round") return [1.04, 1, 1];
  if (family === "bucket") return [1, 1, 1];
  if (family === "mini") return [1, 1, 1];
  return [1, 1, 1];
}

function draw(renderer: Renderer, canvas: HTMLCanvasElement, config: BuilderConfig, rotation: { x: number; y: number }, zoom: number) {
  const { gl, program, uniforms, meshes } = renderer;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.useProgram(program);
  gl.uniformMatrix4fv(uniforms.projection, false, perspective(Math.PI / 4.7, width / height, .1, 100));
  gl.uniformMatrix4fv(uniforms.view, false, translation(0, 0, -5.25));
  gl.uniform3fv(uniforms.light, new Float32Array([.45, .72, .8]));

  if (!config.family) return;
  const root = multiply(scale(zoom, zoom, zoom), multiply(rotationX(rotation.x), rotationY(rotation.y)));
  const bodyColor = config.color || "#eee5df";
  const stitchPattern = config.color ? patternFor(config.stitch) : 9;
  const bodyLocal = localMatrix([0, -.12, 0], familyScale(config.family));

  if (config.strap !== "none") {
    const strapColor = config.strap === "chain" ? (config.hardware === "silver" ? "#cdd2d8" : config.hardware === "black" ? "#242225" : "#c9a45b") : config.strap === "woven" ? "#9b7080" : "#6a493c";
    const strapMesh = config.strap === "chain" ? meshes.thinTorus : meshes.torus;
    const strap = localMatrix([0, .74, -.19], [1.28, 1.72, config.strap === "chain" ? .8 : .48]);
    drawMesh(renderer, strapMesh, multiply(root, strap), strapColor, config.strap === "woven" ? 2 : 9, config.strap === "chain" ? .9 : .12);
  }

  if (config.handles !== "none") {
    const handleColor = config.handles === "wood-light" ? "#c99a62" : config.handles === "wood-dark" ? "#5c2d1d" : bodyColor;
    const handle = localMatrix([0, .86, .06], [.76, .72, .9]);
    drawMesh(renderer, meshes.torus, multiply(root, handle), handleColor, config.handles === "crochet" ? stitchPattern : 9, config.handles.startsWith("wood") ? .18 : 0);
  }

  drawMesh(renderer, meshes[config.family], multiply(root, bodyLocal), bodyColor, stitchPattern, 0);

  if (config.flap !== "none") {
    const flapColor = config.flap === "leather-black" ? "#242124" : config.flap === "leather-cognac" ? "#7b4f34" : config.flap === "suede-burgundy" ? "#7f3043" : bodyColor;
    const y = config.family === "round" ? .42 : .48;
    const z = config.family === "round" ? .38 : .36;
    const flapScale: [number, number, number] = config.family === "mini" ? [.84, .72, .74] : config.family === "round" ? [1.02, .8, .72] : [1.02, .78, .72];
    const flap = localMatrix([0, y, z], flapScale, [.08, 0, 0]);
    drawMesh(renderer, meshes.flap, multiply(root, flap), flapColor, config.flap === "crochet" ? stitchPattern : 9, config.flap === "crochet" ? 0 : .12);
  }

  const metal = config.hardware === "silver" ? "#cfd4da" : config.hardware === "black" ? "#282629" : "#c9a45b";
  const lock = localMatrix([0, config.flap !== "none" ? .37 : -.58, .48], [.105, .105, .075]);
  drawMesh(renderer, meshes.sphere, multiply(root, lock), metal, 9, .95);

  if (config.accent === "tassel") {
    const tassel = localMatrix([-1.06, -.12, .28], [.9, 1, .9], [0, 0, -.08]);
    drawMesh(renderer, meshes.cone, multiply(root, tassel), bodyColor, stitchPattern, 0);
  } else if (config.accent === "scarf") {
    const left = localMatrix([-.88, .33, .33], [.82, 1.05, 1], [0, 0, .55]);
    const right = localMatrix([-.76, .22, .37], [.78, 1.05, 1], [0, 0, -.48]);
    drawMesh(renderer, meshes.ribbon, multiply(root, left), "#e3a0b0", 9, .02);
    drawMesh(renderer, meshes.ribbon, multiply(root, right), "#c66f87", 9, .02);
  } else if (config.accent === "charm") {
    const charm = localMatrix([1.02, -.08, .33], [.12, .18, .07], [0, 0, .7]);
    drawMesh(renderer, meshes.sphere, multiply(root, charm), "#b87880", 9, .35);
  }
}

export default function BagBuilderWebGL3D() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [config, setConfig] = useState<BuilderConfig>(EMPTY);
  const [rotation, setRotation] = useState({ x: -.12, y: .34 });
  const [zoom, setZoom] = useState(1);
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const pointerRef = useRef<{ id: number; x: number; y: number; rx: number; ry: number } | null>(null);

  useEffect(() => {
    const attach = () => {
      const next = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
      setStage((current) => current === next ? current : next);
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!stage) return;
    const sync = () => setConfig((current) => {
      const next = readConfig(stage);
      return sameConfig(current, next) ? current : next;
    });
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(stage, { attributes: true, attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"] });
    return () => observer.disconnect();
  }, [stage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rendererRef.current) return;
    try {
      rendererRef.current = initRenderer(canvas);
      if (rendererRef.current) {
        setReady(true);
        stage?.classList.add("abags-webgl3d-active");
        stage?.setAttribute("data-abags-3d-ready", "true");
      }
    } catch {
      rendererRef.current = null;
      setReady(false);
    }
    return () => {
      stage?.classList.remove("abags-webgl3d-active");
      stage?.removeAttribute("data-abags-3d-ready");
    };
  }, [stage]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;
    let frame = requestAnimationFrame(() => draw(renderer, canvas, config, rotation, zoom));
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => draw(renderer, canvas, config, rotation, zoom));
    };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", onResize); };
  }, [config, rotation, zoom, ready]);

  const label = useMemo(() => config.family ? "Interaktywny model 3D" : "Wybierz fason, aby uruchomić model 3D", [config.family]);
  if (!stage) return null;

  return createPortal(<div className="abags-webgl3d-layer" data-abags-webgl3d>
    <canvas
      ref={canvasRef}
      className="abags-webgl3d-canvas"
      aria-label={label}
      onPointerDown={(event) => {
        pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, rx: rotation.x, ry: rotation.y };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const pointer = pointerRef.current;
        if (!pointer || pointer.id !== event.pointerId) return;
        const dx = event.clientX - pointer.x;
        const dy = event.clientY - pointer.y;
        setRotation({ x: Math.max(-.75, Math.min(.65, pointer.rx + dy * .008)), y: pointer.ry + dx * .01 });
      }}
      onPointerUp={(event) => {
        if (pointerRef.current?.id === event.pointerId) pointerRef.current = null;
      }}
      onPointerCancel={() => { pointerRef.current = null; }}
      onWheel={(event) => {
        event.preventDefault();
        setZoom((value) => Math.max(.82, Math.min(1.22, value - event.deltaY * .0008)));
      }}
    />
    <div className="abags-webgl3d-chip">MODEL 3D · OBRÓT 360°</div>
    <div className="abags-webgl3d-controls">
      <button type="button" onClick={() => setRotation({ x: 0, y: 0 })}>Przód</button>
      <button type="button" onClick={() => setRotation({ x: -.12, y: .48 })}>3D</button>
      <button type="button" onClick={() => setZoom((value) => Math.min(1.22, value + .08))}>＋</button>
      <button type="button" onClick={() => setZoom((value) => Math.max(.82, value - .08))}>−</button>
    </div>
    <p className="abags-webgl3d-hint">Przeciągnij torebkę palcem, aby obejrzeć ją z każdej strony.</p>
  </div>, stage);
}
