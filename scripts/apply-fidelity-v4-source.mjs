import fs from "node:fs";

const path = "app/bag-builder-final-webgl3d.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceExact(from, to, label) {
  if (!source.includes(from)) throw new Error(`Fidelity V4 migration anchor missing: ${label}`);
  source = source.replace(from, to);
}

replaceExact(
  'import { createPortal } from "react-dom";',
  'import { createPortal } from "react-dom";\nimport { ABAGS_FIDELITY_V4_FAMILY_SPECS, ABAGS_FIDELITY_V4_RENDERER_VERSION } from "../lib/abags-fidelity-v4-family-spec";',
  "V4 family spec import",
);
replaceExact('const RENDERER_VERSION = "abags-fidelity-v3";', 'const RENDERER_VERSION = ABAGS_FIDELITY_V4_RENDERER_VERSION;', "renderer version");
replaceExact(
  `function familyContour(family: Exclude<Family, "">): Point[] {\n  if (family === "tote") return superellipseContour(1.02, .79, 4.6, 52, -.055);\n  if (family === "round") return superellipseContour(.88, .89, 2.08, 56, 0);\n  if (family === "bucket") return superellipseContour(.84, .83, 4.4, 52, -.045);\n  return superellipseContour(.76, .64, 5.4, 52, -.025);\n}`,
  `function familyContour(family: Exclude<Family, "">): Point[] {\n  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];\n  return superellipseContour(spec.rx, spec.ry, spec.power, family === "round" ? 56 : 60, spec.taper);\n}`,
  "family contour",
);

const replacements = [
  ['const bodyDepth = config.family === "round" ? .34 : config.family === "bucket" ? .37 : config.family === "mini" ? .31 : .36;', 'const familySpec = ABAGS_FIDELITY_V4_FAMILY_SPECS[config.family];\n  const bodyDepth = familySpec.depth;', "body depth"],
  ['beveledExtrusion(familyContour(config.family), bodyDepth, .052)', 'beveledExtrusion(familyContour(config.family), bodyDepth, familySpec.bevel)', "body bevel"],
  ['const topY = config.family === "round" ? .86 : config.family === "mini" ? .68 : .82;', 'const topY = familySpec.topY;', "top anchor"],
  ['const sideX = config.family === "round" ? .78 : config.family === "mini" ? .69 : .86;', 'const sideX = familySpec.sideAnchor;', "side anchor"],
  ['const flapY = config.family === "round" ? .34 : config.family === "mini" ? .24 : .31;', 'const flapY = familySpec.flapY ?? .31;', "flap y"],
  ['const flapWidth = config.family === "round" ? .76 : config.family === "mini" ? .72 : .90;', 'const flapWidth = familySpec.flapScale[0];', "flap width"],
  ['const flapHeight = config.family === "round" ? .70 : config.family === "mini" ? .64 : .76;', 'const flapHeight = familySpec.flapScale[1];', "flap height"],
  ['const handleWidth = config.family === "round" ? .80 : config.family === "mini" ? .70 : .92;', 'const handleWidth = familySpec.handleScale[0];', "handle width"],
  ['const handleHeight = config.family === "round" ? .78 : config.family === "mini" ? .62 : .80;', 'const handleHeight = familySpec.handleScale[1];', "handle height"],
];
for (const [from, to, label] of replacements) replaceExact(from, to, label);

fs.writeFileSync(path, source);
console.log("Fidelity V4 renderer source migration applied.");