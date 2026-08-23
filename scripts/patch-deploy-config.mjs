import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const configPath = path.join(projectRoot, "dist/server/wrangler.json");
const skipRemoteDiscovery =
  process.env.ABAGS_SKIP_REMOTE_RESOURCE_DISCOVERY === "1";

const raw = await readFile(configPath, "utf8");
const config = JSON.parse(raw);

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const cloudflareGet = async (pathname) => {
  if (!accountId || !apiToken) {
    throw new Error(
      "Cloudflare remote discovery requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.",
    );
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
    },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      `Cloudflare API returned a non-JSON response for ${pathname} (HTTP ${response.status}).`,
    );
  }

  if (!response.ok || payload?.success === false) {
    const messages = [
      ...(Array.isArray(payload?.errors) ? payload.errors : []),
      ...(Array.isArray(payload?.messages) ? payload.messages : []),
    ]
      .map((entry) => entry?.message || entry?.code)
      .filter(Boolean)
      .join("; ");

    throw new Error(
      `Cloudflare API request failed for ${pathname} (HTTP ${response.status})${
        messages ? `: ${messages}` : ""
      }`,
    );
  }

  return payload;
};

const pickNamedResource = ({ items, exactNames, label }) => {
  const usable = items.filter((item) => item?.name);

  for (const name of exactNames.filter(Boolean)) {
    const exact = usable.find((item) => item.name === name);
    if (exact) return exact;
  }

  const fuzzy = usable.filter((item) => {
    const normalized = normalizeName(item.name);
    return (
      normalized.includes("abagshandmade") ||
      normalized.includes("abagshandmade") ||
      normalized.startsWith("abags")
    );
  });

  if (fuzzy.length === 1) return fuzzy[0];
  if (usable.length === 1) return usable[0];

  const available = usable.map((item) => item.name).join(", ") || "none";
  throw new Error(
    `Could not safely resolve ${label}. Available resources: ${available}. ` +
      `Set the matching ABAGS_*_NAME environment override if more than one candidate exists.`,
  );
};

const d1Binding = Array.isArray(config.d1_databases)
  ? config.d1_databases[0]
  : undefined;
const r2Binding = Array.isArray(config.r2_buckets)
  ? config.r2_buckets[0]
  : undefined;

if (!skipRemoteDiscovery) {
  if (!accountId || !apiToken) {
    throw new Error(
      "Missing Cloudflare CI credentials. Configure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.",
    );
  }

  config.account_id = accountId;

  if (d1Binding) {
    const d1Payload = await cloudflareGet(
      `/accounts/${encodeURIComponent(accountId)}/d1/database?per_page=100`,
    );
    const databases = Array.isArray(d1Payload?.result) ? d1Payload.result : [];
    const derivedName =
      d1Binding.database_name ||
      `${config.name || "a-bags-handmade"}-${String(
        d1Binding.binding || "db",
      ).toLowerCase()}`;

    const database = pickNamedResource({
      items: databases,
      exactNames: [
        process.env.ABAGS_D1_DATABASE_NAME?.trim(),
        "a-bags-handmade-storedb",
        derivedName,
      ],
      label: "the production D1 database",
    });

    const databaseId = database.uuid || database.id;
    if (!databaseId) {
      throw new Error(
        `Resolved D1 database ${database.name} does not expose a UUID/id.`,
      );
    }

    d1Binding.database_name = database.name;
    d1Binding.database_id = databaseId;
    delete d1Binding.preview_database_id;
    console.log(`Resolved existing D1 database: ${database.name}`);
  }

  if (r2Binding) {
    const r2Payload = await cloudflareGet(
      `/accounts/${encodeURIComponent(accountId)}/r2/buckets?per_page=100`,
    );
    const buckets = Array.isArray(r2Payload?.result?.buckets)
      ? r2Payload.result.buckets
      : [];
    const derivedName =
      r2Binding.bucket_name ||
      `${config.name || "a-bags-handmade"}-${String(
        r2Binding.binding || "media",
      ).toLowerCase()}`;

    const bucket = pickNamedResource({
      items: buckets,
      exactNames: [
        process.env.ABAGS_R2_BUCKET_NAME?.trim(),
        "a-bags-handmade-storemedia",
        derivedName,
      ],
      label: "the production R2 bucket",
    });

    r2Binding.bucket_name = bucket.name;
    console.log(`Resolved existing R2 bucket: ${bucket.name}`);
  }
} else {
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
