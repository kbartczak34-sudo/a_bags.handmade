"use client";

import { useEffect } from "react";

type Cfg = {
  family: string; color: string; stitch: string; flap: string;
  handles: string; strap: string; hardware: string; accent: string;
};

type Mesh = { pos: WebGLBuffer; norm: WebGLBuffer; uv: WebGLBuffer; idx: WebGLBuffer; count: number };
type R = {
  gl: WebGLRenderingContext; program: WebGLProgram; meshes: Record<string, Mesh>;
  aPos: number; aNorm: number; aUv: number;
  uProj: WebGLUniformLocation; uView: WebGLUniformLocation; uModel: WebGLUniformLocation;
  uColor: WebGLUniformLocation; uStitch: WebGLUniformLocation; uMaterial: WebGLUniformLocation;
  uLight: WebGLUniformLocation; uTime: WebGLUniformLocation; uRough: WebGLUniformLocation;
};

const VERT = `
attribute vec3 aPos; attribute vec3 aNorm; attribute vec2 aUv;
uniform mat4 uProj,uView,uModel; uniform float uStitch,uTime;
varying vec3 vN,vW; varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float stitch(vec2 uv,float s){
  vec2 p=uv;
  if(s<.5){p*=vec2(16.0,18.0); vec2 q=fract(p); float d=min(abs(q.x-(.5-.48*abs(q.y-.5))),abs(q.x-(.5+.48*abs(q.y-.5)))); return 1.0-smoothstep(.055,.14,d);}
  if(s<1.5){p*=vec2(19.0,11.0); vec2 q=fract(p); float d=min(abs(q.x-.5),abs(q.y-.5)); return 1.0-smoothstep(.055,.13,d);}
  if(s<2.5){p*=vec2(11.0,11.0); vec2 q=fract(p); float d=min(min(abs(q.x-.22),abs(q.x-.78)),min(abs(q.y-.22),abs(q.y-.78))); return 1.0-smoothstep(.065,.15,d);}
  p*=vec2(9.0,8.0); vec2 q=fract(p); vec2 c=q-.5; float r=length(vec2(c.x*1.18,c.y)); return 1.0-smoothstep(.075,.17,abs(r-.34));
}
void main(){float relief=stitch(aUv,uStitch)*.020;float fibre=(hash(floor(aUv*vec2(240.0,220.0)))-.5)*.002;vec3 p=aPos+aNorm*(relief+fibre);vec4 w=uModel*vec4(p,1.0);vW=w.xyz;vN=normalize(mat3(uModel)*aNorm);vUv=aUv;gl_Position=uProj*uView*w;}`;

const FRAG = `
precision highp float; varying vec3 vN,vW; varying vec2 vUv;
uniform vec3 uColor,uLight; uniform float uStitch,uMaterial,uTime,uRough;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float stitch(vec2 uv,float s){if(s<.5){vec2 q=fract(uv*vec2(16.0,18.0));float d=min(abs(q.x-(.5-.48*abs(q.y-.5))),abs(q.x-(.5+.48*abs(q.y-.5))));return 1.0-smoothstep(.045,.16,d);}if(s<1.5){vec2 q=fract(uv*vec2(19.0,11.0));return 1.0-smoothstep(.05,.15,min(abs(q.x-.5),abs(q.y-.5)));}if(s<2.5){vec2 q=fract(uv*vec2(11.0));float d=min(min(abs(q.x-.22),abs(q.x-.78)),min(abs(q.y-.22),abs(q.y-.78)));return 1.0-smoothstep(.05,.16,d);}vec2 q=fract(uv*vec2(9.0,8.0))-.5;float r=length(vec2(q.x*1.18,q.y));return 1.0-smoothstep(.06,.17,abs(r-.34));}
void main(){vec3 n=normalize(vN),l=normalize(uLight),v=normalize(vec3(0.0,.12,5.8)-vW),h=normalize(l+v);float s=stitch(vUv,uStitch);float grain=noise(vUv*220.0),fibres=noise(vUv*680.0);float ndl=max(dot(n,l),0.0),ndh=max(dot(n,h),0.0),fres=pow(1.0-max(dot(n,v),0.0),4.0);vec3 base=uColor;if(uMaterial<.5){float yarn=.90+.075*sin(vUv.x*410.0+vUv.y*97.0)+.035*sin(vUv.x*930.0-vUv.y*270.0);base*=yarn*(.82+.18*s);base*=.94+.10*(grain-.5)+.045*(fibres-.5);}else if(uMaterial<1.5){base*=.90+.12*grain;}else if(uMaterial<2.5){base*=.94+.06*grain;}else{base*=.96+.08*grain;}float rough=mix(.96,.22,step(2.5,uMaterial));rough=mix(rough,uRough,.35);float spec=pow(ndh,mix(92.0,12.0,rough))*(uMaterial>2.5?.68:.14);float softAO=.78+.22*max(n.y,0.0);vec3 lit=base*(.26+.76*ndl+.16*softAO)+vec3(spec)+base*fres*.055;lit+=base*vec3(.055,.038,.035)*(1.0-ndl);gl_FragColor=vec4(pow(max(lit,vec3(0.0)),vec3(.96)),1.0);}`;

function hex(s:string){const n=parseInt((s||"#e8ddcc").replace("#","").padEnd(6,"0").slice(0,6),16)||0xe8ddcc;return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];}
function ident(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
function mul(a:Float32Array,b:Float32Array){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function trans(x:number,y:number,z:number){const o=ident();o[12]=x;o[13]=y;o[14]=z;return o;}
function scale(x:number,y:number,z:number){const o=ident();o[0]=x;o[5]=y;o[10]=z;return o;}
function rx(a:number){const o=ident(),c=Math.cos(a),s=Math.sin(a);o[5]=c;o[6]=s;o[9]=-s;o[10]=c;return o;}
function ry(a:number){const o=ident(),c=Math.cos(a),s=Math.sin(a);o[0]=c;o[2]=-s;o[8]=s;o[10]=c;return o;}
function mat(p:[number,number,number],s:[number,number,number],r:[number,number,number]=[0,0,0]){return mul(trans(...p),mul(ry(r[1]),mul(rx(r[0]),scale(...s))));}
function persp(fov:number,aspect:number,n:number,f:number){const q=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=q/aspect;o[5]=q;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o;}
function norm(x:number,y:number,z:number){const l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l] as [number,number,number];}
function shell(w:number,h:number,d:number,shape:string){const rows=70,cols=120,pos:number[]=[],nor:number[]=[],uv:number[]=[],idx:number[]=[];const power=shape==="round"?1.72:shape==="bucket"?3.1:shape==="mini"?3.5:4.7;for(let r=0;r<=rows;r++){const v=r/rows,y=-h+2*h*v,bottom=.84+.16*Math.sin(Math.min(1,v/.24)*Math.PI/2),taper=1-(shape==="bucket"?.16:shape==="mini"?.08:.025)*Math.max(0,(v-.60)/.40),round=shape==="round"?.76+.24*Math.sin(Math.PI*v):1,ww=w*bottom*taper*round,dd=d*(.92+.08*Math.sin(Math.PI*v));for(let c=0;c<=cols;c++){const u=c/cols,a=u*Math.PI*2-Math.PI,ca=Math.cos(a),sa=Math.sin(a),x=ww*Math.sign(ca)*Math.pow(Math.abs(ca),2/power),z=dd*Math.sign(sa)*Math.pow(Math.abs(sa),2/power);pos.push(x,y,z);nor.push(...norm(x/(ww*ww),.10*Math.sin(Math.PI*v),z/(dd*dd)));uv.push(u,v);}}const st=cols+1;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const a=r*st+c,b=a+st;idx.push(a,b,a+1,b,b+1,a+1);}return{positions:pos,normals:nor,uvs:uv,indices:idx};}
function tube(rx:number,ry:number,z:number,minor=.06,segments=80,rings=14){const p:number[]=[],n:number[]=[],u:number[]=[],i:number[]=[];for(let a=0;a<=segments;a++){const t=Math.PI-(a/segments)*Math.PI,c=Math.cos(t),s=Math.sin(t),cx=rx*c,cy=ry*s,tx=-rx*s,ty=ry*c,tl=Math.hypot(tx,ty)||1,ux=tx/tl,uy=ty/tl;for(let b=0;b<=rings;b++){const q=(b/rings)*Math.PI*2,cc=Math.cos(q),ss=Math.sin(q),nx=-uy*cc,ny=ux*cc,nz=ss;p.push(cx+minor*nx,cy+minor*ny,z+minor*nz);n.push(...norm(nx,ny,nz));u.push(a/segments,b/rings);}}const st=rings+1;for(let a=0;a<segments;a++)for(let b=0;b<rings;b++){const x=a*st+b,y=x+st;i.push(x,y,x+1,y,y+1,x+1);}return{positions:p,normals:n,uvs:u,indices:i};}
function ell(a:number,b:number,c:number){const rows=30,cols=52,p:number[]=[],n:number[]=[],u:number[]=[],i:number[]=[];for(let r=0;r<=rows;r++){const t=-Math.PI/2+Math.PI*r/rows;for(let k=0;k<=cols;k++){const ph=-Math.PI+2*Math.PI*k/cols,x=a*Math.cos(t)*Math.cos(ph),y=b*Math.sin(t),z=c*Math.cos(t)*Math.sin(ph);p.push(x,y,z);n.push(...norm(x/(a*a),y/(b*b),z/(c*c)));u.push(k/cols,1-r/rows);}}const st=cols+1;for(let r=0;r<rows;r++)for(let c0=0;c0<cols;c0++){const a0=r*st+c0,b0=a0+st;i.push(a0,b0,a0+1,b0,b0+1,a0+1);}return{positions:p,normals:n,uvs:u,indices:i};}
function compile(gl:WebGLRenderingContext,t:number,s:string){const sh=gl.createShader(t);if(!sh)throw new Error("shader");gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh)||"shader");return sh;}
function mesh(gl:WebGLRenderingContext,d:{positions:number[];normals:number[];uvs:number[];indices:number[]}):Mesh{const pos=gl.createBuffer(),normb=gl.createBuffer(),uv=gl.createBuffer(),idx=gl.createBuffer();if(!pos||!normb||!uv||!idx)throw new Error("buffer");gl.bindBuffer(gl.ARRAY_BUFFER,pos);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(d.positions),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,normb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(d.normals),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,uv);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(d.uvs),gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,idx);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(d.indices),gl.STATIC_DRAW);return{pos,norm:normb,uv,idx,count:d.indices.length};}
function init(canvas:HTMLCanvasElement):R|null{const gl=canvas.getContext("webgl",{antialias:true,alpha:true,premultipliedAlpha:false});if(!gl)return null;const p=gl.createProgram();if(!p)return null;gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,VERT));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||"link");const req=(n:string)=>gl.getUniformLocation(p,n);const locations={uProj:req("uProj"),uView:req("uView"),uModel:req("uModel"),uColor:req("uColor"),uStitch:req("uStitch"),uMaterial:req("uMaterial"),uLight:req("uLight"),uTime:req("uTime"),uRough:req("uRough")};if(Object.values(locations).some((v):v is null=>v===null))return null;return{gl,program:p,meshes:{tote:mesh(gl,shell(1.16,1.08,.48,"tote")),round:mesh(gl,shell(1.13,.94,.50,"round")),bucket:mesh(gl,shell(1.02,1.16,.49,"bucket")),mini:mesh(gl,shell(.88,.90,.42,"mini")),handle:mesh(gl,tube(.84,.83,0,.064)),strap:mesh(gl,tube(1.18,1.72,0,.046)),flap:mesh(gl,ell(1,.52,.10))},aPos:gl.getAttribLocation(p,"aPos"),aNorm:gl.getAttribLocation(p,"aNorm"),aUv:gl.getAttribLocation(p,"aUv"),uProj:locations.uProj!,uView:locations.uView!,uModel:locations.uModel!,uColor:locations.uColor!,uStitch:locations.uStitch!,uMaterial:locations.uMaterial!,uLight:locations.uLight!,uTime:locations.uTime!,uRough:locations.uRough!};}
function draw(r:R,m:Mesh,model:Float32Array,color:string,material:number,stitchId:number,rough=.9){const {gl}=r;gl.bindBuffer(gl.ARRAY_BUFFER,m.pos);gl.enableVertexAttribArray(r.aPos);gl.vertexAttribPointer(r.aPos,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.norm);gl.enableVertexAttribArray(r.aNorm);gl.vertexAttribPointer(r.aNorm,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.uv);gl.enableVertexAttribArray(r.aUv);gl.vertexAttribPointer(r.aUv,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.idx);gl.uniformMatrix4fv(r.uModel,false,model);gl.uniform3fv(r.uColor,hex(color));gl.uniform1f(r.uMaterial,material);gl.uniform1f(r.uStitch,stitchId);gl.uniform1f(r.uRough,rough);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0);}
function read(stage:HTMLElement):Cfg{return{family:stage.dataset.family||"mini",color:stage.dataset.color||"#24324d",stitch:stage.dataset.stitch||"classic",flap:stage.dataset.flap||"none",handles:stage.dataset.handles||"crochet",strap:stage.dataset.strap||"none",hardware:stage.dataset.hardware||"gold",accent:stage.dataset.accent||"none"};}
function stitchId(s:string){return s==="herringbone"?1:s==="basket"?2:s==="shell"?3:0;}

export default function BagBuilderPhotorealV2(){
  useEffect(()=>{
    let disposed=false; let cleanup:()=>void=()=>{};
    const attach=()=>{
      const stage=document.querySelector<HTMLElement>(".abags-vc-dialog.abags-vc-builder-active .abags-bag-builder-stage");
      if(!stage||stage.dataset.abagsPhotoRealV2==="true")return;
      stage.dataset.abagsPhotoRealV2="true";
      const originalPosition=stage.style.position;
      stage.style.position="relative";
      const canvas=document.createElement("canvas");canvas.className="abags-photoreal-v2-canvas";Object.assign(canvas.style,{position:"absolute",inset:"0",width:"100%",height:"100%",zIndex:"12",display:"block",pointerEvents:"auto"});stage.appendChild(canvas);
      stage.querySelectorAll<HTMLElement>("svg,.abags-bag-builder-canvas,canvas:not(.abags-photoreal-v2-canvas)").forEach(n=>{n.dataset.abagsPhotorealHidden="true";n.style.opacity="0";n.style.pointerEvents="none";});
      let renderer:R|null=null;try{renderer=init(canvas);}catch{renderer=null;}
      if(!renderer){stage.dataset.abagsPhotoRealV2="error";canvas.remove();return;}
      const gl=renderer.gl;gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(0,0,0,0);gl.useProgram(renderer.program);
      const resize=()=>{const rect=stage.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.floor(rect.width*dpr)),h=Math.max(1,Math.floor(rect.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);};
      let raf=0;let rotY=.46;let drag=false,lastX=0;
      const down=(e:PointerEvent)=>{drag=true;lastX=e.clientX;canvas.setPointerCapture?.(e.pointerId);};
      const move=(e:PointerEvent)=>{if(!drag)return;rotY+=(e.clientX-lastX)*.008;lastX=e.clientX;};
      const up=()=>{drag=false;};
      canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",up);
      const render=(time:number)=>{if(disposed)return;resize();const c=read(stage);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(renderer!.program);const aspect=canvas.width/Math.max(1,canvas.height);gl.uniformMatrix4fv(renderer!.uProj,false,persp(.72,aspect,.1,20));gl.uniformMatrix4fv(renderer!.uView,false,trans(0,-.02,-4.1));gl.uniform3fv(renderer!.uLight,norm(-.55,1.1,1.2));gl.uniform1f(renderer!.uTime,time*.001);const family=(c.family in renderer!.meshes?c.family:"mini") as "tote"|"round"|"bucket"|"mini";const s=1.06;draw(renderer!,renderer!.meshes[family],mat([0,-.02,0],[s,s,s],[0,rotY,0]),c.color,0,stitchId(c.stitch),.92);if(c.handles!=="none")draw(renderer!,renderer!.meshes.handle,mat([0,.98,0],[1,1,1],[0,rotY,0]),c.handles==="crochet"?c.color:(c.handles==="wood-dark"?"#4b261a":"#d6ae6e"),c.handles.startsWith("wood")?2:0,stitchId(c.stitch),.85);if(c.strap!=="none")draw(renderer!,renderer!.meshes.strap,mat([0,.05,-.02],[.82,.82,.82],[0,rotY,0]),c.strap==="chain"?"#c8a15d":c.strap==="woven"?"#8a666c":"#6b493b",c.strap==="chain"?3:1,stitchId(c.stitch),.55);if(c.flap!=="none")draw(renderer!,renderer!.meshes.flap,mat([0,.34,.50],[.95,.62,.12],[0,rotY,0]),c.flap==="crochet"?c.color:c.flap==="leather-black"?"#242124":c.flap==="leather-cognac"?"#805333":"#7a3044",c.flap==="crochet"?0:1,stitchId(c.stitch),.65);raf=requestAnimationFrame(render);};
      raf=requestAnimationFrame(render);window.addEventListener("resize",resize);
      cleanup=()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);canvas.removeEventListener("pointerup",up);canvas.removeEventListener("pointercancel",up);canvas.remove();stage.style.position=originalPosition;delete stage.dataset.abagsPhotoRealV2;stage.querySelectorAll("[data-abags-photoreal-hidden]").forEach(n=>{n.style.opacity="";n.style.pointerEvents="";delete n.dataset.abagsPhotorealHidden;});};
    };
    const tick=()=>{if(disposed)return;attach();window.setTimeout(tick,220);};tick();
    return()=>{disposed=true;cleanup();};
  },[]);
  return null;
}
