import { chromium } from 'playwright'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'

const root = resolve(import.meta.dirname, '..')
const outputDir = resolve(root, 'website-next/public/downloads')
const reviewDir = resolve(root, 'release-brochures-2026-09-07')
await mkdir(reviewDir, {recursive:true})
const browser = await chromium.launch({headless:true, executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'})
const results = []
try {
  for (const [kind, filename] of [['customer','OverHead-Business-Office-Guide.pdf'],['investor','OverHead-Investor-Brochure.pdf']]) {
    const oldResponse = await fetch(`https://overhead-office.web.app/downloads/${filename}`)
    if (!oldResponse.ok) throw new Error(`Existing brochure unavailable: ${filename}`)
    const previous = Buffer.from(await oldResponse.arrayBuffer())
    await writeFile(resolve(reviewDir, `previous-${filename}`), previous)
    const previousPdf = await PDFDocument.load(previous)
    const page = await browser.newPage({viewport:{width:816,height:1056}, deviceScaleFactor:1})
    await page.goto(pathToFileURL(resolve(root, `website-next/brochures/${kind}.html`)).href, {waitUntil:'networkidle'})
    await page.emulateMedia({media:'print'})
    await page.evaluate(() => document.fonts.ready)
    const layout = await page.locator('.page').evaluateAll(sections => sections.map(section => {
      const footer = section.querySelector('.footer').getBoundingClientRect()
      const content = [...section.children].filter(el => !el.classList.contains('footer'))
      return {height:section.clientHeight,scroll:section.scrollHeight,footerTop:footer.top,contentBottom:Math.max(...content.map(el=>el.getBoundingClientRect().bottom))}
    }))
    if (layout.some(row=>row.scroll>row.height+1 || row.contentBottom>row.footerTop)) throw new Error(`${kind} has page overflow`)
    const links = await page.locator('a').evaluateAll(elements=>elements.map(el=>el.href))
    for (let i=0;i<3;i++) await page.locator('.page').nth(i).screenshot({path:resolve(reviewDir,`${kind}-${i+1}.png`)})
    const pdf = await page.pdf({path:resolve(outputDir,filename),preferCSSPageSize:true,printBackground:true,tagged:true,outline:true})
    const parsed = await PDFDocument.load(pdf)
    if (parsed.getPageCount()!==3) throw new Error(`${kind} rendered ${parsed.getPageCount()} pages instead of 3`)
    let annotationCount = 0
    for (const pdfPage of parsed.getPages()) annotationCount += pdfPage.node.Annots()?.size() || 0
    if (!annotationCount) throw new Error(`${kind} has no clickable PDF links`)
    results.push({kind,filename,pages:3,bytes:pdf.length,previousBytes:previous.length,previousPages:previousPdf.getPageCount(),annotationCount,links,layoutChecked:true})
    await page.close()
  }
  await writeFile(resolve(reviewDir,'render-verification.json'),JSON.stringify(results,null,2))
  console.log(JSON.stringify(results.map(({links,...result})=>result)))
} finally {await browser.close()}
