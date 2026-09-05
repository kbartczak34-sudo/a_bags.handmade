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
replaceExact(
  `      tote: createMesh(gl, beveledExtrusion(familyContour("tote"), .39, .06)),\n      round: createMesh(gl, beveledExtrusion(familyContour("round"), .34, .055)),\n      bucket: createMesh(gl, beveledExtrusion(familyContour("bucket"), .37, .06)),\n      mini: createMesh(gl, beveledExtrusion(familyContour("mini"), .30, .05)),`,
  `      tote: createMesh(gl, beveledExtrusion(familyContour("tote"), ABAGS_FIDELITY_V4_FAMILY_SPECS.tote.depth, ABAGS_FIDELITY_V4_FAMILY_SPECS.tote.bevel)),\n      round: createMesh(gl, beveledExtrusion(familyContour("round"), ABAGS_FIDELITY_V4_FAMILY_SPECS.round.depth, ABAGS_FIDELITY_V4_FAMILY_SPECS.round.bevel)),\n      bucket: createMesh(gl, beveledExtrusion(familyContour("bucket"), ABAGS_FIDELITY_V4_FAMILY_SPECS.bucket.depth, ABAGS_FIDELITY_V4_FAMILY_SPECS.bucket.bevel)),\n      mini: createMesh(gl, beveledExtrusion(familyContour("mini"), ABAGS_FIDELITY_V4_FAMILY_SPECS.mini.depth, ABAGS_FIDELITY_V4_FAMILY_SPECS.mini.bevel)),`,
  "family body meshes",
);
replaceExact(
  `function familyMetrics(family: Exclude<Family, "">) {\n  if (family === "tote") return { depth: .39, topY: .80, side: .91, handleScale: [.94, .88] as const, flapScale: [.94, .90] as const };\n  if (family === "round") return { depth: .34, topY: .82, side: .80, handleScale: [.82, .80] as const, flapScale: [.79, .72] as const };\n  if (family === "bucket") return { depth: .37, topY: .84, side: .76, handleScale: [.82, .82] as const, flapScale: [.90, .92] as const };\n  return { depth: .30, topY: .66, side: .67, handleScale: [.70, .68] as const, flapScale: [.73, .78] as const };\n}`,
  `function familyMetrics(family: Exclude<Family, "">) {\n  const spec = ABAGS_FIDELITY_V4_FAMILY_SPECS[family];\n  return {\n    depth: spec.depth,\n    topY: spec.topY,\n    side: spec.sideAnchor,\n    handleScale: spec.handleScale,\n    flapScale: spec.flapScale,\n    flapY: spec.flapY,\n  };\n}`,
  "family metrics",
);
replaceExact(
  'const flapY = config.family === "round" ? .31 : config.family === "mini" ? .24 : .29;',
  'const flapY = metrics.flapY ?? .29;',
  "family flap anchor",
);
replaceExact('data-abags-final-webgl="v3"', 'data-abags-final-webgl="v4"', "renderer DOM version");
replaceExact('A-BAGS REALTIME 3D · FIDELITY V3', 'A-BAGS REALTIME 3D · FIDELITY V4', "renderer chip version");

fs.writeFileSync(path, source);
console.log("Fidelity V4 renderer source migration applied.");