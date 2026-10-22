// Verify both public updater manifests and installer downloads against a prepared release.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const root = path.resolve(__dirname, '..')
const release = path.join(root, process.env.OVERHEAD_RELEASE_DIR || 'release/current')
const manifest = JSON.parse(fs.readFileSync(path.join(release, 'release-manifest.json'), 'utf8'))
const base = 'https://overhead-office.web.app'

async function readText(url) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  return response.text()
}

async function verifyInstaller(target, feedPath) {
  const localFeed = fs.readFileSync(path.join(release, target.directory, target.feed), 'ascii')
  const publicFeed = await readText(`${base}${feedPath}`)
  for (const [field, pattern] of [
    ['version', /^version:\s*(\S+)\s*$/m],
    ['sha512', /^sha512:\s*(\S+)\s*$/m],
    ['size', /^\s+size:\s*(\d+)\s*$/m],
    ['installer URL', /^\s+- url:\s*(\S+)\s*$/m],
  ]) {
    const expected = localFeed.match(pattern)?.[1]?.trim()
    const actual = publicFeed.match(pattern)?.[1]?.trim()
    if (!expected || expected !== actual) throw new Error(`${feedPath} ${field} does not match the prepared ${target.directory} feed.`)
  }
  if (!publicFeed.includes(`  - url: ${target.installer}`)) throw new Error(`${feedPath} does not advertise ${target.installer}.`)

  const artifactUrl = `${base}${feedPath.slice(0, feedPath.lastIndexOf('/') + 1)}${target.installer}`
  const response = await fetch(artifactUrl, { cache: 'no-store' })
  if (!response.ok || !response.body) throw new Error(`${artifactUrl} returned HTTP ${response.status}`)
  const hash = crypto.createHash('sha512')
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    hash.update(chunk)
  }
  const digest = hash.digest('base64')
  const advertisedSize = Number(publicFeed.match(/^[ \t]*size:\s*(\d+)\s*$/m)?.[1])
  const advertisedHash = publicFeed.match(/^sha512:\s*(\S+)\s*$/m)?.[1]
  if (size !== advertisedSize || digest !== advertisedHash) throw new Error(`${target.directory} hosted installer does not match its published size and SHA-512.`)
  console.log(`Verified ${target.directory} ${target.version} installer (${size} bytes, SHA-512 matched).`)

  const zipUrl = `${base}/downloads/${target.zip}`
  const zipResponse = await fetch(zipUrl, { cache: 'no-store' })
  if (!zipResponse.ok || !zipResponse.body) throw new Error(`${zipUrl} returned HTTP ${zipResponse.status}`)
  const zipHash = crypto.createHash('sha256')
  let zipSize = 0
  for await (const chunk of zipResponse.body) { zipSize += chunk.length; zipHash.update(chunk) }
  const zipChecksum = zipHash.digest('hex')
  const localZip = fs.readFileSync(path.join(release, target.directory, target.zip))
  const localZipDigest = crypto.createHash('sha256').update(localZip).digest('hex')
  if (zipSize !== localZip.length || zipChecksum !== localZipDigest) throw new Error(`${target.directory} hosted ZIP does not match its prepared bytes.`)
  const checksumText = fs.readFileSync(path.join(release, target.directory, 'SHA256SUMS.txt'), 'ascii')
  if (!checksumText.split(/\r?\n/).includes(`${zipChecksum}  ${target.zip}`)) throw new Error(`${target.directory} ZIP is not covered by its local checksum file.`)
}

async function main() {
  if (manifest?.schema !== 'overhead-central-release-v1') throw new Error('Unsupported central release manifest.')
  await verifyInstaller(manifest.targets.desktop, '/updates/latest.yml')
  await verifyInstaller(manifest.targets.cylinder, '/updates/cylinder/latest.yml')
  await verifyInstaller(manifest.targets['cylinder-client'], '/updates/cylinder-client/latest.yml')
  for (const [route, directory] of [['/downloads/SHA256SUMS.txt', 'desktop'], ['/downloads/CYLINDER-SHA256SUMS.txt', 'cylinder'], ['/downloads/CYLINDER-CLIENT-SHA256SUMS.txt', 'cylinder-client']]) {
    const publicChecksums = await readText(`${base}${route}`)
    const localChecksums = fs.readFileSync(path.join(release, directory, 'SHA256SUMS.txt'), 'ascii')
    if (publicChecksums !== localChecksums) throw new Error(`${route} does not match the prepared ${directory} checksum file.`)
  }
  console.log('All Firebase updater feeds and installer routes match the central release.')
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
