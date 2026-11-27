const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const releaseDir = path.join(root, 'release')
const { version } = require(path.join(root, 'package.json'))
const artifacts = [`OverHead-${version}-x86_64.AppImage`, `OverHead-${version}-amd64.deb`]

function digest(filePath, algorithm, encoding) {
  return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest(encoding)
}

const appImage = artifacts[0]
const appImagePath = path.join(releaseDir, appImage)
if (!fs.existsSync(appImagePath)) throw new Error(`Build the AppImage first: ${appImagePath}`)
const appImageSha512 = digest(appImagePath, 'sha512', 'base64')
const appImageSize = fs.statSync(appImagePath).size
const manifest = [
  `version: ${version}`,
  'files:',
  `  - url: ${appImage}`,
  `    sha512: ${appImageSha512}`,
  `    size: ${appImageSize}`,
  `path: ${appImage}`,
  `sha512: ${appImageSha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
  '',
].join('\n')
fs.writeFileSync(path.join(releaseDir, 'latest-linux.yml'), manifest)

const sums = artifacts.map((name) => `${digest(path.join(releaseDir, name), 'sha256', 'hex')}  ${name}`)
fs.writeFileSync(path.join(releaseDir, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`)
console.log(`Wrote latest-linux.yml and SHA256SUMS.txt for OverHead ${version}.`)
