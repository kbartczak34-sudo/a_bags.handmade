"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ABAGS_FIDELITY_V4_FAMILY_SPECS } from "../lib/abags-fidelity-v4-family-spec";

type Family = "" | "tote" | "round" | "bucket" | "mini";
type Stitch = "" | "classic" | "herringbone" | "basket" | "shell";
type Rotation = { x: number; y: number };
type TransformDetail = { rotation?: Rotation; zoom?: number };
type Point = [number, number];
type Mesh = { position: WebGLBuffer; normal: WebGLBuffer; uv: WebGLBuffer; count: number };
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

type Config = {
  family: Family;
  color: string;
  stitch: Stitch;
  flap: string;
  handles: string;
  hardware: string;
};

const STAGE_SELECTOR = ".abags-bag-builder-stage";
const LAYER_SELECTOR = ".abags-fidelity3d-layer";
const DEFAULT_ROTATION: Rotation = { x: -0.07, y: 0.46 };
const DEFAULT_ZOOM = 0.94;
const SURFACE_VERSION = "agata-cord-webgl-v1-photo-calibrated";

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
varying float vFace;
void main(){
  vec4 world=uModel*vec4(aPosition,1.0);
  vWorld=world.xyz;
  vNormal=normalize(mat3(uModel)*aNormal);
  vUv=aUv;
  vFace=abs(aNormal.z);
  gl_Position=uProjection*uView*world;
}`;

const FRAGMENT = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec2 vUv;
varying float vFace;
uniform vec3 uColor;
uniform float uStitch;
uniform float uMaterial;
uniform vec3 uLight;

float saturate(float value){ return clamp(value,0.0,1.0); }

float sdSegment(vec2 p, vec2 a, vec2 b){
  vec2 pa=p-a;
  vec2 ba=b-a;
  float h=clamp(dot(pa,ba)/max(dot(ba,ba),0.0001),0.0,1.0);
  return length(pa-ba*h);
}

float roundedCord(float distanceToAxis,float radius){
  float x=saturate(1.0-distanceToAxis/max(radius,0.0001));
  return x*x*(3.0-2.0*x);
}

float deterministicFibres(vec2 uv){
  float twist=sin((uv.x*1.37+uv.y)*710.0);
  float filament=sin((uv.x-uv.y*.61)*1180.0);
  float cross=sin((uv.x*.24+uv.y)*1530.0);
  return .985+.010*twist+.006*filament+.004*cross;
}

/* Calibrated from the real A-Bags Exact Live V4 product references:
   chunky polyester cord, deep negative space and interlocked handmade loops. */
vec2 agataOpenV(vec2 uv){
  vec2 grid=uv*vec2(8.35,10.65);
  float row=floor(grid.y);
  grid.x+=mod(row,2.0)*.50;
  vec2 q=fract(grid)-.5;

  float left=sdSegment(q,vec2(-.46,-.42),vec2(0.0,.31));
  float right=sdSegment(q,vec2(.46,-.42),vec2(0.0,.31));
  float returnLeft=sdSegment(q,vec2(-.34,.44),vec2(0.0,.31));
  float returnRight=sdSegment(q,vec2(.34,.44),vec2(0.0,.31));
  float knot=length(q-vec2(0.0,.31));

  float cord=max(max(roundedCord(left,.102),roundedCord(right,.102)),
                 max(roundedCord(returnLeft,.086),roundedCord(returnRight,.086)));
  cord=max(cord,roundedCord(knot,.112));

  float openCenter=smoothstep(.115,.255,abs(q.x))*smoothstep(-.27,.18,q.y);
  float cavity=(1.0-cord)*(.58+.42*openCenter);
  return vec2(cord,cavity);
}

/* Real vertical-open A-Bags crochet is made from short interlocked cord sections,
   never one uninterrupted printed-looking post. Rows are staggered and each cell
   receives tiny deterministic handmade drift while preserving the exact silhouette. */
vec2 agataVerticalOpen(vec2 uv){
  vec2 grid=uv*vec2(9.05,10.30);
  vec2 cell=floor(grid);
  float row=cell.y;
  grid.x+=mod(row,2.0)*.48;
  cell=floor(grid);
  vec2 q=fract(grid)-.5;

  float cellJitter=.018*sin(cell.x*12.9898+cell.y*78.233);
  float rowJitter=.012*sin(cell.x*39.346+cell.y*11.135);
  q+=vec2(cellJitter,rowJitter);
  float radius=.088+.006*sin(cell.x*21.73+cell.y*17.19);

  float leftEntry=sdSegment(q,vec2(-.45,-.40),vec2(-.10,-.08));
  float rightEntry=sdSegment(q,vec2(.45,-.40),vec2(.10,-.08));
  float crossingLeft=sdSegment(q,vec2(-.10,-.08),vec2(.09,.10));
  float crossingRight=sdSegment(q,vec2(.10,-.08),vec2(-.09,.10));
  float leftReturn=sdSegment(q,vec2(-.09,.10),vec2(-.34,.42));
  float rightReturn=sdSegment(q,vec2(.09,.10),vec2(.34,.42));

  float entries=max(roundedCord(leftEntry,radius),roundedCord(rightEntry,radius));
  float crossing=max(roundedCord(crossingLeft,radius*.92),roundedCord(crossingRight,radius*.92));
  float returns=max(roundedCord(leftReturn,radius*.88),roundedCord(rightReturn,radius*.88));
  float join=roundedCord(length(q-vec2(0.0,.10)),radius*.94);
  float cord=max(max(entries,crossing),max(returns,join));

  float negativeSpace=smoothstep(.115,.285,abs(q.x))*smoothstep(-.29,.28,q.y);
  float lowerWindow=smoothstep(.16,.36,abs(q.x))*smoothstep(-.43,-.10,q.y);
  float cavity=(1.0-cord)*(.61+.25*negativeSpace+.14*lowerWindow);
  return vec2(cord,cavity);
}

vec2 agataBasket(vec2 uv){
  vec2 grid=uv*vec2(7.20,8.10);
  vec2 cell=floor(grid);
  vec2 q=fract(grid)-.5;
  float parity=mod(cell.x+cell.y,2.0);

  float h1=roundedCord(abs(q.y-.13),.145);
  float h2=roundedCord(abs(q.y+.13),.145);
  float v1=roundedCord(abs(q.x-.13),.145);
  float v2=roundedCord(abs(q.x+.13),.145);
  float horizontal=max(h1,h2);
  float vertical=max(v1,v2);

  float over=mix(horizontal,vertical,parity);
  float under=mix(vertical,horizontal,parity)*.64;
  float crossing=max(over,under);
  float crossingShadow=min(horizontal,vertical)*(1.0-over)*.44;
  float cord=saturate(crossing-crossingShadow);
  return vec2(cord,(1.0-cord)*.72+crossingShadow*.28);
}

vec2 agataRadial(vec2 uv){
  vec2 p=(uv-vec2(.50,.45))*vec2(1.0,1.10);
  float radius=max(length(p),.001);
  float angle=atan(p.y,p.x);
  float spokes=abs(sin(angle*11.0));
  float ray=1.0-smoothstep(.00,.22,spokes);
  float ringPhase=abs(fract(radius*13.2)-.5);
  float ring=1.0-smoothstep(.18,.43,ringPhase);
  float fan=max(ray*.88,ring*.76);
  float center=smoothstep(.04,.14,radius);
  float cord=saturate(fan*center);
  return vec2(cord,(1.0-cord)*(.62+.18*saturate(radius)));
}

vec2 stitchSurface(vec2 uv,float mode){
  if(mode<.5) return agataOpenV(uv);
  if(mode<1.5) return agataVerticalOpen(uv);
  if(mode<2.5) return agataBasket(uv);
  return agataRadial(uv);
}

vec3 tangentBasisX(vec3 n){
  vec3 t=cross(vec3(0.0,1.0,0.0),n);
  if(length(t)<.08) t=cross(vec3(1.0,0.0,0.0),n);
  return normalize(t);
}

void main(){
  vec3 baseNormal=normalize(vNormal);
  vec3 n=baseNormal;
  vec3 lightDir=normalize(uLight);
  vec3 viewDir=normalize(vec3(0.0,.10,5.8)-vWorld);

  float detail=1.0;
  float cavityAO=1.0;
  float rough=.86;
  float specularStrength=.12;
  float fibreSheen=0.0;
  float crown=0.0;

  if(uMaterial<.5){
    vec2 surface=stitchSurface(vUv,uStitch);
    float height=surface.x;
    float cavity=surface.y;

    /* Finite-height gradient gives each cord a true lighting normal instead of
       painting a light stripe on a flat polygon. It changes shading only. */
    float epsilon=.0024;
    float hx1=stitchSurface(vUv+vec2(epsilon,0.0),uStitch).x;
    float hx0=stitchSurface(vUv-vec2(epsilon,0.0),uStitch).x;
    float hy1=stitchSurface(vUv+vec2(0.0,epsilon),uStitch).x;
    float hy0=stitchSurface(vUv-vec2(0.0,epsilon),uStitch).x;
    vec2 gradient=vec2(hx1-hx0,hy1-hy0)/(2.0*epsilon);

    float faceMask=smoothstep(.55,.94,vFace);
    vec3 tangent=tangentBasisX(baseNormal);
    vec3 bitangent=normalize(cross(baseNormal,tangent));
    n=normalize(baseNormal-(tangent*gradient.x+bitangent*gradient.y)*.032*faceMask);

    crown=smoothstep(.42,.94,height);
    cavityAO=mix(.66,1.0,smoothstep(.08,.88,height));
    cavityAO*=1.0-.13*cavity;
    detail=(.88+.13*height)*deterministicFibres(vUv);
    rough=.78;
    specularStrength=.21;
  }else if(uMaterial<1.5){
    float grain=.014*sin(vUv.x*185.0)+.009*sin((vUv.x+vUv.y)*271.0);
    detail=.965+grain;
    rough=.48;
    specularStrength=.17;
  }else if(uMaterial<2.5){
    detail=1.0;
    rough=.12;
    specularStrength=.92;
  }else if(uMaterial<3.5){
    float grain=sin(vUv.x*58.0+sin(vUv.y*8.0)*3.2);
    float pores=sin((vUv.x+vUv.y)*183.0);
    detail=.955+.038*grain+.010*pores;
    rough=.34;
    specularStrength=.19;
  }else if(uMaterial<4.5){
    float nap=sin(vUv.x*97.0)*sin(vUv.y*91.0);
    detail=.96+.020*nap;
    rough=.93;
    specularStrength=.05;
  }else{
    /* Crochet handle: single thick cord, no tiled body stitch. */
    detail=.97+.018*sin(vUv.x*720.0+vUv.y*24.0);
    rough=.79;
    specularStrength=.18;
  }

  vec3 h=normalize(lightDir+viewDir);
  float diffuse=max(dot(n,lightDir),0.0);
  float fill=max(dot(n,normalize(vec3(.64,.30,.76))),0.0);
  float rim=pow(1.0-max(dot(n,viewDir),0.0),2.7);
  float exponent=mix(88.0,10.0,rough);
  float specular=pow(max(dot(n,h),0.0),exponent)*specularStrength;

  if(uMaterial<.5){
    float polyesterCrown=pow(max(dot(n,h),0.0),22.0)*(.025+.075*crown);
    float edgeThread=pow(1.0-max(dot(n,viewDir),0.0),3.2)*.016;
    fibreSheen=polyesterCrown+edgeThread;
  }

  vec3 base=uColor*detail*cavityAO;
  vec3 lit=base*(.31+.73*diffuse+.13*fill)+vec3(specular+fibreSheen)+base*.065*rim;
  gl_FragColor=vec4(pow(max(lit,vec3(0.0)),vec3(.96)),1.0);
}`;

function normalize3(x: number, y: number, z: number): [number, number, number] {
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
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

function scale(x: number, y: number, z: number) {
  const out = identity();
  out[0] = x; out[5] = y; out[10] = z;
  return out;
}

function rotX(angle: number) {
  const out = identity();
  const c = Math.cos(angle), s = Math.sin(angle);
  out[5] = c; out[6] = s; out[9] = -s; out[10] = c;
  return out;
}

function rotY(angle: number) {
  const out = identity();
  const c = Math.cos(angle), s = Math.sin(angle);
  out[0] = c; out[2] = -s; out[8] = s; out[10] = c;
  return out;
}

function rotZ(angle: number) {
  const out = identity();
  const c = Math.cos(angle), s = Math.sin(angle);
  out[0] = c; out[1] = s; out[4] = -s; out[5] = c;
  return out;
}

function matrix(position: [number, number, number], size: [number, number, number], rotation: [number, number, number] = [0,0,0]) {
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

function superellipseContour(rx: number, ry: number, power: number, count = 52, taper = 0): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const c = Math.cos(angle), s = Math.sin(angle);
    const exponent = 2 / power;
    const y = Math.sign(s) * ry * Math.pow(Math.abs(s), exponent);
    const baseX = Math.sign(c) * rx * Math.pow(Math.abs(c), exponent);
    return [baseX * (1 + taper * (y / ry)), y] as Point;
  });
}

function familyContour(family: Exclude<Family, "">): Point[] {
  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];
  return superellipseContour(spec.rx, spec.ry, spec.power, family === "round" ? 56 : 60, spec.taper);
}

function scaledContour(contour: Point[], factor: number): Point[] {
  return contour.map(([x,y]) => [x*factor,y*factor]);
}

function pushTriangle(
  positions: number[], normals: number[], uvs: number[],
  a: [number,number,number], b: [number,number,number], c: [number,number,number],
  normal: [number,number,number],
) {
  for (const point of [a,b,c]) {
    positions.push(...point);
    normals.push(...normal);
    uvs.push(point[0]*.5+.5, point[1]*.5+.5);
  }
}

function beveledExtrusion(contour: Point[], depth: number, bevel = .055) {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [];
  const half=depth/2;
  const face=scaledContour(contour,.965);
  const sideFront=half-bevel, sideBack=-half+bevel;

  for(let index=1; index<face.length-1; index+=1){
    pushTriangle(positions,normals,uvs,[face[0][0],face[0][1],half],[face[index][0],face[index][1],half],[face[index+1][0],face[index+1][1],half],[0,0,1]);
    pushTriangle(positions,normals,uvs,[face[0][0],face[0][1],-half],[face[index+1][0],face[index+1][1],-half],[face[index][0],face[index][1],-half],[0,0,-1]);
  }

  for(let index=0; index<contour.length; index+=1){
    const next=(index+1)%contour.length;
    const a=contour[index], b=contour[next], ia=face[index], ib=face[next];
    const sideNormal=normalize3(b[1]-a[1],-(b[0]-a[0]),.04);
    pushTriangle(positions,normals,uvs,[ia[0],ia[1],half],[a[0],a[1],sideFront],[b[0],b[1],sideFront],normalize3(sideNormal[0],sideNormal[1],.55));
    pushTriangle(positions,normals,uvs,[ia[0],ia[1],half],[b[0],b[1],sideFront],[ib[0],ib[1],half],normalize3(sideNormal[0],sideNormal[1],.55));
    pushTriangle(positions,normals,uvs,[a[0],a[1],sideFront],[a[0],a[1],sideBack],[b[0],b[1],sideBack],sideNormal);
    pushTriangle(positions,normals,uvs,[a[0],a[1],sideFront],[b[0],b[1],sideBack],[b[0],b[1],sideFront],sideNormal);
    pushTriangle(positions,normals,uvs,[a[0],a[1],sideBack],[ia[0],ia[1],-half],[ib[0],ib[1],-half],normalize3(sideNormal[0],sideNormal[1],-.55));
    pushTriangle(positions,normals,uvs,[a[0],a[1],sideBack],[ib[0],ib[1],-half],[b[0],b[1],sideBack],normalize3(sideNormal[0],sideNormal[1],-.55));
  }
  return {positions,normals,uvs};
}

function tubeArc(rx:number, ry:number, minor:number, full=false, segments=56, tubeSegments=10) {
  const positions:number[]=[], normals:number[]=[], uvs:number[]=[];
  const point=(segment:number,ring:number)=>{
    const progress=segment/segments;
    const angle=full?progress*Math.PI*2:Math.PI-progress*Math.PI;
    const cx=rx*Math.cos(angle), cy=ry*Math.sin(angle);
    const tx=-rx*Math.sin(angle), ty=ry*Math.cos(angle);
    const tlen=Math.hypot(tx,ty)||1;
    const ux=tx/tlen, uy=ty/tlen;
    const ringAngle=(ring/tubeSegments)*Math.PI*2;
    const normal=normalize3(-uy*Math.cos(ringAngle),ux*Math.cos(ringAngle),Math.sin(ringAngle));
    return {position:[cx+minor*normal[0],cy+minor*normal[1],minor*normal[2]] as [number,number,number],normal,uv:[progress,ring/tubeSegments] as [number,number]};
  };
  const add=(v:ReturnType<typeof point>)=>{positions.push(...v.position);normals.push(...v.normal);uvs.push(...v.uv);};
  for(let segment=0; segment<segments; segment+=1){
    for(let ring=0; ring<tubeSegments; ring+=1){
      const a=point(segment,ring), b=point(segment+1,ring), c=point(segment+1,ring+1), d=point(segment,ring+1);
      add(a);add(b);add(c);add(a);add(c);add(d);
    }
  }
  return {positions,normals,uvs};
}

function createMesh(gl:WebGLRenderingContext,data:{positions:number[];normals:number[];uvs:number[]}):Mesh{
  const position=gl.createBuffer(), normal=gl.createBuffer(), uv=gl.createBuffer();
  if(!position||!normal||!uv) throw new Error("Nie udało się utworzyć buforów Agata Cord 3D.");
  gl.bindBuffer(gl.ARRAY_BUFFER,position);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.positions),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,normal);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.normals),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,uv);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.uvs),gl.STATIC_DRAW);
  return {position,normal,uv,count:data.positions.length/3};
}

function compile(gl:WebGLRenderingContext,type:number,source:string){
  const shader=gl.createShader(type);
  if(!shader) throw new Error("Nie udało się utworzyć shadera Agata Cord 3D.");
  gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader)||"Błąd shadera Agata Cord 3D.");
  return shader;
}

function init(canvas:HTMLCanvasElement):Renderer{
  const gl=canvas.getContext("webgl",{antialias:true,alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true,powerPreference:"high-performance"});
  if(!gl) throw new Error("WebGL nie jest dostępny dla Agata Cord 3D.");
  const program=gl.createProgram();
  if(!program) throw new Error("Nie udało się utworzyć programu Agata Cord 3D.");
  gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,VERTEX));
  gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,FRAGMENT));
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)||"Błąd linkowania Agata Cord 3D.");
  gl.useProgram(program);
  const attribute=(name:string)=>{const loc=gl.getAttribLocation(program,name);if(loc<0) throw new Error(`Brak atrybutu ${name}.`);return loc;};
  const uniform=(name:string)=>{const loc=gl.getUniformLocation(program,name);if(loc===null) throw new Error(`Brak uniformu ${name}.`);return loc;};
  return {
    gl,program,
    attribs:{position:attribute("aPosition"),normal:attribute("aNormal"),uv:attribute("aUv")},
    uniforms:{
      projection:uniform("uProjection"),view:uniform("uView"),model:uniform("uModel"),
      color:uniform("uColor"),stitch:uniform("uStitch"),material:uniform("uMaterial"),light:uniform("uLight"),
    },
    meshes:{
      tote:createMesh(gl,beveledExtrusion(familyContour("tote"),ABAGS_FIDELITY_V4_FAMILY_SPECS.tote.depth,ABAGS_FIDELITY_V4_FAMILY_SPECS.tote.bevel)),
      round:createMesh(gl,beveledExtrusion(familyContour("round"),ABAGS_FIDELITY_V4_FAMILY_SPECS.round.depth,ABAGS_FIDELITY_V4_FAMILY_SPECS.round.bevel)),
      bucket:createMesh(gl,beveledExtrusion(familyContour("bucket"),ABAGS_FIDELITY_V4_FAMILY_SPECS.bucket.depth,ABAGS_FIDELITY_V4_FAMILY_SPECS.bucket.bevel)),
      mini:createMesh(gl,beveledExtrusion(familyContour("mini"),ABAGS_FIDELITY_V4_FAMILY_SPECS.mini.depth,ABAGS_FIDELITY_V4_FAMILY_SPECS.mini.bevel)),
      flap:createMesh(gl,beveledExtrusion(superellipseContour(.80,.36,4.2,44,-.04),.075,.022)),
      handle:createMesh(gl,tubeArc(.67,.50,.058)),
      ring:createMesh(gl,tubeArc(.13,.13,.024,true,40,9)),
    },
  };
}

function drawMesh(renderer:Renderer,mesh:Mesh,model:Float32Array,color:string,stitch:number,material:number){
  const {gl,attribs,uniforms}=renderer;
  gl.bindBuffer(gl.ARRAY_BUFFER,mesh.position);gl.enableVertexAttribArray(attribs.position);gl.vertexAttribPointer(attribs.position,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,mesh.normal);gl.enableVertexAttribArray(attribs.normal);gl.vertexAttribPointer(attribs.normal,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,mesh.uv);gl.enableVertexAttribArray(attribs.uv);gl.vertexAttribPointer(attribs.uv,2,gl.FLOAT,false,0,0);
  gl.uniformMatrix4fv(uniforms.model,false,model);
  gl.uniform3fv(uniforms.color,new Float32Array(hex(color)));
  gl.uniform1f(uniforms.stitch,stitch);
  gl.uniform1f(uniforms.material,material);
  gl.drawArrays(gl.TRIANGLES,0,mesh.count);
}

function stitchId(value:Stitch){return value==="herringbone"?1:value==="basket"?2:value==="shell"?3:0;}

function readConfig(stage:HTMLElement):Config{
  return {
    family:(stage.dataset.family||"") as Family,
    color:stage.dataset.color||"",
    stitch:(stage.dataset.stitch||"classic") as Stitch,
    flap:stage.dataset.flap||"none",
    handles:stage.dataset.handles||"none",
    hardware:stage.dataset.hardware||"gold",
  };
}

function draw(renderer:Renderer,canvas:HTMLCanvasElement,config:Config,rotation:Rotation,zoom:number){
  const {gl,uniforms,meshes}=renderer;
  const ratio=Math.min(window.devicePixelRatio||1,window.innerWidth<=620?1.5:2);
  const width=Math.max(2,Math.floor(canvas.clientWidth*ratio));
  const height=Math.max(2,Math.floor(canvas.clientHeight*ratio));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  gl.viewport(0,0,width,height);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.useProgram(renderer.program);
  if(!config.family){gl.finish();return;}

  const aspect=width/Math.max(1,height);
  const narrow=aspect<.82;
  const cameraZ=narrow?-6.45:aspect<1.15?-5.85:-5.25;
  const verticalOffset=narrow?-.08:-.03;
  gl.uniformMatrix4fv(uniforms.projection,false,perspective(Math.PI/5.15,aspect,.1,100));
  gl.uniformMatrix4fv(uniforms.view,false,translation(0,verticalOffset,cameraZ));
  gl.uniform3fv(uniforms.light,new Float32Array([-.55,.95,1.25]));

  const fit=narrow?.92:aspect<1.15?.97:1;
  const rootScale=zoom*fit;
  const root=multiply(rotY(rotation.y),multiply(rotX(rotation.x),scale(rootScale,rootScale,rootScale)));
  const spec=ABAGS_FIDELITY_V4_FAMILY_SPECS[config.family];
  const stitch=stitchId(config.stitch);
  const bodyColor=config.color||"#eadfd7";
  const hardware=config.hardware==="silver"?"#d5d9dd":config.hardware==="black"?"#2a292b":"#c9a354";

  drawMesh(renderer,meshes[config.family],root,bodyColor,stitch,0);

  if(config.handles!=="none"){
    const handleColor=config.handles==="wood-dark"?"#60402f":config.handles==="wood-light"?"#d7b985":bodyColor;
    const handleMaterial=config.handles==="crochet"?5:3;
    const rigid=config.handles==="wood-light"||config.handles==="wood-dark";
    const handleDepth=spec.depth/2+.055;
    const planes=rigid?[-handleDepth,handleDepth]:[.015];
    for(const z of planes){
      drawMesh(renderer,meshes.handle,multiply(root,matrix([0,spec.topY-.01,z],[spec.handleScale[0],spec.handleScale[1],1])),handleColor,stitch,handleMaterial);
    }
  }

  if(config.flap!=="none"){
    const flapColor=config.flap==="leather-black"?"#292426":config.flap==="leather-cognac"?"#9a6345":config.flap==="suede-burgundy"?"#773c4b":bodyColor;
    const flapMaterial=config.flap==="crochet"?0:config.flap==="suede-burgundy"?4:1;
    const flapY=spec.flapY??.29;
    drawMesh(renderer,meshes.flap,multiply(root,matrix([0,flapY,spec.depth/2+.058],[spec.flapScale[0],spec.flapScale[1],1],[.045,0,0])),flapColor,stitch,flapMaterial);
  }

  if(config.handles!=="none"){
    const ringY=spec.ringY;
    drawMesh(renderer,meshes.ring,multiply(root,matrix([-spec.sideAnchor,ringY,spec.depth/2+.018],[.68,.68,.68],[0,Math.PI/2,0])),hardware,0,2);
    drawMesh(renderer,meshes.ring,multiply(root,matrix([spec.sideAnchor,ringY,spec.depth/2+.018],[.68,.68,.68],[0,Math.PI/2,0])),hardware,0,2);
  }
  gl.finish();
}

export default function BagBuilderAgataCordWebGL(){
  const [layer,setLayer]=useState<HTMLElement|null>(null);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const rendererRef=useRef<Renderer|null>(null);
  const rotationRef=useRef<Rotation>(DEFAULT_ROTATION);
  const zoomRef=useRef(DEFAULT_ZOOM);
  const frameRef=useRef<number|null>(null);

  useEffect(()=>{
    const find=()=>{
      const stage=document.querySelector<HTMLElement>(STAGE_SELECTOR);
      const next=stage?.querySelector<HTMLElement>(`:scope > ${LAYER_SELECTOR}`)??null;
      setLayer(current=>current===next?current:next);
    };
    find();
    const observer=new MutationObserver(find);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    if(!layer) return;
    const stage=layer.closest<HTMLElement>(STAGE_SELECTOR);
    const canvas=canvasRef.current;
    if(!stage||!canvas) return;

    try{
      rendererRef.current=init(canvas);
      stage.dataset.abagsAgataCordWebgl="initialised";
      stage.removeAttribute("data-abags-agata-cord-webgl-error");
    }catch(error){
      stage.dataset.abagsAgataCordWebglError=error instanceof Error?error.message.slice(0,180):"init-failed";
      rendererRef.current=null;
      return;
    }

    const clear=()=>{
      const renderer=rendererRef.current;
      if(renderer){
        renderer.gl.clearColor(0,0,0,0);
        renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT|renderer.gl.DEPTH_BUFFER_BIT);
      }
      stage.removeAttribute("data-abags-agata-cord-webgl");
    };

    const syncTransform=()=>{
      const x=Number(stage.dataset.abagsFidelity3dRotationX);
      const y=Number(stage.dataset.abagsFidelity3dRotationY);
      const zoom=Number(stage.dataset.abagsFidelity3dZoom);
      if(Number.isFinite(x)&&Number.isFinite(y)) rotationRef.current={x,y};
      if(Number.isFinite(zoom)&&zoom>0) zoomRef.current=zoom;
    };

    const paint=()=>{
      frameRef.current=null;
      if(stage.dataset.abagsPhotoTrue==="active"||stage.dataset.abagsFinal3d!=="ready"){clear();return;}
      const renderer=rendererRef.current;
      if(!renderer) return;
      syncTransform();
      const config=readConfig(stage);
      if(!config.family){clear();return;}
      try{
        draw(renderer,canvas,config,rotationRef.current,zoomRef.current);
        stage.dataset.abagsAgataCordWebgl=SURFACE_VERSION;
        stage.removeAttribute("data-abags-agata-cord-webgl-error");
      }catch(error){
        stage.dataset.abagsAgataCordWebglError=error instanceof Error?error.message.slice(0,180):"draw-failed";
        clear();
      }
    };

    const schedule=()=>{
      if(frameRef.current!==null) cancelAnimationFrame(frameRef.current);
      frameRef.current=requestAnimationFrame(paint);
    };

    const onTransform=(event:Event)=>{
      const detail=(event as CustomEvent<TransformDetail>).detail;
      if(detail?.rotation) rotationRef.current=detail.rotation;
      if(typeof detail?.zoom==="number"&&detail.zoom>0) zoomRef.current=detail.zoom;
      schedule();
    };

    const observer=new MutationObserver(schedule);
    observer.observe(stage,{attributes:true,attributeFilter:[
      "data-family","data-color","data-stitch","data-flap","data-handles","data-hardware",
      "data-abags-final3d","data-abags-photo-true","data-abags-fidelity3d-frame-at",
      "data-abags-fidelity3d-rotation-x","data-abags-fidelity3d-rotation-y","data-abags-fidelity3d-zoom",
    ]});
    const resizeObserver=typeof ResizeObserver!=="undefined"?new ResizeObserver(schedule):null;
    resizeObserver?.observe(layer);
    stage.addEventListener("abags:fidelity3d-transform",onTransform as EventListener);
    window.addEventListener("resize",schedule);
    schedule();

    return()=>{
      observer.disconnect();resizeObserver?.disconnect();
      stage.removeEventListener("abags:fidelity3d-transform",onTransform as EventListener);
      window.removeEventListener("resize",schedule);
      if(frameRef.current!==null) cancelAnimationFrame(frameRef.current);
      frameRef.current=null;
      stage.removeAttribute("data-abags-agata-cord-webgl");
      stage.removeAttribute("data-abags-agata-cord-webgl-error");
      rendererRef.current=null;
    };
  },[layer]);

  if(!layer) return null;
  return createPortal(
    <canvas ref={canvasRef} className="abags-agata-cord-webgl" data-agata-cord-version={SURFACE_VERSION} aria-hidden="true" />,
    layer,
  );
}
