import fs from "node:fs";
import path from "node:path";

const root = process.env.SITES_PROJECT_ROOT || process.cwd();
const files = [
  path.join(root, "app", "panel", "product-panel.tsx"),
  path.join(root, "app", "panel", "site-content-editor.tsx"),
];

for (const file of files) {
  let source = fs.readFileSync(file, "utf8");
  const original = source;

  source = source.replaceAll(
    "if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {",
    "if (file.type && !ACCEPTED_IMAGE_TYPES.has(file.type)) {",
  );
  source = source.replaceAll(
    "selectedFile &&\n                        !ACCEPTED_IMAGE_TYPES.has(selectedFile.type)",
    "selectedFile &&\n                        selectedFile.type &&\n                        !ACCEPTED_IMAGE_TYPES.has(selectedFile.type)",
  );
  source = source.replaceAll(
    "if (file && !ACCEPTED_IMAGE_TYPES.has(file.type)) {",
    "if (file && file.type && !ACCEPTED_IMAGE_TYPES.has(file.type)) {",
  );

  if (source === original) {
    throw new Error(`Expected mobile image validation fragments not found in ${path.relative(root, file)}`);
  }

  fs.writeFileSync(file, source);
}

console.log("Admin image upload patched for Android/browser files with missing MIME type.");
