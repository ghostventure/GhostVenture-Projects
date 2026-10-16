import { readFile } from 'node:fs/promises';

const SITE = 'cltch-ntwrk-social';
const BASE_URL = `https://${SITE}.web.app`;
const ROUTES = ['/', '/auth.html', '/faq.html', '/gig-radar.html', '/privacy.html', '/terms.html', '/android-app.html']
  .map((path) => ({ path, marker: 'CLTCH' }));

function parseArgs(args) {
  const options = { live: false, version: '' };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--live') options.live = true;
    else if (args[index] === '--version' && args[index + 1]) options.version = args[++index];
    else throw new Error(`Unknown or incomplete option: ${args[index]}`);
  }
  if (options.version && !/^[A-Za-z0-9_-]{6,128}$/.test(options.version)) {
    throw new Error('Version ID must contain 6 to 128 letters, numbers, underscores, or hyphens.');
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const firebaseConfig = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8'));
const firebaseRc = JSON.parse(await readFile(new URL('../.firebaserc', import.meta.url), 'utf8'));
if (firebaseConfig.hosting?.site !== SITE || firebaseRc.projects?.default !== SITE) {
  throw new Error(`Expected Firebase project/site ${SITE}; verify firebase.json and .firebaserc before using this runbook.`);
}

console.log(`[hosting-rollback] target: ${SITE} (${BASE_URL})`);
if (options.version) {
  console.log(`[hosting-rollback] operator-supplied candidate version: ${options.version} (not checked against Firebase release history)`);
}
console.log(`[hosting-rollback] planned public GET checks: ${ROUTES.map(({ path }) => path).join(', ')}`);
console.log('[hosting-rollback] inspection mode does not contact Firebase or change anything.');

if (!options.live) {
  console.log('[hosting-rollback] dry run complete; pass --live to run read-only public HTTP checks.');
  process.exit(0);
}

let failed = false;
for (const { path, marker } of ROUTES) {
  try {
    const response = await fetch(new URL(path, BASE_URL), {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(12000)
    });
    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    const passed = response.ok
      && new URL(response.url).origin === BASE_URL
      && contentType.toLowerCase().includes('text/html')
      && body.length > 0
      && body.includes(marker)
      && !/site not found/i.test(body);
    console.log(`[hosting-rollback] ${passed ? 'PASS' : 'FAIL'} GET ${path}: HTTP ${response.status}, ${contentType || 'no content type'}`);
    if (!passed) failed = true;
  } catch (error) {
    failed = true;
    console.log(`[hosting-rollback] FAIL GET ${path}: ${String(error?.message || error).slice(0, 200)}`);
  }
}

if (failed) {
  console.error('[hosting-rollback] one or more public routes failed; inspect the Hosting release and incident-specific behavior.');
  process.exitCode = 1;
} else {
  console.log('[hosting-rollback] all public GET checks passed. Confirm the selected version in Firebase Console; this script cannot verify the active Hosting version or authenticated behavior.');
}
