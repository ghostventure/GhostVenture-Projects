import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scanSecretRepository } from './scan-secrets.mjs';

function runGit(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
}

const root = await mkdtemp(path.join(os.tmpdir(), 'cltch-secret-scan-'));
try {
  await mkdir(path.join(root, 'scripts'), { recursive: true });
  await writeFile(path.join(root, '.gitignore'), '.env*\n');
  await writeFile(path.join(root, '.env.example'), 'FIREBASE_API_KEY=replace-me\n');
  await writeFile(path.join(root, 'client.js'), `const firebaseApiKey = "${'AIza' + 'SyExamplePublicClientKey'}";\nconst stripeKey = "${'pk_live_' + 'publicExampleKey123456'}";\n`);
  runGit(root, ['init', '--quiet']);
  runGit(root, ['add', '-A']);

  const clean = await scanSecretRepository(root);
  assert.deepEqual(clean.findings, [], 'public browser keys and .env.example are not secret findings');
  assert.ok(clean.scanned >= 2);

  const token = 'ghp_' + 'A'.repeat(40);
  await writeFile(path.join(root, 'staged-note.txt'), `safe heading\ncredential=${token}\n`);
  runGit(root, ['add', 'staged-note.txt']);
  const tokenFinding = await scanSecretRepository(root);
  assert.deepEqual(tokenFinding.findings.map(({ path: foundPath, ruleId, line }) => ({ path: foundPath, ruleId, line })), [
    { path: 'staged-note.txt', ruleId: 'github-token', line: 2 }
  ]);
  assert.equal(JSON.stringify(tokenFinding).includes(token), false, 'scanner results must never contain secret text');
  await writeFile(path.join(root, 'staged-note.txt'), 'safe working tree copy\n');
  const stagedOnlyToken = await scanSecretRepository(root);
  assert.ok(stagedOnlyToken.findings.some((finding) => finding.path === 'staged-note.txt' && finding.ruleId === 'github-token'), 'staged blob is scanned even when working-tree copy differs');
  assert.equal(JSON.stringify(stagedOnlyToken).includes(token), false, 'staged-secret results must never contain secret text');
  await writeFile(path.join(root, 'staged-note.txt'), `safe heading\ncredential=${token}\n`);

  await writeFile(path.join(root, '.env.production'), 'EMPTY=1\n');
  runGit(root, ['add', '-f', '.env.production']);
  const envFinding = await scanSecretRepository(root);
  assert.ok(envFinding.findings.some((finding) => finding.path === '.env.production' && finding.ruleId === 'environment-file'));

  const accountFixture = path.join(root, 'service-account.json');
  const accountText = '{"fixture":true}\n';
  await writeFile(accountFixture, accountText);
  runGit(root, ['add', '-f', 'service-account.json']);
  const hash = createHash('sha256').update(await readFile(accountFixture)).digest('hex');
  await writeFile(path.join(root, 'scripts', 'secret-scan-allowlist.json'), JSON.stringify({
    allowlist: [{ path: 'service-account.json', ruleId: 'credential-file-name', sha256: hash, reason: 'Synthetic scanner fixture contains no credential.' }]
  }));
  const allowed = await scanSecretRepository(root);
  assert.equal(allowed.findings.some((finding) => finding.path === 'service-account.json'), false);
  assert.equal(allowed.allowed, 1);
  await writeFile(accountFixture, '{"fixture":"changed"}\n');
  const changed = await scanSecretRepository(root);
  assert.ok(changed.findings.some((finding) => finding.path === 'service-account.json'));

  await assert.rejects(scanSecretRepository(path.join(root, 'not-a-git-repository')), /Could not inspect repository|ENOENT/);
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log('Secret scan smoke passed: tracked/staged and nonignored untracked inputs, high-confidence token and filename detection, public-key exclusions, hash-bound allowlisting, and non-disclosure of matched text.');
