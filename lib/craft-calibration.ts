import { BUILDER_FAMILIES, BUILDER_STITCHES, type BuilderFamily, type BuilderStitch } from "./bag-builder-settings";
import { getProductDb } from "./products";

export const CRAFT_CALIBRATION_STATUSES = ["DRAFT", "MEASURED", "VALIDATED"] as const;
export type CraftCalibrationStatus = (typeof CRAFT_CALIBRATION_STATUSES)[number];
export type PhysicalValidationStatus = "NOT_VALIDATED" | "VALIDATED";

export type CordMaterialRecord = {
  id: string;
  supplier: string;
  supplierSku: string;
  name: string;
  nominalDiameterMm: number;
  measuredDiameterMm: number | null;
  metersPerSpool: number | null;
  gramsPerMeter: number | null;
  purchasePriceCents: number | null;
  status: CraftCalibrationStatus;
  createdAt: string;
  updatedAt: string;
};

export type GaugeProfileRecord = {
  id: string;
  cordMaterialId: string;
  stitchPatternId: BuilderStitch;
  hookSizeMm: number;
  tensionProfileId: string;
  sampleStitches: number;
  sampleRows: number;
  sampleWidthMm: number;
  sampleHeightMm: number;
  cordUsedMm: number;
  stitchPitchXmm: number;
  rowPitchYmm: number;
  metersPerStitch: number;
  finishedThicknessMm: number | null;
  status: CraftCalibrationStatus;
  createdAt: string;
  updatedAt: string;
};

export type GoldenMasterRecord = {
  id: string;
  bagFamily: BuilderFamily;
  productId: string | null;
  cordMaterialId: string;
  gaugeProfileId: string;
  stitchPatternId: BuilderStitch;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  stitchCount: number | null;
  rowCount: number | null;
  actualCordUsedMm: number;
  actualMassG: number;
  notes: string;
  status: CraftCalibrationStatus;
  createdAt: string;
  updatedAt: string;
};

export type CraftCalibrationSnapshot = {
  cords: CordMaterialRecord[];
  gauges: GaugeProfileRecord[];
  goldenMasters: GoldenMasterRecord[];
  readiness: {
    status: PhysicalValidationStatus;
    cordsValidated: number;
    gaugesValidated: number;
    goldenMastersValidated: number;
    reasons: string[];
  };
};

type CordRow = {
  id: string;
  supplier: string;
  supplier_sku: string;
  name: string;
  nominal_diameter_mm: number;
  measured_diameter_mm: number | null;
  meters_per_spool: number | null;
  grams_per_meter: number | null;
  purchase_price_cents: number | null;
  status: CraftCalibrationStatus;
  created_at: string;
  updated_at: string;
};

type GaugeRow = {
  id: string;
  cord_material_id: string;
  stitch_pattern_id: BuilderStitch;
  hook_size_mm: number;
  tension_profile_id: string;
  sample_stitches: number;
  sample_rows: number;
  sample_width_mm: number;
  sample_height_mm: number;
  cord_used_mm: number;
  stitch_pitch_x_mm: number;
  row_pitch_y_mm: number;
  meters_per_stitch: number;
  finished_thickness_mm: number | null;
  status: CraftCalibrationStatus;
  created_at: string;
  updated_at: string;
};

type GoldenMasterRow = {
  id: string;
  bag_family: BuilderFamily;
  product_id: string | null;
  cord_material_id: string;
  gauge_profile_id: string;
  stitch_pattern_id: BuilderStitch;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  stitch_count: number | null;
  row_count: number | null;
  actual_cord_used_mm: number;
  actual_mass_g: number;
  notes: string;
  status: CraftCalibrationStatus;
  created_at: string;
  updated_at: string;
};

const createCordTableSql = `
  CREATE TABLE IF NOT EXISTS craft_cord_materials (
    id TEXT PRIMARY KEY NOT NULL,
    supplier TEXT NOT NULL,
    supplier_sku TEXT NOT NULL,
    name TEXT NOT NULL,
    nominal_diameter_mm REAL NOT NULL,
    measured_diameter_mm REAL,
    meters_per_spool REAL,
    grams_per_meter REAL,
    purchase_price_cents INTEGER,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const createGaugeTableSql = `
  CREATE TABLE IF NOT EXISTS craft_gauge_profiles (
    id TEXT PRIMARY KEY NOT NULL,
    cord_material_id TEXT NOT NULL,
    stitch_pattern_id TEXT NOT NULL,
    hook_size_mm REAL NOT NULL,
    tension_profile_id TEXT NOT NULL,
    sample_stitches INTEGER NOT NULL,
    sample_rows INTEGER NOT NULL,
    sample_width_mm REAL NOT NULL,
    sample_height_mm REAL NOT NULL,
    cord_used_mm REAL NOT NULL,
    stitch_pitch_x_mm REAL NOT NULL,
    row_pitch_y_mm REAL NOT NULL,
    meters_per_stitch REAL NOT NULL,
    finished_thickness_mm REAL,
    status TEXT NOT NULL DEFAULT 'MEASURED',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const createGoldenMasterTableSql = `
  CREATE TABLE IF NOT EXISTS craft_golden_masters (
    id TEXT PRIMARY KEY NOT NULL,
    bag_family TEXT NOT NULL,
    product_id TEXT,
    cord_material_id TEXT NOT NULL,
    gauge_profile_id TEXT NOT NULL,
    stitch_pattern_id TEXT NOT NULL,
    width_mm REAL NOT NULL,
    height_mm REAL NOT NULL,
    depth_mm REAL NOT NULL,
    stitch_count INTEGER,
    row_count INTEGER,
    actual_cord_used_mm REAL NOT NULL,
    actual_mass_g REAL NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'MEASURED',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

let readyPromise: Promise<void> | null = null;

function cleanText(value: unknown, field: string, max = 160) {
  if (typeof value !== "string") throw new Error(`Brak pola: ${field}.`);
  const text = value.trim();
  if (!text || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) throw new Error(`Nieprawidłowe pole: ${field}.`);
  return text;
}

function optionalText(value: unknown, max = 1000) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string") throw new Error("Nieprawidłowa wartość tekstowa.");
  const text = value.trim();
  if (text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new Error("Nieprawidłowa wartość tekstowa.");
  return text;
}

function positiveNumber(value: unknown, field: string, max = 1_000_000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > max) throw new Error(`Nieprawidłowy pomiar: ${field}.`);
  return number;
}

function optionalPositiveNumber(value: unknown, field: string, max = 1_000_000) {
  if (value === null || value === undefined || value === "") return null;
  return positiveNumber(value, field, max);
}

function positiveInteger(value: unknown, field: string, max = 1_000_000) {
  const number = positiveNumber(value, field, max);
  if (!Number.isInteger(number)) throw new Error(`Pomiar ${field} musi być liczbą całkowitą.`);
  return number;
}

function optionalPositiveInteger(value: unknown, field: string, max = 1_000_000) {
  if (value === null || value === undefined || value === "") return null;
  return positiveInteger(value, field, max);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new Error(`Nieprawidłowe pole: ${field}.`);
  return value as T;
}

function requestedStatus(value: unknown, fallback: CraftCalibrationStatus): CraftCalibrationStatus {
  return value === "VALIDATED" ? "VALIDATED" : fallback;
}

function mapCord(row: CordRow): CordMaterialRecord {
  return {
    id: row.id,
    supplier: row.supplier,
    supplierSku: row.supplier_sku,
    name: row.name,
    nominalDiameterMm: row.nominal_diameter_mm,
    measuredDiameterMm: row.measured_diameter_mm,
    metersPerSpool: row.meters_per_spool,
    gramsPerMeter: row.grams_per_meter,
    purchasePriceCents: row.purchase_price_cents,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGauge(row: GaugeRow): GaugeProfileRecord {
  return {
    id: row.id,
    cordMaterialId: row.cord_material_id,
    stitchPatternId: row.stitch_pattern_id,
    hookSizeMm: row.hook_size_mm,
    tensionProfileId: row.tension_profile_id,
    sampleStitches: row.sample_stitches,
    sampleRows: row.sample_rows,
    sampleWidthMm: row.sample_width_mm,
    sampleHeightMm: row.sample_height_mm,
    cordUsedMm: row.cord_used_mm,
    stitchPitchXmm: row.stitch_pitch_x_mm,
    rowPitchYmm: row.row_pitch_y_mm,
    metersPerStitch: row.meters_per_stitch,
    finishedThicknessMm: row.finished_thickness_mm,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGoldenMaster(row: GoldenMasterRow): GoldenMasterRecord {
  return {
    id: row.id,
    bagFamily: row.bag_family,
    productId: row.product_id,
    cordMaterialId: row.cord_material_id,
    gaugeProfileId: row.gauge_profile_id,
    stitchPatternId: row.stitch_pattern_id,
    widthMm: row.width_mm,
    heightMm: row.height_mm,
    depthMm: row.depth_mm,
    stitchCount: row.stitch_count,
    rowCount: row.row_count,
    actualCordUsedMm: row.actual_cord_used_mm,
    actualMassG: row.actual_mass_g,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureCraftCalibrationReady() {
  readyPromise ??= (async () => {
    const db = getProductDb();
    await db.prepare(createCordTableSql).run();
    await db.prepare(createGaugeTableSql).run();
    await db.prepare(createGoldenMasterTableSql).run();
  })();
  try {
    await readyPromise;
  } catch (error) {
    readyPromise = null;
    throw error;
  }
}

export async function getCraftCalibrationSnapshot(): Promise<CraftCalibrationSnapshot> {
  await ensureCraftCalibrationReady();
  const db = getProductDb();
  const [cordResult, gaugeResult, masterResult] = await Promise.all([
    db.prepare("SELECT * FROM craft_cord_materials ORDER BY updated_at DESC").all<CordRow>(),
    db.prepare("SELECT * FROM craft_gauge_profiles ORDER BY updated_at DESC").all<GaugeRow>(),
    db.prepare("SELECT * FROM craft_golden_masters ORDER BY updated_at DESC").all<GoldenMasterRow>(),
  ]);
  const cords = cordResult.results.map(mapCord);
  const gauges = gaugeResult.results.map(mapGauge);
  const goldenMasters = masterResult.results.map(mapGoldenMaster);
  const cordsValidated = cords.filter((item) => item.status === "VALIDATED").length;
  const gaugesValidated = gauges.filter((item) => item.status === "VALIDATED").length;
  const goldenMastersValidated = goldenMasters.filter((item) => item.status === "VALIDATED").length;
  const reasons: string[] = [];
  if (!cordsValidated) reasons.push("Brak zatwierdzonego materiału sznurka.");
  if (!gaugesValidated) reasons.push("Brak zatwierdzonej próbki Gauge.");
  if (!goldenMastersValidated) reasons.push("Brak zatwierdzonego fizycznego Golden Mastera.");
  return {
    cords,
    gauges,
    goldenMasters,
    readiness: {
      status: reasons.length ? "NOT_VALIDATED" : "VALIDATED",
      cordsValidated,
      gaugesValidated,
      goldenMastersValidated,
      reasons,
    },
  };
}

export async function createCordMaterial(source: unknown) {
  const raw = typeof source === "object" && source ? source as Record<string, unknown> : {};
  const supplier = cleanText(raw.supplier, "supplier");
  const supplierSku = cleanText(raw.supplierSku, "supplierSku");
  const name = cleanText(raw.name, "name");
  const nominalDiameterMm = positiveNumber(raw.nominalDiameterMm, "nominalDiameterMm", 100);
  const measuredDiameterMm = optionalPositiveNumber(raw.measuredDiameterMm, "measuredDiameterMm", 100);
  const metersPerSpool = optionalPositiveNumber(raw.metersPerSpool, "metersPerSpool");
  const gramsPerMeter = optionalPositiveNumber(raw.gramsPerMeter, "gramsPerMeter", 10_000);
  const purchasePriceCents = optionalPositiveInteger(raw.purchasePriceCents, "purchasePriceCents", 100_000_000);
  const status = requestedStatus(raw.status, "DRAFT");
  if (status === "VALIDATED" && (measuredDiameterMm === null || metersPerSpool === null || gramsPerMeter === null)) {
    throw new Error("Materiał można zatwierdzić dopiero po wpisaniu rzeczywistych pomiarów średnicy, długości nawoju i masy na metr.");
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await ensureCraftCalibrationReady();
  await getProductDb().prepare(`INSERT INTO craft_cord_materials
    (id, supplier, supplier_sku, name, nominal_diameter_mm, measured_diameter_mm, meters_per_spool, grams_per_meter, purchase_price_cents, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, supplier, supplierSku, name, nominalDiameterMm, measuredDiameterMm, metersPerSpool, gramsPerMeter, purchasePriceCents, status, now, now).run();
  return (await getCraftCalibrationSnapshot()).cords.find((item) => item.id === id)!;
}

export async function createGaugeProfile(source: unknown) {
  const raw = typeof source === "object" && source ? source as Record<string, unknown> : {};
  const cordMaterialId = cleanText(raw.cordMaterialId, "cordMaterialId");
  const stitchPatternId = enumValue(raw.stitchPatternId, BUILDER_STITCHES, "stitchPatternId");
  const hookSizeMm = positiveNumber(raw.hookSizeMm, "hookSizeMm", 100);
  const tensionProfileId = cleanText(raw.tensionProfileId, "tensionProfileId");
  const sampleStitches = positiveInteger(raw.sampleStitches, "sampleStitches", 100_000);
  const sampleRows = positiveInteger(raw.sampleRows, "sampleRows", 100_000);
  const sampleWidthMm = positiveNumber(raw.sampleWidthMm, "sampleWidthMm");
  const sampleHeightMm = positiveNumber(raw.sampleHeightMm, "sampleHeightMm");
  const cordUsedMm = positiveNumber(raw.cordUsedMm, "cordUsedMm", 100_000_000);
  const finishedThicknessMm = optionalPositiveNumber(raw.finishedThicknessMm, "finishedThicknessMm", 1_000);
  const stitchPitchXmm = sampleWidthMm / sampleStitches;
  const rowPitchYmm = sampleHeightMm / sampleRows;
  const metersPerStitch = cordUsedMm / 1000 / (sampleStitches * sampleRows);
  const status = requestedStatus(raw.status, "MEASURED");
  await ensureCraftCalibrationReady();
  const cord = await getProductDb().prepare("SELECT id, status FROM craft_cord_materials WHERE id = ? LIMIT 1").bind(cordMaterialId).first<{ id: string; status: CraftCalibrationStatus }>();
  if (!cord) throw new Error("Wybrany materiał sznurka nie istnieje.");
  if (status === "VALIDATED" && cord.status !== "VALIDATED") throw new Error("Gauge można zatwierdzić dopiero dla zatwierdzonego materiału sznurka.");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getProductDb().prepare(`INSERT INTO craft_gauge_profiles
    (id, cord_material_id, stitch_pattern_id, hook_size_mm, tension_profile_id, sample_stitches, sample_rows, sample_width_mm, sample_height_mm, cord_used_mm, stitch_pitch_x_mm, row_pitch_y_mm, meters_per_stitch, finished_thickness_mm, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, cordMaterialId, stitchPatternId, hookSizeMm, tensionProfileId, sampleStitches, sampleRows, sampleWidthMm, sampleHeightMm, cordUsedMm, stitchPitchXmm, rowPitchYmm, metersPerStitch, finishedThicknessMm, status, now, now).run();
  return (await getCraftCalibrationSnapshot()).gauges.find((item) => item.id === id)!;
}

export async function createGoldenMaster(source: unknown) {
  const raw = typeof source === "object" && source ? source as Record<string, unknown> : {};
  const bagFamily = enumValue(raw.bagFamily, BUILDER_FAMILIES, "bagFamily");
  const productId = raw.productId ? cleanText(raw.productId, "productId", 80) : null;
  const cordMaterialId = cleanText(raw.cordMaterialId, "cordMaterialId");
  const gaugeProfileId = cleanText(raw.gaugeProfileId, "gaugeProfileId");
  const stitchPatternId = enumValue(raw.stitchPatternId, BUILDER_STITCHES, "stitchPatternId");
  const widthMm = positiveNumber(raw.widthMm, "widthMm");
  const heightMm = positiveNumber(raw.heightMm, "heightMm");
  const depthMm = positiveNumber(raw.depthMm, "depthMm");
  const stitchCount = optionalPositiveInteger(raw.stitchCount, "stitchCount");
  const rowCount = optionalPositiveInteger(raw.rowCount, "rowCount");
  const actualCordUsedMm = positiveNumber(raw.actualCordUsedMm, "actualCordUsedMm", 100_000_000);
  const actualMassG = positiveNumber(raw.actualMassG, "actualMassG", 1_000_000);
  const notes = optionalText(raw.notes);
  const status = requestedStatus(raw.status, "MEASURED");
  await ensureCraftCalibrationReady();
  const gauge = await getProductDb().prepare("SELECT cord_material_id, stitch_pattern_id, status FROM craft_gauge_profiles WHERE id = ? LIMIT 1").bind(gaugeProfileId).first<{ cord_material_id: string; stitch_pattern_id: BuilderStitch; status: CraftCalibrationStatus }>();
  if (!gauge || gauge.cord_material_id !== cordMaterialId || gauge.stitch_pattern_id !== stitchPatternId) throw new Error("Golden Master musi używać zgodnego istniejącego profilu Gauge.");
  if (status === "VALIDATED" && gauge.status !== "VALIDATED") throw new Error("Golden Master można zatwierdzić dopiero z zatwierdzonym profilem Gauge.");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getProductDb().prepare(`INSERT INTO craft_golden_masters
    (id, bag_family, product_id, cord_material_id, gauge_profile_id, stitch_pattern_id, width_mm, height_mm, depth_mm, stitch_count, row_count, actual_cord_used_mm, actual_mass_g, notes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, bagFamily, productId, cordMaterialId, gaugeProfileId, stitchPatternId, widthMm, heightMm, depthMm, stitchCount, rowCount, actualCordUsedMm, actualMassG, notes, status, now, now).run();
  return (await getCraftCalibrationSnapshot()).goldenMasters.find((item) => item.id === id)!;
}
