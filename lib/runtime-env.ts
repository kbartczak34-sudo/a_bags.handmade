export interface D1PreparedStatementBinding {
  bind(...values: unknown[]): D1PreparedStatementBinding;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1DatabaseBinding {
  prepare(query: string): D1PreparedStatementBinding;
  batch(statements: D1PreparedStatementBinding[]): Promise<unknown[]>;
}

export interface R2ObjectBodyBinding {
  body: ReadableStream;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}

export interface R2BucketBinding {
  get(key: string): Promise<R2ObjectBodyBinding | null>;
  put(
    key: string,
    value: Uint8Array,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
    },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
}

export type RuntimeBindings = {
  DB?: D1DatabaseBinding;
  BUCKET?: R2BucketBinding;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_LIVE_WEBHOOK_CONFIRMED?: string;
  RESEND_API_KEY?: string;
  ORDER_EMAIL_FROM?: string;

  // Public legal/compliance identity. These values are intentionally kept
  // outside source control because the seller's address and phone number are
  // personal/business data that should only be published once verified.
  LEGAL_BUSINESS_MODE?: string;
  LEGAL_SELLER_NAME?: string;
  LEGAL_SELLER_ADDRESS?: string;
  LEGAL_SELLER_EMAIL?: string;
  LEGAL_SELLER_PHONE?: string;
  LEGAL_SELLER_NIP?: string;
  LEGAL_SELLER_REGON?: string;
  LEGAL_RETURNS_ADDRESS?: string;
  LEGAL_VAT_MODE?: string;
  LEGAL_MANUFACTURER_NAME?: string;
  LEGAL_MANUFACTURER_ADDRESS?: string;
  LEGAL_MANUFACTURER_EMAIL?: string;

  // Explicit go-live attestations for obligations that cannot be proven by
  // application code. Set to "true" only after the relevant records/checks
  // actually exist outside the repository.
  LEGAL_PRODUCT_COMPLIANCE_CONFIRMED?: string;
  LEGAL_PACKAGING_COMPLIANCE_CONFIRMED?: string;
  LEGAL_FISCAL_COMPLIANCE_CONFIRMED?: string;
  LEGAL_PRIVACY_COMPLIANCE_CONFIRMED?: string;
};

const runtimeKey = "__ABAGS_RUNTIME_BINDINGS__";

type RuntimeGlobal = typeof globalThis & {
  [runtimeKey]?: RuntimeBindings;
};

export function setRuntimeBindings(bindings: RuntimeBindings) {
  (globalThis as RuntimeGlobal)[runtimeKey] = bindings;
}

export function getRuntimeBindings(): RuntimeBindings {
  return (globalThis as RuntimeGlobal)[runtimeKey] ?? {};
}
