const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { _electron } = require('playwright')
const root = path.resolve(__dirname, '..')
const release = path.join(root, 'release-stripe-0.3.12')
async function main() {
  const app = await _electron.launch({ executablePath: require('electron'), args:[path.join(__dirname, 'stripe-package-harness.cjs')], env:{...process.env, OVERHEAD_SMOKE_DATA:fs.mkdtempSync(path.join(os.tmpdir(), 'overhead-stripe-smoke-'))} })
  try {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.locator('body').waitFor()
    await page.screenshot({path:path.join(release,'startup-smoke.png')})
    console.log((await page.locator('body').innerText()).slice(0, 900))
    await page.locator('.login-card').waitFor({timeout:30000})
    const check = await app.evaluate(({app, BrowserWindow}) => ({userData:app.getPath('userData'), windows:BrowserWindow.getAllWindows().length}))
    if (!check.userData.includes('overhead-stripe-smoke-')) throw new Error('Smoke profile is not isolated')
    await page.screenshot({path:path.join(release,'startup-smoke.png')})
    console.log(JSON.stringify({packagedStartup:'passed', ...check}))
  } finally { await app.close() }
}
main().catch(error => {console.error(error.message);process.exitCode=1})
