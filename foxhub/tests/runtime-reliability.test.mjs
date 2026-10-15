import assert from "node:assert/strict";
import test from "node:test";

function withBrowserWindow(windowValue, callback) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousTimeout = globalThis.setTimeout;
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: windowValue });
  globalThis.setTimeout = (fn) => {
    queueMicrotask(fn);
    return 1;
  };
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      globalThis.setTimeout = previousTimeout;
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else delete globalThis.window;
    });
}

function makeWindow(href) {
  const replaced = [];
  const historyCalls = [];
  const location = {
    href,
    pathname: new URL(href).pathname,
    replace(url) { replaced.push(url); },
    reload() { throw new Error("unexpected full reload"); }
  };
  return {
    value: {
      location,
      history: {
        state: { marker: "state" },
        replaceState(...args) { historyCalls.push(args); }
      },
      navigator: { onLine: true },
      addEventListener() {},
      get sessionStorage() { throw new Error("sessionStorage blocked"); },
      get localStorage() { throw new Error("localStorage blocked"); }
    },
    location,
    replaced,
    historyCalls
  };
}

test("runtime reliability markers stay stable for smoke coverage", async () => {
  const runtime = await import(`../src/runtimeReliability.js?test=${Date.now()}`);
  assert.deepEqual(runtime.RUNTIME_RELIABILITY_MARKERS, ["RuntimeErrorBoundary", "createRetryingLazyImport"]);
});

test("runtime guards can install safely without a browser window", async () => {
  const runtime = await import(`../src/runtimeReliability.js?test=${Date.now()}-server`);
  assert.doesNotThrow(() => runtime.installRuntimeReliabilityGuards());
  assert.doesNotThrow(() => runtime.recordRuntimeEvent("server.noop", { message: "noop" }));
});

test("blocked sessionStorage uses a one-time URL marker and does not reload-loop when the marker is reused", async () => {
  const runtime = await import(`../src/runtimeReliability.js?blocked-storage=${Date.now()}`);
  const browser = makeWindow("https://foxhub.example/member?tab=chat#inbox");
  const chunkError = new Error("Loading chunk 42 failed");

  await withBrowserWindow(browser.value, async () => {
    await assert.rejects(runtime.createRetryingLazyImport(async () => { throw chunkError; }, "member")(), (error) => error === chunkError);
    assert.equal(browser.replaced.length, 1);
    const recoveryUrl = new URL(browser.replaced[0]);
    assert.equal(recoveryUrl.origin, "https://foxhub.example");
    assert.equal(recoveryUrl.pathname, "/member");
    assert.equal(recoveryUrl.searchParams.get("tab"), "chat");
    assert.equal(recoveryUrl.searchParams.get("__foxhub_chunk_reload"), "member");
    assert.equal(recoveryUrl.hash, "#inbox");

    browser.location.href = recoveryUrl.toString();
    await assert.rejects(runtime.createRetryingLazyImport(async () => { throw chunkError; }, "member")(), (error) => error === chunkError);
    assert.equal(browser.replaced.length, 1, "reusing the URL marker must suppress another reload");
  });
});

test("successful lazy import removes its recovery marker while preserving other URL state", async () => {
  const runtime = await import(`../src/runtimeReliability.js?cleanup=${Date.now()}`);
  const browser = makeWindow("https://foxhub.example/member?tab=chat&__foxhub_chunk_reload=member#inbox");
  const moduleValue = { default: "loaded" };

  await withBrowserWindow(browser.value, async () => {
    const result = await runtime.createRetryingLazyImport(async () => moduleValue, "member")();
    assert.equal(result, moduleValue);
    assert.equal(browser.historyCalls.length, 1);
    assert.deepEqual(browser.historyCalls[0], [
      { marker: "state" },
      "",
      "/member?tab=chat#inbox"
    ]);
  });
});
