import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../lib/abags-camera-controls.ts", import.meta.url), "utf8");
const context = { exports: {} };
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
const { AbagsCameraGesture, wheelCameraZoom, keyboardCamera } = context.exports;
const limits = { minZoom: .34, maxZoom: 1.45 };
const initial = () => ({ rotation: { x: -.12, y: -.62 }, zoom: .92 });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should equal ${expected}`);

test("a customer can pinch, lift either finger, and immediately keep rotating without a jump", () => {
  for (const lifted of [1, 2]) {
    const gesture = new AbagsCameraGesture(limits);
    let camera = initial();
    gesture.start(1, 0, 100, camera);
    gesture.start(2, 100, 100, camera);
    camera = gesture.move(2, 140, 100, camera);
    close(camera.zoom, 1.288);
    const remaining = lifted === 1 ? 2 : 1;
    const x = remaining === 2 ? 140 : 0;
    gesture.end(lifted, camera);
    // Browsers also fire lostpointercapture after pointerup.
    gesture.end(lifted, camera);
    const resumed = gesture.move(remaining, x, 100, camera);
    close(resumed.rotation.y, camera.rotation.y);
    camera = gesture.move(remaining, x + 20, 110, resumed);
    close(camera.rotation.y, initial().rotation.y + .24);
    close(camera.rotation.x, initial().rotation.x + .08);
    close(camera.zoom, 1.288);
  }
});

test("adding a finger after dragging preserves the current angle and starts zoom from the current scale", () => {
  const gesture = new AbagsCameraGesture(limits);
  let camera = initial();
  gesture.start(1, 0, 0, camera);
  camera = gesture.move(1, 30, 20, camera);
  gesture.start(2, 130, 20, camera);
  const pinched = gesture.move(2, 150, 20, camera);
  close(pinched.rotation.x, camera.rotation.x);
  close(pinched.rotation.y, camera.rotation.y);
  close(pinched.zoom, camera.zoom * 1.2);
});

test("cancelled, lost or backgrounded pointers stop moving the camera and a new gesture starts cleanly", () => {
  const gesture = new AbagsCameraGesture(limits);
  const camera = initial();
  gesture.start(1, 0, 0, camera);
  gesture.end(1, camera);
  assert.equal(gesture.move(1, 100, 100, camera), null);
  gesture.start(2, 0, 0, camera);
  gesture.clear();
  assert.equal(gesture.move(2, 100, 100, camera), null);
  gesture.start(3, 500, 500, camera);
  close(gesture.move(3, 500, 500, camera).rotation.y, camera.rotation.y);
});

test("a third finger and coincident touches do not corrupt the pinch baseline", () => {
  const gesture = new AbagsCameraGesture(limits);
  let camera = initial();
  gesture.start(1, 0, 0, camera);
  gesture.start(2, 0, 0, camera);
  assert.equal(gesture.move(2, 100, 0, camera), null);
  camera = gesture.move(2, 120, 0, camera);
  close(camera.zoom, initial().zoom * 1.2);
  gesture.start(3, 240, 0, camera);
  gesture.end(1, camera);
  const unchanged = gesture.move(3, 240, 0, camera);
  close(unchanged.zoom, camera.zoom);
  assert.ok(Number.isFinite(gesture.move(3, 260, 0, unchanged).zoom));
});

test("pinch and orbit respect zoom and tilt limits while allowing a complete revolution", () => {
  const gesture = new AbagsCameraGesture(limits);
  const camera = initial();
  gesture.start(1, 0, 0, camera);
  const rotated = gesture.move(1, 1000, -1000, camera);
  close(rotated.rotation.x, -.72);
  assert.ok(rotated.rotation.y > Math.PI * 2);
  gesture.start(2, 1100, -1000, rotated);
  close(gesture.move(2, 10000, -1000, rotated).zoom, limits.maxZoom);
  close(gesture.move(2, 1000, -1000, rotated).zoom, limits.minZoom);
});

test("pixel, line and page wheels give the same scale change and opposite movements restore the scale", () => {
  const pixel = wheelCameraZoom(.92, 32, 0, 400, limits);
  close(wheelCameraZoom(.92, 2, 1, 400, limits), pixel);
  close(wheelCameraZoom(.92, .08, 2, 400, limits), pixel);
  close(wheelCameraZoom(pixel, -32, 0, 400, limits), .92);
  assert.ok(wheelCameraZoom(.92, -10000, 0, 400, limits) < limits.maxZoom, "one large event must not jump directly to maximum");
  close(wheelCameraZoom(limits.maxZoom, -240, 0, 400, limits), limits.maxZoom);
  close(wheelCameraZoom(limits.minZoom, 240, 0, 400, limits), limits.minZoom);
});

test("keyboard rotation, fine adjustment, zoom and Home share the pointer camera limits", () => {
  let camera = initial();
  camera = keyboardCamera("ArrowRight", camera, initial(), limits);
  close(camera.rotation.y, initial().rotation.y + .12);
  const fine = keyboardCamera("ArrowLeft", camera, initial(), limits, true);
  close(fine.rotation.y, camera.rotation.y - .04);
  for (let n = 0; n < 30; n++) camera = keyboardCamera("ArrowUp", camera, initial(), limits);
  close(camera.rotation.x, -.72);
  for (let n = 0; n < 30; n++) camera = keyboardCamera("+", camera, initial(), limits);
  close(camera.zoom, limits.maxZoom);
  for (let n = 0; n < 30; n++) camera = keyboardCamera("-", camera, initial(), limits);
  close(camera.zoom, limits.minZoom);
  const reset = keyboardCamera("Home", camera, initial(), limits);
  close(reset.zoom, initial().zoom);
  close(reset.rotation.x, initial().rotation.x);
  close(reset.rotation.y, initial().rotation.y);
  assert.equal(keyboardCamera("Tab", camera, initial(), limits), null, "focus navigation must stay native");
  assert.equal(keyboardCamera("Escape", camera, initial(), limits), null, "the dialog must keep its close shortcut");
});

// Execute the real component's handlers without a browser or GPU. Deliberately
// dispatch several events before a React commit to reproduce high-rate input.
const renderer = await readFile(new URL("../app/bag-builder-fidelity3d.tsx", import.meta.url), "utf8");
const component = ts.transpileModule(renderer.slice(renderer.indexOf("export default function BagBuilderFidelity3D")), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function mountedControls() {
  const values = [], effects = [], listeners = new Map();
  let state = 0, captures = 0, focuses = 0;
  const canvas = {
    clientHeight: 400, focus: () => focuses++, closest: () => null,
    addEventListener: (name, handler, options) => listeners.set(name, { handler, options }),
    removeEventListener: (name, handler) => { if (listeners.get(name)?.handler === handler) listeners.delete(name); },
  };
  const jsx = (type, props) => ({ type, props });
  const runtime = { exports: {},
    require: name => { assert.equal(name, "react/jsx-runtime"); return { jsx, jsxs: jsx }; },
    useState: value => {
      const index = state++;
      values[index] = index === 0 ? {} : index === 7 ? canvas : value;
      return [values[index], next => { values[index] = typeof next === "function" ? next(values[index]) : next; }];
    },
    useRef: current => ({ current }), useId: () => "camera-instructions",
    useMemo: fn => fn(), useEffect: fn => effects.push(fn), useLayoutEffect: () => {},
    createPortal: node => node, AbagsCameraGesture, keyboardCamera, wheelCameraZoom,
    DEFAULT_ROTATION: initial().rotation, DEFAULT_ZOOM: initial().zoom, CAMERA_LIMITS: limits,
    MIN_ZOOM: limits.minZoom, MAX_ZOOM: limits.maxZoom, EMPTY: { family: "tote" },
    clamp: (value, low, high) => Math.max(low, Math.min(high, value)),
  };
  runInNewContext(component, runtime);
  const layer = runtime.exports.default();
  const canvasNode = layer.props.children.find(node => node?.type === "canvas");
  canvasNode.props.ref(canvas);
  const pointer = (pointerId, x, y, button = 0) => ({ pointerId, button, clientX: x, clientY: y,
    target: { closest: () => null }, currentTarget: { setPointerCapture: () => captures++ }, preventDefault() {},
  });
  return { layer, canvasNode, values, effects, listeners, pointer, captures: () => captures, focuses: () => focuses };
}

test("the mounted renderer handles rapid drag/pinch/resume input using the latest camera rather than a stale React frame", () => {
  const { layer, pointer, values, captures, focuses } = mountedControls();
  layer.props.onPointerDown(pointer(1, 0, 0, 2));
  assert.equal(captures(), 0, "secondary clicks keep the browser context menu");
  layer.props.onPointerDown(pointer(1, 0, 0));
  layer.props.onPointerMove(pointer(1, 20, 10));
  const rotated = { ...values[2] };
  layer.props.onPointerDown(pointer(2, 120, 10));
  layer.props.onPointerMove(pointer(2, 140, 10));
  close(values[3], .92 * 1.2);
  layer.props.onPointerUp(pointer(2, 140, 10));
  layer.props.onLostPointerCapture(pointer(2, 140, 10));
  layer.props.onPointerMove(pointer(1, 30, 10));
  close(values[2].y, rotated.y + .12);
  close(values[2].x, rotated.x);
  assert.equal(values[6], "custom", "a free orbit must not claim to be a preset view");
  assert.equal(focuses(), 2);
});

test("native wheel binding prevents dialog scrolling, preserves browser shortcuts and removes its listener", () => {
  const { effects, listeners, values } = mountedControls();
  const bindWheel = effects.find(fn => fn.toString().includes('addEventListener("wheel"'));
  const cleanup = bindWheel();
  const { handler, options } = listeners.get("wheel");
  assert.equal(options.passive, false);
  let prevented = 0;
  const event = { deltaY: 2, deltaMode: 1, cancelable: true, preventDefault: () => prevented++ };
  handler(event);
  handler(event);
  close(values[3], wheelCameraZoom(wheelCameraZoom(.92, 2, 1, 400, limits), 2, 1, 400, limits));
  assert.equal(prevented, 2);
  const before = values[3];
  handler({ ...event, ctrlKey: true });
  handler({ ...event, metaKey: true });
  close(values[3], before);
  assert.equal(prevented, 2);
  cleanup();
  assert.equal(listeners.has("wheel"), false);
});

test("the focused preview exposes keyboard instructions and consumes only camera commands", () => {
  const { canvasNode, values } = mountedControls();
  assert.equal(canvasNode.props.tabIndex, 0);
  assert.equal(canvasNode.props["aria-describedby"], "camera-instructions");
  let prevented = 0;
  const key = name => ({ key: name, preventDefault: () => prevented++ });
  canvasNode.props.onKeyDown(key("ArrowRight"));
  close(values[2].y, initial().rotation.y + .12);
  canvasNode.props.onKeyDown(key("+"));
  close(values[3], 1.02);
  canvasNode.props.onKeyDown(key("Home"));
  close(values[3], .92);
  close(values[2].y, initial().rotation.y);
  canvasNode.props.onKeyDown(key("Tab"));
  canvasNode.props.onKeyDown(key("Escape"));
  canvasNode.props.onKeyDown({ ...key("+"), ctrlKey: true });
  assert.equal(prevented, 3);
});
