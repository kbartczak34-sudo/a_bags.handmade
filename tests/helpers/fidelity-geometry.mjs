import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8");
const specSource = await readFile(new URL("../../lib/abags-fidelity-v4-family-spec.ts", import.meta.url), "utf8");
const compile = (code) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const specContext = { exports: {} };
runInNewContext(compile(specSource), specContext);
export const specs = specContext.exports.ABAGS_FIDELITY_V4_FAMILY_SPECS;
const context = { exports: {}, Float32Array, Uint16Array, ABAGS_FIDELITY_V4_FAMILY_SPECS: specs };
const pure = source.slice(0, source.indexOf("export default function BagBuilderFidelity3D"))
  .replace(/^import[\s\S]*?from "[^"]+";\s*/gm, "");
runInNewContext(compile(pure + "\nObject.assign(exports, {appendCord, openingBraidPaths, makeOpeningRim, ensureOpeningRim, groundContactFrame, groundSupportPoints, makeVariableDepthBody, makeCrochetPanel, makeCrochetGusset, makeCrochetFlap, crochetFlapSurface, closedFlapSurface, ensureClosedFlapShell, ensureCrochetFlapMesh, openingPath, woodHandleDepthPlanes, woodHandleMountHeight, woodHandleMatrix, woodHandleBindingPaths, makeWoodHandleBinding, ensureWoodHandleBinding, crochetPanelPoint, fidelityAccessoryAnchor, makeOrnamentGeometry, ensureOrnamentMeshes, appendOrnamentRibbon, strapHardwarePosition, strapBindingPaths, makeStrapBinding, ensureStrapBinding, shoulderStrapMatrix, familyShoulderStrapMesh, shoulderBandFrame, makeShoulderBandGeometry, ensureShoulderBandMeshes, familyShoulderChainMesh, makeDHardwareRing, makeLobsterClaspMesh, strapClaspPosition, normalMatrix, matrix, ensureCrochetMeshes});"), context);
export const geometry = context.exports;

