"use client";

import { useEffect, useState } from "react";
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

function normalizeHex(value: string) {
  const source = value.replace("#", "").trim();
  if (source.length === 3) return source.split("").map((part) => part + part).join("");
  return source.padEnd(6, "0").slice(0, 6);
}

function mixHex(value: string, target: string, amount: number) {
  const left = Number.parseInt(normalizeHex(value), 16);
  const right = Number.parseInt(normalizeHex(target), 16);
  const read = (number: number, shift: number) => (number >> shift) & 255;
  const channel = (a: number, b: number) => Math.round(a + (b - a) * amount);
  const r = channel(read(left, 16), read(right, 16));
  const g = channel(read(left, 8), read(right, 8));
  const b = channel(read(left, 0), read(right, 0));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function bodyPath(family: BuilderConfig["family"]) {
  if (family === "round") return "M142 222 Q150 174 212 154 Q310 123 408 154 Q470 174 478 222 L490 332 Q496 408 444 455 Q391 502 310 502 Q229 502 176 455 Q124 408 130 332 Z";
  if (family === "bucket") return "M176 145 Q310 118 444 145 L473 442 Q478 489 435 505 Q310 535 185 505 Q142 489 147 442 Z";
  if (family === "mini") return "M188 205 Q192 173 226 163 L394 163 Q428 173 432 205 L445 414 Q448 451 414 466 Q310 490 206 466 Q172 451 175 414 Z";
  return "M147 173 Q151 142 186 136 L434 136 Q469 142 473 173 L487 454 Q489 491 450 502 L170 502 Q131 491 133 454 Z";
}

function flapPath(family: BuilderConfig["family"]) {
  if (family === "round") return "M161 215 Q310 106 459 215 Q432 305 310 329 Q188 305 161 215 Z";
  if (family === "mini") return "M190 199 Q310 151 430 199 L416 302 Q310 338 204 302 Z";
  return "M170 161 Q310 127 450 161 L434 290 Q310 334 186 290 Z";
}

function handleY(family: BuilderConfig["family"]) {
  if (family === "mini") return 174;
  if (family === "round") return 163;
  return 139;
}

function leatherColor(config: BuilderConfig) {
  if (config.flap === "leather-black") return "#232024";
  if (config.flap === "leather-cognac") return "#7A4C30";
  if (config.flap === "suede-burgundy") return "#743246";
  return config.color || "#E8DDCC";
}

function StitchPatterns({ bag, light, dark, deep }: { bag: string; light: string; dark: string; deep: string }) {
  return <>
    <pattern id="v7-yarn-classic" width="25" height="31" patternUnits="userSpaceOnUse">
      <rect width="25" height="31" fill={bag}/>
      <path d="M-5 31 C0 24 4 15 9 7 C13 1 17 -3 22 -8 M8 38 C13 30 17 21 22 13 C26 7 30 3 35 -2" fill="none" stroke={deep} strokeWidth="9.2" strokeLinecap="round" opacity=".34"/>
      <path d="M-4 28 C1 21 5 12 10 4 C14 -2 18 -6 23 -11 M9 35 C14 27 18 18 23 10 C27 4 31 0 36 -5" fill="none" stroke={light} strokeWidth="5.8" strokeLinecap="round" opacity=".7"/>
      <path d="M-3 29 C2 22 6 13 11 5 C15 -1 19 -5 24 -10 M10 36 C15 28 19 19 24 11 C28 5 32 1 37 -4" fill="none" stroke={bag} strokeWidth="3.4" strokeLinecap="round"/>
      <path d="M7 7 L16 14 M7 22 L16 29" stroke={dark} strokeWidth="1.2" opacity=".28" strokeLinecap="round"/>
    </pattern>
    <pattern id="v7-yarn-herringbone" width="38" height="34" patternUnits="userSpaceOnUse">
      <rect width="38" height="34" fill={bag}/>
      <path d="M-6 2 L8 17 L-6 33 M19 2 L33 17 L19 33 M44 2 L30 17 L44 33 M19 2 L5 17 L19 33" fill="none" stroke={deep} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity=".35"/>
      <path d="M-5 0 L9 15 L-5 31 M19 0 L33 15 L19 31 M43 0 L29 15 L43 31 M19 0 L5 15 L19 31" fill="none" stroke={light} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity=".68"/>
      <path d="M-4 2 L9 16 L-4 32 M19 2 L32 16 L19 32 M42 2 L29 16 L42 32 M19 2 L6 16 L19 32" fill="none" stroke={bag} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </pattern>
    <pattern id="v7-yarn-basket" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" fill={bag}/>
      <path d="M3 10 H37 M3 30 H37 M10 3 V37 M30 3 V37" stroke={deep} strokeWidth="10" strokeLinecap="round" opacity=".3"/>
      <path d="M3 7 H37 M3 27 H37 M7 3 V37 M27 3 V37" stroke={light} strokeWidth="5.2" strokeLinecap="round" opacity=".64"/>
      <path d="M4 9 H36 M4 29 H36 M9 4 V36 M29 4 V36" stroke={bag} strokeWidth="3.1" strokeLinecap="round"/>
    </pattern>
    <pattern id="v7-yarn-shell" width="44" height="38" patternUnits="userSpaceOnUse">
      <rect width="44" height="38" fill={bag}/>
      <path d="M2 33 Q11 7 22 33 Q33 7 42 33 M-20 14 Q-11 -11 0 14 Q11 -11 20 14 Q31 -11 42 14 Q53 -11 64 14" fill="none" stroke={deep} strokeWidth="9" strokeLinecap="round" opacity=".32"/>
      <path d="M2 29 Q11 5 22 29 Q33 5 42 29 M-20 10 Q-11 -13 0 10 Q11 -13 20 10 Q31 -13 42 10 Q53 -13 64 10" fill="none" stroke={light} strokeWidth="5" strokeLinecap="round" opacity=".68"/>
      <path d="M3 31 Q11 7 22 31 Q33 7 41 31 M-19 12 Q-11 -11 0 12 Q11 -11 20 12 Q31 -11 42 12 Q53 -11 63 12" fill="none" stroke={bag} strokeWidth="3.2" strokeLinecap="round"/>
    </pattern>
  </>;
}

function AtelierSvg({ config }: { config: BuilderConfig }) {
  const hasShape = Boolean(config.family);
  const hasColor = Boolean(config.color);
  const bag = config.color || "#E8DDCC";
  const light = mixHex(bag, "#ffffff", .54);
  const highlight = mixHex(bag, "#ffffff", .78);
  const dark = mixHex(bag, "#2b1b20", .34);
  const deep = mixHex(bag, "#120b0d", .52);
  const edge = mixHex(bag, "#1b1013", .45);
  const stitch = config.stitch || "classic";
  const body = bodyPath(config.family);
  const flap = flapPath(config.family);
  const leather = leatherColor(config);
  const leatherDark = mixHex(leather, "#120a0d", .38);
  const leatherLight = mixHex(leather, "#ffffff", .22);
  const metal = config.hardware === "silver" ? "#D7DBE0" : config.hardware === "black" ? "#2F2C30" : "#C9A45B";
  const metalDark = config.hardware === "silver" ? "#737981" : config.hardware === "black" ? "#111012" : "#6A4B1B";
  const handleTop = handleY(config.family);

  return <svg className="abags-atelier-v7-svg" viewBox="0 0 620 520" role="img" aria-label={hasShape ? "Realistyczny podgląd projektowanej torebki" : "Pusty podgląd projektowanej torebki"}>
    <defs>
      <linearGradient id="v7-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFEFD"/><stop offset=".66" stopColor="#FCF7F3"/><stop offset="1" stopColor="#F1E7DF"/></linearGradient>
      <radialGradient id="v7-room-light" cx="26%" cy="12%" r="78%"><stop offset="0" stopColor="#ffffff" stopOpacity=".95"/><stop offset=".5" stopColor="#ffffff" stopOpacity=".18"/><stop offset="1" stopColor="#ffffff" stopOpacity="0"/></radialGradient>
      <linearGradient id="v7-side-shadow" x1="0" x2="1"><stop offset="0" stopColor={deep} stopOpacity=".42"/><stop offset=".2" stopColor={dark} stopOpacity=".12"/><stop offset=".52" stopColor="#fff" stopOpacity="0"/><stop offset=".82" stopColor={dark} stopOpacity=".08"/><stop offset="1" stopColor={deep} stopOpacity=".36"/></linearGradient>
      <linearGradient id="v7-bottom-shadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={deep} stopOpacity="0"/><stop offset=".66" stopColor={dark} stopOpacity=".06"/><stop offset="1" stopColor={deep} stopOpacity=".33"/></linearGradient>
      <linearGradient id="v7-leather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={leatherLight}/><stop offset=".28" stopColor={leather}/><stop offset="1" stopColor={leatherDark}/></linearGradient>
      <linearGradient id="v7-wood-light" x1="0" x2="1"><stop offset="0" stopColor="#9F6937"/><stop offset=".18" stopColor="#EBC98E"/><stop offset=".42" stopColor="#B57D45"/><stop offset=".66" stopColor="#F2D9A4"/><stop offset="1" stopColor="#8E572D"/></linearGradient>
      <linearGradient id="v7-wood-dark" x1="0" x2="1"><stop offset="0" stopColor="#271109"/><stop offset=".2" stopColor="#6C3A25"/><stop offset=".46" stopColor="#35180E"/><stop offset=".72" stopColor="#87523A"/><stop offset="1" stopColor="#241008"/></linearGradient>
      <linearGradient id="v7-woven" x1="0" x2="1"><stop offset="0" stopColor="#F1E2CC"/><stop offset=".14" stopColor="#74505B"/><stop offset=".3" stopColor="#E9D8C7"/><stop offset=".46" stopColor="#C99A38"/><stop offset=".62" stopColor="#4C6576"/><stop offset=".78" stopColor="#E9D8C7"/><stop offset="1" stopColor="#805663"/></linearGradient>
      <radialGradient id="v7-metal" cx="32%" cy="24%" r="78%"><stop offset="0" stopColor="#fff"/><stop offset=".16" stopColor={mixHex(metal,"#fff",.55)}/><stop offset=".5" stopColor={metal}/><stop offset=".78" stopColor={metalDark}/><stop offset="1" stopColor={mixHex(metal,"#000",.55)}/></radialGradient>
      <filter id="v7-product-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#4D3438" floodOpacity=".24"/></filter>
      <filter id="v7-soft-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#3C282C" floodOpacity=".26"/></filter>
      <filter id="v7-metal-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="1.8" floodColor="#271B1E" floodOpacity=".35"/></filter>
      <clipPath id="v7-body-clip"><path d={body}/></clipPath>
      <clipPath id="v7-flap-clip"><path d={flap}/></clipPath>
      <StitchPatterns bag={bag} light={light} dark={dark} deep={deep}/>
    </defs>

    <rect x="8" y="8" width="604" height="504" rx="38" fill="url(#v7-bg)"/>
    <rect x="8" y="8" width="604" height="504" rx="38" fill="url(#v7-room-light)"/>
    <path d="M8 374 H612 V512 H8 Z" fill="#E9DDD4" opacity=".55"/>
    <path d="M8 374 H612" stroke="#D8C8BE" strokeWidth="1.5" opacity=".45"/>
    <ellipse cx="310" cy="477" rx="176" ry="24" fill="#4C3438" opacity={hasShape ? .17 : .05}/>

    {!hasShape && <g className="abags-v7-empty">
      <path d="M204 176 Q310 126 416 176 L435 408 Q310 466 185 408 Z" fill="none" stroke="#CDBABD" strokeWidth="4" strokeDasharray="10 10" opacity=".72"/>
      <text x="310" y="279" textAnchor="middle">Wybierz fason</text>
      <text x="310" y="306" textAnchor="middle" className="is-small">Torebka będzie budowana tutaj, warstwa po warstwie</text>
    </g>}

    {hasShape && !hasColor && <g filter="url(#v7-product-shadow)">
      <path d={body} fill="#FFFDFC" stroke="#CDBABD" strokeWidth="5" strokeDasharray="12 10"/>
      <path d={body} fill="none" stroke="#fff" strokeWidth="2" opacity=".75" transform="translate(0 -2)"/>
    </g>}

    {hasShape && hasColor && <g filter="url(#v7-product-shadow)">
      {config.strap !== "none" && <g data-v7-layer="strap">
        {config.strap === "chain" ? <>
          <path d="M148 239 C76 159 89 69 192 42 C311 10 458 42 475 164 C483 209 462 241 458 262" fill="none" stroke={metalDark} strokeWidth="14" strokeDasharray="2 11" strokeLinecap="round" opacity=".52"/>
          <path d="M148 236 C76 156 89 66 192 39 C311 7 458 39 475 161 C483 206 462 238 458 259" fill="none" stroke="url(#v7-metal)" strokeWidth="8.5" strokeDasharray="2 11" strokeLinecap="round" filter="url(#v7-metal-shadow)"/>
        </> : <>
          <path d="M150 241 C85 162 94 80 193 48 C310 10 451 43 468 167 C475 209 462 235 459 256" fill="none" stroke={config.strap === "woven" ? "url(#v7-woven)" : leatherDark} strokeWidth={config.strap === "woven" ? 27 : 24} strokeLinecap="round" filter="url(#v7-soft-shadow)"/>
          <path d="M150 236 C86 158 95 76 194 45 C310 8 449 42 465 165 C472 204 459 231 456 252" fill="none" stroke={config.strap === "woven" ? "#fff6e8" : leatherLight} strokeWidth="3" strokeLinecap="round" opacity=".42"/>
          {config.strap === "woven" && <path d="M151 241 C86 162 95 80 194 48 C310 11 450 44 467 167 C474 208 461 234 458 256" fill="none" stroke="#503F47" strokeWidth="3" strokeDasharray="8 11" opacity=".38"/>}
        </>}
      </g>}

      {config.handles !== "none" && <g data-v7-layer="handles">
        {config.handles === "crochet" ? <>
          <path d={`M218 ${handleTop + 36} C212 ${handleTop - 74} 408 ${handleTop - 74} 402 ${handleTop + 36}`} fill="none" stroke={deep} strokeWidth="31" strokeLinecap="round" opacity=".5"/>
          <path d={`M218 ${handleTop + 32} C212 ${handleTop - 78} 408 ${handleTop - 78} 402 ${handleTop + 32}`} fill="none" stroke={bag} strokeWidth="24" strokeLinecap="round"/>
          <path d={`M220 ${handleTop + 27} C217 ${handleTop - 69} 403 ${handleTop - 69} 400 ${handleTop + 27}`} fill="none" stroke={highlight} strokeWidth="4" strokeDasharray="7 6" strokeLinecap="round" opacity=".62"/>
        </> : <>
          <path d={`M222 ${handleTop + 31} C210 ${handleTop - 94} 410 ${handleTop - 94} 398 ${handleTop + 31}`} fill="none" stroke="#25130D" strokeWidth="35" strokeLinecap="round" opacity=".3"/>
          <path d={`M222 ${handleTop + 27} C210 ${handleTop - 98} 410 ${handleTop - 98} 398 ${handleTop + 27}`} fill="none" stroke={config.handles === "wood-dark" ? "url(#v7-wood-dark)" : "url(#v7-wood-light)"} strokeWidth="29" strokeLinecap="round"/>
          <path d={`M226 ${handleTop + 18} C222 ${handleTop - 86} 398 ${handleTop - 86} 394 ${handleTop + 18}`} fill="none" stroke="#FFF2D1" strokeWidth="3" strokeLinecap="round" opacity=".44"/>
          <path d={`M236 ${handleTop - 26} C278 ${handleTop - 57} 342 ${handleTop - 57} 384 ${handleTop - 26}`} fill="none" stroke="#5B341F" strokeWidth="2" strokeDasharray="14 9" opacity=".38"/>
        </>}
      </g>}

      <g data-v7-layer="body">
        <path d={body} fill={`url(#v7-yarn-${stitch})`} stroke={edge} strokeWidth="7" strokeLinejoin="round"/>
        <g clipPath="url(#v7-body-clip)">
          <rect x="122" y="112" width="380" height="420" fill="url(#v7-side-shadow)" opacity=".7"/>
          <rect x="122" y="112" width="380" height="420" fill="url(#v7-bottom-shadow)" opacity=".7"/>
          <ellipse cx="250" cy="160" rx="150" ry="110" fill="#fff" opacity=".12"/>
          <path d="M162 196 Q310 155 458 196" fill="none" stroke={highlight} strokeWidth="4" opacity=".25"/>
        </g>
        <path d={body} fill="none" stroke={highlight} strokeWidth="2.2" strokeLinejoin="round" opacity=".42" transform="translate(0 -2)"/>
        <path d={body} fill="none" stroke={deep} strokeWidth="2" strokeLinejoin="round" opacity=".34" transform="translate(0 3)"/>
        <path d="M168 464 Q310 490 452 464" fill="none" stroke={deep} strokeWidth="4" opacity=".16" strokeLinecap="round"/>
      </g>

      {config.flap !== "none" && <g data-v7-layer="flap">
        <path d={flap} fill={config.flap === "crochet" ? `url(#v7-yarn-${stitch})` : "url(#v7-leather)"} stroke={config.flap === "crochet" ? edge : leatherDark} strokeWidth="5" filter="url(#v7-soft-shadow)"/>
        <g clipPath="url(#v7-flap-clip)">
          {config.flap !== "crochet" && <>
            <path d="M155 178 Q310 127 465 178" fill="none" stroke="#fff" strokeWidth="7" opacity=".12"/>
            <path d="M190 198 Q310 169 430 198" fill="none" stroke="#fff" strokeWidth="1.3" strokeDasharray="2 6" opacity=".34"/>
            <rect x="155" y="150" width="310" height="190" fill="url(#v7-bottom-shadow)" opacity=".28"/>
          </>}
        </g>
        <circle cx="310" cy={config.family === "round" ? 277 : config.family === "mini" ? 268 : 263} r="19" fill="url(#v7-metal)" stroke={metalDark} strokeWidth="2" filter="url(#v7-metal-shadow)"/>
        <ellipse cx="304" cy={config.family === "round" ? 271 : config.family === "mini" ? 262 : 257} rx="7" ry="5" fill="#fff" opacity=".72"/>
      </g>}

      {(config.strap !== "none" || config.handles !== "none") && <g data-v7-layer="hardware" filter="url(#v7-metal-shadow)">
        <circle cx="159" cy="226" r="12" fill="url(#v7-metal)" stroke={metalDark} strokeWidth="2"/><circle cx="461" cy="226" r="12" fill="url(#v7-metal)" stroke={metalDark} strokeWidth="2"/>
        <circle cx="159" cy="226" r="5" fill="#fff" opacity=".28"/><circle cx="461" cy="226" r="5" fill="#fff" opacity=".28"/>
      </g>}

      {config.accent === "tassel" && <g data-v7-layer="accent" filter="url(#v7-soft-shadow)">
        <circle cx="466" cy="246" r="9" fill="url(#v7-metal)"/>
        <path d="M468 253 Q483 266 478 286" fill="none" stroke={bag} strokeWidth="9" strokeLinecap="round"/>
        {Array.from({ length: 12 }, (_, index) => <path key={index} d={`M${452 + index * 3} 282 Q${455 + index * 3} ${329 + (index % 3) * 3} ${449 + index * 3.8} 382`} fill="none" stroke={index % 3 === 0 ? light : index % 3 === 1 ? bag : dark} strokeWidth={index % 2 ? 4.3 : 5.2} strokeLinecap="round"/>)}
      </g>}

      {config.accent === "scarf" && <g data-v7-layer="accent" filter="url(#v7-soft-shadow)">
        <path d="M191 174 C157 146 133 161 149 191 C164 218 195 205 202 181 C211 209 243 219 258 192 C276 159 244 143 209 173 Z" fill="#EFBCC8" stroke="#fff" strokeWidth="3"/>
        <path d="M175 188 Q191 176 205 191 Q191 212 173 206 Z" fill="#8A5D78" opacity=".72"/>
        <path d="M211 187 Q227 175 244 191 Q229 210 211 204 Z" fill="#C99A38" opacity=".8"/>
        <circle cx="203" cy="187" r="7" fill="#A65E73"/>
      </g>}

      {config.accent === "charm" && <g data-v7-layer="accent" filter="url(#v7-soft-shadow)">
        <path d="M455 241 Q489 255 485 289" fill="none" stroke="url(#v7-metal)" strokeWidth="5"/>
        <path d="M485 287 C470 268 448 289 485 321 C522 289 500 268 485 287 Z" fill="#B87880" stroke={metalDark} strokeWidth="2.5"/>
        <path d="M476 285 Q485 278 494 285" fill="none" stroke="#fff" strokeWidth="2" opacity=".6"/>
      </g>}

      <g data-v7-layer="label" filter="url(#v7-metal-shadow)">
        <rect x="268" y="439" width="84" height="25" rx="8" fill="url(#v7-metal)" stroke={metalDark} strokeWidth="1.2"/>
        <rect x="274" y="444" width="72" height="12" rx="5" fill="#fff" opacity=".1"/>
        <text x="310" y="456" textAnchor="middle" fill="#fff" fontSize="10" fontFamily="serif" fontWeight="600">a_bags</text>
      </g>
    </g>}
  </svg>;
}

export default function AtelierBagRendererV7() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [config, setConfig] = useState<BuilderConfig>(EMPTY);

  useEffect(() => {
    const find = () => {
      const next = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
      setStage((current) => current === next ? current : next);
    };
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!stage) return;
    stage.classList.add("abags-v7-active");
    const sync = () => {
      const next = readConfig(stage);
      setConfig((current) => sameConfig(current, next) ? current : next);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(stage, { attributes: true, attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent", "data-builder-signature"] });
    return () => {
      observer.disconnect();
      stage.classList.remove("abags-v7-active");
    };
  }, [stage]);

  if (!stage) return null;

  return createPortal(
    <div className="abags-atelier-v7-layer" aria-hidden="true">
      <AtelierSvg config={config}/>
    </div>,
    stage,
  );
}
