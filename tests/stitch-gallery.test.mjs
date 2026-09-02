import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("product model persists stitch metadata without breaking older saves", async () => {
  const [catalog, products, adminRoute, schema] = await Promise.all([
    read("lib/catalog.ts"),
    read("lib/products.ts"),
    read("app/api/admin/products/route.ts"),
    read("db/schema.ts"),
  ]);

  assert.match(catalog, /stitchType: string/);
  assert.match(products, /stitch_type TEXT NOT NULL DEFAULT ''/);
  assert.match(products, /stitchType: row\.stitch_type/);
  assert.match(products, /COALESCE\(\?, stitch_type\)/);
  assert.match(adminRoute, /formData\.has\("stitchType"\)/);
  assert.match(schema, /stitchType: text\("stitch_type"\)/);
});

test("owner panel exposes a dedicated stitch manager", async () => {
  const [panel, manager] = await Promise.all([
    read("app/panel/admin-panel.tsx"),
    read("app/panel/stitch-manager.tsx"),
  ]);

  assert.match(panel, /Sploty \/ ściegi/);
  assert.match(panel, /<StitchManager \/>/);
  assert.match(manager, /formData\.set\("stitchType", stitchType\)/);
  assert.match(manager, /Pusta wartość wyłącza produkt z galerii technik/);
});

test("storefront gallery groups only products with explicit stitch metadata", async () => {
  const [gallery, layout, styles] = await Promise.all([
    read("app/stitch-gallery.tsx"),
    read("app/layout.tsx"),
    read("app/production-polish.css"),
  ]);

  assert.match(gallery, /fetch\("\/api\/products"/);
  assert.match(gallery, /product\.stitchType\?\.trim\(\)/);
  assert.match(gallery, /id="sploty"/);
  assert.match(gallery, /aria-pressed=\{activeStitch === stitch\}/);
  assert.match(layout, /<StitchGallery \/>/);
  assert.match(layout, /production-polish\.css/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
});
