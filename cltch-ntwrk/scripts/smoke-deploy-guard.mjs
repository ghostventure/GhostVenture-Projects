import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');
const guardPath = path.join(repoRoot, 'scripts', 'guard-deploy.mjs');

function runGuard(script, cwd) {
  return spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' });
}

async function makeFixture(parent, name, { packageName = 'cltch-ntwrk-mobile', site = 'cltch-ntwrk-social' } = {}) {
  const root = path.join(parent, name);
  await mkdir(path.join(root, 'scripts'), { recursive: true });
  await copyFile(guardPath, path.join(root, 'scripts', 'guard-deploy.mjs'));
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: packageName }));
  await writeFile(path.join(root, 'firebase.json'), JSON.stringify({ hosting: { site, public: '.' } }));
  await writeFile(path.join(root, 'auth.html'), '<main>fixture</main>');
  await writeFile(path.join(root, 'musician-matched-gigs.html'), '<main>fixture</main>');
  return root;
}

const packageJson = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
assert.equal(packageJson.name, 'cltch-ntwrk-mobile', 'fixture validation expects the CLTCH package identity');

const actualCorrect = runGuard(guardPath, repoRoot);
assert.equal(actualCorrect.status, 0, `correct repository config should pass:\n${actualCorrect.stderr}${actualCorrect.stdout}`);
assert.match(actualCorrect.stdout, /CLTCH\.NTWRK repo verified/);

const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'cltch-deploy-guard-'));
try {
  const correctRoot = await makeFixture(tmpRoot, 'correct');
  const correctFixture = runGuard(path.join(correctRoot, 'scripts', 'guard-deploy.mjs'), correctRoot);
  assert.equal(correctFixture.status, 0, `correct fixture config should pass:\n${correctFixture.stderr}${correctFixture.stdout}`);

  const wrongCwd = runGuard(guardPath, tmpRoot);
  assert.notEqual(wrongCwd.status, 0, 'running from the wrong working directory must fail closed');
  assert.match(wrongCwd.stderr, /Run deploys from .* not /);

  const wrongPackageRoot = await makeFixture(tmpRoot, 'wrong-package', { packageName: 'plugz-mobile' });
  const wrongPackage = runGuard(path.join(wrongPackageRoot, 'scripts', 'guard-deploy.mjs'), wrongPackageRoot);
  assert.notEqual(wrongPackage.status, 0, 'wrong package identity must fail closed');
  assert.match(wrongPackage.stderr, /Unexpected package name/);

  const wrongSiteRoot = await makeFixture(tmpRoot, 'wrong-site', { site: 'plugz-production' });
  const wrongSite = runGuard(path.join(wrongSiteRoot, 'scripts', 'guard-deploy.mjs'), wrongSiteRoot);
  assert.notEqual(wrongSite.status, 0, 'wrong Firebase Hosting site must fail closed');
  assert.match(wrongSite.stderr, /firebase\.json hosting\.site must be/);
} finally {
  await rm(tmpRoot, { recursive: true, force: true });
}

console.log('Deploy guard smoke passed (valid root, wrong cwd, wrong package, wrong Hosting site).');
