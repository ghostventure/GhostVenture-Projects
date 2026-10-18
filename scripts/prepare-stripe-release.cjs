const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const AdmZip = require('adm-zip')
const root = path.resolve(__dirname, '..')
const version = require('../package.json').version
const dir = path.join(root, `release-stripe-${version}`)
const installer = `OverHead-Setup-${version}-win-x64.exe`
const zipName = `OverHead-Desktop-${version}-win-x64.zip`
const zip = new AdmZip()
zip.addLocalFolder(path.join(dir, 'win-unpacked'))
zip.writeZip(path.join(dir, zipName))
const buffer = fs.readFileSync(path.join(dir, installer))
const sha512 = crypto.createHash('sha512').update(buffer).digest('base64')
fs.writeFileSync(path.join(dir, 'latest.yml'), `version: ${version}\nfiles:\n  - url: ${installer}\n    sha512: ${sha512}\n    size: ${buffer.length}\npath: ${installer}\nsha512: ${sha512}\nreleaseDate: '${new Date().toISOString()}'\n`)
const names = [installer, `${installer}.blockmap`, zipName, 'latest.yml']
fs.writeFileSync(path.join(dir, 'SHA256SUMS.txt'), names.map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex')}  ${name}`).join('\n') + '\n')
console.log(`Prepared ${zipName}, latest.yml, and matching checksums`)
