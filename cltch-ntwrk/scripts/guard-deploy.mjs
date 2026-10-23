import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(path.dirname(decodeURIComponent(new URL(import.meta.url).pathname)), '..');
const cwd = process.cwd();

function fail(message) {
  console.error(`\n[deploy-guard] ${message}\n`);
  process.exit(1);
}

if (path.resolve(cwd) !== repoRoot) {
  fail(`Run deploys from ${repoRoot}, not ${cwd}.`);
}

const packageJsonPath = path.join(repoRoot, 'package.json');
const firebaseJsonPath = path.join(repoRoot, 'firebase.json');
const authPagePath = path.join(repoRoot, 'auth.html');
const matchedGigsPath = path.join(repoRoot, 'musician-matched-gigs.html');

if (!fs.existsSync(packageJsonPath) || !fs.existsSync(firebaseJsonPath)) {
  fail('Missing package.json or firebase.json in the expected repo root.');
}

if (!fs.existsSync(authPagePath) || !fs.existsSync(matchedGigsPath)) {
  fail('CLTCH deploy guard did not find required site files. This does not look like the CLTCH repo.');
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const firebaseJson = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));

if (packageJson.name !== 'cltch-ntwrk-mobile') {
  fail(`Unexpected package name "${packageJson.name}". Refusing CLTCH deploy.`);
}

if (firebaseJson?.hosting?.site !== 'cltch-ntwrk-social') {
  fail(`firebase.json hosting.site must be "cltch-ntwrk-social", got "${firebaseJson?.hosting?.site ?? 'missing'}".`);
}

if (firebaseJson?.hosting?.public !== '.') {
  fail(`firebase.json hosting.public must be ".", got "${firebaseJson?.hosting?.public ?? 'missing'}".`);
}

console.log('[deploy-guard] CLTCH.NTWRK repo verified. Safe to deploy.');
