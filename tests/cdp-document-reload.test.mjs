import assert from "node:assert/strict";
import test from "node:test";
import { reloadCdpDocument } from "../scripts/cdp-document-reload.mjs";

function fixture(states) {
  const sent = [];
  let time = 0, reads = 0;
  return {
    sent,
    get reads() { return reads; },
    send: async (...args) => { sent.push(args); },
    evaluate: async () => {
      const state = states[Math.min(reads++, states.length - 1)];
      if (state instanceof Error) throw state;
      return state;
    },
    options: { timeoutMs: 600, now: () => time, pause: async ms => { time += ms; } },
  };
}

test("reload waits for a new complete document rather than the old readyState", async () => {
  const f = fixture([1000, {timeOrigin:1000,readyState:"complete"}, {timeOrigin:2000,readyState:"loading"}, {timeOrigin:2000,readyState:"complete"}]);
  await reloadCdpDocument(f.send, f.evaluate, f.options);
  assert.equal(f.reads, 4);
  assert.deepEqual(f.sent, [["Page.reload", {ignoreCache:true}]]);
});

test("a document teardown error can settle only after the new document completes", async () => {
  const f = fixture([1000, new Error("Runtime.evaluate: Inspected target navigated or closed"), {timeOrigin:2000,readyState:"complete"}]);
  await reloadCdpDocument(f.send, f.evaluate, f.options);
  assert.equal(f.reads, 3);
  assert.equal(f.sent.length, 1, "no repeated navigation");
});

test("a permanently closed target and a stale complete document both fail within the deadline", async () => {
  for (const state of [new Error("Inspected target navigated or closed"), {timeOrigin:1000,readyState:"complete"}]) {
    const f = fixture([1000, state]);
    await assert.rejects(reloadCdpDocument(f.send, f.evaluate, f.options), /New document did not complete/);
    assert.equal(f.sent.length, 1);
  }
});

test("unrelated protocol errors are reported immediately", async () => {
  const failure = new Error("Runtime.evaluate: target crashed");
  const f = fixture([1000, failure]);
  await assert.rejects(reloadCdpDocument(f.send, f.evaluate, f.options), error => error === failure);
  assert.equal(f.reads, 2);
});
