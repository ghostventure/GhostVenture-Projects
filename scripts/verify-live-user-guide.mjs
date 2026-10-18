import {chromium} from 'playwright'
import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const root=resolve(import.meta.dirname,'..')
const base='https://overhead-office.web.app'
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
const errors=[]
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}})
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(base,{waitUntil:'networkidle'})
 await page.locator('footer').getByRole('link',{name:'User Guide',exact:true}).click()
 await page.waitForURL('**/user-guide/')
 await page.getByRole('heading',{name:'Your guide to getting work done.'}).waitFor()
 assert.equal(await page.locator('.chapter').count(),14)
 assert.ok(await page.locator('img').evaluateAll(imgs=>imgs.length===4&&imgs.every(im=>im.complete&&im.naturalWidth>0)))
 await page.locator('#guide-search').fill('xyznoresults');await page.locator('#no-results').waitFor({state:'visible'})
 await page.locator('#guide-search').fill('quotes');assert.ok(await page.locator('.chapter:not([hidden])').count()>0)
 await page.locator('#guide-search').fill('')
 await page.locator('.toc a[href="#records"]').click();assert.equal(new URL(page.url()).hash,'#records')
 await page.setViewportSize({width:390,height:844})
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth))
 await page.goto(base+'/support/',{waitUntil:'networkidle'})
 assert.equal(await page.locator('footer').getByRole('link',{name:'User Guide',exact:true}).getAttribute('href'),'/user-guide/')
 assert.deepEqual(errors,[])
 const pdfResponse=await fetch(base+'/downloads/OverHead-User-Guide.pdf')
 assert.equal(pdfResponse.status,200);assert.match(pdfResponse.headers.get('content-type'),/application\/pdf/)
 const pdf=Buffer.from(await pdfResponse.arrayBuffer())
 const hash=b=>createHash('sha256').update(b).digest('hex')
 assert.equal(hash(pdf),hash(await readFile(resolve(root,'website-next/public/downloads/OverHead-User-Guide.pdf'))))
 for(const route of ['/updates/latest.yml','/downloads/OverHead-Business-Office-Guide.pdf','/downloads/OverHead-Investor-Brochure.pdf']) assert.equal((await fetch(base+route,{method:'HEAD'})).status,200)
 const sitemap=await (await fetch(base+'/sitemap.xml')).text();assert.ok(sitemap.includes('/user-guide/'))
 const report={verifiedAt:new Date().toISOString(),chapters:14,screenshots:4,footerNavigation:true,search:true,mobile:true,pdfSha256:hash(pdf),pdfBytes:pdf.length,consoleErrors:errors,sitemap:true}
 await writeFile(resolve(root,'release-user-guide/live-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await browser.close()}
