import type {
  D1DatabaseBinding,
  R2BucketBinding,
} from "./lib/runtime-env";

declare global {
  interface Fetcher {
    fetch(request: Request): Promise<Response>;
  }

  interface D1Database extends D1DatabaseBinding {}

  interface R2Bucket extends R2BucketBinding {}
}

export {};
