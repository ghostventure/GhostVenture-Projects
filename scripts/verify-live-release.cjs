const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const root = path.resolve(__dirname, '..')
const base = 'https://overhead-office.web.app'
const version = require(path.join(root, 'package.json')).version

async function readAndHash(response) {
  const hash = crypto.createHash('sha256')
  let size = 0
  for await (const chunk of response.body) {
    hash.update(chunk)
    size += chunk.length
  }
  return { sha256: hash.digest('hex'), size }
}

async function verifyFile(route, localPath) {
  const response = await fetch(`${base}${route}`)
  assert.equal(response.status, 200, `${route} should return HTTP 200`)
  const actual = await readAndHash(response)
  const bytes = fs.readFileSync(localPath)
  assert.equal(actual.size, bytes.length, `${route} byte length differs from the local release`)
  assert.equal(actual.sha256, crypto.createHash('sha256').update(bytes).digest('hex'), `${route} checksum differs from the local release`)
  console.log(`PASS ${route} ${actual.size} bytes sha256=${actual.sha256}`)
}

async function main() {
  const zipName = `OverHead-Desktop-${version}-win-x64.zip`
  const installerName = `OverHead-Setup-${version}-win-x64.exe`
  for (const route of ['/', '/updates/latest.yml', '/downloads/SHA256SUMS.txt']) {
    const response = await fetch(`${base}${route}`)
    assert.equal(response.status, 200, `${route} should return HTTP 200`)
    if (route === '/') assert.match(await response.text(), /OverHead/)
    if (route.endsWith('latest.yml')) assert.match(await response.text(), new RegExp(`version: ${version.replaceAll('.', '\\.')}`))
    console.log(`PASS ${route} HTTP 200`)
  }
  await Promise.all([
    verifyFile(`/downloads/${zipName}`, path.join(root, 'release', zipName)),
    verifyFile(`/updates/${installerName}`, path.join(root, 'release', installerName)),
    verifyFile('/downloads/OverHead-User-Guide.pdf', path.join(root, 'website-next', 'public', 'downloads', 'OverHead-User-Guide.pdf')),
  ])
  const guide = await fetch(`${base}/user-guide/`)
  assert.equal(guide.status, 200, '/user-guide/ should return HTTP 200')
  assert.match(await guide.text(), new RegExp(installerName.replaceAll('.', '\\.')))
  console.log('PASS /user-guide/ links the current installer')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
