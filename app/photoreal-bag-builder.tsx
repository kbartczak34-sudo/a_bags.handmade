"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  EXACT_ATELIER_LIBRARY,
  EXACT_ATELIER_SPRITE_PARTS,
  type ExactAtelierReference,
} from "../lib/exact-customizer-library";

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

const COLOR_LABELS: Record<string, string> = {
  "#E8DDCC": "Naturalny beż",
  "#E4A9B5": "Pudrowy róż",
  "#24324D": "Głęboki granat",
  "#65493D": "Czekoladowy brąz",
  "#C7962F": "Musztardowy",
  "#222124": "Czarny",
  "#B93A42": "Czerwony",
  "#275C4A": "Butelkowa zieleń",
  "#087E81": "Turkus",
  "#A88AE0": "Lawendowy",
};

function sameConfig(a: BuilderConfig, b: BuilderConfig) {
  return a.family === b.family && a.color === b.color && a.stitch === b.stitch && a.flap === b.flap && a.handles === b.handles && a.strap === b.strap && a.hardware === b.hardware && a.accent === b.accent;
}

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

function clamp(value: number, min = 0, max = 255) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value: string) {
  const hex = value.replace("#", "").trim();
  return hex.length === 3 ? hex.split("").map((item) => item + item).join("") : hex.padEnd(6, "0").slice(0, 6);
}

function mixHex(value: string, target: string, amount: number) {
  const a = Number.parseInt(normalizeHex(value), 16);
  const b = Number.parseInt(normalizeHex(target), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(clamp(ar + (br - ar) * amount));
  const g = Math.round(clamp(ag + (bg - ag) * amount));
  const bl = Math.round(clamp(ab + (bb - ab) * amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

function bodyPath(family: BuilderConfig["family"]) {
  if (family === "round") return "M135 235 Q140 185 205 165 Q300 132 395 165 Q460 185 465 235 L478 335 Q486 414 432 470 Q378 525 300 525 Q222 525 168 470 Q114 414 122 335 Z";
  if (family === "bucket") return "M165 160 Q300 130 435 160 L468 456 Q472 505 424 520 Q300 548 176 520 Q128 505 132 456 Z";
  if (family === "mini") return "M175 220 Q180 185 218 175 L382 175 Q420 185 425 220 L440 430 Q442 470 405 485 Q158 470 160 430 Z";
  return "M135 185 Q140 150 178 145 L422 145 Q460 150 465 185 L478 465 Q480 505 440 515 L160 515 Q120 505 122 465 Z";
}

function correctedBodyPath(family: BuilderConfig["family"]) {
  if (family !== "mini") return bodyPath(family);
  return "M175 220 Q180 185 218 175 L382 175 Q420 185 425 220 L440 430 Q442 470 405 485 Q300 510 195 485 Q158 470 160 430 Z";
}

function flapPath(family: BuilderConfig["family"]) {
  if (family === "round") return "M155 225 Q300 105 445 225 Q420 315 300 340 Q180 315 155 225 Z";
  if (family === "mini") return "M178 212 Q300 160 422 212 L408 315 Q300 350 192 315 Z";
  return "M160 170 Q300 135 440 170 L425 300 Q300 350 175 300 Z";
}

function topY(family: BuilderConfig["family"]) {
  if (family === "mini") return 190;
  if (family === "round") return 175;
  return 150;
}

function builderColorKey(color: string) {
  const map: Record<string, string[]> = {
    "#E8DDCC": ["cream", "taupe", "brown-ombre"],
    "#E4A9B5": ["pink", "pink-ombre", "pastel-blue", "pastel"],
    "#24324D": ["navy"],
    "#65493D": ["brown-ombre", "taupe"],
    "#C7962F": ["mustard"],
    "#222124": ["black"],
    "#B93A42": ["red"],
    "#275C4A": ["green"],
    "#087E81": ["teal"],
    "#A88AE0": ["multicolor", "pastel-blue", "pink"],
  };
  return map[color] ?? [];
}

function familyScore(reference: ExactAtelierReference, family: BuilderConfig["family"]) {
  if (!family) return 0;
  if (family === "round") return reference.family === "round" ? 8 : 0;
  if (family === "tote") return reference.family === "tote" ? 8 : reference.family === "structured" ? 5 : 0;
  if (family === "bucket") return reference.family === "flap" ? 8 : reference.family === "structured" ? 4 : 0;
  return reference.family === "structured" ? 8 : reference.family === "flap" ? 4 : 0;
}

function stitchScore(reference: ExactAtelierReference, stitch: BuilderConfig["stitch"]) {
  if (!stitch) return 0;
  if (stitch === "basket") return reference.stitch === "basket" ? 4 : 0;
  if (stitch === "shell") return reference.stitch === "radial" ? 4 : 0;
  if (stitch === "herringbone") return reference.stitch === "vertical-open" ? 4 : reference.stitch === "open-v" ? 2 : 0;
  return reference.stitch === "open-v" ? 4 : reference.stitch === "vertical-open" ? 2 : 0;
}

function flapScore(reference: ExactAtelierReference, config: BuilderConfig) {
  if (config.flap === "none") return reference.flap === "none" ? 4 : 0;
  if (config.flap === "crochet") return reference.flap.startsWith("crochet") ? 4 : 0;
  if (config.flap === "leather-black") return reference.id === "black-leather-flap" ? 5 : reference.flap.startsWith("leather") ? 3 : 0;
  if (config.flap === "leather-cognac") return reference.flap === "leather-envelope" ? 5 : reference.flap.startsWith("leather") ? 3 : 0;
  return reference.flap === "suede-round" ? 5 : 0;
}

function strapScore(reference: ExactAtelierReference, strap: BuilderConfig["strap"]) {
  if (strap === "none") return reference.strap === "none" ? 2 : 0;
  if (strap === "woven") return reference.strap.startsWith("woven") ? 2 : 0;
  if (strap === "chain") return reference.strap === "chain-leather" ? 2 : 0;
  return reference.strap.startsWith("leather") || reference.strap === "burgundy" ? 2 : 0;
}

function accentScore(reference: ExactAtelierReference, accent: BuilderConfig["accent"]) {
  if (accent === "none") return reference.accent === "none" ? 2 : 0;
  if (accent === "tassel") return reference.accent.startsWith("tassel") ? 2 : 0;
  if (accent === "scarf") return reference.accent === "scarf" ? 2 : 0;
  return reference.accent === "charm" || reference.accent === "stones" ? 2 : 0;
}

function nearestReference(config: BuilderConfig) {
  if (!config.family) return null;
  const colorKeys = builderColorKey(config.color);
  let possible = 8;
  if (config.color) possible += 7;
  if (config.stitch) possible += 4;
  possible += 4 + 2 + 2 + 2 + 1;

  const ranked = EXACT_ATELIER_LIBRARY.map((reference) => {
    let score = familyScore(reference, config.family);
    if (config.color) {
      const colorIndex = colorKeys.indexOf(reference.color);
      if (colorIndex === 0) score += 7;
      else if (colorIndex > 0) score += Math.max(2, 6 - colorIndex);
    }
    score += stitchScore(reference, config.stitch);
    score += flapScore(reference, config);
    score += reference.handles === config.handles ? 2 : 0;
    score += strapScore(reference, config.strap);
    score += accentScore(reference, config.accent);
    if (config.hardware === "gold" && (reference.hardware === "gold" || reference.hardware === "bronze")) score += 1;
    return { reference, score, confidence: possible ? Math.round((score / possible) * 100) : 0 };
  }).sort((a, b) => b.score - a.score);

  return ranked[0] ?? null;
}

function spritePosition(index: number) {
  const col = index % 5;
  const row = Math.floor(index / 5);
  return {
    backgroundPosition: `${col * 25}% ${row * (100 / 3)}%`,
  };
}

function useAtelierSprite() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    Promise.all(EXACT_ATELIER_SPRITE_PARTS.map(async (part) => {
      const response = await fetch(part, { cache: "force-cache", signal: controller.signal });
      if (!response.ok) throw new Error(`sprite part ${response.status}`);
      return response.text();
    })).then((parts) => {
      if (controller.signal.aborted) return;
      const encoded = parts.join("").replace(/\s+/g, "");
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
      setUrl(objectUrl);
    }).catch(() => { if (!controller.signal.aborted) setUrl(null); });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);
  return url;
}

function PhotorealSvg({ config }: { config: BuilderConfig }) {
  const hasShape = Boolean(config.family);
  const body = correctedBodyPath(config.family);
  const bag = config.color || "#E8DDCC";
  const dark = mixHex(bag, "#1f1518", 0.34);
  const deeper = mixHex(bag, "#000000", 0.5);
  const light = mixHex(bag, "#ffffff", 0.5);
  const glow = mixHex(bag, "#ffffff", 0.72);
  const metal = config.hardware === "silver" ? "#D2D6DB" : config.hardware === "black" ? "#302E31" : "#C9A45B";
  const metalDark = config.hardware === "silver" ? "#70757C" : config.hardware === "black" ? "#111113" : "#73531F";
  const handle = topY(config.family);
  const stitch = config.stitch || "classic";
  const leather = config.flap === "leather-black" ? "#211E20" : config.flap === "leather-cognac" ? "#805333" : config.flap === "suede-burgundy" ? "#7A3044" : bag;
  const leatherDark = mixHex(leather, "#130D0F", 0.42);
  const leatherLight = mixHex(leather, "#ffffff", 0.16);

  return <svg className="abags-photoreal-svg" viewBox="0 0 600 560" role="img" aria-label={hasShape ? `Fotorealistyczny podgląd: ${COLOR_LABELS[config.color] ?? "wybrany kolor"}` : "Pusty fotorealistyczny podgląd konfiguratora"}>
    <defs>
      <linearGradient id="pr-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFDFB"/><stop offset=".64" stopColor="#FBF5F0"/><stop offset="1" stopColor="#F1E7DF"/></linearGradient>
      <radialGradient id="pr-light" cx="26%" cy="12%" r="78%"><stop offset="0" stopColor="#FFFFFF" stopOpacity=".92"/><stop offset=".46" stopColor="#FFFFFF" stopOpacity=".22"/><stop offset="1" stopColor="#E9D9CF" stopOpacity="0"/></radialGradient>
      <linearGradient id="pr-bag" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={light}/><stop offset=".24" stopColor={bag}/><stop offset=".64" stopColor={mixHex(bag,"#ffffff",.08)}/><stop offset="1" stopColor={dark}/></linearGradient>
      <linearGradient id="pr-bag-edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={deeper}/><stop offset=".48" stopColor={bag}/><stop offset="1" stopColor={deeper}/></linearGradient>
      <linearGradient id="pr-leather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={leatherLight}/><stop offset=".34" stopColor={leather}/><stop offset="1" stopColor={leatherDark}/></linearGradient>
      <linearGradient id="pr-wood-light" x1="0" x2="1"><stop offset="0" stopColor="#B98245"/><stop offset=".2" stopColor="#F2D8A2"/><stop offset=".48" stopColor="#C59457"/><stop offset=".7" stopColor="#F5DEAE"/><stop offset="1" stopColor="#9E6935"/></linearGradient>
      <linearGradient id="pr-wood-dark" x1="0" x2="1"><stop offset="0" stopColor="#2B120B"/><stop offset=".2" stopColor="#6F3D29"/><stop offset=".5" stopColor="#3B1A10"/><stop offset=".74" stopColor="#86523A"/><stop offset="1" stopColor="#251009"/></linearGradient>
      <linearGradient id="pr-woven" x1="0" x2="1"><stop offset="0" stopColor="#EBDCC6"/><stop offset=".18" stopColor="#7E5360"/><stop offset=".36" stopColor="#F0E5D8"/><stop offset=".54" stopColor="#C7962F"/><stop offset=".72" stopColor="#4A6476"/><stop offset=".9" stopColor="#EBDCC6"/><stop offset="1" stopColor="#8A666C"/></linearGradient>
      <radialGradient id="pr-metal" cx="34%" cy="28%" r="75%"><stop offset="0" stopColor="#FFFFFF"/><stop offset=".18" stopColor={mixHex(metal,"#ffffff",.5)}/><stop offset=".52" stopColor={metal}/><stop offset=".78" stopColor={metalDark}/><stop offset="1" stopColor={mixHex(metal,"#000000",.52)}/></radialGradient>
      <filter id="pr-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="18" stdDeviation="15" floodColor="#51383C" floodOpacity=".22"/></filter>
      <filter id="pr-yarn-depth" x="-12%" y="-12%" width="124%" height="124%"><feTurbulence type="fractalNoise" baseFrequency=".018 .28" numOctaves="2" seed="13" result="noise"/><feColorMatrix in="noise" type="saturate" values="0" result="gray"/><feBlend in="SourceGraphic" in2="gray" mode="soft-light" result="textured"/><feSpecularLighting in="gray" surfaceScale="1.8" specularConstant=".22" specularExponent="12" lightingColor="#ffffff" result="spec"><feDistantLight azimuth="225" elevation="62"/></feSpecularLighting><feComposite in="spec" in2="SourceAlpha" operator="in" result="specClip"/><feBlend in="textured" in2="specClip" mode="screen"/></filter>
      <filter id="pr-leather-grain" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".18" numOctaves="3" seed="5" result="grain"/><feColorMatrix in="grain" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .22 0"/><feBlend in="SourceGraphic" mode="multiply"/></filter>
      <filter id="pr-wood-grain" x="-12%" y="-12%" width="124%" height="124%"><feTurbulence type="fractalNoise" baseFrequency=".015 .16" numOctaves="2" seed="8" result="wood"/><feDisplacementMap in="SourceGraphic" in2="wood" scale="2.5" xChannelSelector="R" yChannelSelector="G"/><feBlend in="SourceGraphic" in2="wood" mode="soft-light"/></filter>
      <pattern id="pr-stitch-classic" width="26" height="28" patternUnits="userSpaceOnUse"><rect width="26" height="28" fill="url(#pr-bag)"/><path d="M-5 27 C2 17 8 8 16 -3 M9 31 C17 20 22 11 31 1" fill="none" stroke={deeper} strokeWidth="8" strokeLinecap="round" opacity=".32"/><path d="M-4 24 C3 14 9 6 17 -5 M10 28 C18 17 23 9 32 -1" fill="none" stroke={light} strokeWidth="5" strokeLinecap="round" opacity=".5"/><path d="M-3 23 C4 13 10 5 18 -6 M11 27 C19 16 24 8 33 -2" fill="none" stroke={bag} strokeWidth="3.2" strokeLinecap="round"/></pattern>
      <pattern id="pr-stitch-herringbone" width="36" height="34" patternUnits="userSpaceOnUse"><rect width="36" height="34" fill="url(#pr-bag)"/><path d="M-4 2 L9 17 L-4 32 M18 2 L31 17 L18 32 M40 2 L27 17 L40 32 M18 2 L5 17 L18 32" fill="none" stroke={deeper} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity=".34"/><path d="M-4 0 L9 15 L-4 30 M18 0 L31 15 L18 30 M40 0 L27 15 L40 30 M18 0 L5 15 L18 30" fill="none" stroke={light} strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" opacity=".46"/></pattern>
      <pattern id="pr-stitch-basket" width="34" height="34" patternUnits="userSpaceOnUse"><rect width="34" height="34" fill="url(#pr-bag)"/><path d="M4 9 H30 M4 26 H30 M9 4 V30 M26 4 V30" stroke={deeper} strokeWidth="8" strokeLinecap="round" opacity=".28"/><path d="M4 7 H30 M4 24 H30 M7 4 V30 M24 4 V30" stroke={light} strokeWidth="4.5" strokeLinecap="round" opacity=".5"/></pattern>
      <pattern id="pr-stitch-shell" width="42" height="36" patternUnits="userSpaceOnUse"><rect width="42" height="36" fill="url(#pr-bag)"/><path d="M2 31 Q10 7 21 31 Q32 7 40 31 M-19 13 Q-11 -10 0 13 Q11 -10 19 13 Q30 -10 38 13 Q49 -10 57 13" fill="none" stroke={deeper} strokeWidth="8" strokeLinecap="round" opacity=".3"/><path d="M2 28 Q10 5 21 28 Q32 5 40 28 M-19 10 Q-11 -12 0 10 Q11 -12 19 10 Q30 -12 38 10 Q49 -12 57 10" fill="none" stroke={light} strokeWidth="4.5" strokeLinecap="round" opacity=".5"/></pattern>
    </defs>

    <rect x="16" y="10" width="568" height="536" rx="38" fill="url(#pr-bg)"/>
    <rect x="16" y="10" width="568" height="536" rx="38" fill="url(#pr-light)"/>
    <path d="M16 395 H584 V546 H16 Z" fill="#EADDD3" opacity=".5"/>
    <path d="M16 395 H584" stroke="#D9C8BC" strokeWidth="2" opacity=".42"/>
    <ellipse cx="300" cy="500" rx="178" ry="27" fill="#5A4245" opacity={hasShape ? ".16" : ".06"}/>

    {!hasShape && <g><path d="M190 190 Q300 135 410 190 L430 430 Q300 490 170 430 Z" fill="none" stroke="#CDBABD" strokeWidth="4" strokeDasharray="10 10" opacity=".65"/><text x="300" y="300" textAnchor="middle" fill="#805A61" fontSize="26" fontFamily="serif">Wybierz fason</text><text x="300" y="328" textAnchor="middle" fill="#9B8589" fontSize="11" fontFamily="sans-serif">Atelier Render uruchomi materiał i światło</text></g>}

    {hasShape && <g filter="url(#pr-shadow)">
      {config.strap !== "none" && <g data-photoreal-layer="strap">
        {config.strap === "chain" ? <>
          <path d="M142 253 C72 164 80 72 181 44 C302 10 451 43 470 176 C478 223 458 250 454 272" fill="none" stroke={metalDark} strokeWidth="14" strokeDasharray="2 11" strokeLinecap="round" opacity=".55"/>
          <path d="M142 251 C72 162 80 70 181 42 C302 8 451 41 470 174 C478 221 458 248 454 270" fill="none" stroke="url(#pr-metal)" strokeWidth="9" strokeDasharray="2 11" strokeLinecap="round"/>
        </> : <>
          <path d="M146 254 C82 170 90 84 185 50 C300 10 445 46 462 180 C470 225 455 250 452 270" fill="none" stroke={config.strap === "woven" ? "url(#pr-woven)" : leatherDark} strokeWidth={config.strap === "woven" ? 27 : 24} strokeLinecap="round"/>
          <path d="M146 251 C82 167 90 81 185 47 C300 7 445 43 462 177 C470 222 455 247 452 267" fill="none" stroke={config.strap === "woven" ? "#FFF7EE" : leatherLight} strokeWidth="3" strokeLinecap="round" opacity=".45"/>
        </>}
      </g>}

      {config.handles !== "none" && <g data-photoreal-layer="handles">
        {config.handles === "crochet" ? <>
          <path d={`M210 ${handle + 37} C205 ${handle - 78} 395 ${handle - 78} 390 ${handle + 37}`} fill="none" stroke={deeper} strokeWidth="31" strokeLinecap="round" opacity=".5"/>
          <path d={`M210 ${handle + 34} C205 ${handle - 80} 395 ${handle - 80} 390 ${handle + 34}`} fill="none" stroke={`url(#pr-stitch-${stitch})`} strokeWidth="25" strokeLinecap="round" filter="url(#pr-yarn-depth)"/>
        </> : <>
          <path d={`M215 ${handle + 31} C205 ${handle - 95} 395 ${handle - 95} 385 ${handle + 31}`} fill="none" stroke="#2D1811" strokeWidth="35" strokeLinecap="round" opacity=".3"/>
          <path d={`M215 ${handle + 28} C205 ${handle - 98} 395 ${handle - 98} 385 ${handle + 28}`} fill="none" stroke={config.handles === "wood-dark" ? "url(#pr-wood-dark)" : "url(#pr-wood-light)"} strokeWidth="29" strokeLinecap="round" filter="url(#pr-wood-grain)"/>
          <path d={`M220 ${handle + 21} C215 ${handle - 88} 385 ${handle - 88} 380 ${handle + 21}`} fill="none" stroke="#FFF5D7" strokeWidth="3" strokeLinecap="round" opacity=".42"/>
        </>}
      </g>}

      <path d={body} fill={`url(#pr-stitch-${stitch})`} stroke="url(#pr-bag-edge)" strokeWidth="8" strokeLinejoin="round" filter="url(#pr-yarn-depth)" data-photoreal-layer="body"/>
      <path d={body} fill="none" stroke={glow} strokeWidth="2.2" strokeLinejoin="round" opacity=".5" transform="translate(0 -2)"/>
      <path d={body} fill="none" stroke={deeper} strokeWidth="2" strokeLinejoin="round" opacity=".34" transform="translate(0 3)"/>

      {config.flap !== "none" && <g data-photoreal-layer="flap">
        <path d={flapPath(config.family)} fill={config.flap === "crochet" ? `url(#pr-stitch-${stitch})` : "url(#pr-leather)"} stroke={config.flap === "crochet" ? deeper : leatherDark} strokeWidth="5" filter={config.flap === "crochet" ? "url(#pr-yarn-depth)" : "url(#pr-leather-grain)"}/>
        {config.flap !== "crochet" && <path d={flapPath(config.family)} fill="none" stroke="#FFFFFF" strokeWidth="2" opacity=".22" transform="translate(0 -2)"/>}
        <circle cx="300" cy={config.family === "round" ? 286 : config.family === "mini" ? 278 : 274} r="20" fill="url(#pr-metal)" stroke={metalDark} strokeWidth="2"/>
        <ellipse cx="294" cy={config.family === "round" ? 280 : config.family === "mini" ? 272 : 268} rx="7" ry="5" fill="#FFF" opacity=".72"/>
      </g>}

      {(config.strap !== "none" || config.handles !== "none") && <g data-photoreal-layer="hardware"><circle cx="150" cy="238" r="13" fill="url(#pr-metal)" stroke={metalDark} strokeWidth="2"/><circle cx="450" cy="238" r="13" fill="url(#pr-metal)" stroke={metalDark} strokeWidth="2"/><circle cx="150" cy="238" r="6" fill="#FFF" opacity=".25"/><circle cx="450" cy="238" r="6" fill="#FFF" opacity=".25"/></g>}

      {config.accent === "tassel" && <g data-photoreal-layer="accent"><circle cx="468" cy="252" r="10" fill="url(#pr-metal)"/><path d="M470 259 Q486 270 481 293" fill="none" stroke={bag} strokeWidth="10" strokeLinecap="round"/>{Array.from({length:13},(_,index) => <path key={index} d={`M${456 + index * 3} 289 Q${459 + index * 3} ${350 + (index % 3) * 4} ${451 + index * 4} 409`} fill="none" stroke={index % 3 === 0 ? light : index % 3 === 1 ? bag : dark} strokeWidth={index % 2 ? 4.8 : 5.6} strokeLinecap="round" opacity={.82 + (index % 4) * .04}/>)}</g>}

      {config.accent === "scarf" && <g data-photoreal-layer="accent"><path d="M187 177 C136 134 103 158 129 207 C153 250 198 220 205 191 C216 231 260 251 281 211 C304 165 260 137 211 175 Z" fill="#F2C3CF" stroke="#FFFFFF" strokeWidth="3"/><path d="M197 191 L144 360 Q175 372 201 350 L220 207 Z" fill="#F8DCE4"/><path d="M211 194 L256 346 Q280 334 288 309 L224 202 Z" fill="#C96784" opacity=".92"/><path d="M160 222 Q174 204 188 221 M229 233 Q244 214 259 233 M176 278 Q192 258 207 278 M237 290 Q250 274 265 291" fill="none" stroke="#5E536E" strokeWidth="5" strokeLinecap="round"/><circle cx="172" cy="188" r="9" fill="#9A5266"/><circle cx="239" cy="195" r="7" fill="#C79A4A"/></g>}

      {config.accent === "charm" && <g data-photoreal-layer="accent"><path d="M454 246 Q493 263 487 302" fill="none" stroke="url(#pr-metal)" strokeWidth="6"/><path d="M487 300 C469 277 443 301 487 338 C531 301 505 277 487 300 Z" fill="#B87880" stroke={metalDark} strokeWidth="3"/><path d="M477 297 Q487 288 497 297" fill="none" stroke="#FFF" strokeWidth="2" opacity=".6"/></g>}

      <g data-photoreal-layer="label"><rect x="257" y="451" width="86" height="27" rx="9" fill="url(#pr-metal)" stroke={metalDark} strokeWidth="1.5"/><rect x="263" y="456" width="74" height="15" rx="5" fill="#FFFFFF" opacity=".1"/><text x="300" y="469" textAnchor="middle" fill="#FFF" fontSize="11" fontFamily="serif" fontWeight="600">a_bags</text></g>
    </g>}
  </svg>;
}

export default function PhotorealBagBuilder() {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [config, setConfig] = useState<BuilderConfig>(EMPTY);
  const spriteUrl = useAtelierSprite();

  useEffect(() => {
    const findStage = () => {
      const next = document.querySelector<HTMLElement>(".abags-bag-builder-stage");
      setStage((current) => current === next ? current : next);
    };
    findStage();
    const observer = new MutationObserver(findStage);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!stage) return;
    const sync = () => {
      const next = readConfig(stage);
      setConfig((current) => sameConfig(current, next) ? current : next);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(stage, {
      attributes: true,
      attributeFilter: ["data-family", "data-color", "data-stitch", "data-flap", "data-handles", "data-strap", "data-hardware", "data-accent"],
    });
    return () => observer.disconnect();
  }, [stage]);

  const nearest = useMemo(() => nearestReference(config), [config]);
  if (!stage) return null;

  return createPortal(<>
    <div className="abags-photoreal-layer" data-abags-photoreal-v5="true" aria-hidden="true"><PhotorealSvg config={config}/></div>
    {nearest && <div className="abags-photoreal-reference" aria-label={`Najbliższy rzeczywisty wzorzec: ${nearest.reference.label}`}>
      {spriteUrl && <span className="abags-photoreal-reference-thumb" style={{ backgroundImage: `url(${spriteUrl})`, backgroundSize: "500% 400%", ...spritePosition(nearest.reference.index) }} aria-hidden="true"/>}
      <span className="abags-photoreal-reference-copy"><small>Wzorzec atelier 1:1</small><strong>{nearest.reference.label}</strong><span>{nearest.confidence}% zgodności cech · zdjęcie referencyjne, nie render wybranej kombinacji</span></span>
    </div>}
    <div className="abags-photoreal-badge" aria-hidden="true">Atelier Render v5 · materiał + światło</div>
  </>, stage);
}
