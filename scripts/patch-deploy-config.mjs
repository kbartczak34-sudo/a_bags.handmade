import { readFile, writeFile } from "node:fs/promises";

const configPath = new URL("../dist/server/wrangler.json", import.meta.url);
const raw = await readFile(configPath, "utf8");
const config = JSON.parse(raw);

const ensureSingleBinding = (entries, binding) => {
  const current = Array.isArray(entries) && entries.length > 0 ? entries[0] : {};
  return [{ ...current, binding }];
};

config.d1_databases = ensureSingleBinding(
  config.d1_databases,
  "ABAGSDB26081901",
);
config.r2_buckets = ensureSingleBinding(
  config.r2_buckets,
  "ABAGSMEDIA26081901",
);

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

console.log(
  "Patched generated Wrangler bindings:",
  config.d1_databases?.map((entry) => entry.binding).join(", "),
  "/",
  config.r2_buckets?.map((entry) => entry.binding).join(", "),
);
