// Publish the standalone Install Manager and remove product installer/feed assets from Hosting.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const zlib = require('node:zlib')

const root = path.resolve(__dirname, '..')
const site = 'overhead-office'
const websiteRoot = path.join(root, 'website-next', 'out')
const packageJson = require('../package.json')
const managerFile = path.join(root, 'release', 'install-manager', `OverHead-Install-Manager-${packageJson.version}-win-x64.exe`)
const managerRoute = '/downloads/OverHead-Install-Manager.exe'
const planFile = path.join(root, 'release', 'install-manager', 'firebase-route-plan.json')
const managerOnly = process.argv.includes('--manager-only')

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
  const installed = candidates.flatMap((candidate) => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(candidate, 'package.json'), 'utf8'))
      if (!fs.existsSync(path.join(candidate, 'lib', 'auth.js')) || !fs.existsSync(path.join(candidate, 'lib', 'requireAuth.js'))) return []
      return [{ path: candidate, version: pkg.version || '0.0.0' }]
    } catch { return [] }
  })
  installed.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
  if (!installed.length) throw new Error('Install firebase-tools or set OVERHEAD_FIREBASE_TOOLS to an installed firebase-tools directory.')
  console.log(`Using firebase-tools ${installed[0].version}`)
  return installed[0].path
}

const firebaseTools = resolveFirebaseTools()
const auth = require(path.join(firebaseTools, 'lib', 'auth.js'))
const { requireAuth } = require(path.join(firebaseTools, 'lib', 'requireAuth.js'))
const { Client } = require(path.join(firebaseTools, 'lib', 'apiv2.js'))
const api = new Client({ urlPrefix: 'https://firebasehosting.googleapis.com', apiVersion: 'v1beta1', auth: true })

function hashCompressed(contents) {
  return crypto.createHash('sha256').update(zlib.gzipSync(contents, { level: 9 })).digest('hex')
}

function isProgramRoute(route) {
  return /^\/downloads\/OverHead-Desktop-.*-win-x64\.zip$/i.test(route)
    || /^\/downloads\/OverHead-Cylinder(?:-Client)?-.*\.(?:zip|exe)(?:\.blockmap)?$/i.test(route)
    || /^\/downloads\/(?:CYLINDER|CYLINDER-CLIENT)-SHA256SUMS\.txt$/i.test(route)
    || /^\/updates\/OverHead-Setup-.*-win-x64\.exe(?:\.blockmap)?$/i.test(route)
    || /^\/updates\/OverHead-Cylinder(?:-Client)?-Setup-.*\.exe(?:\.blockmap)?$/i.test(route)
    || /^\/updates\/cylinder(?:-client)?(?:\/|$)/i.test(route)
    || /^\/updates\/(?:latest\.yml|SHA256SUMS\.txt)$/i.test(route)
    || /^\/downloads\/latest\.yml$/i.test(route)
}

function isProgramRedirect(redirect) {
  return ['source', 'glob', 'destination', 'location'].some((key) =>
    typeof redirect?.[key] === 'string' && /OverHead-(?:Desktop|Setup|Cylinder)-|CYLINDER(?:-CLIENT)?-SHA256SUMS|\/(?:downloads|updates)\/latest\.yml|\/updates\/cylinder(?:-client)?\//i.test(redirect[key]))
}

function walkFiles(folder) {
  const files = []
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const fullPath = path.join(folder, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(fullPath))
    else if (entry.isFile()) files.push(fullPath)
  }
  return files
}

async function liveRelease() {
  return (await api.get(`/sites/${site}/releases`, { queryParams: { pageSize: 1 } })).body.releases[0]
}

async function readLiveFiles(versionName) {
  const files = {}
  let pageToken
  do {
    const result = (await api.get(`/${versionName}/files`, { queryParams: { pageSize: 1000, ...(pageToken ? { pageToken } : {}) } })).body
    for (const file of result.files || []) files[file.path] = file.hash
    pageToken = result.nextPageToken
  } while (pageToken)
  return files
}

async function buildPlan() {
  if (!fs.existsSync(managerFile)) throw new Error(`Compiled Manager not found: ${managerFile}`)
  if (!fs.existsSync(path.join(websiteRoot, 'downloads', 'index.html'))) throw new Error(`Static website build not found: ${websiteRoot}`)
  const managerBytes = fs.readFileSync(managerFile)
  const managerSha256 = crypto.createHash('sha256').update(managerBytes).digest('hex').toUpperCase()
  const checksumPath = path.join(websiteRoot, 'downloads', 'SHA256SUMS.txt')
  const checksumText = fs.readFileSync(checksumPath, 'utf8')
  if (!checksumText.split(/\r?\n/).includes(`${managerSha256}  OverHead-Install-Manager.exe`)) throw new Error('Published SHA-256 manifest does not match the compiled Manager.')
  if (/OverHead-(?:Desktop|Setup|Cylinder)-|CYLINDER(?:-CLIENT)?-SHA256SUMS|latest\.yml/i.test(checksumText)) throw new Error('Published downloads checksum manifest still includes product packages or update feeds.')
  const managerSignature = String(require('node:child_process').execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Get-AuthenticodeSignature -LiteralPath '${managerFile.replaceAll("'", "''")}').Status`], { encoding: 'utf8', windowsHide: true })).trim()
  if (managerSignature !== 'NotSigned') throw new Error(`Expected the disclosed local unsigned Manager build, received signature status: ${managerSignature}`)

  const current = await liveRelease()
  if (!current?.version?.name) throw new Error('Firebase Hosting has no current release to preserve.')
  const oldRelease = (await api.get(`/${current.version.name}`)).body
  const liveFiles = await readLiveFiles(current.version.name)
  if (!liveFiles['/index.html'] || Object.keys(liveFiles).length < 30) throw new Error('Live Firebase file inventory is incomplete; refusing to deploy.')

  const removedProgramRoutes = managerOnly ? [] : Object.keys(liveFiles).filter(isProgramRoute).sort()
  const remaining = new Map(Object.entries(liveFiles).filter(([route]) => managerOnly || !isProgramRoute(route)))
  const localContents = new Map()
  const addedRoutes = []
  const changedRoutes = []
  const localRoutes = []
  for (const localFile of walkFiles(websiteRoot)) {
    const relative = path.relative(websiteRoot, localFile).split(path.sep).join('/')
    const route = `/${relative}`
    if (managerOnly && !['/downloads/SHA256SUMS.txt', '/downloads/OverHead-Install-Manager-SHA256.txt'].includes(route)) continue
    if (isProgramRoute(route)) continue
    localRoutes.push(route)
    const bytes = fs.readFileSync(localFile)
    const compressedHash = hashCompressed(bytes)
    localContents.set(compressedHash, zlib.gzipSync(bytes, { level: 9 }))
    if (!remaining.has(route)) addedRoutes.push(route)
    else if (remaining.get(route) !== compressedHash) changedRoutes.push(route)
    remaining.set(route, compressedHash)
  }
  const managerCompressed = zlib.gzipSync(managerBytes, { level: 9 })
  const managerCompressedHash = crypto.createHash('sha256').update(managerCompressed).digest('hex')
  localContents.set(managerCompressedHash, managerCompressed)
  if (!remaining.has(managerRoute)) addedRoutes.push(managerRoute)
  else if (remaining.get(managerRoute) !== managerCompressedHash) changedRoutes.push(managerRoute)
  remaining.set(managerRoute, managerCompressedHash)

  if (!managerOnly && (remaining.has('/updates/latest.yml') || remaining.has('/updates/SHA256SUMS.txt') || [...remaining.keys()].some(isProgramRoute))) {
    throw new Error('Staged Hosting map still contains a Desktop or Cylinder binary/feed route.')
  }
  const config = structuredClone(oldRelease.config || {})
  const removedRedirects = managerOnly ? [] : (config.redirects || []).filter(isProgramRedirect)
  if (!managerOnly) config.redirects = (config.redirects || []).filter((item) => !isProgramRedirect(item))
  const changedRouteSet = new Set(changedRoutes)
  const removedProgramRouteSet = new Set(removedProgramRoutes)
  const preservedLiveRoutes = Object.keys(liveFiles)
    .filter((route) => !removedProgramRouteSet.has(route) && !changedRouteSet.has(route))
    .sort()
  const manifest = {
    project: site,
    sourceRelease: current.version.name,
    deploymentTarget: managerRoute,
    managerSha256,
    managerSizeBytes: managerBytes.length,
    managerSignature,
    preservedLiveRouteCount: Object.keys(liveFiles).length - removedProgramRoutes.length,
    preservedLiveRoutes,
    changedLiveRoutes: [...new Set(changedRoutes)].sort(),
    finalRouteCount: remaining.size,
    removedProgramRoutes,
    removedProgramRedirects: removedRedirects,
    addedRoutes: [...new Set(addedRoutes)].sort(),
    changedRoutes: [...new Set(changedRoutes)].sort(),
    forbiddenProgramRoutesAfter: [...remaining.keys()].filter(isProgramRoute),
    localStaticRouteCount: localRoutes.length,
  }
  fs.mkdirSync(path.dirname(planFile), { recursive: true })
  fs.writeFileSync(planFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return { manifest, current, config, files: Object.fromEntries(remaining), contents: localContents }
}

async function main() {
  await requireAuth({ project: site, ...auth.getGlobalDefaultAccount(), nonInteractive: true })
  const plan = await buildPlan()
  console.log(JSON.stringify(plan.manifest, null, 2))
  if (!process.argv.includes('--publish')) {
    console.log(`Plan only. Review ${planFile}; no Firebase release was created.`)
    return
  }
  const latest = await liveRelease()
  if (latest?.version?.name !== plan.current.version.name) throw new Error('Firebase site changed after planning. Re-run and review the new manifest diff.')
  const created = (await api.post(`/sites/${site}/versions`, { config: plan.config })).body
  const populated = (await api.post(`/${created.name}:populateFiles`, { files: plan.files })).body
  const upload = new Client({ urlPrefix: populated.uploadUrl, auth: true })
  for (const hash of populated.uploadRequiredHashes || []) {
    const content = plan.contents.get(hash)
    if (!content) throw new Error(`Firebase requested an unexpected upload hash ${hash}; stopping before release.`)
    const response = await upload.request({ method: 'POST', path: `/${hash}`, body: content, headers: { 'content-length': String(content.length) }, responseType: 'stream', resolveOnHTTPError: true, signal: AbortSignal.timeout(1200000), retries: 3, retryMinTimeout: 2500, retryMaxTimeout: 10000, skipLog: { body: true } })
    if (response.status >= 400) throw new Error(`Firebase artifact upload failed: HTTP ${response.status}`)
    response.body.resume()
    console.log(`Uploaded ${content.length} bytes`)
  }
  await api.patch(`/${created.name}`, { status: 'FINALIZED' }, { queryParams: { updateMask: 'status' } })
  const latestBeforeRelease = await liveRelease()
  if (latestBeforeRelease?.version?.name !== plan.current.version.name) throw new Error('Live site changed during upload. The prepared version remains unreleased.')
  const releaseMessage = managerOnly ? 'Update the standalone OverHead Install Manager' : 'Move Desktop and Cylinder installers off Hosting; publish the standalone Install Manager'
  const result = (await api.post(`/sites/${site}/releases`, { message: releaseMessage }, { queryParams: { versionName: created.name } })).body
  fs.writeFileSync(path.join(path.dirname(planFile), 'firebase-release.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(`Released ${result.name}`)
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1 })
