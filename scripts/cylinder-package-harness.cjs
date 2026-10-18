// Test-only host simulation. The shipped launcher retains its real OS check.
const { app } = require('electron')
const path = require('node:path')
const cp = require('node:child_process')
if (!process.env.OVERHEAD_SMOKE_DATA) throw Error('Isolated smoke profile required')
app.setPath('appData', process.env.OVERHEAD_SMOKE_DATA)
const original = cp.execFileSync
cp.execFileSync = function (exe, args, ...rest) {
  if (exe === 'reg.exe' && args.includes('ProductName')) return 'Windows Server 2022'
  return original.call(this, exe, args, ...rest)
}
require(path.resolve(__dirname, process.env.OVERHEAD_SMOKE_RELEASE || '../release-cylinder-sweep-0.3.13', 'win-unpacked/resources/app.asar/electron-server-main.cjs'))
