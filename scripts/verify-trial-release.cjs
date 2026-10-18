const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const asar = require('@electron/asar')
const root = path.resolve(__dirname, '..')
const dir = path.join(root, 'release-trial-0.3.14')
const base = 'https://overhead-office.web.app'
async function main() {
  const archive = path.join(dir, 'win-unpacked/resources/app.asar')
  for (const name of ['electron-backend.cjs','electron-main.cjs','electron-preload.cjs','stripe-connector.cjs']) assert.ok(asar.extractFile(archive, name).equals(fs.readFileSync(path.join(root, name))), `${name} differs in package`)
  assert.equal(JSON.parse(asar.extractFile(archive, 'package.json')).version, '0.3.14')
  const results = []
  for (const route of ['/', '/sign-in/', '/account/']) {
    const response = await fetch(base + route)
    assert.equal(response.status, 200)
    const body = Buffer.from(await response.arrayBuffer()); if(route === '/') assert.match(body.toString(), /90-day free Gold trial/)
    results.push({route,status:response.status})
  }
  for (const [route,name] of [
    ['/updates/latest.yml','latest.yml'],
    ['/downloads/SHA256SUMS.txt','SHA256SUMS.txt'],
    ['/updates/OverHead-Setup-0.3.14-win-x64.exe','OverHead-Setup-0.3.14-win-x64.exe'],
    ['/downloads/OverHead-Desktop-0.3.14-win-x64.zip','OverHead-Desktop-0.3.14-win-x64.zip'],
  ]) {
    const response = await fetch(base + route)
    assert.equal(response.status, 200)
    if (route.endsWith('.zip')) assert.match(response.headers.get('content-type'), /application\/zip/)
    const hash = crypto.createHash('sha256')
    for await (const chunk of response.body) hash.update(chunk)
    const remoteHash = hash.digest('hex')
    assert.equal(remoteHash, crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex'))
    results.push({route,status:200,sha256:remoteHash})
    console.log(`Verified ${route}`)
  }
  const redirect = await fetch(base + '/downloads/OverHead-Desktop-0.3.10-win-x64.zip', {redirect:'manual'})
  assert.equal(redirect.status,302)
  assert.ok(redirect.headers.get('location').endsWith('/downloads/OverHead-Desktop-0.3.14-win-x64.zip'))
  fs.writeFileSync(path.join(dir, 'live-verification.json'), JSON.stringify({verifiedAt:new Date().toISOString(),packagedSourceMatches:true,websitePreserved:true,legacyRedirect:true,results}, null, 2))
  console.log('Live release verified; website preserved; legacy download redirected.')
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })