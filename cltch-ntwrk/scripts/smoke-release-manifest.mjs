import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeReleaseManifest } from './release-manifest.mjs';

const temp = await mkdtemp(path.join(os.tmpdir(), 'cltch-release-manifest-'));
try {
  execFileSync('git', ['init', '-q', temp]);
  execFileSync('git', ['-C', temp, 'config', 'user.email', 'smoke@example.invalid']);
  execFileSync('git', ['-C', temp, 'config', 'user.name', 'Smoke Test']);
  await writeFile(path.join(temp, 'README.md'), 'fixture\n');
  execFileSync('git', ['-C', temp, 'add', 'README.md']);
  execFileSync('git', ['-C', temp, 'commit', '-qm', 'fixture']);
  const calls = [];
  const manifest = await makeReleaseManifest({
    hostingVersion: 'version_123456', repoRoot: temp, now: new Date('2026-10-16T20:00:00.000Z'),
    fetchImpl: async (url) => { const href = String(url); calls.push(href); return { status: href.endsWith('/faq.html') ? 500 : 200, ok: !href.endsWith('/faq.html') }; }
  });
  assert.equal(manifest.project, 'cltch-ntwrk-social');
  assert.equal(manifest.hostingVersion, 'version_123456');
  assert.equal(manifest.source.commit, execFileSync('git', ['-C', temp, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
  assert.equal(manifest.source.branch, 'master');
  assert.equal(calls.length, 5);
  assert.equal(manifest.liveSmoke.checks.length, 5);
  assert.equal(manifest.liveSmoke.passed, false);
  assert.equal(manifest.liveSmoke.checks.find((check) => check.url.endsWith('/faq.html')).status, 500);
  await assert.rejects(() => makeReleaseManifest({ hostingVersion: 'bad id', repoRoot: temp }), /finalized Firebase Hosting version ID/);
  await writeFile(path.join(temp, 'uncommitted.txt'), 'not deployed\n');
  await assert.rejects(() => makeReleaseManifest({ hostingVersion: 'version_123456', repoRoot: temp }), /source checkout is dirty/);
  console.log('Release manifest smoke passed: source, Hosting version, and every live route result are recorded; failed routes fail the release check.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
