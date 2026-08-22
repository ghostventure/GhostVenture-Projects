import { chromium } from 'playwright'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const source = pathToFileURL(resolve(root, 'website-next', 'customer-brochure.html')).href
const output = resolve(root, 'website-next', 'public', 'downloads', 'OverHead-Business-Office-Guide.pdf')
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
try {
  const page = await browser.newPage({ viewport: { width: 1275, height: 1650 }, deviceScaleFactor: 1 })
  await page.goto(source, { waitUntil: 'networkidle' })
  await page.pdf({ path: output, format: 'Letter', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } })
  console.log(output)
} finally { await browser.close() }
