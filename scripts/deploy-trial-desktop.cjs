// Publish selected release artifacts while preserving the rest of the live site.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const zlib = require('node:zlib')
const cli = process.env.OVERHEAD_FIREBASE_TOOLS
if (!cli) throw new Error('Set OVERHEAD_FIREBASE_TOOLS to the installed firebase-tools directory.')
const auth = require(path.join(cli, 'lib/auth.js'))
const { requireAuth } = require(path.join(cli, 'lib/requireAuth.js'))
const { Client } = require(path.join(cli, 'lib/apiv2.js'))
const site = 'overhead-office'
const root = path.resolve(__dirname, '..')
const brochureMode = process.argv.includes('--brochures')
const guideMode = process.argv.includes('--user-guide')
const release = path.join(root, guideMode ? 'release-user-guide' : brochureMode ? 'release-brochures-2026-09-07' : 'release-trial-0.3.14')
const version = '0.3.14'
const api = new Client({ urlPrefix: 'https://firebasehosting.googleapis.com', apiVersion: 'v1beta1', auth: true })
async function liveRelease() { return (await api.get(`/sites/${site}/releases`, {queryParams:{pageSize:1}})).body.releases[0] }
async function main() {
  await requireAuth({ project: site, ...auth.getGlobalDefaultAccount(), nonInteractive: true })
  const billingClient = new Client({urlPrefix:'https://cloudbilling.googleapis.com', apiVersion:'v1', auth:true})
  const billing = (await billingClient.get(`/projects/${site}/billingInfo`)).body
  console.log(JSON.stringify({billingEnabled:billing.billingEnabled}))
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
  const artifacts = guideMode ? await require('./prepare-user-guide-deploy.cjs')(root, files) : brochureMode ? [
    ['/downloads/OverHead-Business-Office-Guide.pdf', '../website-next/public/downloads/OverHead-Business-Office-Guide.pdf'],
    ['/downloads/OverHead-Investor-Brochure.pdf', '../website-next/public/downloads/OverHead-Investor-Brochure.pdf'],
  ] : [
    ...(billing.billingEnabled ? [
      [`/updates/OverHead-Setup-${version}-win-x64.exe`, `OverHead-Setup-${version}-win-x64.exe`],
      [`/updates/OverHead-Setup-${version}-win-x64.exe.blockmap`, `OverHead-Setup-${version}-win-x64.exe.blockmap`],
      ['/updates/latest.yml', 'latest.yml'],
    ] : []),
    [`/downloads/OverHead-Desktop-${version}-win-x64.zip`, `OverHead-Desktop-${version}-win-x64.zip`],
    ['/downloads/SHA256SUMS.txt', 'SHA256SUMS.txt'],
  ]
  const contents = new Map()
  for (const [url, filename] of artifacts) {
    const compressed = zlib.gzipSync(fs.readFileSync(path.join(release, filename)), {level:9})
    const hash = crypto.createHash('sha256').update(compressed).digest('hex')
    files[url] = hash
    contents.set(hash, compressed)
  }
  const config = structuredClone(old.config || {})
  const oldPaths = [...new Set([...Object.keys(files).filter(p => /^\/downloads\/OverHead-Desktop-.*-win-x64\.zip$/.test(p) && !p.includes(version)), ...['0.1.0','0.2.1','0.3.10','0.3.11'].map(v => `/downloads/OverHead-Desktop-${v}-win-x64.zip`)])]
  if (!brochureMode && !guideMode) {
    config.redirects = (config.redirects || []).filter(r => !oldPaths.includes(r.glob) && !oldPaths.includes(r.source))
    for (const oldPath of oldPaths) config.redirects.push({glob:oldPath, location:`/downloads/OverHead-Desktop-${version}-win-x64.zip`, statusCode:302})
  }
  const created = (await api.post(`/sites/${site}/versions`, {config})).body
  fs.writeFileSync(path.join(release, 'hosting-deploy-state.json'), JSON.stringify({source, target:created.name}, null, 2))
  console.log(`Prepared ${created.name}; preserving ${Object.keys(files).length} paths`)
  const populated = (await api.post(`/${created.name}:populateFiles`, {files})).body
  const upload = new Client({urlPrefix:populated.uploadUrl, auth:true})
  for (const hash of populated.uploadRequiredHashes || []) {
    if (!contents.has(hash)) throw new Error('Hosting requested an unchanged live file; stopping before release.')
    console.log(`Uploading ${contents.get(hash).length} bytes`)
    const response = await upload.request({method:'POST', path:`/${hash}`, body:require('node:stream').Readable.from(contents.get(hash)), responseType:'stream', resolveOnHTTPError:true, signal:AbortSignal.timeout(1200000)})
    if (response.status >= 400) throw new Error(`Artifact upload failed: HTTP ${response.status}`)
    response.body.resume()
  }
  await api.patch(`/${created.name}`, {status:'FINALIZED'}, {queryParams:{updateMask:'status'}})
  if ((await liveRelease()).version.name !== source) throw new Error('The live site changed during upload. Re-run to preserve the newer site.')
  const result = (await api.post(`/sites/${site}/releases`, {message:guideMode ? 'Publish illustrated desktop user guide and PDF with site navigation' : brochureMode ? 'Updated customer and investor brochures for Desktop 0.3.12' : `OverHead Desktop ${version}: 90-day trials and profile retention`}, {queryParams:{versionName:created.name}})).body
  fs.writeFileSync(path.join(release, 'hosting-release.json'), JSON.stringify(result, null, 2))
  console.log(`Released ${result.name}`)
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
