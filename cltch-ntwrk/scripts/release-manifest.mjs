import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = 'https://cltch-ntwrk-social.web.app';
const pages = ['/', '/auth.html', '/faq.html', '/gig-radar.html', '/privacy.html'];

export async function makeReleaseManifest({ hostingVersion, fetchImpl = fetch, now = new Date(), repoRoot = root }) {
  if (!/^[A-Za-z0-9_-]{6,100}$/.test(String(hostingVersion || ''))) {
    throw new Error('Pass the finalized Firebase Hosting version ID with --hosting-version.');
  }
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const changes = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  if (changes) throw new Error('The source checkout is dirty. Commit the deployed source before recording its release manifest.');
  if (!branch) throw new Error('A named source branch is required to record the release manifest.');
  const smoke = [];
  for (const route of pages) {
    let status = 0;
    let error;
    try {
      const response = await fetchImpl(new URL(route, baseUrl), { redirect: 'follow', signal: AbortSignal.timeout(12000) });
      status = response.status;
      if (!response.ok) error = `HTTP ${response.status}`;
    } catch (cause) {
      error = String(cause?.message || cause).slice(0, 180);
    }
    smoke.push({ url: new URL(route, baseUrl).href, status, passed: status >= 200 && status < 400, ...(error ? { error } : {}) });
  }
  return {
    schemaVersion: 1,
    project: 'cltch-ntwrk-social',
    site: 'cltch-ntwrk-social',
    hostingUrl: baseUrl,
    hostingVersion,
    source: { repository: 'ghostventure/GhostVenture-Projects', path: 'cltch-ntwrk', branch, commit },
    createdAt: now.toISOString(),
    liveSmoke: { checkedAt: now.toISOString(), passed: smoke.every((check) => check.passed), checks: smoke }
  };
}

async function main() {
  const args = process.argv.slice(2);
  const versionIndex = args.indexOf('--hosting-version');
  const outputIndex = args.indexOf('--output');
  if (versionIndex < 0 || !args[versionIndex + 1]) {
    throw new Error('Usage: node scripts/release-manifest.mjs --hosting-version VERSION_ID [--output PATH]');
  }
  const manifest = await makeReleaseManifest({ hostingVersion: args[versionIndex + 1] });
  const outputPath = outputIndex >= 0 ? path.resolve(args[outputIndex + 1]) : path.join(root, 'docs', 'releases', `hosting-${manifest.createdAt.replace(/[:.]/g, '-')}-${manifest.source.commit.slice(0, 8)}.json`);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ output: outputPath, commit: manifest.source.commit, hostingVersion: manifest.hostingVersion, smokePassed: manifest.liveSmoke.passed }));
  if (!manifest.liveSmoke.passed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`[release-manifest] ${error.message}`); process.exitCode = 1; });
}
