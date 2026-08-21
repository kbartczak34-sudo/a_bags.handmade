import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

const minimalEnv = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};

const minimalCtx = {
  waitUntil() {},
  passThroughOnException() {},
};

test("protected admin routes reject unauthenticated requests", async () => {
  const worker = await loadWorker();

  for (const pathname of ["/panel", "/panel/settings", "/site-admin", "/api/admin/reviews"]) {
    const response = await worker.fetch(
      new Request(`http://localhost${pathname}`),
      minimalEnv,
      minimalCtx,
    );

    assert.equal(response.status, 403, pathname);
    assert.equal(response.headers.get("cache-control"), "no-store", pathname);
  }
});

test("worker attaches baseline security headers", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/panel"),
    minimalEnv,
    minimalCtx,
  );

  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(
    response.headers.get("referrer-policy"),
    "strict-origin-when-cross-origin",
  );
  assert.match(response.headers.get("permissions-policy") ?? "", /camera=\(\)/);
});
