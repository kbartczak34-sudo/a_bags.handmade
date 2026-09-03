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

type Mesh = { position: WebGLBuffer; normal: WebGLBuffer; uv: WebGLBuffer; index: WebGLBuffer; count: number };
type Renderer = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  meshes: Record<string, Mesh>;
  attribs: { position: number; normal: number; uv: number };
  uniforms: Record<"projection" | "view" | "model" | "color" | "material" | "stitch" | "relief" | "light", WebGLUniformLocation>;
};

const EMPTY: BuilderConfig = { family: "", color: "", stitch: "", flap: "none", handles: "none", strap: "none", hardware: "gold", accent: "none" };

function readConfig(stage: HTMLElement): BuilderConfig {
  return {
    family: (stage.dataset.family ?? "") as BuilderConfig["family"], color: stage.dataset.color ?? "", stitch: (stage.dataset.stitch ?? "") as BuilderConfig["stitch"],
    flap: (stage.dataset.flap ?? "none") as BuilderConfig["flap"], handles: (stage.dataset.handles ?? "none") as BuilderConfig["handles"],
    strap: (stage.dataset.strap ?? "none") as BuilderConfig["strap"], hardware: (stage.dataset.hardware ?? "gold") as BuilderConfig["hardware"], accent: (stage.dataset.accent ?? "none") as BuilderConfig["accent"],
  };
}
function sameConfig(a: BuilderConfig, b: BuilderConfig) { return Object.keys(a).every((key) => a[key as keyof BuilderConfig] === b[key as keyof BuilderConfig]); }
function hex(value: string): [number, number, number] { const raw = value.replace("#", "").padEnd(6, "0").slice(0, 6); const n = Number.parseInt(raw || "e8ddcc", 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
function identity() { return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]); }
function multiply(a: Float32Array, b: Float32Array) { const o = new Float32Array(16); for (let c=0;c<4;c+=1) for (let r=0;r<4;r+=1) o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3]; return o; }
function translation(x:number,y:number,z:number){const o=identity();o[12]=x;o[13]=y;o[14]=z;return o;}
function scale(x:number,y:number,z:number){const o=identity();o[0]=x;o[5]=y;o[10]=z;return o;}
function rotX(a:number){const o=identity(),c=Math.cos(a),s=Math.sin(a);o[5]=c;o[6]=s;o[9]=-s;o[10]=c;return o;}
function rotY(a:number){const o=identity(),c=Math.cos(a),s=Math.sin(a);o[0]=c;o[2]=-s;o[8]=s;o[10]=c;return o;}
function rotZ(a:number){const o=identity(),c=Math.cos(a),s=Math.sin(a);o[0]=c;o[1]=s;o[4]=-s;o[5]=c;return o;}
function matrix(p:[number,number,number],s:[number,number,number],r:[number,number,number]=[0,0,0]){return multiply(translation(...p),multiply(rotZ(r[2]),multiply(rotY(r[1]),multiply(rotX(r[0]),scale(...s)))));}
function perspective(fov:number,aspect:number,near:number,far:number){const f=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=f/aspect;o[5]=f;o[10]=(far+near)/(near-far);o[11]=-1;o[14]=(2*far*near)/(near-far);return o;}
function normalize(x:number,y:number,z:number):[number,number,number]{const l=Math.hypot(x,y,z)||1;return[x/l,y/l,z/l];}

function makeBagShell(width:number,height:number,depth:number,shape:"tote"|"round"|"bucket"|"mini", rows=54, columns=96){
  const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[];
  const power=shape==="round"?1.7:shape==="bucket"?3.5:shape==="mini"?3.1:4.4;
  for(let row=0;row<=rows;row+=1){
    const v=row/rows; const y=-height+2*height*v;
    const bottomRound=.84+.16*Math.sin(Math.PI*Math.min(v/.26,1)/2);
    const topTaper=1-(shape==="bucket"?.14:shape==="mini"?.06:.035)*Math.max(0,(v-.62)/.38);
    const roundBoost=shape==="round"?.78+.22*Math.sin(Math.PI*v):1;
    const w=width*bottomRound*topTaper*roundBoost;
    const d=depth*(.9+.1*Math.sin(Math.PI*v));
    for(let col=0;col<=columns;col+=1){
      const u=col/columns, a=u*Math.PI*2-Math.PI;
      const ca=Math.cos(a),sa=Math.sin(a);
      const x=w*Math.sign(ca)*Math.pow(Math.abs(ca),2/power);
      const z=d*Math.sign(sa)*Math.pow(Math.abs(sa),2/power);
      positions.push(x,y,z);
      const [nx,,nz]=normalize(x/(w*w),0,z/(d*d));
      const ny=(v<.18?-.11:0)+(v>.72?.05:0);
      const n=normalize(nx,ny,nz); normals.push(...n); uvs.push(u,v);
    }
  }
  const stride=columns+1; for(let r=0;r<rows;r+=1)for(let c=0;c<columns;c+=1){const a=r*stride+c,b=a+stride;indices.push(a,b,a+1,b,b+1,a+1);} return{positions,normals,uvs,indices};
}

function makeOvalTube(rx:number,rz:number,minor=.055,major=72,tube=12){const p:number[]=[],n:number[]=[],uv:number[]=[],idx:number[]=[];for(let i=0;i<=major;i+=1){const u=i/major*Math.PI*2,cu=Math.cos(u),su=Math.sin(u);for(let j=0;j<=tube;j+=1){const v=j/tube*Math.PI*2,cv=Math.cos(v),sv=Math.sin(v);const nx=cu*cv,nz=su*cv,ny=sv;p.push(rx*cu+minor*nx,minor*ny,rz*su+minor*nz);n.push(...normalize(nx,ny,nz));uv.push(i/major,j/tube);}}const s=tube+1;for(let i=0;i<major;i+=1)for(let j=0;j<tube;j+=1){const a=i*s+j,b=(i+1)*s+j;idx.push(a,b,a+1,b,b+1,a+1);}return{positions:p,normals:n,uvs:uv,indices:idx};}
function makeArchTube(rx:number,ry:number,z:number,minor=.055,segments=56,tube=10){const p:number[]=[],n:number[]=[],uv:number[]=[],idx:number[]=[];for(let i=0;i<=segments;i+=1){const t=Math.PI-i/segments*Math.PI;const cx=rx*Math.cos(t),cy=ry*Math.sin(t);const tx=-rx*Math.sin(t),ty=ry*Math.cos(t);const tl=Math.hypot(tx,ty)||1;const ux=tx/tl,uy=ty/tl;for(let j=0;j<=tube;j+=1){const a=j/tube*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a);const nx=-uy*ca,nY=ux*ca,nz=sa;p.push(cx+minor*nx,cy+minor*nY,z+minor*nz);n.push(...normalize(nx,nY,nz));uv.push(i/segments,j/tube);}}const s=tube+1;for(let i=0;i<segments;i+=1)for(let j=0;j<tube;j+=1){const a=i*s+j,b=(i+1)*s+j;idx.push(a,b,a+1,b,b+1,a+1);}return{positions:p,normals:n,uvs:uv,indices:idx};}
function makeEllipsoid(a:number,b:number,c:number,rows=28,cols=42){const p:number[]=[],n:number[]=[],uv:number[]=[],idx:number[]=[];for(let r=0;r<=rows;r+=1){const t=-Math.PI/2+Math.PI*r/rows;for(let k=0;k<=cols;k+=1){const ph=-Math.PI+Math.PI*2*k/cols,x=a*Math.cos(t)*Math.cos(ph),y=b*Math.sin(t),z=c*Math.cos(t)*Math.sin(ph);p.push(x,y,z);n.push(...normalize(x/(a*a),y/(b*b),z/(c*c)));uv.push(k/cols,1-r/rows);}}const s=cols+1;for(let r=0;r<rows;r+=1)for(let c0=0;c0<cols;c0+=1){const a0=r*s+c0,b0=a0+s;idx.push(a0,b0,a0+1,b0,b0+1,a0+1);}return{positions:p,normals:n,uvs:uv,indices:idx};}
function makeCone(radius=.16,height=.64,segments=28){const p=[0,height/2,0],n=[0,1,0],uv=[.5,1],idx:number[]=[];for(let i=0;i<=segments;i+=1){const a=i/segments*Math.PI*2,x=Math.cos(a)*radius,z=Math.sin(a)*radius;p.push(x,-height/2,z);n.push(...normalize(x,radius/height,z));uv.push(i/segments,0);if(i<segments)idx.push(0,i+1,i+2);}return{positions:p,normals:n,uvs:uv,indices:idx};}

const VERTEX=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec2 aUv;uniform mat4 uProjection,uView,uModel;uniform float uRelief,uStitch;varying vec3 vNormal,vWorld;varying vec2 vUv;float stitch(vec2 uv,float m){if(m<.5)return sin((uv.x*1.2+uv.y*.72)*110.0)*.55+sin((uv.x*.6-uv.y)*55.0)*.25;if(m<1.5){vec2 p=fract(uv*vec2(20.0,18.0));return .8-smoothstep(.06,.28,min(abs(p.x-p.y),abs(1.0-p.x-p.y)));}if(m<2.5){vec2 p=fract(uv*18.0);return max(1.0-smoothstep(.12,.34,abs(p.x-.5)),1.0-smoothstep(.12,.34,abs(p.y-.5)));}return sin(uv.x*72.0+sin(uv.y*36.0)*2.8)*.55+sin(uv.y*44.0)*.2;}void main(){float h=stitch(aUv,uStitch)*uRelief;vec3 pos=aPosition+aNormal*h;vec4 world=uModel*vec4(pos,1.0);vWorld=world.xyz;vNormal=normalize(mat3(uModel)*aNormal);vUv=aUv;gl_Position=uProjection*uView*world;}`;
const FRAGMENT=`precision mediump float;varying vec3 vNormal,vWorld;varying vec2 vUv;uniform vec3 uColor,uLight;uniform float uMaterial,uStitch;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float yarn(vec2 uv,float m){float a;if(m<.5)a=.58+.24*sin((uv.x*1.2+uv.y*.72)*110.0)+.1*sin(uv.x*214.0);else if(m<1.5){vec2 p=fract(uv*vec2(20.0,18.0));a=.42+.48*(1.0-smoothstep(.07,.25,min(abs(p.x-p.y),abs(1.0-p.x-p.y))));}else if(m<2.5){vec2 p=fract(uv*18.0);float gx=1.0-smoothstep(.14,.34,abs(p.x-.5)),gy=1.0-smoothstep(.14,.34,abs(p.y-.5));a=.38+.45*max(gx,gy);}else a=.52+.28*sin(uv.x*72.0+sin(uv.y*36.0)*2.8)+.1*sin(uv.y*44.0);return clamp(a,0.08,1.0);}void main(){vec3 n=normalize(vNormal),l=normalize(uLight),v=normalize(vec3(0.0,0.0,4.8)-vWorld),h=normalize(l+v);float ndl=max(dot(n,l),0.0),ndh=max(dot(n,h),0.0);float rough=.92,metal=0.0,detail=1.0;if(uMaterial<.5){detail=.72+.42*yarn(vUv,uStitch)+.04*(hash(floor(vUv*vec2(180.0,160.0)))-.5);rough=.94;}else if(uMaterial<1.5){detail=.88+.08*sin(vUv.y*120.0+sin(vUv.x*18.0)*4.0);rough=.42;}else if(uMaterial<2.5){detail=.9+.1*sin(vUv.x*38.0+sin(vUv.y*7.0)*3.0)+.04*(hash(floor(vUv*90.0))-.5);rough=.55;}else if(uMaterial<3.5){detail=.72+.28*sin(vUv.x*68.0)*sin(vUv.y*34.0);rough=.78;}else{metal=.95;rough=.14;detail=1.0;}vec3 base=uColor*detail;float spec=pow(ndh,mix(80.0,10.0,rough))*mix(.08,.72,metal);float rim=pow(1.0-max(dot(n,v),0.0),2.4);vec3 color=base*(.33+.78*ndl)+vec3(spec)+vec3(.07)*rim;color+=base*.08*(1.0-ndl);gl_FragColor=vec4(pow(color,vec3(.95)),1.0);}`;

function compile(gl:WebGLRenderingContext,type:number,source:string){const s=gl.createShader(type);if(!s)throw new Error("shader");gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)??"shader");return s;}
function createMesh(gl:WebGLRenderingContext,data:{positions:number[];normals:number[];uvs:number[];indices:number[]}):Mesh{const position=gl.createBuffer(),normal=gl.createBuffer(),uv=gl.createBuffer(),index=gl.createBuffer();if(!position||!normal||!uv||!index)throw new Error("buffer");gl.bindBuffer(gl.ARRAY_BUFFER,position);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.positions),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,normal);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.normals),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,uv);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.uvs),gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(data.indices),gl.STATIC_DRAW);return{position,normal,uv,index,count:data.indices.length};}
function init(canvas:HTMLCanvasElement):Renderer|null{const gl=canvas.getContext("webgl",{antialias:true,alpha:true,premultipliedAlpha:false});if(!gl)return null;const program=gl.createProgram();if(!program)return null;gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)??"link");gl.useProgram(program);const req=(n:string)=>{const l=gl.getUniformLocation(program,n);if(!l)throw new Error(n);return l;};return{gl,program,meshes:{tote:createMesh(gl,makeBagShell(1.14,1.08,.33,"tote")),round:createMesh(gl,makeBagShell(1.16,.94,.36,"round")),bucket:createMesh(gl,makeBagShell(1.02,1.18,.35,"bucket")),mini:createMesh(gl,makeBagShell(.88,.92,.29,"mini")),rim:createMesh(gl,makeOvalTube(1,.3,.055)),handle:createMesh(gl,makeArchTube(.82,.82,.0,.065)),strap:createMesh(gl,makeArchTube(1.18,1.7,0,.045)),chain:createMesh(gl,makeArchTube(1.18,1.7,0,.028)),flap:createMesh(gl,makeEllipsoid(1,.48,.09)),sphere:createMesh(gl,makeEllipsoid(1,1,1,20,30)),ribbon:createMesh(gl,makeEllipsoid(.46,.12,.035,16,28)),cone:createMesh(gl,makeCone())},attribs:{position:gl.getAttribLocation(program,"aPosition"),normal:gl.getAttribLocation(program,"aNormal"),uv:gl.getAttribLocation(program,"aUv")},uniforms:{projection:req("uProjection"),view:req("uView"),model:req("uModel"),color:req("uColor"),material:req("uMaterial"),stitch:req("uStitch"),relief:req("uRelief"),light:req("uLight")}};}
function drawMesh(r:Renderer,m:Mesh,model:Float32Array,color:string,material:number,stitch:number,relief=0){const{gl,attribs,uniforms}=r;gl.bindBuffer(gl.ARRAY_BUFFER,m.position);gl.enableVertexAttribArray(attribs.position);gl.vertexAttribPointer(attribs.position,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.normal);gl.enableVertexAttribArray(attribs.normal);gl.vertexAttribPointer(attribs.normal,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.uv);gl.enableVertexAttribArray(attribs.uv);gl.vertexAttribPointer(attribs.uv,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.index);gl.uniformMatrix4fv(uniforms.model,false,model);gl.uniform3fv(uniforms.color,hex(color));gl.uniform1f(uniforms.material,material);gl.uniform1f(uniforms.stitch,stitch);gl.uniform1f(uniforms.relief,relief);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0);}
function stitchId(s:BuilderConfig["stitch"]){return s==="herringbone"?1:s==="basket"?2:s==="shell"?3:0;}
function draw(r:Renderer,canvas:HTMLCanvasElement,c:BuilderConfig,rotation:{x:number;y:number},zoom:number){const{gl,uniforms,meshes}=r,ratio=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.floor(canvas.clientWidth*ratio)),h=Math.max(1,Math.floor(canvas.clientHeight*ratio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.uniformMatrix4fv(uniforms.projection,false,perspective(Math.PI/4.4,w/h,.1,100));gl.uniformMatrix4fv(uniforms.view,false,translation(0,0,-5.15));gl.uniform3fv(uniforms.light,new Float32Array([.38,.78,.82]));if(!c.family)return;const root=multiply(scale(zoom,zoom,zoom),multiply(rotX(rotation.x),rotY(rotation.y))),body=c.color||"#e8ddcc",st=stitchId(c.stitch),relief=c.color&&c.stitch?.028:0,mesh=meshes[c.family];drawMesh(r,mesh,multiply(root,matrix([0,-.12,0],[1,1,1])),body,0,st,relief);
  const dims=c.family==="mini"?[.76,.27,.91]:c.family==="round"?[1.02,.31,.82]:c.family==="bucket"?[.9,.31,1.05]:[1.02,.3,.96];drawMesh(r,meshes.rim,multiply(root,matrix([0,dims[2],0],[dims[0],1,dims[1]],[0,0,0])),body,0,st,.012);
  if(c.handles!=="none"){const hc=c.handles==="wood-light"?"#c99a62":c.handles==="wood-dark"?"#5c2d1d":body,mat=c.handles.startsWith("wood")?1:0;drawMesh(r,meshes.handle,multiply(root,matrix([0,dims[2]-.02,.02],[c.family==="mini"?.8:1,1,1])),hc,mat,st,c.handles==="crochet"?.018:0);}
  if(c.strap!=="none"){const sc=c.strap==="chain"?(c.hardware==="silver"?"#d2d6dc":c.hardware==="black"?"#242225":"#c9a45b"):c.strap==="leather"?"#6a493c":"#9b7080",mat=c.strap==="chain"?4:c.strap==="leather"?2:3;drawMesh(r,c.strap==="chain"?meshes.chain:meshes.strap,multiply(root,matrix([0,-.1,-.12],[1,1,1])),sc,mat,st,0);}
  if(c.flap!=="none"){const fc=c.flap==="leather-black"?"#242124":c.flap==="leather-cognac"?"#7b4f34":c.flap==="suede-burgundy"?"#7f3043":body,mat=c.flap==="crochet"?0:2;drawMesh(r,meshes.flap,multiply(root,matrix([0,.48,.37],[c.family==="mini"?.78:1.02,c.family==="round"?.82:.74,.72],[.08,0,0])),fc,mat,st,c.flap==="crochet"?.018:0);}
  const metal=c.hardware==="silver"?"#d4d8de":c.hardware==="black"?"#29272a":"#c9a45b";drawMesh(r,meshes.sphere,multiply(root,matrix([0,c.flap!=="none"?.34:-.58,.47],[.105,.105,.075])),metal,4,0,0);
  if(c.accent==="tassel")drawMesh(r,meshes.cone,multiply(root,matrix([-1.05,-.08,.27],[.92,1,.92],[0,0,-.08])),body,0,st,.01);else if(c.accent==="scarf"){drawMesh(r,meshes.ribbon,multiply(root,matrix([-.88,.3,.34],[.86,1,1],[0,0,.56])),"#e3a0b0",3,0,0);drawMesh(r,meshes.ribbon,multiply(root,matrix([-.75,.2,.37],[.78,1,1],[0,0,-.5])),"#c66f87",3,0,0);}else if(c.accent==="charm")drawMesh(r,meshes.sphere,multiply(root,matrix([1.02,-.08,.35],[.11,.16,.07])),"#b87880",4,0,0);
}

export default function BagBuilderReal3D(){
  const[stage,setStage]=useState<HTMLElement|null>(null),[config,setConfig]=useState<BuilderConfig>(EMPTY),[rotation,setRotation]=useState({x:-.12,y:.32}),[zoom,setZoom]=useState(1),[ready,setReady]=useState(false);const canvasRef=useRef<HTMLCanvasElement|null>(null),rendererRef=useRef<Renderer|null>(null),pointerRef=useRef<{id:number;x:number;y:number;rx:number;ry:number}|null>(null);
  useEffect(()=>{const attach=()=>{const next=document.querySelector<HTMLElement>(".abags-bag-builder-stage");setStage((current)=>current===next?current:next);};attach();const o=new MutationObserver(attach);o.observe(document.body,{childList:true,subtree:true});return()=>o.disconnect();},[]);
  useEffect(()=>{if(!stage)return;const sync=()=>setConfig((current)=>{const next=readConfig(stage);return sameConfig(current,next)?current:next;});sync();const o=new MutationObserver(sync);o.observe(stage,{attributes:true,attributeFilter:["data-family","data-color","data-stitch","data-flap","data-handles","data-strap","data-hardware","data-accent"]});return()=>o.disconnect();},[stage]);
  useEffect(()=>{const canvas=canvasRef.current;if(!canvas||rendererRef.current)return;try{rendererRef.current=init(canvas);if(rendererRef.current){setReady(true);stage?.classList.add("abags-real3d-active");stage?.setAttribute("data-abags-real3d-ready","true");}}catch{rendererRef.current=null;setReady(false);}return()=>{stage?.classList.remove("abags-real3d-active");stage?.removeAttribute("data-abags-real3d-ready");};},[stage]);
  useEffect(()=>{const r=rendererRef.current,canvas=canvasRef.current;if(!r||!canvas)return;let frame=requestAnimationFrame(()=>draw(r,canvas,config,rotation,zoom));const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>draw(r,canvas,config,rotation,zoom));};window.addEventListener("resize",resize);return()=>{cancelAnimationFrame(frame);window.removeEventListener("resize",resize);};},[config,rotation,zoom,ready]);
  const label=useMemo(()=>config.family?"Realistyczny model 3D tworzonej torebki":"Wybierz fason, aby rozpocząć model 3D",[config.family]);if(!stage)return null;
  return createPortal(<div className="abags-real3d-layer" data-abags-real3d><canvas ref={canvasRef} className="abags-real3d-canvas" aria-label={label} onPointerDown={(e)=>{pointerRef.current={id:e.pointerId,x:e.clientX,y:e.clientY,rx:rotation.x,ry:rotation.y};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={(e)=>{const p=pointerRef.current;if(!p||p.id!==e.pointerId)return;setRotation({x:Math.max(-.72,Math.min(.62,p.rx+(e.clientY-p.y)*.008)),y:p.ry+(e.clientX-p.x)*.01});}} onPointerUp={(e)=>{if(pointerRef.current?.id===e.pointerId)pointerRef.current=null;}} onPointerCancel={()=>{pointerRef.current=null;}} onWheel={(e)=>{e.preventDefault();setZoom((v)=>Math.max(.82,Math.min(1.23,v-e.deltaY*.0008)));}}/><div className="abags-real3d-chip">REAL 3D · SZNUREK + MATERIAŁY</div><div className="abags-real3d-controls"><button type="button" onClick={()=>setRotation({x:0,y:0})}>Przód</button><button type="button" onClick={()=>setRotation({x:-.14,y:.55})}>3D</button><button type="button" onClick={()=>setRotation({x:-.28,y:1.2})}>Bok</button><button type="button" onClick={()=>setZoom((v)=>Math.min(1.23,v+.08))}>＋</button><button type="button" onClick={()=>setZoom((v)=>Math.max(.82,v-.08))}>−</button></div><p className="abags-real3d-hint">Przeciągnij palcem — zobacz bryłę, głębokość, splot i materiały z każdej strony.</p></div>,stage);
}
