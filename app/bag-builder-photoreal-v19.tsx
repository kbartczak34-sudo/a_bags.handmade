"use client";

import { useEffect, useRef } from "react";

type V3 = [number, number, number];
type M4 = Float32Array;
type Mesh = { p: number[]; n: number[]; u: number[] };
type Profile = { sx: number; sy: number; depth: number; pow: number; handle: number; strap: number; opening: number };

const mul=(a:M4,b:M4)=>{const o=new Float32Array(16);for(let c=0;c<4;c+=1)for(let r=0;r<4;r+=1)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;};
const rx=(a:number)=>new Float32Array([1,0,0,0,0,Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1]);
const ry=(a:number)=>new Float32Array([Math.cos(a),0,-Math.sin(a),0,0,1,0,0,Math.sin(a),0,Math.cos(a),0,0,0,0,1]);
const tr=(x:number,y:number,z:number)=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);
const perspective=(f:number,a:number,n:number,far:number)=>{const q=1/Math.tan(f/2),o=new Float32Array(16);o[0]=q/a;o[5]=q;o[10]=(far+n)/(n-far);o[11]=-1;o[14]=2*far*n/(n-far);return o;};
const S=(v:number,p:number)=>v<0?-Math.pow(-v,p):Math.pow(v,p);
function tri(p:number[],n:number[],u:number[],a:V3,b:V3,c:V3,no:V3,ua:[number,number],ub:[number,number],uc:[number,number]){p.push(...a,...b,...c);n.push(...no,...no,...no);u.push(...ua,...ub,...uc);}
function shell(w:number,h:number,d:number,pow:number,open:number):Mesh{
  const p:number[]=[],n:number[]=[],u:number[]=[],N=96;
  const ring=(z:number,y:number)=>Array.from({length:N},(_,i)=>{const t=i*2*Math.PI/N;return [w*S(Math.cos(t),pow),y+h*S(Math.sin(t),pow),z] as V3;});
  const front=ring(d,0),back=ring(-d,0);
  for(let i=0;i<N;i+=1){const j=(i+1)%N;
    const a=front[i],b=front[j],c=back[i],e=back[j];
    const qx=(a[0]+b[0])*.5,qy=(a[1]+b[1])*.5,nn=Math.hypot(qx/w,(qy)/h)||1;
    const side:V3=[qx/w/nn,qy/h/nn,0];
    tri(p,n,u,a,c,e,side,[i/N,0],[i/N,1],[j/N,1]);tri(p,n,u,a,e,b,side,[i/N,0],[j/N,1],[j/N,0]);
    if(a[1]<open) tri(p,n,u,[a[0],Math.min(a[1],open),d],[b[0],Math.min(b[1],open),d],[0,Math.min((a[1]+b[1])*.5,open),d],[0,0,1],[0,0],[1,0],[.5,1]);
    if(c[1]<open) tri(p,n,u,[c[0],Math.min(c[1],open),-d],[0,Math.min((c[1]+e[1])*.5,open),-d],[e[0],Math.min(e[1],open),-d],[0,0,-1],[0,0],[.5,1],[1,0]);
  }
  return {p,n,u};
}
function innerWalls(w:number,d:number,top:number,bottom:number):Mesh{
  const p:number[]=[],n:number[]=[],u:number[]=[],N=72,iw=w*.84,id=d*.72;
  for(let i=0;i<N;i+=1){const j=(i+1)%N,t=i*2*Math.PI/N,t2=j*2*Math.PI/N;
    const a=[iw*Math.cos(t),top,id*Math.sin(t)] as V3,b=[iw*Math.cos(t2),top,id*Math.sin(t2)] as V3,c=[iw*.82*Math.cos(t2),bottom,id*.70*Math.sin(t2)] as V3,e=[iw*.82*Math.cos(t),bottom,id*.70*Math.sin(t)] as V3;
    const no:V3=[Math.cos(t),-.35,Math.sin(t)];tri(p,n,u,a,b,c,no,[i/N,0],[j/N,0],[j/N,1]);tri(p,n,u,a,c,e,no,[i/N,0],[j/N,1],[i/N,1]);
  }
  const center=[0,bottom,0] as V3;
  for(let i=0;i<N;i+=1){const j=(i+1)%N,a=[iw*.82*Math.cos(i*2*Math.PI/N),bottom,id*.70*Math.sin(i*2*Math.PI/N)] as V3,b=[iw*.82*Math.cos(j*2*Math.PI/N),bottom,id*.70*Math.sin(j*2*Math.PI/N)] as V3;tri(p,n,u,center,b,a,[0,1,0],[.5,.5],[j/N,1],[i/N,1]);}
  return {p,n,u};
}
function rim(w:number,d:number,y:number):Mesh{const p:number[]=[],n:number[]=[],u:number[]=[],N=80,r=.075;for(let i=0;i<N;i+=1){const j=i+1,t=i*2*Math.PI/N,t2=j*2*Math.PI/N;for(let k=0;k<10;k+=1){const a=k*2*Math.PI/10,b=(k+1)*2*Math.PI/10;const pt=(tt:number,aa:number):V3=>[(w+r*Math.cos(aa))*Math.cos(tt),y+r*Math.sin(aa),(d+r*Math.cos(aa))*Math.sin(tt)];const q0=pt(t,a),q1=pt(t2,a),q2=pt(t2,b),q3=pt(t,b),no:V3=[Math.cos(t),.5,Math.sin(t)];tri(p,n,u,q0,q1,q2,no,[i/N,k/10],[j/N,k/10],[j/N,(k+1)/10]);tri(p,n,u,q0,q2,q3,no,[i/N,k/10],[j/N,(k+1)/10],[i/N,(k+1)/10]);}}return {p,n,u};}
function arch(cx:number,y:number,z:number,rx0:number,ry0:number,r:number):Mesh{const p:number[]=[],n:number[]=[],u:number[]=[],A=40,B=12;for(let i=0;i<A-1;i+=1){const t=i*Math.PI/(A-1),t2=(i+1)*Math.PI/(A-1);for(let k=0;k<B;k+=1){const a=k*2*Math.PI/B,b=(k+1)*2*Math.PI/B;const pt=(tt:number,aa:number):V3=>{const x=cx+rx0*Math.cos(tt),yy=y+ry0*Math.sin(tt),tx=-Math.sin(tt),ty=Math.cos(tt);return [x+r*Math.cos(aa)*ty,yy-r*Math.cos(aa)*tx,z+r*Math.sin(aa)];};const q0=pt(t,a),q1=pt(t2,a),q2=pt(t2,b),q3=pt(t,b);const no:V3=[Math.cos(t),Math.sin(t),0];tri(p,n,u,q0,q1,q2,no,[i/A,k/B],[(i+1)/A,k/B],[(i+1)/A,(k+1)/B]);tri(p,n,u,q0,q2,q3,no,[i/A,k/B],[(i+1)/A,(k+1)/B],[i/A,(k+1)/B]);}}return {p,n,u};}
function disk(cx:number,cy:number,cz:number,rx0:number,ry0:number):Mesh{const p:number[]=[],n:number[]=[],u:number[]=[];const N=64;for(let i=0;i<N;i+=1){const t=i*2*Math.PI/N,j=(i+1)*2*Math.PI/N;tri(p,n,u,[cx,cy,cz],[cx+rx0*Math.cos(j),cy+ry0*Math.sin(j),cz],[cx+rx0*Math.cos(t),cy+ry0*Math.sin(t)],[0,0,1],[.5,.5],[j/N,1],[i/N,1]);}return {p,n,u};}

const VS=`attribute vec3 aP;attribute vec3 aN;attribute vec2 aU;uniform mat4 uMVP;uniform mat4 uModel;varying vec3 vN;varying vec2 vU;void main(){vN=mat3(uModel)*aN;vU=aU;gl_Position=uMVP*vec4(aP,1.);}`;
const FS=`precision mediump float;varying vec3 vN;varying vec2 vU;uniform vec3 uColor;uniform float uStitch;uniform float uMetal;void main(){vec3 n=normalize(vN),l=normalize(vec3(-.52,.88,.64)),h=normalize(l+vec3(.06,.30,1.));float diff=.24+.76*max(dot(n,l),0.);float spec=pow(max(dot(n,h),0.),42.)*.26;float yarn=sin(vU.x*900.+sin(vU.y*71.)*2.5);float yarn2=sin(vU.y*720.+vU.x*33.);float rib=.78+.22*sin((vU.x+vU.y)*44.);float fibre=.94+.06*yarn*yarn2;float stitch=mix(1.,rib*fibre,uStitch);vec3 c=uColor*diff*stitch*fibre+vec3(spec);if(uMetal>.5)c=mix(c,vec3(.70,.50,.22),.84);gl_FragColor=vec4(c,1.);}`;
function compile(gl:WebGLRenderingContext,type:number,src:string){const s=gl.createShader(type);if(!s)throw new Error("shader");gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||"shader");return s;}
function color(v:string):V3{const m:Record<string,V3>={navy:[.035,.065,.12],czarny:[.018,.018,.022],black:[.018,.018,.022],beżowy:[.72,.62,.48],bezowy:[.72,.62,.48],kremowy:[.82,.76,.64],ecru:[.78,.73,.64],biały:[.88,.88,.84],bialy:[.88,.88,.84],brązowy:[.25,.10,.045],brazowy:[.25,.10,.045],bordowy:[.28,.025,.04],różowy:[.75,.20,.34],rozowy:[.75,.20,.34],zielony:[.08,.30,.18],granatowy:[.035,.065,.12]};const x=m[v.toLowerCase()];if(x)return x;if(/^#[0-9a-f]{6}$/i.test(v)){return [parseInt(v.slice(1,3),16)/255,parseInt(v.slice(3,5),16)/255,parseInt(v.slice(5,7),16)/255];}return [.28,.25,.20];}

export default function BagBuilderPhotorealV19(){
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 useEffect(()=>{let dead=false,timer=0,raf=0;const start=()=>{if(dead)return;const stage=document.querySelector<HTMLElement>(".abags-vc-dialog.abags-vc-builder-active .abags-bag-builder-stage"),canvas=canvasRef.current;if(!stage||!canvas){timer=window.setTimeout(start,100);return;}if(canvas.parentElement!==stage)stage.appendChild(canvas);let gl:WebGLRenderingContext|null=null;try{gl=canvas.getContext("webgl",{antialias:true,alpha:true,preserveDrawingBuffer:false});}catch{timer=window.setTimeout(start,250);return;}if(!gl){timer=window.setTimeout(start,250);return;}try{
  const program=gl.createProgram();if(!program)throw new Error("program");gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,VS));gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||"link");gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
  const A={p:gl.getAttribLocation(program,"aP"),n:gl.getAttribLocation(program,"aN"),u:gl.getAttribLocation(program,"aU")};const L={mvp:gl.getUniformLocation(program,"uMVP"),model:gl.getUniformLocation(program,"uModel"),color:gl.getUniformLocation(program,"uColor"),stitch:gl.getUniformLocation(program,"uStitch"),metal:gl.getUniformLocation(program,"uMetal")};
  let ax=.54,ay=-.56,zoom=1,down=false,lx=0,ly=0;const profiles:Record<string,Profile>={round:{sx:1.30,sy:1.30,depth:.72,pow:.92,handle:.82,strap:.96,opening:.48},flap:{sx:1.42,sy:1.52,depth:.68,pow:.94,handle:.88,strap:1.08,opening:.52},mini:{sx:1.08,sy:1.02,depth:.55,pow:.82,handle:.66,strap:.80,opening:.42},tote:{sx:1.55,sy:1.28,depth:.74,pow:1.02,handle:1.0,strap:1.16,opening:.50}};
  const buffers=(mesh:Mesh)=>{const bp=gl!.createBuffer(),bn=gl!.createBuffer(),bu=gl!.createBuffer();if(!bp||!bn||!bu)throw new Error("buffer");gl!.bindBuffer(gl!.ARRAY_BUFFER,bp);gl!.bufferData(gl!.ARRAY_BUFFER,new Float32Array(mesh.p),gl!.STATIC_DRAW);gl!.bindBuffer(gl!.ARRAY_BUFFER,bn);gl!.bufferData(gl!.ARRAY_BUFFER,new Float32Array(mesh.n),gl!.STATIC_DRAW);gl!.bindBuffer(gl!.ARRAY_BUFFER,bu);gl!.bufferData(gl!.ARRAY_BUFFER,new Float32Array(mesh.u),gl!.STATIC_DRAW);return {bp,bn,bu,count:mesh.p.length/3};};
  const draw=(b:ReturnType<typeof buffers>,model:M4,c:V3,stitch:number,metal:number,mvp:M4)=>{gl!.bindBuffer(gl!.ARRAY_BUFFER,b.bp);gl!.vertexAttribPointer(A.p,3,gl!.FLOAT,false,0,0);gl!.enableVertexAttribArray(A.p);gl!.bindBuffer(gl!.ARRAY_BUFFER,b.bn);gl!.vertexAttribPointer(A.n,3,gl!.FLOAT,false,0,0);gl!.enableVertexAttribArray(A.n);gl!.bindBuffer(gl!.ARRAY_BUFFER,b.bu);gl!.vertexAttribPointer(A.u,2,gl!.FLOAT,false,0,0);gl!.enableVertexAttribArray(A.u);gl!.uniformMatrix4fv(L.model,false,model);gl!.uniformMatrix4fv(L.mvp,false,mvp);gl!.uniform3f(L.color,c[0],c[1],c[2]);gl!.uniform1f(L.stitch,stitch);gl!.uniform1f(L.metal,metal);gl!.drawArrays(gl!.TRIANGLES,0,b.count);};
  let family="round";
  const render=()=>{if(dead||gl!.isContextLost())return;const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.floor(r.width*dpr));canvas.height=Math.max(1,Math.floor(r.height*dpr));gl!.viewport(0,0,canvas.width,canvas.height);gl!.clearColor(0,0,0,0);gl!.clear(gl!.COLOR_BUFFER_BIT|gl!.DEPTH_BUFFER_BIT);const data=stage.dataset;family=data.family||"round";const key=family.toLowerCase().includes("tote")||family.includes("kuf")?"tote":family.toLowerCase().includes("klap")||family.toLowerCase().includes("bucket")?"flap":family.toLowerCase().includes("mini")?"mini":"round";const q=profiles[key];const c=color(data.color||"navy");const stitch=/none|brak|basic/i.test(data.stitch||"")?0.35:1;const P=perspective(.72,Math.max(.45,r.width/Math.max(1,r.height)),.1,30);const V=mul(tr(0,-.10,-5.25/zoom),mul(rx(ax),ry(ay)));const M=new Float32Array([q.sx,0,0,0,0,q.sy,0,0,0,0,1,0,0,0,0,1]);const MVP=mul(P,mul(V,M));
    const body=buffers(shell(1,1,.50,q.pow,q.opening));const inner=buffers(innerWalls(.84,.38,q.opening-.02,-.42));const top=rim(1.02,.54,q.opening+.02);const rb=buffers(top);const handle=buffers(arch(0,.84,0,q.handle,.42,.095));const strap=buffers(arch(0,.72,0,q.strap,.34,.045));
    draw(body, M,c,stitch,0,MVP);draw(inner,M,[c[0]*.32,c[1]*.28,c[2]*.22],1,0,MVP);draw(rb,M,[Math.min(1,c[0]*1.18),Math.min(1,c[1]*1.18),Math.min(1,c[2]*1.18)],stitch,0,MVP);
    const handleM=mul(tr(0,.02,.04),M);const handles=data.handles||"";if(!/none|brak|bez/i.test(handles))draw(handle,handleM,[Math.min(1,c[0]*1.35),Math.min(1,c[1]*1.35),Math.min(1,c[2]*1.35)],stitch,0,MVP);
    if(data.strap&&!/none|brak|bez/i.test(data.strap))draw(strap,M,[c[0]*1.25,c[1]*1.25,c[2]*1.25],stitch,0,MVP);
    if(data.hardware&&!/none|brak|bez/i.test(data.hardware)){const h=buffers(rim(.10,.10,.64));draw(h,M,[.7,.48,.20],0,1,MVP);}
    if(data.flap&&!/none|brak|bez/i.test(data.flap)){const f=buffers(disk(0,-.05,.515,.62,.36));draw(f,M,[c[0]*.88,c[1]*.88,c[2]*.88],stitch,0,MVP);}
    raf=requestAnimationFrame(render);
  };
  const onDown=(e:PointerEvent)=>{down=true;lx=e.clientX;ly=e.clientY;canvas.setPointerCapture?.(e.pointerId);};const onMove=(e:PointerEvent)=>{if(!down)return;ay+=(e.clientX-lx)*.008;ax=Math.max(-.05,Math.min(.9,ax+(e.clientY-ly)*.006));lx=e.clientX;ly=e.clientY;};const onUp=()=>{down=false;};const onWheel=(e:WheelEvent)=>{e.preventDefault();zoom=Math.max(.78,Math.min(1.22,zoom+(e.deltaY>0?-.05:.05)));};canvas.addEventListener("pointerdown",onDown);canvas.addEventListener("pointermove",onMove);canvas.addEventListener("pointerup",onUp);canvas.addEventListener("pointercancel",onUp);canvas.addEventListener("wheel",onWheel,{passive:false});window.addEventListener("resize",render);const old=document.querySelectorAll("svg.abags-bag-builder-preview,.abags-bag-builder-canvas,.abags-photoreal-v2-canvas,.abags-photoreal-v3-canvas,.abags-photoreal-v4-canvas,.abags-photoreal-v5-canvas,.abags-photoreal-v18-canvas");old.forEach(el=>(el as HTMLElement).style.display="none");stage.dataset.abagsPhotorealV19="ready";render();
  canvas.addEventListener("webglcontextlost",()=>{stage.dataset.abagsPhotorealV19Error="context-lost";});
  return()=>{cancelAnimationFrame(raf);clearTimeout(timer);window.removeEventListener("resize",render);canvas.removeEventListener("pointerdown",onDown);canvas.removeEventListener("pointermove",onMove);canvas.removeEventListener("pointerup",onUp);canvas.removeEventListener("pointercancel",onUp);canvas.removeEventListener("wheel",onWheel);};
 }catch(error){stage.dataset.abagsPhotorealV19Error=error instanceof Error?error.message:"init-error";timer=window.setTimeout(start,500);}};start();return()=>{dead=true;clearTimeout(timer);cancelAnimationFrame(raf);};},[]);
 return <canvas ref={canvasRef} className="abags-photoreal-v19-canvas" aria-label="Realistyczny podgląd torebki"/>;
}
