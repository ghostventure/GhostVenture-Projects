import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProductionSbom } from './generate-sbom.mjs';

const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const committed = JSON.parse(await readFile(new URL('../docs/sbom/npm-production.cdx.json', import.meta.url), 'utf8'));
const first = buildProductionSbom(lock);
const second = buildProductionSbom(lock);
const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
assert.equal(serialize(first), serialize(second), 'generation must be deterministic');
assert.equal(serialize(committed), serialize(first), 'checked-in SBOM must match the current lockfile');
assert.equal(first.bomFormat, 'CycloneDX');
assert.equal(first.specVersion, '1.5');
assert.ok(first.components.length > 0);

const lockRoot = lock.packages[''];
const rootRef = first.metadata.component['bom-ref'];
const componentsByRef = new Map(first.components.map((component) => [component['bom-ref'], component]));
const allRefs = new Set([rootRef, ...componentsByRef.keys()]);
const graph = new Map(first.dependencies.map((entry) => [entry.ref, entry.dependsOn]));
assert.equal(graph.has(rootRef), true);
assert.deepEqual(graph.get(rootRef), Object.keys(lockRoot.dependencies || {}).sort().map((name) => {
  const component = first.components.find((item) => item.name === name && item.version);
  assert.ok(component, `root production dependency ${name} must appear in the SBOM`);
  return component['bom-ref'];
}).sort());

for (const component of first.components) {
  assert.ok(component.name && component.version && component.purl, 'every component needs name, lock version, and purl');
  const expectedPath = `node_modules/${component.name}`;
  const lockedEntryExists = Object.entries(lock.packages).some(([location, item]) =>
    (location === expectedPath || location.endsWith(`/${expectedPath}`)) && item.version === component.version);
  assert.equal(lockedEntryExists, true, `${component.name}@${component.version} must exist in the lockfile`);
  assert.ok(Array.isArray(component.licenses) && component.licenses.length > 0, 'every component needs an explicit license assertion or NOASSERTION');
  assert.ok(component.licenses.every((entry) => entry.license?.id || entry.license?.name), 'license entries must not be empty');
  assert.equal(graph.has(component['bom-ref']), true, 'every component needs a dependency graph node');
  for (const dependencyRef of graph.get(component['bom-ref'])) {
    assert.equal(allRefs.has(dependencyRef), true, `dependency ref ${dependencyRef} must resolve to a component`);
  }
}
assert.equal(componentsByRef.has('pkg:npm/%40capacitor/android@8.3.0'), false, 'dev-only Capacitor packages must be excluded');
assert.ok(first.components.some((component) => component.name === 'next'));
assert.ok(first.components.some((component) => component.name === 'react'));
const nextRef = first.components.find((component) => component.name === 'next')['bom-ref'];
const reactRef = first.components.find((component) => component.name === 'react')['bom-ref'];
const reactDomRef = first.components.find((component) => component.name === 'react-dom')['bom-ref'];
assert.ok(graph.get(nextRef).includes(reactRef), 'Next peer dependency on React must be represented');
assert.ok(graph.get(nextRef).includes(reactDomRef), 'Next peer dependency on React DOM must be represented');
const reachable = new Set([rootRef]);
const pending = [rootRef];
while (pending.length) {
  for (const dependencyRef of graph.get(pending.shift())) {
    if (!reachable.has(dependencyRef)) {
      reachable.add(dependencyRef);
      pending.push(dependencyRef);
    }
  }
}
assert.equal(reachable.size, allRefs.size, 'every SBOM component must be reachable from the production root');

const unknownLicenses = first.components.filter((component) => component.licenses.some((entry) => entry.license?.name === 'NOASSERTION'));
assert.equal(unknownLicenses.length, first.components.length, 'missing npm-lock license metadata must be recorded as NOASSERTION, never guessed');
console.log(`SBOM smoke passed: ${first.components.length} production components, exact lock versions, complete license fields, valid dependency refs, and reproducible CycloneDX output (${unknownLicenses.length} NOASSERTION licenses).`);
