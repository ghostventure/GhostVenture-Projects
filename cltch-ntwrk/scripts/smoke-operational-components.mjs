import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../app/operational-components.js", import.meta.url), "utf8");
const sandbox = {
  console,
  setTimeout,
};

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "app/operational-components.js" });

const registry = sandbox.CLTCHOperationalComponents;
assert.ok(registry, "CLTCHOperationalComponents should be exposed");
assert.equal(registry.catalog.length, 7, "catalog should list only the seven wired local helpers");
assert.equal(registry.domains.length, 6, "catalog should group helpers across six actual domains");
assert.equal(registry.summarize().total, 7, "summary total should match the wired helper count");
assert.equal(registry.summarize().connectedIntegrations, 0, "local helpers must not claim live integrations");
assert.ok(registry.find("payment", { limit: 20 }).length > 0, "catalog should be searchable");
assert.ok(registry.find("unused fake domain").length === 0, "catalog must not invent placeholder helpers");

console.log("CLTCH operations catalog smoke passed: seven wired local helpers across six domains.");
