import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const suites = Object.keys(packageJson.scripts || {}).filter((name) => name.startsWith('smoke:') && name !== 'smoke:all').sort();
if (!suites.length) throw new Error('No smoke scripts are registered in package.json.');

for (const name of suites) {
  console.log(`\n[smoke-suite] ${name}`);
  const result = spawnSync('npm', ['run', name], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    console.error(`[smoke-suite] stopped after ${name} failed`);
    break;
  }
}
if (!process.exitCode) console.log(`\n[smoke-suite] ${suites.length} registered smoke scripts passed.`);
