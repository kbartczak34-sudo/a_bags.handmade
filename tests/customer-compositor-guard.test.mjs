import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stack, guard] = await Promise.all([
  readFile(new URL("../app/exact-live-customizer.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/bag-builder-customer-compositor-guard.tsx", import.meta.url), "utf8"),
]);

test("customer compositor guard is mounted after all legacy and commerce controllers", () => {
  const referenceV4 = stack.indexOf("<BagBuilderReferenceV4 />");
  const checkout = stack.indexOf("<BagBuilderCheckoutHandoff />");
  const compositor = stack.indexOf("<BagBuilderCustomerCompositorGuard />");
  assert.ok(referenceV4 >= 0, "Reference V4 must remain mounted");
  assert.ok(checkout > referenceV4, "checkout handoff remains after the reference controller");
  assert.ok(compositor > checkout, "runtime compositor guard must be the final customizer component");
});

test("runtime guard uses inline important declarations so late V4 styles cannot stretch controls", () => {
  assert.match(guard, /style\.setProperty\(property, value, "important"\)/);
  assert.match(guard, /bottom:\s*"auto"/);
  assert.match(guard, /left:\s*"auto"/);
  assert.match(guard, /transform:\s*"none"/);
  assert.match(guard, /height:\s*"35px"/);
  assert.match(guard, /"max-height":\s*"35px"/);
});

test("zoom compositor chrome is explicitly bounded on mobile", () => {
  assert.match(guard, /width:\s*"184px"/);
  assert.match(guard, /"max-width":\s*"calc\(100% - 16px\)"/);
  assert.match(guard, /height:\s*"38px"/);
  assert.match(guard, /"max-height":\s*"38px"/);
  assert.match(guard, /"grid-template-columns":\s*"28px minmax\(48px,1fr\) 28px 42px"/);
});

test("runtime compositor hardening applies only to verified customer realtime 3D", () => {
  assert.match(guard, /stage\.dataset\.abagsFinal3d !== "ready"/);
  assert.match(guard, /dialog\.dataset\.abagsPhotoTrue !== "active"/);
  assert.match(guard, /stage\.dataset\.abagsPhotoTrue !== "active"/);
  assert.match(guard, /matchMedia\("\(max-width: 980px\)"\)/);
});

test("QA can prove that the runtime guard actually reached the live stage", () => {
  assert.match(guard, /stage\.dataset\.abagsCustomerCompositorGuard = "v1"/);
  assert.match(guard, /delete stage\.dataset\.abagsCustomerCompositorGuard/);
});

test("guard observer cannot loop on its own inline style writes", () => {
  assert.match(guard, /attributeFilter:\s*\["data-abags-final3d", "data-abags-photo-true"\]/);
  assert.doesNotMatch(guard, /attributeFilter:[\s\S]*"style"/);
});
