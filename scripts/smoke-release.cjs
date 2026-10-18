const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { _electron } = require('playwright')
async function main() {
  const executablePath = path.resolve(__dirname, '../release/win-unpacked/OverHead.exe')
  const isolatedProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'overhead-release-smoke-'))
  let app
  try {
    app = await _electron.launch({ executablePath, args: [], env: { ...process.env, OVERHEAD_SMOKE_DATA: isolatedProfile } })
    const page = await app.firstWindow()
    page.on('console', (message) => console.log(`Renderer console ${message.type()}: ${message.text()}`))
    page.on('pageerror', (error) => console.log(`Renderer error: ${error.stack || error.message}`))
    page.on('crash', () => console.log('Renderer crashed'))
    await page.waitForTimeout(5000)
    const state = await app.evaluate(({ app: electronApp, BrowserWindow }) => ({ userData: electronApp.getPath('userData'), appData: electronApp.getPath('appData'), windows: BrowserWindow.getAllWindows().length }))
    console.log(`Runtime paths: ${JSON.stringify(state)}`)
    console.log(`URL: ${page.url()} title: ${await page.title()} text: ${(await page.locator('body').innerText().catch(() => 'BODY ERROR')).slice(0, 1500)}`)
    await page.screenshot({ path: path.join(os.tmpdir(), 'overhead-release-smoke.png'), fullPage: true })
    await page.locator('.login-card, .workspace-shell, .app-shell, #root > *').first().waitFor({ timeout: 10000 })
    assert.ok(state.userData.startsWith(isolatedProfile), `Data escaped isolated profile: ${state.userData}`)
    assert.equal(state.windows, 1)
    console.log('PASS: packaged app rendered with isolated profile')
  } finally { if (app) await app.close(); fs.rmSync(isolatedProfile, { recursive: true, force: true }) }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
