const fs = require('node:fs')
const path = require('node:path')

const output = path.resolve('out')
const requiredFiles = [
  'index.html',
  '404.html',
  'robots.txt',
  'sitemap.xml',
  'manifest.webmanifest',
  'dashboard/index.html',
  'account/index.html',
  'sign-in/index.html',
  'downloads/index.html',
]

function fail(message) {
  console.error(`Static export verification failed: ${message}`)
  process.exitCode = 1
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(output, file))) fail(`required route or metadata file is missing: ${file}`)
}

if (process.exitCode) process.exit()

const sitemap = fs.readFileSync(path.join(output, 'sitemap.xml'), 'utf8')
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
if (!locations.length) fail('sitemap contains no location entries')

const seen = new Set()
for (const location of locations) {
  let url
  try { url = new URL(location) } catch { fail(`sitemap contains an invalid URL: ${location}`); continue }
  if (url.origin !== 'https://overhead-office.web.app') fail(`sitemap URL points outside the canonical site: ${url.origin}`)
  if (seen.has(url.pathname)) fail(`sitemap contains a duplicate route: ${url.pathname}`)
  seen.add(url.pathname)
  const relative = url.pathname === '/' ? 'index.html' : `${url.pathname.replace(/^\/+|\/+$/g, '')}/index.html`
  if (!fs.existsSync(path.join(output, relative))) fail(`sitemap route has no exported HTML: ${url.pathname}`)
}

const robots = fs.readFileSync(path.join(output, 'robots.txt'), 'utf8')
for (const route of ['/dashboard/', '/account/', '/sign-in/']) {
  if (!robots.includes(`Disallow: ${route}`)) fail(`robots.txt does not exclude private route ${route}`)
}
if (!robots.includes('https://overhead-office.web.app/sitemap.xml')) fail('robots.txt does not point to the canonical sitemap')

const htmlFiles = []
function collectHtml(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) collectHtml(file)
    else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(file)
  }
}
collectHtml(output)
if (!htmlFiles.length) fail('export contains no HTML documents')
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8')
  if (!/<!doctype html>/i.test(html)) fail(`${path.relative(output, file)} has no HTML doctype`)
}

const mapFiles = []
function collectMaps(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) collectMaps(file)
    else if (entry.isFile() && entry.name.endsWith('.map')) mapFiles.push(file)
  }
}
collectMaps(output)
if (mapFiles.length) fail(`export contains ${mapFiles.length} source map files`)

if (!process.exitCode) console.log(`Verified ${htmlFiles.length} exported HTML pages and ${locations.length} sitemap routes.`)
