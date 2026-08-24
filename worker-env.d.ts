import type {
  D1DatabaseBinding,
  R2BucketBinding,
} from "./lib/runtime-env";

declare global {
  interface Fetcher {
    fetch(request: Request): Promise<Response>;
  }

  type D1Database = D1DatabaseBinding;
  type R2Bucket = R2BucketBinding;
}

export {};
