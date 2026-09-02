"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Config = { color: string; stitch: string; handles: string; hardware: string; strap: string; accent: string };
type Snapshot = { imageUrl: string; productName: string; config: Config; showBase: boolean };
type RGB = { r: number; g: number; b: number };

const COLORS: Record<string, string> = { "natural-bez":"#d8c3a8", "pudrowy-roz":"#d9a3aa", "gleboki-granat":"#24324d", "czekoladowy-braz":"#65493d", musztardowy:"#c7962f", czarny:"#242224" };
const METAL: Record<string, string> = { zlote:"#c9a24f", srebrne:"#d4d8dd", czarne:"#2c292d" };
const imageCache = new Map<string, HTMLImageElement>();

function norm(value:string){return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function hex(hexValue:string):RGB{const n=Number.parseInt(hexValue.slice(1),16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255};}
function active(dialog:HTMLElement,index:number){return dialog.querySelector<HTMLButtonElement>(`.abags-vc-controls fieldset:nth-child(${index}) button.is-active`)?.textContent??"";}
function parse(dialog:HTMLElement):Snapshot|null{
  const preview=dialog.querySelector<HTMLElement>(".abags-vc-preview"),base=preview?.querySelector<HTMLImageElement>(".abags-vc-base"); if(!preview||!base?.src)return null;
  const colorText=norm(active(dialog,2)),handlesText=norm(active(dialog,4)),hardwareText=norm(active(dialog,5)),strapText=norm(active(dialog,6)),accentText=norm(active(dialog,7));
  const color=colorText.includes("naturalny-bez")?"natural-bez":colorText.includes("pudrowy-roz")?"pudrowy-roz":colorText.includes("gleboki-granat")?"gleboki-granat":colorText.includes("czekoladowy-braz")?"czekoladowy-braz":colorText.includes("musztardowy")?"musztardowy":colorText.includes("czarny")?"czarny":"";
  const handles=handlesText.includes("drewniane")?"drewniane":handlesText.includes("lancuszek")?"lancuszek":handlesText?"klasyczne":"";
  const hardware=hardwareText.includes("srebrne")?"srebrne":hardwareText.includes("czarne")?"czarne":hardwareText?"zlote":"";
  const strap=strapText.includes("lancuszek-premium")?"lancuszek-premium":strapText.includes("regulowany")?"regulowany":strapText?"bez-paska":"";
  const accent=accentText.includes("chwost")?"chwost":accentText.includes("apaszka")||accentText.includes("kokarda")?"apaszka":accentText.includes("zawieszka")?"zawieszka":accentText?"bez-ozdoby":"";
  const name=dialog.querySelector<HTMLButtonElement>(".abags-vc-controls fieldset:nth-child(1) button.is-active strong")?.textContent?.trim()||base.alt.replace(/^Bazowy model\s*/i,"")||"A-Bags";
  return{imageUrl:base.src,productName:name,config:{color,stitch:norm(active(dialog,3)),handles,hardware,strap,accent},showBase:preview.classList.contains("is-showing-base")};
}

async function getImage(src:string){
  const cached=imageCache.get(src); if(cached?.complete&&cached.naturalWidth)return cached;
  const img=cached??new Image(); if(!cached){img.decoding="async";imageCache.set(src,img);img.src=src;}
  if(img.complete&&img.naturalWidth)return img;
  await new Promise<void>((resolve,reject)=>{img.addEventListener("load",()=>resolve(),{once:true});img.addEventListener("error",()=>reject(new Error("image load failed")),{once:true});});
  return img;
}

function recolor(ctx:CanvasRenderingContext2D,w:number,h:number,targetHex:string){
  let image:ImageData; try{image=ctx.getImageData(0,0,w,h);}catch{return 0;}
  const target=hex(targetHex),d=image.data,cx=w*.5,cy=h*.59,rx=w*.39,ry=h*.39; let changed=0;
  for(let y=Math.floor(h*.25);y<Math.ceil(h*.9);y++)for(let x=Math.floor(w*.12);x<Math.ceil(w*.88);x++){
    const ellipse=((x-cx)*(x-cx))/(rx*rx)+((y-cy)*(y-cy))/(ry*ry); if(ellipse>1.12)continue;
    const i=(y*w+x)*4,r=d[i],g=d[i+1],b=d[i+2],a=d[i+3]; if(a<12)continue;
    const max=Math.max(r,g,b),min=Math.min(r,g,b),lum=(.2126*r+.7152*g+.0722*b)/255,sat=max===0?0:(max-min)/max;
    if(lum>.94||lum<.025)continue;
    const central=1-Math.min(1,ellipse/1.12), texture=Math.max(.34,Math.min(.94,.42+sat*.45+(1-Math.abs(lum-.48)*1.1)*.12));
    const weight=Math.min(.88,texture*(.72+central*.22));
    const shade=targetHex==="#242224"?Math.max(.12,lum*.55):targetHex==="#d8c3a8"||targetHex==="#d9a3aa"?Math.min(.9,.3+lum*.62):Math.min(.82,.16+lum*.72);
    const tr=target.r*shade+(255-target.r)*Math.max(0,shade-.72)*.35,tg=target.g*shade+(255-target.g)*Math.max(0,shade-.72)*.35,tb=target.b*shade+(255-target.b)*Math.max(0,shade-.72)*.35;
    d[i]=Math.round(r*(1-weight)+tr*weight);d[i+1]=Math.round(g*(1-weight)+tg*weight);d[i+2]=Math.round(b*(1-weight)+tb*weight);changed++;
  }
  ctx.putImageData(image,0,0); return changed;
}

function bodyPath(ctx:CanvasRenderingContext2D,w:number,h:number){ctx.beginPath();ctx.roundRect(w*.18,h*.31,w*.64,h*.53,Math.min(w,h)*.08);}
function stitch(ctx:CanvasRenderingContext2D,w:number,h:number,value:string){if(!value)return;ctx.save();bodyPath(ctx,w,h);ctx.clip();ctx.globalAlpha=.12;ctx.strokeStyle="#fff";ctx.lineWidth=Math.max(1,w*.002);const step=Math.max(15,w*.034),seed=value.split("").reduce((s,c)=>s+c.charCodeAt(0),0)%3;if(seed===0){for(let x=-h;x<w+h;x+=step){ctx.beginPath();ctx.moveTo(x,h*.3);ctx.lineTo(x+h*.48,h*.84);ctx.stroke();ctx.beginPath();ctx.moveTo(x+h*.48,h*.3);ctx.lineTo(x,h*.84);ctx.stroke();}}else if(seed===1){for(let y=h*.34;y<h*.84;y+=step)for(let x=w*.2;x<w*.82;x+=step){ctx.beginPath();ctx.arc(x,y,step*.3,Math.PI,0);ctx.stroke();}}else{for(let y=h*.34;y<h*.84;y+=step){ctx.beginPath();ctx.moveTo(w*.2,y);ctx.lineTo(w*.82,y);ctx.stroke();}}ctx.restore();}
function chain(ctx:CanvasRenderingContext2D,points:Array<[number,number]>,metal:string,w:number){ctx.save();ctx.strokeStyle=METAL[metal]??METAL.zlote;ctx.lineWidth=Math.max(2,w*.0035);for(let p=0;p<points.length-1;p++){const [x1,y1]=points[p],[x2,y2]=points[p+1],dx=x2-x1,dy=y2-y1,steps=Math.max(1,Math.floor(Math.hypot(dx,dy)/(w*.022)));for(let s=0;s<=steps;s++){const t=s/steps,x=x1+dx*t,y=y1+dy*t;ctx.beginPath();ctx.ellipse(x,y,w*.011,w*.006,Math.atan2(dy,dx)+(s%2?Math.PI/2:0),0,Math.PI*2);ctx.stroke();}}ctx.restore();}
function accessories(ctx:CanvasRenderingContext2D,w:number,h:number,c:Config){ctx.save();ctx.lineCap="round";ctx.lineJoin="round";const metal=METAL[c.hardware]??METAL.zlote;
  if(c.handles==="drewniane"){const g=ctx.createLinearGradient(w*.32,h*.12,w*.68,h*.34);g.addColorStop(0,"#f2d49c");g.addColorStop(.5,"#c99554");g.addColorStop(1,"#f0d8ab");ctx.strokeStyle=g;ctx.lineWidth=Math.max(10,w*.031);ctx.beginPath();ctx.ellipse(w*.5,h*.3,w*.18,h*.19,0,Math.PI,Math.PI*2);ctx.stroke();}
  else if(c.handles==="lancuszek")chain(ctx,[[w*.34,h*.32],[w*.5,h*.17],[w*.66,h*.32]],c.hardware,w);
  if(c.hardware){ctx.fillStyle=metal;for(const x of [.22,.78]){ctx.beginPath();ctx.arc(w*x,h*.36,w*.011,0,Math.PI*2);ctx.fill();}}
  if(c.strap==="regulowany"){ctx.strokeStyle="rgba(54,42,42,.92)";ctx.lineWidth=Math.max(10,w*.027);ctx.beginPath();ctx.moveTo(w*.8,h*.38);ctx.bezierCurveTo(w*.94,h*.55,w*.92,h*.8,w*.72,h*.92);ctx.stroke();ctx.strokeStyle=metal;ctx.lineWidth=Math.max(2,w*.004);ctx.strokeRect(w*.82,h*.55,w*.045,h*.06);}else if(c.strap==="lancuszek-premium")chain(ctx,[[w*.79,h*.37],[w*.9,h*.63],[w*.79,h*.9],[w*.58,h*.94]],c.hardware,w);
  if(c.accent==="chwost"){const x=w*.3,top=h*.39,bottom=h*.72;ctx.fillStyle="#8a5c68";ctx.beginPath();ctx.arc(x,top,w*.025,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#8a5c68";ctx.lineWidth=Math.max(2,w*.004);for(let i=-6;i<=6;i++){ctx.beginPath();ctx.moveTo(x+i*w*.006,top+w*.022);ctx.lineTo(x+i*w*.011,bottom);ctx.stroke();}}
  else if(c.accent==="apaszka"){const x=w*.31,y=h*.37;ctx.fillStyle="rgba(226,170,178,.95)";ctx.strokeStyle="#6e4e61";ctx.lineWidth=Math.max(2,w*.003);for(const [dx,rot] of [[-.055,-.35],[.055,.35]] as Array<[number,number]>){ctx.beginPath();ctx.ellipse(x+w*dx,y,w*.075,h*.04,rot,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.beginPath();ctx.moveTo(x-w*.012,y+h*.02);ctx.lineTo(x-w*.08,y+h*.28);ctx.lineTo(x,y+h*.2);ctx.closePath();ctx.fill();ctx.stroke();}
  else if(c.accent==="zawieszka"){const x=w*.75,y=h*.46;ctx.fillStyle=metal;ctx.beginPath();ctx.arc(x,y,w*.026,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f2d7dc";ctx.beginPath();ctx.arc(x,y,w*.012,0,Math.PI*2);ctx.fill();}
  ctx.restore();}

function LiveCanvas({snapshot}:{snapshot:Snapshot}){const ref=useRef<HTMLCanvasElement|null>(null);useEffect(()=>{const canvas=ref.current;if(!canvas||snapshot.showBase)return;let cancelled=false;(async()=>{try{const img=await getImage(snapshot.imageUrl);if(cancelled)return;const scale=Math.min(1,820/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)return;ctx.clearRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);if(snapshot.config.color&&COLORS[snapshot.config.color])recolor(ctx,w,h,COLORS[snapshot.config.color]);stitch(ctx,w,h,snapshot.config.stitch);accessories(ctx,w,h,snapshot.config);}catch{canvas.getContext("2d")?.clearRect(0,0,canvas.width,canvas.height);}})();return()=>{cancelled=true};},[snapshot]);if(snapshot.showBase)return null;return <><canvas ref={ref} className="abags-realtime-preview" data-abags-realtime-preview="true" role="img" aria-label={`Podgląd personalizacji na żywo: ${snapshot.productName}`}/><div className="abags-realtime-preview-badge">Live · render pikselowy</div></>;}

export default function RealtimeCustomizerPreviewV2(){const[mount,setMount]=useState<HTMLElement|null>(null),[snapshot,setSnapshot]=useState<Snapshot|null>(null);const keyRef=useRef("");useEffect(()=>{let frame=0;const sync=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const dialog=document.querySelector<HTMLElement>(".abags-vc-dialog"),preview=dialog?.querySelector<HTMLElement>(".abags-vc-preview")??null;setMount((old)=>old===preview?old:preview);if(!dialog||!preview){if(keyRef.current){keyRef.current="";setSnapshot(null);}return;}const next=parse(dialog),key=next?JSON.stringify(next):"";if(key!==keyRef.current){keyRef.current=key;setSnapshot(next);}preview.classList.toggle("has-realtime-renderer",Boolean(next&&!next.showBase));});};sync();const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","src"]});document.addEventListener("click",sync,true);return()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener("click",sync,true);document.querySelector(".abags-vc-preview")?.classList.remove("has-realtime-renderer");};},[]);if(!mount||!snapshot)return null;return createPortal(<LiveCanvas snapshot={snapshot}/>,mount);}
