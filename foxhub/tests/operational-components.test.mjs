import assert from "node:assert/strict";
import test from "node:test";
import {
  findOperationalComponent,
  operationalComponentCatalog,
  operationalComponentDomains,
  operationalComponentSummary,
  summarizeOperationalComponents
} from "../src/operationalComponents.js";

test("operational component catalog installs exactly 4,000 unique helpers", () => {
  assert.equal(operationalComponentCatalog.length, 4000);
  assert.equal(operationalComponentSummary.total, 4000);
  assert.equal(operationalComponentDomains.length, 40);
  assert.equal(operationalComponentSummary.perDomain, 100);
  assert.equal(new Set(operationalComponentCatalog.map((component) => component.key)).size, 4000);
});

test("operational component catalog is grouped and discoverable", () => {
  const summary = summarizeOperationalComponents();
  assert.equal(summary.total, 4000);
  assert.equal(summary.byDomain.Access, 100);
  assert.equal(summary.byDomain.Workflow, 100);
  assert.ok(summary.byStatus.ready > 0);
  assert.ok(summary.byStatus.active > 0);

  const component = findOperationalComponent("ops-crm-001");
  assert.equal(component.domain, "crm");
  assert.equal(component.surface, "Relationships");
  assert.match(component.detail, /component 1201 of 4000/i);
});
