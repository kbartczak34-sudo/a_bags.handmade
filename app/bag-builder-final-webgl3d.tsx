"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS, ABAGS_FIDELITY_V4_RENDERER_VERSION } from "../lib/abags-fidelity-v4-family-spec";

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

const DEFAULT_ROTATION = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.42;
const RENDERER_VERSION = ABAGS_FIDELITY_V4_RENDERER_VERSION;

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

float yarnFibres(vec2 uv){
  float a=sin((uv.x*.72+uv.y)*430.0);
  float b=sin((uv.x-uv.y*.42)*690.0);
  return .965+.018*a+.012*b;
}

float cord(float d,float width){
  return 1.0-smoothstep(width,width*1.85,d);
}

float stitchPattern(vec2 uv,float mode){
  vec2 tile;
  float raised=0.0;
  float shadow=0.0;

  if(mode<.5){
    // A-Bags: ażurowy V — alternating diagonal cords with an open centre.
    tile=fract(uv*vec2(10.0,11.0));
    float left=abs(tile.x-(.5-.54*abs(tile.y-.5)));
    float right=abs(tile.x-(.5+.54*abs(tile.y-.5)));
    raised=max(cord(left,.075),cord(right,.075));
    shadow=1.0-smoothstep(.12,.27,abs(tile.x-.5));
    return (.73+.30*raised-.08*shadow)*yarnFibres(uv);
  }

  if(mode<1.5){
    // A-Bags: pionowy ażurowy — vertical posts joined by compact V bridges.
    tile=fract(uv*vec2(12.0,10.0));
    float post=cord(abs(tile.x-.5),.105);
    float bridgeA=cord(abs((tile.x-.5)-(.34*(tile.y-.5))),.075);
    float bridgeB=cord(abs((tile.x-.5)+(.34*(tile.y-.5))),.075);
    float bridge=max(bridgeA,bridgeB)*(1.0-smoothstep(.28,.47,abs(tile.y-.5)));
    float opening=(1.0-post)*(1.0-bridge);
    return (.72+.28*max(post,bridge)-.055*opening)*yarnFibres(uv);
  }

  if(mode<2.5){
    // A-Bags: koszykowy — paired bands with an alternating over/under rhythm.
    tile=fract(uv*vec2(8.0,8.0));
    float vx=max(cord(abs(tile.x-.34),.115),cord(abs(tile.x-.66),.115));
    float hy=max(cord(abs(tile.y-.34),.115),cord(abs(tile.y-.66),.115));
    float parity=mod(floor(uv.x*8.0)+floor(uv.y*8.0),2.0);
    float over=mix(hy,vx,parity);
    float under=mix(vx,hy,parity);
    return (.72+.27*over+.10*under)*yarnFibres(uv);
  }

  // A-Bags: promienisty — repeated crochet fans/scallops rather than waves.
  tile=fract(uv*vec2(8.5,8.0));
  vec2 fan=vec2(tile.x-.5,tile.y-.18);
  float radius=length(vec2(fan.x*1.18,fan.y));
  float arc=cord(abs(radius-.42),.065)*step(0.0,fan.y);
  float spoke1=cord(abs(fan.x),.055)*step(.02,fan.y);
  float spoke2=cord(abs(fan.x-fan.y*.48),.055)*step(.02,fan.y);
  float spoke3=cord(abs(fan.x+fan.y*.48),.055)*step(.02,fan.y);
  raised=max(arc,max(spoke1,max(spoke2,spoke3)));
  return (.74+.27*raised)*yarnFibres(uv);
}

void main(){
  vec3 n=normalize(vNormal);
  vec3 l=normalize(uLight);
  vec3 v=normalize(vec3(0.0,.10,5.8)-vWorld);
  vec3 h=normalize(l+v);
  float diffuse=max(dot(n,l),0.0);
  float fill=max(dot(n,normalize(vec3(.6,.35,.8))),0.0);
  float rim=pow(1.0-max(dot(n,v),0.0),2.4);
  float detail=1.0;
  float rough=.9;
  float metallic=0.0;

  if(uMaterial<.5){
    detail=stitchPattern(vUv,uStitch);
    rough=.94;
  }else if(uMaterial<1.5){
    detail=(.88+.08*sin(vUv.y*75.0))*yarnFibres(vUv*.45);
    rough=.48;
  }else if(uMaterial<2.5){
    detail=1.0;
    rough=.14;
    metallic=.9;
  }else{
    detail=.91+.07*sin(vUv.x*33.0)*sin(vUv.y*29.0);
    rough=.75;
  }

  float specular=pow(max(dot(n,h),0.0),mix(76.0,11.0,rough))*mix(.11,.88,metallic);
  vec3 base=uColor*detail;
  vec3 lit=base*(.38+.65*diffuse+.16*fill)+vec3(specular)+base*.07*rim;
  gl_FragColor=vec4(pow(max(lit,vec3(0.0)),vec3(.96)),1.0);
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
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[5] = c; out[6] = s; out[9] = -s; out[10] = c;
  return out;
}

function rotY(angle: number) {
  const out = identity();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[0] = c; out[2] = -s; out[8] = s; out[10] = c;
  return out;
}

function rotZ(angle: number) {
  const out = identity();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[0] = c; out[1] = s; out[4] = -s; out[5] = c;
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

function superellipseContour(rx: number, ry: number, power: number, count = 48, taper = 0): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const exponent = 2 / power;
    const y = Math.sign(s) * ry * Math.pow(Math.abs(s), exponent);
    const baseX = Math.sign(c) * rx * Math.pow(Math.abs(c), exponent);
    const normalizedY = y / ry;
    const widthScale = 1 + taper * normalizedY;
    return [baseX * widthScale, y] as Point;
  });
}

function familyContour(family: Exclude<Family, "">): Point[] {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  return superellipseContour(spec.rx, spec.ry, spec.power, family === "round" ? 56 : 60, spec.taper);
}

function scaledContour(contour: Point[], factor: number): Point[] {
  return contour.map(([x, y]) => [x * factor, y * factor]);
}

function pushTriangle(
  positions: number[],
  normals: number[],
  uvs: number[],
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  normal: [number, number, number],
) {
  for (const point of [a, b, c]) {
    positions.push(...point);
    normals.push(...normal);
    uvs.push(point[0] * .5 + .5, point[1] * .5 + .5);
  }
}

function beveledExtrusion(contour: Point[], depth: number, bevel = .055) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const half = depth / 2;
  const face = scaledContour(contour, .965);
  const sideFront = half - bevel;
  const sideBack = -half + bevel;

  for (let index = 1; index < face.length - 1; index += 1) {
    pushTriangle(positions, normals, uvs, [face[0][0], face[0][1], half], [face[index][0], face[index][1], half], [face[index + 1][0], face[index + 1][1], half], [0, 0, 1]);
    pushTriangle(positions, normals, uvs, [face[0][0], face[0][1], -half], [face[index + 1][0], face[index + 1][1], -half], [face[index][0], face[index][1], -half], [0, 0, -1]);
  }

  for (let index = 0; index < contour.length; index += 1) {
    const next = (index + 1) % contour.length;
    const a = contour[index];
    const b = contour[next];
    const ia = face[index];
    const ib = face[next];
    const sideNormal = normalize(b[1] - a[1], -(b[0] - a[0]), .04);

    pushTriangle(positions, normals, uvs, [ia[0], ia[1], half], [a[0], a[1], sideFront], [b[0], b[1], sideFront], normalize(sideNormal[0], sideNormal[1], .55));
    pushTriangle(positions, normals, uvs, [ia[0], ia[1], half], [b[0], b[1], sideFront], [ib[0], ib[1], half], normalize(sideNormal[0], sideNormal[1], .55));

    pushTriangle(positions, normals, uvs, [a[0], a[1], sideFront], [a[0], a[1], sideBack], [b[0], b[1], sideBack], sideNormal);
    pushTriangle(positions, normals, uvs, [a[0], a[1], sideFront], [b[0], b[1], sideBack], [b[0], b[1], sideFront], sideNormal);

    pushTriangle(positions, normals, uvs, [a[0], a[1], sideBack], [ia[0], ia[1], -half], [ib[0], ib[1], -half], normalize(sideNormal[0], sideNormal[1], -.55));
    pushTriangle(positions, normals, uvs, [a[0], a[1], sideBack], [ib[0], ib[1], -half], [b[0], b[1], sideBack], normalize(sideNormal[0], sideNormal[1], -.55));
  }

  return { positions, normals, uvs };
}

function tubeArc(rx: number, ry: number, minor: number, full = false, segments = 56, tubeSegments = 10) {
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
    const normal = normalize(-uy * Math.cos(ringAngle), ux * Math.cos(ringAngle), Math.sin(ringAngle));
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

function sphereMesh(rows = 14, columns = 20) {
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
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
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
      tote: createMesh(gl, beveledExtrusion(familyContour("tote"), ABAGS_FIDELITY_V4_FAMILY_SPECS.tote.depth, ABAGS_FIDELITY_V4_FAMILY_SPECS.tote.bevel)),
      round: createMesh(gl, beveledExtrusion(familyContour("round"), ABAGS_FIDELITY_V4_FAMILY_SPECS.round.depth, ABAGS_FIDELITY_V4_FAMILY_SPECS.round.bevel)),
      bucket: createMesh(gl, beveledExtrusion(familyContour("bucket"), ABAGS_FIDELITY_V4_FAMILY_SPECS.bucket.depth, ABAGS_FIDELITY_V4_FAMILY_SPECS.bucket.bevel)),
      mini: createMesh(gl, beveledExtrusion(familyContour("mini"), ABAGS_FIDELITY_V4_FAMILY_SPECS.mini.depth, ABAGS_FIDELITY_V4_FAMILY_SPECS.mini.bevel)),
      flap: createMesh(gl, beveledExtrusion(superellipseContour(.80, .36, 4.2, 44, -.04), .075, .022)),
      handle: createMesh(gl, tubeArc(.67, .50, .058)),
      strap: createMesh(gl, tubeArc(1.10, 1.40, .038)),
      ring: createMesh(gl, tubeArc(.13, .13, .024, true, 40, 9)),
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

function familyMetrics(family: Exclude<Family, "">) {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  return {
    depth: spec.depth,
    topY: spec.topY,
    side: spec.sideAnchor,
    ringY: spec.ringY,
    handleScale: spec.handleScale,
    flapScale: spec.flapScale,
    flapY: spec.flapY,
  };
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

  const aspect = width / Math.max(1, height);
  const narrow = aspect < .82;
  const cameraZ = narrow ? -6.45 : aspect < 1.15 ? -5.85 : -5.25;
  const verticalOffset = narrow ? -.08 : -.03;
  gl.uniformMatrix4fv(uniforms.projection, false, perspective(Math.PI / 5.15, aspect, .1, 100));
  gl.uniformMatrix4fv(uniforms.view, false, translation(0, verticalOffset, cameraZ));
  gl.uniform3fv(uniforms.light, new Float32Array([-.55, .95, 1.25]));

  if (!config.family) {
    gl.finish();
    return;
  }

  const fit = narrow ? .92 : aspect < 1.15 ? .97 : 1;
  const rootScale = zoom * fit;
  const root = multiply(rotY(rotation.y), multiply(rotX(rotation.x), scale(rootScale, rootScale, rootScale)));
  const bodyColor = config.color || "#eadfd7";
  const stitch = stitchId(config.stitch);
  const metrics = familyMetrics(config.family);
  const { depth, topY, side } = metrics;
  const hardware = config.hardware === "silver" ? "#d5d9dd" : config.hardware === "black" ? "#2a292b" : "#c9a354";

  if (config.strap !== "none") {
    const strapColor = config.strap === "chain" ? hardware : config.strap === "leather" ? "#76503d" : "#9a7580";
    drawMesh(renderer, meshes.strap, multiply(root, matrix([0, .16, -.25], [.92, .96, 1])), strapColor, stitch, config.strap === "chain" ? 2 : config.strap === "leather" ? 1 : 3);
  }

  drawMesh(renderer, meshes[config.family], root, bodyColor, stitch, 0);

  if (config.handles !== "none") {
    const handleColor = config.handles === "wood-dark" ? "#60402f" : config.handles === "wood-light" ? "#d7b985" : bodyColor;
    const handleMaterial = config.handles === "crochet" ? 0 : 1;
    drawMesh(
      renderer,
      meshes.handle,
      multiply(root, matrix([0, topY - .01, .015], [metrics.handleScale[0], metrics.handleScale[1], 1])),
      handleColor,
      stitch,
      handleMaterial,
    );
  }

  if (config.flap !== "none") {
    const flapColor = config.flap === "leather-black" ? "#292426" : config.flap === "leather-cognac" ? "#9a6345" : config.flap === "suede-burgundy" ? "#773c4b" : bodyColor;
    const flapMaterial = config.flap === "crochet" ? 0 : 1;
    const flapY = metrics.flapY ?? .29;
    drawMesh(
      renderer,
      meshes.flap,
      multiply(root, matrix([0, flapY, depth / 2 + .058], [metrics.flapScale[0], metrics.flapScale[1], 1], [.045, 0, 0])),
      flapColor,
      stitch,
      flapMaterial,
    );
    drawMesh(renderer, meshes.sphere, multiply(root, matrix([0, flapY - .22, depth / 2 + .145], [.072, .072, .045])), hardware, 0, 2);
  }

  if (config.handles !== "none" || config.strap !== "none") {
    const ringY = metrics.ringY;
    drawMesh(renderer, meshes.ring, multiply(root, matrix([-side, ringY, depth / 2 + .018], [.68, .68, .68], [0, Math.PI / 2, 0])), hardware, 0, 2);
    drawMesh(renderer, meshes.ring, multiply(root, matrix([side, ringY, depth / 2 + .018], [.68, .68, .68], [0, Math.PI / 2, 0])), hardware, 0, 2);
  }

  if (config.accent === "charm") {
    drawMesh(renderer, meshes.sphere, multiply(root, matrix([side * .86, .04, depth / 2 + .17], [.105, .105, .06])), "#b86f82", 0, 2);
  } else if (config.accent === "tassel") {
    drawMesh(renderer, meshes.sphere, multiply(root, matrix([side * .91, .25, depth / 2 + .14], [.07, .07, .05])), hardware, 0, 2);
    drawMesh(renderer, meshes.strap, multiply(root, matrix([side * .86, -.48, depth / 2 + .16], [.14, .27, .34], [0, 0, -.10])), bodyColor, stitch, 0);
  } else if (config.accent === "scarf") {
    drawMesh(renderer, meshes.flap, multiply(root, matrix([-side * .68, .36, depth / 2 + .17], [.22, .37, .16], [0, 0, .42])), "#efb7c5", 0, 3);
    drawMesh(renderer, meshes.flap, multiply(root, matrix([-side * .49, .19, depth / 2 + .18], [.18, .31, .15], [0, 0, -.34])), "#c66f89", 0, 3);
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
      target.dataset.abagsFidelity3dReady = RENDERER_VERSION;
      target.dataset.abagsFidelity3dModel = "real-product-calibrated";
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
      target.removeAttribute("data-abags-fidelity3d-model");
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
          target.dataset.abagsFidelity3dFrame = configSignature(config);
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
    setRotation(next === "front" ? { x: -.02, y: 0 } : next === "side" ? { x: -.035, y: Math.PI / 2 } : DEFAULT_ROTATION);
  };

  const label = config.family ? "Interaktywny model 3D A-Bags" : "Wybierz fason, aby rozpocząć model 3D";

  if (!portalTarget) return null;

  return createPortal(
    <div className="abags-pro3d-layer abags-fidelity3d-layer" data-abags-pro3d data-abags-fidelity3d data-abags-final-webgl="v4">
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
            x: clamp(drag.current.rx + (event.clientY - drag.current.y) * .008, -.64, .48),
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
      <div className="abags-pro3d-chip">A-BAGS REALTIME 3D · FIDELITY V4</div>
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
