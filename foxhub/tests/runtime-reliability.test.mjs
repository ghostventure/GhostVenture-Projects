import assert from "node:assert/strict";
import test from "node:test";

test("runtime reliability markers stay stable for smoke coverage", async () => {
  const runtime = await import(`../src/runtimeReliability.js?test=${Date.now()}`);
  assert.deepEqual(runtime.RUNTIME_RELIABILITY_MARKERS, ["RuntimeErrorBoundary", "createRetryingLazyImport"]);
});

test("runtime guards can install safely without a browser window", async () => {
  const runtime = await import(`../src/runtimeReliability.js?test=${Date.now()}-server`);
  assert.doesNotThrow(() => runtime.installRuntimeReliabilityGuards());
  assert.doesNotThrow(() => runtime.recordRuntimeEvent("server.noop", { message: "noop" }));
});
