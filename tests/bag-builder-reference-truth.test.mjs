import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("reference UI uses the same Agata family and crochet-stitch vocabulary as the live builder", async () => {
  const source = await read("app/bag-builder-reference-experience.tsx");
  assert.match(source, /Kuferek \/ tote/);
  assert.match(source, /Okrągła/);
  assert.match(source, /Z klapą/);
  assert.match(source, /Strukturalna \/ mini/);
  assert.match(source, /Ażurowy V/);
  assert.match(source, /Pionowy ażurowy/);
  assert.match(source, /Promienisty/);
  assert.match(source, /Ścieg szydełkowy/);
  assert.doesNotMatch(source, /Prostokątna|Półokrągła|Kubełkowa|Jodełka|Muszla/);
});

test("family thumbnails consume the central Agata reference contract instead of a drifting duplicate map", async () => {
  const source = await read("app/bag-builder-reference-experience.tsx");
  assert.match(source, /ABAGS_FIDELITY_V4_FAMILY_SPECS/);
  assert.match(source, /Object\.entries\(ABAGS_FIDELITY_V4_FAMILY_SPECS\)/);
  assert.match(source, /spec\.reference/);
});

test("inspiration presets no longer misclassify photographed flap bags as round crochet variants", async () => {
  const source = await read("app/bag-builder-reference-experience.tsx");
  assert.match(source, /referenceId: "black-leather-flap", family: "bucket", color: "#222124", stitch: "classic", flap: "leather-black"/);
  assert.doesNotMatch(source, /referenceId: "black-leather-flap", family: "round"/);
  assert.doesNotMatch(source, /referenceId: "pink-leather-flap", family: "round"/);
});

test("a real structured Agata reference proves mini can carry a light wooden handle", async () => {
  const source = await read("app/bag-builder-reference-experience.tsx");
  const library = await read("lib/exact-customizer-library.ts");
  assert.match(library, /id:"teal-wood-chain-stones"[\s\S]*?family:"structured"[\s\S]*?handles:"wood-light"/);
  assert.match(source, /referenceId: "teal-wood-chain-stones", family: "mini"[\s\S]*?handles: "wood-light"/);
});
