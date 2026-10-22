// Publish selected release artifacts while preserving the rest of the live site.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const zlib = require('node:zlib')
const root = path.resolve(__dirname, '..')
function resolveFirebaseTools() {
  const explicit = process.env.OVERHEAD_FIREBASE_TOOLS
  const candidates = explicit ? [explicit] : [
    path.join(root, 'node_modules', 'firebase-tools'),
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools'),
  ]
  const npxRoot = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx')
  if (!explicit && fs.existsSync(npxRoot)) {
    for (const entry of fs.readdirSync(npxRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) candidates.push(path.join(npxRoot, entry.name, 'node_modules', 'firebase-tools'))
    }
  }
  const installed = candidates.flatMap(candidate => {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(candidate, 'package.json'), 'utf8'))
      if (!fs.existsSync(path.join(candidate, 'lib', 'auth.js')) || !fs.existsSync(path.join(candidate, 'lib', 'requireAuth.js'))) return []
      return [{ path: candidate, version: packageJson.version || '0.0.0' }]
    } catch { return [] }
  })
  installed.sort((a, b) => {
    const av = a.version.split('.').map(Number)
    const bv = b.version.split('.').map(Number)
    for (let i = 0; i < 3; i += 1) if ((av[i] || 0) !== (bv[i] || 0)) return (bv[i] || 0) - (av[i] || 0)
    return 0
  })
  if (!installed.length) throw new Error(explicit
    ? 'OVERHEAD_FIREBASE_TOOLS does not point to a compatible installed firebase-tools directory.'
    : 'Install firebase-tools or set OVERHEAD_FIREBASE_TOOLS to its installed directory.')
  console.log(`Using firebase-tools ${installed[0].version}`)
  return installed[0].path
}
const cli = resolveFirebaseTools()
const auth = require(path.join(cli, 'lib/auth.js'))
const { requireAuth } = require(path.join(cli, 'lib/requireAuth.js'))
const { Client } = require(path.join(cli, 'lib/apiv2.js'))
const site = 'overhead-office'
const brochureMode = process.argv.includes('--brochures')
const guideMode = process.argv.includes('--user-guide')
const centralMode = process.argv.includes('--central')
const release = path.join(root, process.env.OVERHEAD_RELEASE_DIR || (centralMode ? 'release/current' : guideMode ? 'release-user-guide' : brochureMode ? 'release-brochures-2026-09-07' : 'release'))
const version = require('../package.json').version
const centralManifest = centralMode ? JSON.parse(fs.readFileSync(path.join(release, 'release-manifest.json'), 'utf8')) : null
const api = new Client({ urlPrefix: 'https://firebasehosting.googleapis.com', apiVersion: 'v1beta1', auth: true })
async function liveRelease() { return (await api.get(`/sites/${site}/releases`, {queryParams:{pageSize:1}})).body.releases[0] }
function assertSignedInstaller(installerPath) {
  if (process.env.OVERHEAD_ALLOW_UNSIGNED_RELEASE === 'true') {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', `Get-AuthenticodeSignature -LiteralPath '${installerPath.replaceAll("'", "''")}' | Select-Object -ExpandProperty Status`], { encoding: 'utf8', windowsHide: true })
    if (result.error || result.status !== 0 || result.stdout.trim() !== 'NotSigned') {
      throw new Error((result.stderr || result.stdout || result.error?.message || 'Expected an explicitly unsigned release artifact.').trim())
    }
    console.log(`Verified explicitly unsigned installer: ${path.basename(installerPath)}`)
    return
  }
  const expectedSigner = process.env.OVERHEAD_EXPECTED_SIGNER
  if (!expectedSigner) throw new Error('Set OVERHEAD_EXPECTED_SIGNER to the exact subject of the approved organization certificate.')
  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(__dirname, 'assert-windows-installer-signature.ps1'),
    '-InstallerPath', installerPath, '-ExpectedSigner', expectedSigner,
  ], { encoding: 'utf8', windowsHide: true })
  if (result.error || result.status !== 0) {
    throw new Error((result.stderr || result.stdout || result.error?.message || 'Installer signature check failed.').trim())
  }
  console.log(result.stdout.trim())
}
function validateCentralArtifacts() {
  if (centralManifest?.schema !== 'overhead-central-release-v1') throw new Error('Central release manifest schema is missing or unsupported.')
  for (const name of ['desktop', 'cylinder', 'cylinder-client']) {
    const target = centralManifest.targets?.[name]
    if (!target || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(target.version || '')) throw new Error(`Central release manifest has an invalid ${name} target.`)
    const appPrefix = name === 'desktop' ? 'OverHead' : name === 'cylinder-client' ? 'OverHead-Cylinder-Client' : 'OverHead-Cylinder'
    const installerName = `${appPrefix}-Setup-${target.version}-win-x64.exe`
    const zipName = name === 'desktop' ? `OverHead-Desktop-${target.version}-win-x64.zip` : `${appPrefix}-${target.version}-win-x64.zip`
    if (target.installer !== installerName || target.zip !== zipName || target.feed !== 'latest.yml' || target.directory !== name) {
      throw new Error(`Central release manifest has unexpected ${name} artifact names.`)
    }
    const directory = path.join(release, name)
    const installer = path.join(directory, target.installer || '')
    const blockmap = `${installer}.blockmap`
    const archive = path.join(directory, target.zip || '')
    const feedPath = path.join(directory, target.feed || '')
    const checksumsPath = path.join(directory, 'SHA256SUMS.txt')
    for (const file of [installer, blockmap, archive, feedPath, checksumsPath]) {
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`${name} release artifact is missing: ${file}`)
    }
    const installerBytes = fs.readFileSync(installer)
    const sha512 = crypto.createHash('sha512').update(installerBytes).digest('base64')
    const feed = fs.readFileSync(feedPath, 'ascii')
    if (!new RegExp(`^version: ${target.version.replaceAll('.', '\\.')}\\s*$`, 'm').test(feed) ||
        !new RegExp(`^  - url: ${target.installer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').test(feed) ||
        !new RegExp(`^    sha512: ${sha512.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').test(feed) ||
        !new RegExp(`^    size: ${installerBytes.length}\\s*$`, 'm').test(feed)) {
      throw new Error(`${name} updater manifest does not match its installer.`)
    }
    const checksumText = fs.readFileSync(checksumsPath, 'ascii')
    for (const file of [installer, blockmap, archive, feedPath]) {
      const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
      const line = `${digest}  ${path.basename(file)}`
      if (!checksumText.split(/\r?\n/).includes(line)) throw new Error(`${name} checksum file does not cover ${path.basename(file)} correctly.`)
    }
  }
}
async function main() {
  if (centralMode) validateCentralArtifacts()
  await requireAuth({ project: site, ...auth.getGlobalDefaultAccount(), nonInteractive: true })
  const billingClient = new Client({urlPrefix:'https://cloudbilling.googleapis.com', apiVersion:'v1', auth:true})
  const billing = (await billingClient.get(`/projects/${site}/billingInfo`)).body
  console.log(JSON.stringify({billingEnabled:billing.billingEnabled}))
  if (centralMode && !billing.billingEnabled) throw new Error('Firebase Hosting billing is disabled; stop before publishing the central Windows installer release.')
  const live = await liveRelease()
  const source = live.version.name
  const old = (await api.get(`/${source}`)).body
  const files = {}
  let pageToken
  do {
    const result = (await api.get(`/${source}/files`, {queryParams:{pageSize:1000, ...(pageToken ? {pageToken} : {})}})).body
    for (const file of result.files || []) files[file.path] = file.hash
    pageToken = result.nextPageToken
  } while (pageToken)
  console.log(JSON.stringify({ source, files: Object.keys(files).length, samplePaths: Object.keys(files).slice(0, 6), config: old.config, desktopPaths: Object.keys(files).filter(p => /download|update/.test(p)) }))
  if (!process.argv.includes('--publish')) return
  if (!files['/index.html'] || Object.keys(files).length < 30) throw new Error('Live file inventory is incomplete.')
  if (centralMode) {
    assertSignedInstaller(path.join(release, 'desktop', centralManifest.targets.desktop.installer))
    assertSignedInstaller(path.join(release, 'cylinder', centralManifest.targets.cylinder.installer))
    assertSignedInstaller(path.join(release, 'cylinder-client', centralManifest.targets['cylinder-client'].installer))
  } else if (!brochureMode && !guideMode && billing.billingEnabled) {
    assertSignedInstaller(path.join(release, `OverHead-Setup-${version}-win-x64.exe`))
  }
  const artifacts = guideMode ? await require('./prepare-user-guide-deploy.cjs')(root, files) : brochureMode ? [
    ['/downloads/OverHead-Business-Office-Guide.pdf', '../website-next/public/downloads/OverHead-Business-Office-Guide.pdf'],
    ['/downloads/OverHead-Investor-Brochure.pdf', '../website-next/public/downloads/OverHead-Investor-Brochure.pdf'],
  ] : centralMode ? [
    ...(billing.billingEnabled ? [
      [`/updates/${centralManifest.targets.desktop.installer}`, `desktop/${centralManifest.targets.desktop.installer}`],
      [`/updates/${centralManifest.targets.desktop.installer}.blockmap`, `desktop/${centralManifest.targets.desktop.installer}.blockmap`],
      ['/updates/latest.yml', 'desktop/latest.yml'],
    ] : []),
    [`/downloads/${centralManifest.targets.desktop.zip}`, `desktop/${centralManifest.targets.desktop.zip}`],
    ['/downloads/SHA256SUMS.txt', 'desktop/SHA256SUMS.txt'],
    [`/updates/cylinder/${centralManifest.targets.cylinder.installer}`, `cylinder/${centralManifest.targets.cylinder.installer}`],
    [`/updates/cylinder/${centralManifest.targets.cylinder.installer}.blockmap`, `cylinder/${centralManifest.targets.cylinder.installer}.blockmap`],
    ['/updates/cylinder/latest.yml', 'cylinder/latest.yml'],
    [`/downloads/${centralManifest.targets.cylinder.zip}`, `cylinder/${centralManifest.targets.cylinder.zip}`],
    ['/downloads/CYLINDER-SHA256SUMS.txt', 'cylinder/SHA256SUMS.txt'],
    [`/updates/cylinder-client/${centralManifest.targets['cylinder-client'].installer}`, `cylinder-client/${centralManifest.targets['cylinder-client'].installer}`],
    [`/updates/cylinder-client/${centralManifest.targets['cylinder-client'].installer}.blockmap`, `cylinder-client/${centralManifest.targets['cylinder-client'].installer}.blockmap`],
    ['/updates/cylinder-client/latest.yml', 'cylinder-client/latest.yml'],
    [`/downloads/${centralManifest.targets['cylinder-client'].zip}`, `cylinder-client/${centralManifest.targets['cylinder-client'].zip}`],
    ['/downloads/CYLINDER-CLIENT-SHA256SUMS.txt', 'cylinder-client/SHA256SUMS.txt'],
  ] : [
    ...(billing.billingEnabled ? [
      [`/updates/OverHead-Setup-${version}-win-x64.exe`, `OverHead-Setup-${version}-win-x64.exe`],
      [`/updates/OverHead-Setup-${version}-win-x64.exe.blockmap`, `OverHead-Setup-${version}-win-x64.exe.blockmap`],
      ['/updates/latest.yml', 'latest.yml'],
    ] : []),
    [`/downloads/OverHead-Desktop-${version}-win-x64.zip`, `OverHead-Desktop-${version}-win-x64.zip`],
    ['/downloads/SHA256SUMS.txt', 'SHA256SUMS.txt'],
  ]
  if (centralMode) {
    const extraFilesPath = path.join(release, 'hosting-extra-files.json')
    if (fs.existsSync(extraFilesPath)) {
      const extraFiles = JSON.parse(fs.readFileSync(extraFilesPath, 'utf8'))
      if (!Array.isArray(extraFiles)) throw new Error('hosting-extra-files.json must contain an array of {url, source} entries.')
      const extraRoutes = new Set()
      for (const entry of extraFiles) {
        if (!entry || typeof entry.url !== 'string' || !entry.url.startsWith('/') || entry.url.includes('..') || typeof entry.source !== 'string') {
          throw new Error('Invalid Hosting extra-file entry; expected an absolute route and repository-relative source path.')
        }
        if (extraRoutes.has(entry.url) || artifacts.some(([url]) => url === entry.url)) throw new Error(`Duplicate Hosting release route: ${entry.url}`)
        extraRoutes.add(entry.url)
        const sourcePath = path.resolve(root, entry.source)
        if (!sourcePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
          throw new Error(`Hosting extra-file source is missing or outside the repository: ${entry.source}`)
        }
        artifacts.push([entry.url, sourcePath])
      }
    }
  }
  const contents = new Map()
  for (const [url, filename] of artifacts) {
    const sourcePath = path.isAbsolute(filename) ? filename : path.join(release, filename)
    const compressed = zlib.gzipSync(fs.readFileSync(sourcePath), {level:9})
    const hash = crypto.createHash('sha256').update(compressed).digest('hex')
    files[url] = hash
    contents.set(hash, compressed)
  }
  const config = structuredClone(old.config || {})
  const desktopZip = centralMode ? centralManifest.targets.desktop.zip : `OverHead-Desktop-${version}-win-x64.zip`
  const cylinderZip = centralMode ? centralManifest.targets.cylinder.zip : null
  const cylinderClientZip = centralMode ? centralManifest.targets['cylinder-client'].zip : null
  const oldPaths = [...new Set([
    ...Object.keys(files).filter(p => /^\/downloads\/OverHead-Desktop-.*-win-x64\.zip$/.test(p) && p !== `/downloads/${desktopZip}`),
    ...(centralMode ? Object.keys(files).filter(p => /^\/downloads\/OverHead-Cylinder-.*-win-x64\.zip$/.test(p) && ![`/downloads/${cylinderZip}`, `/downloads/${cylinderClientZip}`].includes(p)) : []),
    ...['0.1.0','0.2.1','0.3.10','0.3.11'].map(v => `/downloads/OverHead-Desktop-${v}-win-x64.zip`),
  ])]
  if (!brochureMode && !guideMode) {
    config.redirects = (config.redirects || []).filter(r => !oldPaths.includes(r.glob) && !oldPaths.includes(r.source))
    for (const oldPath of oldPaths) {
      const destination = centralMode && oldPath.includes('Cylinder-Client-')
        ? `/downloads/${cylinderClientZip}`
        : centralMode && oldPath.includes('Cylinder') ? `/downloads/${cylinderZip}` : `/downloads/${desktopZip}`
      config.redirects.push({glob:oldPath, location:destination, statusCode:302})
    }
  }
  const created = (await api.post(`/sites/${site}/versions`, {config})).body
  fs.writeFileSync(path.join(release, 'hosting-deploy-state.json'), JSON.stringify({source, target:created.name}, null, 2))
  console.log(`Prepared ${created.name}; preserving ${Object.keys(files).length} paths`)
  const populated = (await api.post(`/${created.name}:populateFiles`, {files})).body
  const upload = new Client({urlPrefix:populated.uploadUrl, auth:true})
  for (const hash of populated.uploadRequiredHashes || []) {
    if (!contents.has(hash)) throw new Error('Hosting requested an unchanged live file; stopping before release.')
    console.log(`Uploading ${contents.get(hash).length} bytes`)
    const content = contents.get(hash)
    const response = await upload.request({method:'POST', path:`/${hash}`, body:content, headers:{'content-length':String(content.length)}, responseType:'stream', resolveOnHTTPError:true, signal:AbortSignal.timeout(1200000), retries:3, retryMinTimeout:2500, retryMaxTimeout:10000, skipLog:{body:true}})
    if (response.status >= 400) throw new Error(`Artifact upload failed: HTTP ${response.status}`)
    response.body.resume()
  }
  await api.patch(`/${created.name}`, {status:'FINALIZED'}, {queryParams:{updateMask:'status'}})
  if ((await liveRelease()).version.name !== source) throw new Error('The live site changed during upload. Re-run to preserve the newer site.')
  const message = guideMode ? 'Publish illustrated desktop user guide and PDF with site navigation' : brochureMode ? 'Updated customer and investor brochures' : centralMode ? `OverHead central release: Desktop ${centralManifest.targets.desktop.version}, Cylinder ${centralManifest.targets.cylinder.version}` : `OverHead Desktop ${version}: local workflow and account controls`
  const result = (await api.post(`/sites/${site}/releases`, {message}, {queryParams:{versionName:created.name}})).body
  fs.writeFileSync(path.join(release, 'hosting-release.json'), JSON.stringify(result, null, 2))
  console.log(`Released ${result.name}`)
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1 })
