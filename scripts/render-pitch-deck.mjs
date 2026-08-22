import { chromium } from 'playwright'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const source = pathToFileURL(resolve(root, 'website-next', 'overhead-preseed-pitch-deck.html')).href
const output = resolve(root, 'OverHead-PreSeed-Pitch-Deck.pdf')

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
})
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  await page.goto(source, { waitUntil: 'networkidle' })
  await page.pdf({
    path: output,
    width: '13.333in',
    height: '7.5in',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: false,
  })
  await page.screenshot({ path: resolve(root, 'OverHead-PreSeed-Pitch-Deck-preview.png'), fullPage: true })
  console.log(output)
} finally {
  await browser.close()
}
