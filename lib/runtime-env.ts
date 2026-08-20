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
