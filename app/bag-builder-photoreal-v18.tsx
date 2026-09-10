"use client";

import { useEffect, useRef } from "react";

type V3 = [number, number, number];
type M4 = Float32Array;
type Profile = { sx: number; sy: number; depth: number; handle: number; strap: number; pow: number };
type Mesh = { p: number[]; n: number[]; u: number[] };

const S = (v: number, p: number) => (v < 0 ? -Math.pow(-v, p) : Math.pow(v, p));
const mul = (a: M4, b: M4) => { const o = new Float32Array(16); for (let c = 0; c < 4; c += 1) for (let r = 0; r < 4; r += 1) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; };
const ident = () => new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const rotX = (a: number) => new Float32Array([1,0,0,0,0,Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1]);
const rotY = (a: number) => new Float32Array([Math.cos(a),0,-Math.sin(a),0,0,1,0,0,Math.sin(a),0,Math.cos(a),0,0,0,0,1]);
const trans = (x: number, y: number, z: number) => new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);
const perspective = (f: number, a: number, n: number, far: number) => { const q = 1 / Math.tan(f / 2), o = new Float32Array(16); o[0] = q / a; o[5] = q; o[10] = (far + n) / (n - far); o[11] = -1; o[14] = 2 * far * n / (n - far); return o; };
function addTri(p: number[], n: number[], u: number[], a: V3, b: V3, c: V3, nn: V3, uv: [number, number], uv2: [number, number], uv3: [number, number]) { p.push(...a, ...b, ...c); n.push(...nn, ...nn, ...nn); u.push(...uv, ...uv2, ...uv3); }

function bodyMesh(w: number, h: number, d: number, pow: number): Mesh {
  const p: number[] = [], n: number[] = [], u: number[] = [], N = 96;
  const ring = (z: number) => Array.from({ length: N }, (_, i) => { const t = i * 2 * Math.PI / N; return [w * S(Math.cos(t), pow), h * S(Math.sin(t), pow), z] as V3; });
  const front = ring(d), back = ring(-d);
  for (let i = 0; i < N; i += 1) {
    const j = (i + 1) % N;
    addTri(p, n, u, [0, 0, d], front[i], front[j], [0, 0, 1], [.5, .5], [.5 + front[i][0] / (2 * w), .5 + front[i][1] / (2 * h)], [.5 + front[j][0] / (2 * w), .5 + front[j][1] / (2 * h)]);
    addTri(p, n, u, [0, 0, -d], back[j], back[i], [0, 0, -1], [.5, .5], [.5 + back[j][0] / (2 * w), .5 + back[j][1] / (2 * h)], [.5 + back[i][0] / (2 * w), .5 + back[i][1] / (2 * h)]);
    const qx = (front[i][0] + front[j][0]) * .5, qy = (front[i][1] + front[j][1]) * .5, nn = Math.hypot(qx / w, qy / h) || 1;
    const normal: V3 = [qx / w / nn, qy / h / nn, 0];
    addTri(p, n, u, front[i], back[i], back[j], normal, [i / N, 0], [i / N, 1], [j / N, 1]);
    addTri(p, n, u, front[i], back[j], front[j], normal, [i / N, 0], [j / N, 1], [j / N, 0]);
  }
  return { p, n, u };
}

function ellipseMesh(w: number, d: number, y: number, zOffset: number, thickness: number): Mesh {
  const p: number[] = [], n: number[] = [], u: number[] = [], N = 72;
  for (let i = 0; i < N; i += 1) {
    const j = (i + 1) % N;
    const a = [w * Math.cos(i * 2 * Math.PI / N), y, zOffset + d * Math.sin(i * 2 * Math.PI / N)] as V3;
    const b = [w * Math.cos(j * 2 * Math.PI / N), y, zOffset + d * Math.sin(j * 2 * Math.PI / N)] as V3;
    addTri(p, n, u, [0, y + thickness, zOffset], a, b, [0, 1, 0], [.5, .5], [i / N, 0], [j / N, 0]);
  }
  return { p, n, u };
}

function rimMesh(w: number, d: number, y: number): Mesh {
  const p: number[] = [], n: number[] = [], u: number[] = [], N = 72, r = .075;
  for (let i = 0; i < N; i += 1) {
    const t = i * 2 * Math.PI / N, j = (i + 1) * 2 * Math.PI / N;
    for (let k = 0; k < 10; k += 1) {
      const a = k * 2 * Math.PI / 10, b = (k + 1) * 2 * Math.PI / 10;
      const point = (tt: number, aa: number): V3 => [(w + r * Math.cos(aa)) * Math.cos(tt), y + r * Math.sin(aa), (d + r * Math.cos(aa)) * Math.sin(tt)];
      const q0 = point(t, a), q1 = point(j, a), q2 = point(j, b), q3 = point(t, b);
      const normal: V3 = [Math.cos(t), .45, Math.sin(t)];
      addTri(p, n, u, q0, q1, q2, normal, [i / N, k / 10], [(i + 1) / N, k / 10], [(i + 1) / N, (k + 1) / 10]);
      addTri(p, n, u, q0, q2, q3, normal, [i / N, k / 10], [(i + 1) / N, (k + 1) / 10], [i / N, (k + 1) / 10]);
    }
  }
  return { p, n, u };
}

function tubeArch(cx: number, baseY: number, z: number, rx: number, ry: number, r: number): Mesh {
  const p: number[] = [], n: number[] = [], u: number[] = [], A = 36, B = 12;
  for (let i = 0; i < A - 1; i += 1) {
    const t = i * Math.PI / (A - 1), j = (i + 1) * Math.PI / (A - 1);
    for (let k = 0; k < B; k += 1) {
      const a = k * 2 * Math.PI / B, b = (k + 1) * 2 * Math.PI / B;
      const point = (tt: number, aa: number): V3 => { const x = cx + rx * Math.cos(tt), y = baseY + ry * Math.sin(tt), tx = -Math.sin(tt), ty = Math.cos(tt); return [x + r * Math.cos(aa) * ty, y - r * Math.cos(aa) * tx, z + r * Math.sin(aa)]; };
      const q0 = point(t, a), q1 = point(j, a), q2 = point(j, b), q3 = point(t, b);
      const c0: V3 = [q0[0] - cx, q0[1] - baseY, q0[2] - z], l0 = Math.hypot(...c0) || 1;
      const normal: V3 = [c0[0] / l0, c0[1] / l0, c0[2] / l0];
      addTri(p, n, u, q0, q1, q2, normal, [i / A, k / B], [(i + 1) / A, k / B], [(i + 1) / A, (k + 1) / B]);
      addTri(p, n, u, q0, q2, q3, normal, [i / A, k / B], [(i + 1) / A, (k + 1) / B], [i / A, (k + 1) / B]);
    }
  }
  return { p, n, u };
}

function hardwareRing(cx: number, cy: number, cz: number, rx: number, ry: number, r: number): Mesh {
  const p: number[] = [], n: number[] = [], u: number[] = [], A = 32, B = 8;
  for (let i = 0; i < A; i += 1) {
    const t = i * 2 * Math.PI / A, j = (i + 1) * 2 * Math.PI / A;
    for (let k = 0; k < B; k += 1) {
      const a = k * 2 * Math.PI / B, b = (k + 1) * 2 * Math.PI / B;
      const point = (tt: number, aa: number): V3 => [cx + (rx + r * Math.cos(aa)) * Math.cos(tt), cy + (ry + r * Math.cos(aa)) * Math.sin(tt), cz + r * Math.sin(aa)];
      const q0 = point(t, a), q1 = point(j, a), q2 = point(j, b), q3 = point(t, b);
      const normal: V3 = [Math.cos(t), Math.sin(t), Math.sin(a)];
      addTri(p, n, u, q0, q1, q2, normal, [i / A, k / B], [(i + 1) / A, k / B], [(i + 1) / A, (k + 1) / B]);
      addTri(p, n, u, q0, q2, q3, normal, [i / A, k / B], [(i + 1) / A, (k + 1) / B], [i / A, (k + 1) / B]);
    }
  }
  return { p, n, u };
}

const VS = `attribute vec3 aP;attribute vec3 aN;attribute vec2 aU;uniform mat4 uMVP;uniform mat4 uModel;varying vec3 vN;varying vec2 vU;void main(){vN=mat3(uModel)*aN;vU=aU;gl_Position=uMVP*vec4(aP,1.);}`;
const FS = `precision mediump float;varying vec3 vN;varying vec2 vU;uniform vec3 uColor;uniform float uStitch;uniform float uMetal;void main(){vec3 n=normalize(vN),l=normalize(vec3(-.48,.86,.62)),h=normalize(l+vec3(.08,.32,1.));float diff=.30+.70*max(dot(n,l),0.);float spec=pow(max(dot(n,h),0.),34.)*.20;float d=abs(fract((vU.x+vU.y)*30.)-.5);float rib=smoothstep(.54,.13,d);float fibre=.5+.5*sin(vU.x*680.+sin(vU.y*67.)*3.);float micro=.92+.08*sin(vU.x*1700.+vU.y*310.);float weave=mix(1.,.68+.32*rib*fibre,uStitch);vec3 c=uColor*weave*diff*micro+cVec3(spec);if(uMetal>.5)c=mix(c,vec3(.68,.48,.20),.82);gl_FragColor=vec4(c,1.);}`.replace("cVec3(spec)","vec3(spec)");
function compile(gl: WebGLRenderingContext, type: number, src: string) { const s = gl.createShader(type); if (!s) throw new Error("shader"); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader"); return s; }

export default function BagBuilderPhotorealV18() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let dead = false, raf = 0, retry = 0;
    const start = () => {
      if (dead) return;
      const stage = document.querySelector<HTMLElement>(".abags-vc-dialog.abags-vc-builder-active .abags-bag-builder-stage"), canvas = ref.current;
      if (!stage || !canvas) { retry = window.setTimeout(start, 120); return; }
      if (canvas.parentElement !== stage) stage.appendChild(canvas);
      let gl: WebGLRenderingContext;
      try { gl = canvas.getContext("webgl", { antialias: true, alpha: true, preserveDrawingBuffer: false }) as WebGLRenderingContext; } catch { retry = window.setTimeout(start, 250); return; }
      if (!gl) { retry = window.setTimeout(start, 250); return; }
      try {
        const program = gl.createProgram();
        if (!program) throw new Error("program");
        gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FS)); gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "link");
        gl.useProgram(program); gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        const attrs = { p: gl.getAttribLocation(program, "aP"), n: gl.getAttribLocation(program, "aN"), u: gl.getAttribLocation(program, "aU") };
        const loc = { mvp: gl.getUniformLocation(program, "uMVP"), model: gl.getUniformLocation(program, "uModel"), color: gl.getUniformLocation(program, "uColor"), stitch: gl.getUniformLocation(program, "uStitch"), metal: gl.getUniformLocation(program, "uMetal") };
        let angleX = .50, angleY = -.58, zoom = 1, down = false, lx = 0, ly = 0;
        const profiles: Record<string, Profile> = {
          round: { sx: 1.30, sy: 1.30, depth: .72, handle: .82, strap: .96, pow: .92 },
          flap: { sx: 1.42, sy: 1.55, depth: .68, handle: .88, strap: 1.08, pow: .94 },
          mini: { sx: 1.08, sy: 1.02, depth: .55, handle: .66, strap: .80, pow: .82 },
          tote: { sx: 1.55, sy: 1.28, depth: .74, handle: 1.00, strap: 1.16, pow: 1.02 },
        };
        const parseColor = (v: string): V3 => {
          const value = v.trim().toLowerCase(), named: Record<string, V3> = { navy: [.08,.13,.27], granatowy: [.08,.13,.27], blue: [.10,.18,.38], pink: [.72,.35,.43], różowy: [.72,.35,.43], cream: [.84,.76,.65], ecru: [.84,.76,.65], beige: [.70,.59,.48], black: [.055,.05,.05], white: [.88,.86,.82], green: [.18,.34,.23], teal: [.10,.36,.36], red: [.55,.10,.10], mustard: [.62,.42,.08], brown: [.30,.18,.12] };
          if (named[value]) return named[value];
          const h = value.replace("#", ""); if (h.length !== 6) return named.navy;
          return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4),16)/255];
        };
        const valid = (v: string) => v && !["none","brak","bez"].includes(v.toLowerCase());
        const stitchValue = (v: string) => { const s = v.toLowerCase(); return s.includes("basket") || s.includes("koszyk") ? .92 : s.includes("radial") || s.includes("prom") ? .82 : s.includes("vertical") || s.includes("pion") ? .96 : 1; };
        const draw = (mesh: Mesh, m: M4, c: V3, st = 1, metal = 0) => {
          const bp = gl.createBuffer(), bn = gl.createBuffer(), bu = gl.createBuffer(); if (!bp || !bn || !bu) return;
          for (const [buf,data,att,size] of [[bp,mesh.p,attrs.p,3],[bn,mesh.n,attrs.n,3],[bu,mesh.u,attrs.u,2]] as const) { gl.bindBuffer(gl.ARRAY_BUFFER,buf); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STREAM_DRAW); gl.enableVertexAttribArray(att); gl.vertexAttribPointer(att,size,gl.FLOAT,false,0,0); }
          gl.uniformMatrix4fv(loc.model,false,m); gl.uniform3fv(loc.color,c); gl.uniform1f(loc.stitch,st); gl.uniform1f(loc.metal,metal); gl.drawArrays(gl.TRIANGLES,0,mesh.p.length/3); gl.deleteBuffer(bp); gl.deleteBuffer(bn); gl.deleteBuffer(bu);
        };
        const render = () => {
          if (dead || gl.isContextLost()) return;
          const w = canvas.clientWidth || 640, h = canvas.clientHeight || 640, dpr = Math.min(window.devicePixelRatio || 1, 2), W = Math.floor(w*dpr), H = Math.floor(h*dpr);
          if (canvas.width !== W || canvas.height !== H) { canvas.width=W; canvas.height=H; gl.viewport(0,0,W,H); }
          gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
          const raw = (stage.dataset.family || "tote").toLowerCase(), f = raw.includes("okr") || raw.includes("round") ? "round" : raw.includes("klap") || raw.includes("bucket") ? "flap" : raw.includes("mini") || raw.includes("strukt") ? "mini" : "tote";
          const profile = profiles[f], { sx, sy, depth, handle, strap } = profile;
          const P = perspective(.70,w/h,.05,20), V = mul(trans(0,-.08,-5.20/zoom),mul(rotX(angleX),rotY(angleY))), M = ident(); gl.uniformMatrix4fv(loc.mvp,false,mul(P,mul(V,M)));
          const c = parseColor(stage.dataset.color || "#263a61"), st = stitchValue(stage.dataset.stitch || "");
          draw(bodyMesh(sx,sy,depth,profile.pow),M,c,st);
          const openingY = sy * .91, opening = ellipseMesh(sx*.70,depth*.72,openingY,0,.025), rim = rimMesh(sx*.72,depth*.82,openingY);
          draw(opening,M,[Math.max(c[0]*.09,.018),Math.max(c[1]*.08,.015),Math.max(c[2]*.07,.012)],.08); draw(rim,M,[Math.min(c[0]*.80+.10,.95),Math.min(c[1]*.80+.08,.95),Math.min(c[2]*.80+.06,.95)],.78);
          const handles = (stage.dataset.handles || "").toLowerCase(); if (f !== "mini" && valid(handles)) draw(tubeArch(0,sy*.78,.01,handle*.72,.44,.078),M,[Math.min(c[0]*.72+.12,.95),Math.min(c[1]*.72+.10,.95),Math.min(c[2]*.72+.08,.95)],.76);
          const strapV = (stage.dataset.strap || "").toLowerCase(); if (valid(strapV)) draw(tubeArch(0,sy*.60,.10,sx*.84,.48,.044),M,[.09,.075,.06],.30);
          const hardware = (stage.dataset.hardware || "").toLowerCase(); if (valid(hardware) && f !== "mini") { const hw = [.66,.48,.20] as V3; draw(hardwareRing(-sx*.58,sy*.78,depth+.025,.085,.085,.025),M,hw,.2,1); draw(hardwareRing(sx*.58,sy*.78,depth+.025,.085,.085,.025),M,hw,.2,1); }
          raf = requestAnimationFrame(render);
        };
        const onDown = (e: PointerEvent) => { down=true; lx=e.clientX; ly=e.clientY; canvas.setPointerCapture(e.pointerId); };
        const onMove = (e: PointerEvent) => { if (!down) return; angleY += (e.clientX-lx)*.008; angleX = Math.max(-.82,Math.min(.95,angleX+(e.clientY-ly)*.006)); lx=e.clientX; ly=e.clientY; };
        const onUp = () => { down=false; };
        const onWheel = (e: WheelEvent) => { e.preventDefault(); zoom=Math.max(.78,Math.min(1.30,zoom*(e.deltaY>0?.94:1.06))); };
        canvas.addEventListener("pointerdown",onDown); canvas.addEventListener("pointermove",onMove); canvas.addEventListener("pointerup",onUp); canvas.addEventListener("pointercancel",onUp); canvas.addEventListener("wheel",onWheel,{passive:false});
        render();
        return () => { cancelAnimationFrame(raf); canvas.removeEventListener("pointerdown",onDown); canvas.removeEventListener("pointermove",onMove); canvas.removeEventListener("pointerup",onUp); canvas.removeEventListener("pointercancel",onUp); canvas.removeEventListener("wheel",onWheel); };
      } catch (error) {
        stage.dataset.abagsPhotorealV18Error = error instanceof Error ? error.message : "renderer-init-failed";
        retry = window.setTimeout(start, 500);
      }
    };
    start();
    return () => { dead=true; window.clearTimeout(retry); cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={ref} className="abags-photoreal-v18-canvas" aria-label="Fotorealistyczny podgląd torebki" />;
}
