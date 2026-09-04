"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  meshes: Record<string, Mesh>;
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

const DEFAULT_ROTATION = { x: -0.08, y: 0.5 };
const DEFAULT_ZOOM = 0.9;
const MIN_ZOOM = 0.48;
const MAX_ZOOM = 1.45;

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
uniform vec3 uLight;
uniform float uStitch;
uniform float uMaterial;
float stitchPattern(vec2 uv,float mode){
  if(mode<0.5){
    return 0.83+0.17*sin((uv.x*1.18+uv.y*0.72)*74.0);
  }
  if(mode<1.5){
    float a=sin((uv.x+uv.y)*58.0);
    float b=sin((uv.x-uv.y)*58.0);
    return 0.82+0.18*max(a,b);
  }
  if(mode<2.5){
    float a=abs(sin(uv.x*47.0));
    float b=abs(sin(uv.y*47.0));
    return 0.79+0.21*max(a,b);
  }
  return 0.82+0.18*sin(uv.x*48.0+sin(uv.y*28.0)*2.8);
}
void main(){
  vec3 n=normalize(vNormal);
  vec3 l=normalize(uLight);
  vec3 eye=normalize(vec3(0.0,0.2,5.4)-vWorld);
  vec3 halfVector=normalize(l+eye);
  float diffuse=max(dot(n,l),0.0);
  float specular=pow(max(dot(n,halfVector),0.0),uMaterial>3.5?72.0:20.0);
  float rim=pow(1.0-max(dot(n,eye),0.0),2.0);
  float texture=uMaterial<0.5?stitchPattern(vUv,uStitch):1.0;
  vec3 base=uColor*texture;
  float ambient=uMaterial>3.5?0.34:0.28;
  float lightAmount=ambient+diffuse*0.78;
  vec3 color=base*lightAmount+vec3(specular)*(uMaterial>3.5?0.72:0.18)+base*rim*0.12;
  gl_FragColor=vec4(pow(max(color,vec3(0.0)),vec3(0.96)),1.0);
}`;

function configSignature(config: Config) {
  return [config.family, config.color, config.stitch, config.flap, config.handles, config.strap, config.hardware, config.accent].join("|");
}

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hex(value: string): [number, number, number] {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : "e8ddcc";
  const number = Number.parseInt(safe, 16);
  return [((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255];
}

function identity() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
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
  out[5] = c;
  out[6] = s;
  out[9] = -s;
  out[10] = c;
  return out;
}

function rotY(angle: number) {
  const out = identity();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[0] = c;
  out[2] = -s;
  out[8] = s;
  out[10] = c;
  return out;
}

function rotZ(angle: number) {
  const out = identity();
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[0] = c;
  out[1] = s;
  out[4] = -s;
  out[5] = c;
  return out;
}

function matrix(position: [number, number, number], size: [number, number, number], rotation: [number, number, number] = [0,0,0]) {
  return multiply(translation(...position), multiply(rotZ(rotation[2]), multiply(rotY(rotation[1]), multiply(rotX(rotation[0]), scale(...size)))));
}

function perspective(fov: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fov / 2);
  const out = new Float32Array(16);
  out[0] = f / Math.max(aspect, 0.1);
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function normalize(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function familyPoints(family: Exclude<Family, "">): Point[] {
  if (family === "round") {
    return Array.from({ length: 40 }, (_, index) => {
      const angle = Math.PI * 2 * (index / 40);
      return [Math.cos(angle) * 0.92, Math.sin(angle) * 0.76 - 0.05] as Point;
    });
  }
  if (family === "bucket") {
    return [[-0.7,0.78],[0.7,0.78],[0.91,-0.72],[-0.91,-0.72]];
  }
  if (family === "mini") {
    return [[-0.82,0.54],[0.82,0.54],[0.86,-0.56],[-0.86,-0.56]];
  }
  return [[-0.91,0.72],[0.91,0.72],[0.99,-0.73],[-0.99,-0.73]];
}

function pushTriangle(target: { positions: number[]; normals: number[]; uvs: number[] }, a: [number,number,number], b: [number,number,number], c: [number,number,number], normal: [number,number,number], uvA: [number,number], uvB: [number,number], uvC: [number,number]) {
  target.positions.push(...a, ...b, ...c);
  target.normals.push(...normal, ...normal, ...normal);
  target.uvs.push(...uvA, ...uvB, ...uvC);
}

function extrudedPolygon(points: Point[], depth: number) {
  const result = { positions: [] as number[], normals: [] as number[], uvs: [] as number[] };
  const half = depth / 2;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const uv = (point: Point): [number,number] => [(point[0]-minX)/(maxX-minX || 1), (point[1]-minY)/(maxY-minY || 1)];
  const center: Point = [points.reduce((sum,p)=>sum+p[0],0)/points.length, points.reduce((sum,p)=>sum+p[1],0)/points.length];
  const centerUv = uv(center);

  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    const a = points[index];
    const b = points[next];
    pushTriangle(result, [center[0],center[1],half], [a[0],a[1],half], [b[0],b[1],half], [0,0,1], centerUv, uv(a), uv(b));
    pushTriangle(result, [center[0],center[1],-half], [b[0],b[1],-half], [a[0],a[1],-half], [0,0,-1], centerUv, uv(b), uv(a));

    const edgeX = b[0]-a[0];
    const edgeY = b[1]-a[1];
    const sideNormal = normalize(edgeY, -edgeX, 0);
    const u0 = index / points.length;
    const u1 = (index + 1) / points.length;
    pushTriangle(result, [a[0],a[1],half], [a[0],a[1],-half], [b[0],b[1],half], sideNormal, [u0,1],[u0,0],[u1,1]);
    pushTriangle(result, [b[0],b[1],half], [a[0],a[1],-half], [b[0],b[1],-half], sideNormal, [u1,1],[u0,0],[u1,0]);
  }
  return result;
}

function tubeArc(rx: number, ry: number, minor: number, segments = 56, tubeSegments = 10, full = false) {
  const result = { positions: [] as number[], normals: [] as number[], uvs: [] as number[] };
  const vertex = (progress: number, ring: number) => {
    const t = full ? progress * Math.PI * 2 : Math.PI - progress * Math.PI;
    const cx = rx * Math.cos(t);
    const cy = ry * Math.sin(t);
    const tx = -rx * Math.sin(t);
    const ty = ry * Math.cos(t);
    const length = Math.hypot(tx,ty) || 1;
    const ux = tx/length;
    const uy = ty/length;
    const angle = ring * Math.PI * 2;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const normal = normalize(-uy*ca, ux*ca, sa);
    return { position: [cx+minor*normal[0], cy+minor*normal[1], minor*normal[2]] as [number,number,number], normal, uv: [progress, ring] as [number,number] };
  };
  for (let i=0;i<segments;i+=1) {
    for (let j=0;j<tubeSegments;j+=1) {
      const a=vertex(i/segments,j/tubeSegments);
      const b=vertex((i+1)/segments,j/tubeSegments);
      const c=vertex((i+1)/segments,(j+1)/tubeSegments);
      const d=vertex(i/segments,(j+1)/tubeSegments);
      result.positions.push(...a.position,...b.position,...c.position,...a.position,...c.position,...d.position);
      result.normals.push(...a.normal,...b.normal,...c.normal,...a.normal,...c.normal,...d.normal);
      result.uvs.push(...a.uv,...b.uv,...c.uv,...a.uv,...c.uv,...d.uv);
    }
  }
  return result;
}

function sphereMesh(rows = 14, columns = 20) {
  const result = { positions: [] as number[], normals: [] as number[], uvs: [] as number[] };
  const vertex = (row: number, column: number) => {
    const theta = -Math.PI/2 + Math.PI*(row/rows);
    const phi = Math.PI*2*(column/columns);
    const normal = normalize(Math.cos(theta)*Math.cos(phi), Math.sin(theta), Math.cos(theta)*Math.sin(phi));
    return { position: normal as [number,number,number], normal, uv: [column/columns,row/rows] as [number,number] };
  };
  for (let row=0;row<rows;row+=1) {
    for (let column=0;column<columns;column+=1) {
      const a=vertex(row,column), b=vertex(row+1,column), c=vertex(row+1,column+1), d=vertex(row,column+1);
      result.positions.push(...a.position,...b.position,...c.position,...a.position,...c.position,...d.position);
      result.normals.push(...a.normal,...b.normal,...c.normal,...a.normal,...c.normal,...d.normal);
      result.uvs.push(...a.uv,...b.uv,...c.uv,...a.uv,...c.uv,...d.uv);
    }
  }
  return result;
}

function createMesh(gl: WebGLRenderingContext, data: {positions:number[];normals:number[];uvs:number[]}): Mesh {
  const position=gl.createBuffer(), normal=gl.createBuffer(), uv=gl.createBuffer();
  if(!position||!normal||!uv) throw new Error("Nie udało się utworzyć buforów WebGL.");
  gl.bindBuffer(gl.ARRAY_BUFFER,position); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.positions),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,normal); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.normals),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,uv); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.uvs),gl.STATIC_DRAW);
  return {position,normal,uv,count:data.positions.length/3};
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader=gl.createShader(type);
  if(!shader) throw new Error("Nie udało się utworzyć shadera WebGL.");
  gl.shaderSource(shader,source); gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader)||"Błąd kompilacji shadera.");
  return shader;
}

function init(canvas: HTMLCanvasElement): Renderer {
  const gl=canvas.getContext("webgl",{antialias:true,alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true,powerPreference:"high-performance"});
  if(!gl) throw new Error("WebGL nie jest dostępny na tym urządzeniu.");
  const program=gl.createProgram();
  if(!program) throw new Error("Nie udało się utworzyć programu WebGL.");
  gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,VERTEX));
  gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,FRAGMENT));
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)||"Błąd linkowania WebGL.");
  gl.useProgram(program);
  const attribute=(name:string)=>{const location=gl.getAttribLocation(program,name);if(location<0)throw new Error(`Brak atrybutu ${name}.`);return location;};
  const uniform=(name:string)=>{const location=gl.getUniformLocation(program,name);if(location===null)throw new Error(`Brak uniformu ${name}.`);return location;};
  return {
    gl,program,
    attribs:{position:attribute("aPosition"),normal:attribute("aNormal"),uv:attribute("aUv")},
    uniforms:{projection:uniform("uProjection"),view:uniform("uView"),model:uniform("uModel"),color:uniform("uColor"),stitch:uniform("uStitch"),material:uniform("uMaterial"),light:uniform("uLight")},
    meshes:{
      tote:createMesh(gl,extrudedPolygon(familyPoints("tote"),0.56)),
      round:createMesh(gl,extrudedPolygon(familyPoints("round"),0.6)),
      bucket:createMesh(gl,extrudedPolygon(familyPoints("bucket"),0.62)),
      mini:createMesh(gl,extrudedPolygon(familyPoints("mini"),0.48)),
      flap:createMesh(gl,extrudedPolygon([[-0.78,0.28],[0.78,0.28],[0.69,-0.4],[-0.69,-0.4]],0.08)),
      handle:createMesh(gl,tubeArc(0.7,0.68,0.065)),
      strap:createMesh(gl,tubeArc(1.12,1.45,0.04)),
      ring:createMesh(gl,tubeArc(0.16,0.16,0.035,40,8,true)),
      sphere:createMesh(gl,sphereMesh()),
    },
  };
}

function drawMesh(renderer: Renderer, mesh: Mesh, model: Float32Array, color: string, stitch: number, material: number) {
  const {gl,attribs,uniforms}=renderer;
  gl.bindBuffer(gl.ARRAY_BUFFER,mesh.position); gl.enableVertexAttribArray(attribs.position); gl.vertexAttribPointer(attribs.position,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,mesh.normal); gl.enableVertexAttribArray(attribs.normal); gl.vertexAttribPointer(attribs.normal,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,mesh.uv); gl.enableVertexAttribArray(attribs.uv); gl.vertexAttribPointer(attribs.uv,2,gl.FLOAT,false,0,0);
  gl.uniformMatrix4fv(uniforms.model,false,model);
  gl.uniform3fv(uniforms.color,new Float32Array(hex(color)));
  gl.uniform1f(uniforms.stitch,stitch);
  gl.uniform1f(uniforms.material,material);
  gl.drawArrays(gl.TRIANGLES,0,mesh.count);
}

function stitchId(stitch: Stitch) {
  return stitch==="herringbone"?1:stitch==="basket"?2:stitch==="shell"?3:0;
}

function draw(renderer: Renderer, canvas: HTMLCanvasElement, config: Config, rotation: {x:number;y:number}, zoom: number) {
  const {gl,uniforms,meshes}=renderer;
  const ratio=Math.min(window.devicePixelRatio||1,2);
  const width=Math.max(2,Math.floor(canvas.clientWidth*ratio));
  const height=Math.max(2,Math.floor(canvas.clientHeight*ratio));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  gl.viewport(0,0,width,height);
  gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
  gl.useProgram(renderer.program);
  gl.uniformMatrix4fv(uniforms.projection,false,perspective(Math.PI/5.1,width/height,0.1,100));
  gl.uniformMatrix4fv(uniforms.view,false,translation(0,-0.02,-5.0));
  gl.uniform3fv(uniforms.light,new Float32Array([-0.45,0.88,1.0]));
  if(!config.family) return;

  const root=multiply(scale(zoom,zoom,zoom),multiply(rotX(rotation.x),rotY(rotation.y)));
  const body=config.color||"#e8ddcc";
  const stitch=stitchId(config.stitch);
  drawMesh(renderer,meshes[config.family],root,body,stitch,0);

  const topY=config.family==="bucket"?0.83:config.family==="mini"?0.63:config.family==="round"?0.72:0.84;
  const depth=config.family==="mini"?0.25:0.31;
  const metal=config.hardware==="silver"?"#d6dbe1":config.hardware==="black"?"#28282b":"#c7a05a";

  if(config.strap!=="none"){
    const strapColor=config.strap==="chain"?metal:config.strap==="leather"?"#6e4938":"#9e7580";
    const material=config.strap==="chain"?4:config.strap==="leather"?2:0;
    drawMesh(renderer,meshes.strap,multiply(root,matrix([0,topY-0.12,-depth-0.17],[0.9,0.88,1])),strapColor,stitch,material);
  }
  if(config.handles!=="none"){
    const handleColor=config.handles==="wood-dark"?"#603521":config.handles==="wood-light"?"#c99c68":body;
    const material=config.handles.startsWith("wood")?1:0;
    drawMesh(renderer,meshes.handle,multiply(root,matrix([0,topY-0.02,0],[0.95,0.9,1])),handleColor,stitch,material);
  }
  if(config.flap!=="none"){
    const flapColor=config.flap==="leather-black"?"#252326":config.flap==="leather-cognac"?"#7b5137":config.flap==="suede-burgundy"?"#7d3449":body;
    const material=config.flap==="crochet"?0:2;
    drawMesh(renderer,meshes.flap,multiply(root,matrix([0,0.28,depth+0.34],[0.93,0.86,1],[0.02,0,0])),flapColor,stitch,material);
  }

  drawMesh(renderer,meshes.sphere,multiply(root,matrix([0,-0.28,depth+0.43],[0.11,0.11,0.07])),metal,0,4);
  if(config.strap!=="none"){
    for(const x of [-0.94,0.94]) drawMesh(renderer,meshes.ring,multiply(root,matrix([x,topY-0.28,0],[0.72,0.72,0.72],[0,Math.PI/2,0])),metal,0,4);
  }
  if(config.accent==="tassel"){
    drawMesh(renderer,meshes.sphere,multiply(root,matrix([0.86,0.18,depth+0.4],[0.11,0.11,0.09])),metal,0,4);
    for(let index=0;index<5;index+=1){
      drawMesh(renderer,meshes.strap,multiply(root,matrix([0.86+(index-2)*0.035,-0.03,depth+0.34],[0.08,0.22,0.08],[0,0,0])),body,stitch,0);
    }
  }else if(config.accent==="charm"){
    drawMesh(renderer,meshes.sphere,multiply(root,matrix([0.88,0.08,depth+0.42],[0.13,0.13,0.08])),"#b86f82",0,2);
  }else if(config.accent==="scarf"){
    drawMesh(renderer,meshes.flap,multiply(root,matrix([-0.66,0.35,depth+0.42],[0.24,0.36,0.25],[0,0,0.42])),"#e9a5b7",0,3);
    drawMesh(renderer,meshes.flap,multiply(root,matrix([-0.51,0.22,depth+0.44],[0.18,0.28,0.2],[0,0,-0.45])),"#c66f89",0,3);
  }
  gl.finish();
}

export default function BagBuilderFinalWebGL3D() {
  const [stage,setStage]=useState<HTMLElement|null>(null);
  const [config,setConfig]=useState<Config>(EMPTY);
  const [rotation,setRotation]=useState(DEFAULT_ROTATION);
  const [zoom,setZoom]=useState(DEFAULT_ZOOM);
  const [view,setViewState]=useState<"front"|"three"|"side">("three");
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const rendererRef=useRef<Renderer|null>(null);
  const pointers=useRef(new Map<number,{x:number;y:number}>());
  const drag=useRef<{x:number;y:number;rx:number;ry:number}|null>(null);
  const pinch=useRef<{distance:number;zoom:number}|null>(null);

  useEffect(()=>{
    const find=()=>setStage((current)=>{const next=document.querySelector<HTMLElement>(".abags-bag-builder-stage");return current===next?current:next;});
    find();
    const observer=new MutationObserver(find); observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    if(!stage)return;
    const sync=()=>setConfig((current)=>{const next=readConfig(stage);return sameConfig(current,next)?current:next;});
    sync();
    const observer=new MutationObserver(sync);
    observer.observe(stage,{attributes:true,attributeFilter:["data-family","data-color","data-stitch","data-flap","data-handles","data-strap","data-hardware","data-accent"]});
    return()=>observer.disconnect();
  },[stage]);

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!stage||!canvas||rendererRef.current)return;
    try{
      rendererRef.current=init(canvas);
      stage.classList.add("abags-pro3d-active","abags-fidelity3d-active");
      stage.dataset.abagsPro3dReady="true";
      stage.dataset.abagsFidelity3dReady="variable-depth-v2";
      stage.removeAttribute("data-abags-fidelity3d-error");
    }catch(error){
      rendererRef.current=null;
      stage.dataset.abagsFidelity3dError=error instanceof Error?error.message.slice(0,160):"init-failed";
      stage.removeAttribute("data-abags-fidelity3d-ready");
    }
    return()=>{
      rendererRef.current=null;
      stage.classList.remove("abags-pro3d-active","abags-fidelity3d-active");
      stage.removeAttribute("data-abags-pro3d-ready");
      stage.removeAttribute("data-abags-fidelity3d-ready");
      stage.removeAttribute("data-abags-fidelity3d-frame");
      stage.removeAttribute("data-abags-fidelity3d-frame-at");
      stage.removeAttribute("data-abags-fidelity3d-error");
    };
  },[stage]);

  useEffect(()=>{
    const renderer=rendererRef.current,canvas=canvasRef.current;
    if(!renderer||!canvas||!stage)return;
    const paint=()=>{
      try{
        draw(renderer,canvas,config,rotation,zoom);
        if(config.family){
          stage.dataset.abagsFidelity3dFrame=configSignature(config);
          stage.dataset.abagsFidelity3dFrameAt=String(Date.now());
        }else{
          stage.removeAttribute("data-abags-fidelity3d-frame");
          stage.removeAttribute("data-abags-fidelity3d-frame-at");
        }
        stage.removeAttribute("data-abags-fidelity3d-error");
      }catch(error){
        stage.dataset.abagsFidelity3dError=error instanceof Error?error.message.slice(0,160):"draw-failed";
        stage.removeAttribute("data-abags-fidelity3d-frame");
      }
    };
    let frame=requestAnimationFrame(paint);
    const redraw=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(paint);};
    window.addEventListener("resize",redraw);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener("resize",redraw);};
  },[config,rotation,zoom,stage]);

  if(!stage)return null;
  const distance=()=>{const points=Array.from(pointers.current.values());return points.length<2?0:Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);};
  const setView=(next:"front"|"three"|"side")=>{
    setViewState(next);
    setRotation(next==="front"?{x:-0.02,y:0}:next==="side"?{x:-0.04,y:Math.PI/2}:DEFAULT_ROTATION);
  };
  const label=useMemo(()=>config.family?"Interaktywny model 3D A-Bags":"Wybierz fason, aby rozpocząć model 3D",[config.family]);

  return createPortal(
    <div className="abags-pro3d-layer abags-fidelity3d-layer" data-abags-pro3d data-abags-fidelity3d data-abags-final-webgl="v2">
      <canvas
        ref={canvasRef}
        className="abags-pro3d-canvas abags-fidelity3d-canvas"
        aria-label={label}
        onPointerDown={(event)=>{
          event.preventDefault(); pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY}); event.currentTarget.setPointerCapture?.(event.pointerId);
          if(pointers.current.size>=2){pinch.current={distance:distance(),zoom};drag.current=null;}else drag.current={x:event.clientX,y:event.clientY,rx:rotation.x,ry:rotation.y};
        }}
        onPointerMove={(event)=>{
          if(!pointers.current.has(event.pointerId))return;
          event.preventDefault(); pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
          if(pointers.current.size>=2&&pinch.current){const next=distance();if(pinch.current.distance>0)setZoom(clamp(pinch.current.zoom*(next/pinch.current.distance),MIN_ZOOM,MAX_ZOOM));return;}
          if(!drag.current)return;
          setViewState("three"); setRotation({x:clamp(drag.current.rx+(event.clientY-drag.current.y)*0.008,-0.68,0.52),y:drag.current.ry+(event.clientX-drag.current.x)*0.012});
        }}
        onPointerUp={(event)=>{pointers.current.delete(event.pointerId);if(pointers.current.size<2)pinch.current=null;if(!pointers.current.size)drag.current=null;}}
        onPointerCancel={(event)=>{pointers.current.delete(event.pointerId);pinch.current=null;drag.current=null;}}
        onWheel={(event)=>{event.preventDefault();setZoom((value)=>clamp(value-event.deltaY*0.0008,MIN_ZOOM,MAX_ZOOM));}}
      />
      <div className="abags-pro3d-chip">A-BAGS REALTIME 3D</div>
      <div className="abags-pro3d-view-controls" aria-label="Widok modelu 3D">
        <button type="button" className={view==="front"?"is-active":""} aria-pressed={view==="front"} onClick={()=>setView("front")}>Przód</button>
        <button type="button" className={view==="three"?"is-active":""} aria-pressed={view==="three"} onClick={()=>setView("three")}>3/4</button>
        <button type="button" className={view==="side"?"is-active":""} aria-pressed={view==="side"} onClick={()=>setView("side")}>Bok</button>
      </div>
      <div className="abags-pro3d-zoom" aria-label="Zoom modelu 3D">
        <button type="button" onClick={()=>setZoom((value)=>clamp(value-0.1,MIN_ZOOM,MAX_ZOOM))} aria-label="Oddal model">−</button>
        <span>ODDAL</span>
        <input type="range" min={48} max={145} step={1} value={Math.round(zoom*100)} onChange={(event)=>setZoom(clamp(Number(event.currentTarget.value)/100,MIN_ZOOM,MAX_ZOOM))} aria-label="Skala modelu 3D" />
        <span>PRZYBLIŻ</span>
        <button type="button" onClick={()=>setZoom((value)=>clamp(value+0.1,MIN_ZOOM,MAX_ZOOM))} aria-label="Przybliż model">+</button>
        <button type="button" className="abags-pro3d-reset" onClick={()=>{setRotation(DEFAULT_ROTATION);setViewState("three");setZoom(DEFAULT_ZOOM);}}>{Math.round(zoom*100)}%</button>
      </div>
      <p className="abags-pro3d-hint">Przeciągnij, aby obrócić · pinch lub suwak, aby przybliżyć · projekt aktualizuje się na żywo.</p>
    </div>,
    stage,
  );
}
