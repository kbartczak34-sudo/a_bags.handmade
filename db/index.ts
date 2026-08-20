import { drizzle } from "drizzle-orm/d1";
import { getRuntimeBindings } from "../lib/runtime-env";
import * as schema from "./schema";

export function getDb() {
  const db = getRuntimeBindings().DB;

  if (!db) {
    throw new Error(
      "Cloudflare D1 binding is unavailable. Ensure the Worker entry passes the database binding into runtime bindings before handling requests.",
    );
  }

  return drizzle(db as never, { schema });
}
