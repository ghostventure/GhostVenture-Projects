import { readFile, writeFile, copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
const root = resolve(import.meta.dirname, '..')
const reportDir = resolve(root, 'release-brochures-2026-09-07')
const base = 'https://overhead-office.web.app'
const render = JSON.parse(await readFile(resolve(reportDir,'render-verification.json'),'utf8'))
const results = []
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
for (const item of render) {
  const response = await fetch(`${base}/downloads/${item.filename}`)
  assert.equal(response.status,200)
  assert.match(response.headers.get('content-type'), /application\/pdf/)
  const bytes = Buffer.from(await response.arrayBuffer())
  const local = await readFile(resolve(root,'website-next/public/downloads',item.filename))
  assert.equal(hash(bytes),hash(local))
  assert.equal((await PDFDocument.load(bytes)).getPageCount(),3)
  await copyFile(resolve(root,'website-next/public/downloads',item.filename),resolve(root,'website-deploy/downloads',item.filename))
  results.push({file:item.filename,status:200,sha256:hash(bytes),bytes:bytes.length,reductionPercent:Math.round((1-bytes.length/item.previousBytes)*100)})
}
for(const url of new Set(render.flatMap(item=>item.links).filter(url=>url.startsWith('https://')))) {
  const response = await fetch(url,{method:'HEAD'})
  assert.equal(response.status,200,`Broken brochure link: ${url}`)
}
const home = Buffer.from(await (await fetch(base)).arrayBuffer())
assert.equal(hash(home),'0573a5d4df35dd1b927a56f107a7e6bab31603ce0d1a6342deb97b4551899d7d')
const feed = Buffer.from(await (await fetch(`${base}/updates/latest.yml`)).arrayBuffer())
assert.equal(hash(feed),hash(await readFile(resolve(root,'release-stripe-0.3.12/latest.yml'))))
await writeFile(resolve(reportDir,'live-verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),websitePreserved:true,updateFeedPreserved:true,linksVerified:true,results},null,2))
console.log(JSON.stringify(results))
console.log('Live brochure PDFs, all HTTPS links, home page, and desktop update feed verified.')
