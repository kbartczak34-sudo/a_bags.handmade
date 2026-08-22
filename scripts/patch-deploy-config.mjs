import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const configPath = path.join(projectRoot, "dist/server/wrangler.json");
const wranglerBin = path.join(projectRoot, "node_modules/.bin/wrangler");
const sourceConfig = path.join(projectRoot, "wrangler.jsonc");
const skipRemoteDiscovery =
  process.env.ABAGS_SKIP_REMOTE_RESOURCE_DISCOVERY === "1";

const raw = await readFile(configPath, "utf8");
const config = JSON.parse(raw);

const runWrangler = async (args) => {
  const { stdout } = await execFileAsync(
    wranglerBin,
    [...args, "--config", sourceConfig],
    {
      cwd: projectRoot,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  return stdout.trim();
};

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.result)) return value.result;
  if (Array.isArray(value?.databases)) return value.databases;
  return [];
};

const d1Binding = Array.isArray(config.d1_databases)
  ? config.d1_databases[0]
  : undefined;

if (d1Binding && !skipRemoteDiscovery) {
  const d1Raw = await runWrangler(["d1", "list", "--json"]);
  const databases = normalizeArray(JSON.parse(d1Raw));
  const derivedName =
    d1Binding.database_name ||
    `${config.name || "a-bags-handmade"}-${String(d1Binding.binding || "db").toLowerCase()}`;

  const database =
    databases.find((item) => item?.name === "a-bags-handmade-storedb") ||
    databases.find((item) => item?.name === derivedName);

  if (!database?.uuid && !database?.id) {
    throw new Error(
      `Existing D1 database not found. Expected a-bags-handmade-storedb or ${derivedName}.`,
    );
  }

  d1Binding.database_name = database.name;
  d1Binding.database_id = database.uuid || database.id;
  delete d1Binding.preview_database_id;

  console.log(`Resolved existing D1 database: ${database.name}`);
}

const r2Binding = Array.isArray(config.r2_buckets)
  ? config.r2_buckets[0]
  : undefined;

if (r2Binding && !r2Binding.bucket_name && !skipRemoteDiscovery) {
  const candidateNames = [
    "a-bags-handmade-storemedia",
    `${config.name || "a-bags-handmade"}-${String(r2Binding.binding || "media").toLowerCase()}`,
  ];

  let resolvedBucket = null;
  for (const bucketName of candidateNames) {
    try {
      await runWrangler(["r2", "bucket", "info", bucketName, "--json"]);
      resolvedBucket = bucketName;
      break;
    } catch {
      // Try the next candidate. If none exists, Wrangler may provision the draft binding.
    }
  }

  if (resolvedBucket) {
    r2Binding.bucket_name = resolvedBucket;
    console.log(`Resolved existing R2 bucket: ${resolvedBucket}`);
  } else {
    console.log("No existing R2 bucket matched; leaving R2 binding for provisioning.");
  }
}

if (skipRemoteDiscovery) {
  console.log(
    "Remote Cloudflare resource discovery skipped for offline CI artifact validation.",
  );
}

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

console.log(
  "Patched generated Wrangler resources:",
  config.d1_databases?.map((entry) => entry.binding).join(", ") || "no D1",
  "/",
  config.r2_buckets?.map((entry) => entry.binding).join(", ") || "no R2",
);
