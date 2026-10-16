import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), '..');
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const CONTENT_RULES = [
  ['private-key-block', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['aws-access-key-id', /\bAKIA[0-9A-Z]{16}\b/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ['stripe-secret-key', /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['gcp-service-account-key', /"type"\s*:\s*"service_account"[\s\S]{0,1200}"private_key"\s*:\s*"-----BEGIN/],
  ['named-secret-assignment', /\b(?:AWS_SECRET_ACCESS_KEY|STRIPE_SECRET_KEY|CLIENT_SECRET|REFRESH_TOKEN|ACCESS_TOKEN|PRIVATE_KEY)\b\s*[:=]\s*["']?(?!your[_ -]|example|placeholder|changeme|dummy|<)[A-Za-z0-9/+_.=-]{20,}/i]
];

function sensitivePathRule(relativePath) {
  const name = path.posix.basename(relativePath).toLowerCase();
  if (/^\.env(?:\..+)?$/.test(name) && !/\.(?:example|sample|template)$/.test(name)) return 'environment-file';
  if (/\.(?:pem|key|p12|pfx|p8|jks)$/i.test(name)) return 'private-key-file';
  if (/(?:service[-_]?account|credentials?)(?:[-_.].*)?\.(?:json|ya?ml|txt|pem|key|p12|pfx)$/i.test(name)) return 'credential-file-name';
  if (/^(?:id_rsa|id_ed25519)(?:\..*)?$/i.test(name)) return 'ssh-private-key-file';
  return null;
}

function lineAt(text, offset) {
  let lines = 1;
  for (let index = 0; index < offset; index += 1) if (text.charCodeAt(index) === 10) lines += 1;
  return lines;
}

async function readAllowlist(root) {
  const filePath = path.join(root, 'scripts', 'secret-scan-allowlist.json');
  try {
    const document = JSON.parse(await readFile(filePath, 'utf8'));
    if (!Array.isArray(document.allowlist)) throw new Error('allowlist must be an array');
    for (const entry of document.allowlist) {
      if (!entry || typeof entry.path !== 'string' || typeof entry.ruleId !== 'string'
        || !/^[a-f\d]{64}$/i.test(entry.sha256 || '') || typeof entry.reason !== 'string' || !entry.reason.trim()) {
        throw new Error('each allowlist entry needs path, ruleId, SHA-256, and a reason');
      }
    }
    return document.allowlist;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Invalid secret scan allowlist: ${error.message}`);
  }
}

function readIndexBlobs(root, relativePath) {
  const entries = spawnSync('git', ['-C', root, 'ls-files', '--stage', '-z', '--', relativePath], { encoding: 'buffer' });
  if (entries.error) throw new Error(`Could not inspect Git index: ${entries.error.message}`);
  if (entries.status !== 0) throw new Error(`Git index lookup failed with exit code ${entries.status}`);
  const blobs = [];
  for (const entry of entries.stdout.toString('utf8').split('\0').filter(Boolean)) {
    const separator = entry.indexOf('\t');
    if (separator < 0) throw new Error('Git index returned an invalid entry');
    const [mode, objectId, stage] = entry.slice(0, separator).split(' ');
    if (stage !== '0') throw new Error(`Refusing to scan an unresolved index entry: ${relativePath}`);
    const object = spawnSync('git', ['-C', root, 'cat-file', 'blob', objectId], { encoding: 'buffer' });
    if (object.error) throw new Error(`Could not read staged object for ${relativePath}: ${object.error.message}`);
    if (object.status !== 0) throw new Error(`Could not read staged object for ${relativePath}`);
    blobs.push({ buffer: object.stdout, mode });
  }
  return blobs;
}

export async function scanSecretRepository(root = defaultRoot) {
  const repoRoot = await realpath(root);
  const fileList = spawnSync('git', ['-C', repoRoot, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'buffer' });
  if (fileList.error) throw new Error(`Could not run git ls-files: ${fileList.error.message}`);
  if (fileList.status !== 0) throw new Error(`git ls-files failed with exit code ${fileList.status}`);

  const paths = [...new Set(fileList.stdout.toString('utf8').split('\0').filter(Boolean))].sort();
  const allowlist = await readAllowlist(repoRoot);
  const findings = [];
  let scanned = 0;

  for (const relativePath of paths) {
    const normalizedPath = relativePath.split(path.sep).join('/');
    const pathRule = sensitivePathRule(normalizedPath);
    let stats;
    let absolutePath = path.resolve(repoRoot, relativePath);
    try {
      stats = await lstat(absolutePath);
      if (!stats.isSymbolicLink() && !stats.isFile()) continue;
      if (stats.isSymbolicLink()) {
        absolutePath = await realpath(absolutePath);
        if (absolutePath !== repoRoot && !absolutePath.startsWith(`${repoRoot}${path.sep}`)) {
          throw new Error('symlink target leaves the repository');
        }
        stats = await lstat(absolutePath);
        if (!stats.isFile()) continue;
      }
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw new Error(`Could not inspect ${normalizedPath}: ${error.message}`);
    }

    if (stats.size > MAX_FILE_BYTES) throw new Error(`Refusing to skip oversized candidate ${normalizedPath} (${stats.size} bytes).`);
    let buffer;
    try { buffer = await readFile(absolutePath); }
    catch (error) { throw new Error(`Could not read ${normalizedPath}: ${error.message}`); }
    scanned += 1;

    const versions = [{ buffer, source: 'working tree' }, ...readIndexBlobs(repoRoot, relativePath)];
    const seen = new Set();
    for (const version of versions) {
      const fileHash = createHash('sha256').update(version.buffer).digest('hex');
      if (seen.has(fileHash)) continue;
      seen.add(fileHash);
      if (pathRule) findings.push({ path: normalizedPath, ruleId: pathRule, line: 1, fileHash });
      if (version.buffer.includes(0)) continue;
      const text = version.buffer.toString('utf8');
      for (const [ruleId, pattern] of CONTENT_RULES) {
        const match = pattern.exec(text);
        if (match) findings.push({ path: normalizedPath, ruleId, line: lineAt(text, match.index), fileHash });
      }
    }
  }

  const allowed = [];
  const blocking = [];
  for (const finding of findings) {
    const match = allowlist.find((entry) => entry.path === finding.path && entry.ruleId === finding.ruleId && entry.sha256.toLowerCase() === finding.fileHash);
    if (match) allowed.push(finding);
    else blocking.push(finding);
  }
  return { scanned, findings: blocking, allowed: allowed.length };
}

async function main() {
  try {
    const result = await scanSecretRepository();
    for (const finding of result.findings) {
      console.error(`[secret-scan] Possible credential exposure: ${finding.path}:${finding.line} [${finding.ruleId}]`);
    }
    if (result.findings.length) {
      console.error(`[secret-scan] Blocked: ${result.findings.length} finding(s) across ${result.scanned} candidate files.`);
      process.exitCode = 1;
      return;
    }
    console.log(`[secret-scan] Scanned ${result.scanned} candidate files; no unallowlisted high-confidence findings (${result.allowed} exact allowlisted).`);
  } catch (error) {
    console.error(`[secret-scan] Scanner error: ${error.message}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) await main();
