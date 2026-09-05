import fs from "node:fs";

const controllerPath = "app/bag-builder-final3d-controller.tsx";
const testPath = "tests/final-3d-builder.test.mjs";
let controller = fs.readFileSync(controllerPath, "utf8");
let test = fs.readFileSync(testPath, "utf8");

function replaceAllRequired(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing V4 verifier migration anchor: ${label}`);
  return text.split(from).join(to);
}

controller = replaceAllRequired(controller, 'const REQUIRED_RENDERER = "abags-fidelity-v3";', 'const REQUIRED_RENDERER = "abags-fidelity-v4";', "required renderer");
controller = replaceAllRequired(controller, "renderer-frame-v3-pixels-", "renderer-frame-v4-pixels-", "frame error namespace");

test = replaceAllRequired(test, "Fidelity v3", "Fidelity v4", "test title renderer version");
test = replaceAllRequired(test, '/RENDERER_VERSION = "abags-fidelity-v3"/', "/RENDERER_VERSION = ABAGS_FIDELITY_V4_RENDERER_VERSION/", "renderer version assertion");
test = replaceAllRequired(test, '/data-abags-final-webgl="v3"/', '/data-abags-final-webgl="v4"/', "renderer DOM assertion");
test = replaceAllRequired(test, 'assert.match(renderer, /superellipseContour\\(1\\.02, \\.79, 4\\.6, 52, -\\.055\\)/);\n  assert.match(renderer, /superellipseContour\\(\\.88, \\.89, 2\\.08, 56, 0\\)/);\n  assert.match(renderer, /superellipseContour\\(\\.84, \\.83, 4\\.4, 52, -\\.045\\)/);\n  assert.match(renderer, /superellipseContour\\(\\.76, \\.64, 5\\.4, 52, -\\.025\\)/);', 'assert.match(renderer, /ABAGS_FIDELITY_V4_FAMILY_SPECS\\[family\\]/);\n  assert.match(renderer, /spec\\.rx, spec\\.ry, spec\\.power/);\n  assert.match(renderer, /spec\\.taper/);', "family geometry assertions");
test = replaceAllRequired(test, "current v3 frames", "current v4 frames", "verifier title");
test = replaceAllRequired(test, '/REQUIRED_RENDERER = "abags-fidelity-v3"/', '/REQUIRED_RENDERER = "abags-fidelity-v4"/', "required renderer assertion");
test = replaceAllRequired(test, "/renderer-frame-v3-pixels-/", "/renderer-frame-v4-pixels-/", "frame namespace assertion");

fs.writeFileSync(controllerPath, controller);
fs.writeFileSync(testPath, test);
console.log("Fidelity V4 verifier and regression contract migrated.");