import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');
const lockPath = path.join(repoRoot, 'package-lock.json');
const outputPath = path.join(repoRoot, 'docs', 'sbom', 'npm-production.cdx.json');

function packageRef(name, version) {
  const encodedName = encodeURIComponent(name).replace(/%2F/gi, '/');
  return `pkg:npm/${encodedName}@${version}`;
}

function resolvePackagePath(packages, fromPath, dependencyName) {
  let location = fromPath;
  for (;;) {
    const candidate = [location, 'node_modules', dependencyName].filter(Boolean).join('/');
    if (packages[candidate]) return candidate;
    if (!location) return null;
    const parent = path.posix.dirname(location);
    location = parent === '.' ? '' : parent;
  }
}

function licenseEntry(lockPackage) {
  const value = lockPackage.license;
  if (typeof value === 'string' && value.trim()) return { license: { name: value.trim() } };
  if (value && typeof value === 'object') {
    const name = value.type || value.name || value.url;
    if (typeof name === 'string' && name.trim()) return { license: { name: name.trim() } };
  }
  return { license: { name: 'NOASSERTION' } };
}

function packageComponent(name, lockPackage) {
  if (!lockPackage.version) throw new Error(`Locked dependency ${name} has no version.`);
  const ref = packageRef(name, lockPackage.version);
  return {
    type: 'library',
    name,
    version: lockPackage.version,
    'bom-ref': ref,
    purl: ref,
    licenses: [licenseEntry(lockPackage)]
  };
}

export function buildProductionSbom(lock) {
  if (!lock || lock.lockfileVersion !== 3 || !lock.packages?.['']) {
    throw new Error('Expected a package-lock v3 document with a root package entry.');
  }
  const packages = lock.packages;
  const root = packages[''];
  const rootName = root.name || lock.name;
  const rootVersion = root.version || lock.version;
  if (!rootName || !rootVersion) throw new Error('The lockfile root package needs a name and version.');
  const rootRef = packageRef(rootName, rootVersion);
  const components = new Map();
  const graph = new Map([[rootRef, new Set()]]);
  const queue = [];
  const queuedLocations = new Set();

  function addDependency(fromRef, fromPath, dependencyName, optional = false) {
    const targetPath = resolvePackagePath(packages, fromPath, dependencyName);
    if (!targetPath) {
      if (optional) return;
      throw new Error(`Locked production dependency ${dependencyName} required by ${fromPath || rootName} is missing.`);
    }
    const lockPackage = packages[targetPath];
    if (!lockPackage.version) throw new Error(`Locked production dependency ${targetPath} has no version.`);
    const ref = packageRef(dependencyName, lockPackage.version);
    if (!components.has(ref)) {
      components.set(ref, packageComponent(dependencyName, lockPackage));
    }
    if (!queuedLocations.has(targetPath)) {
      queuedLocations.add(targetPath);
      queue.push({ ref, location: targetPath });
    }
    graph.set(ref, graph.get(ref) || new Set());
    graph.get(fromRef).add(ref);
  }

  for (const name of Object.keys(root.dependencies || {}).sort()) addDependency(rootRef, '', name);
  for (const name of Object.keys(root.optionalDependencies || {}).sort()) addDependency(rootRef, '', name, true);

  while (queue.length) {
    const { ref, location } = queue.shift();
    const lockPackage = packages[location];
    graph.set(ref, graph.get(ref) || new Set());
    for (const name of Object.keys(lockPackage.dependencies || {}).sort()) addDependency(ref, location, name);
    for (const name of Object.keys(lockPackage.optionalDependencies || {}).sort()) addDependency(ref, location, name, true);
    for (const name of Object.keys(lockPackage.peerDependencies || {}).sort()) {
      const optionalPeer = lockPackage.peerDependenciesMeta?.[name]?.optional === true;
      addDependency(ref, location, name, optionalPeer);
    }
  }

  const componentList = [...components.values()].sort((a, b) => a['bom-ref'].localeCompare(b['bom-ref']));
  const dependencies = [...graph.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ref, targets]) => ({ ref, dependsOn: [...targets].sort() }));
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: {
      component: {
        type: 'application',
        name: rootName,
        version: rootVersion,
        'bom-ref': rootRef
      }
    },
    components: componentList,
    dependencies
  };
}

async function main() {
  try {
    const lock = JSON.parse(await readFile(lockPath, 'utf8'));
    const bom = buildProductionSbom(lock);
    const serialized = `${JSON.stringify(bom, null, 2)}\n`;
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serialized);
    const unknownLicenses = bom.components.filter((component) => component.licenses[0]?.license?.name === 'NOASSERTION').length;
    console.log(`[sbom] Wrote ${path.relative(repoRoot, outputPath)} with ${bom.components.length} locked production components (${unknownLicenses} license(s) reported as NOASSERTION).`);
  } catch (error) {
    console.error(`[sbom] Could not generate inventory: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) await main();
