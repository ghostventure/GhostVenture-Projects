const { app, dialog } = require('electron')
const { execFileSync } = require('node:child_process')

process.env.OVERHEAD_DEPLOYMENT_MODE = 'cylinder'
process.env.OVERHEAD_CYLINDER_VARIANT = 'client'

function isSupportedWorkstation() {
  if (process.platform !== 'win32') return false
  try {
    const output = execFileSync('reg.exe', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', '/v', 'ProductName'], { encoding: 'utf8', windowsHide: true, timeout: 5000, maxBuffer: 16384 })
    return /Windows 10|Windows 11/i.test(output) && !/Windows Server|\bIoT\b/i.test(output)
  } catch {
    return false
  }
}

if (!isSupportedWorkstation()) {
  app.whenReady().then(() => {
    dialog.showErrorBox('Cylinder Client requires Windows 10 or Windows 11', 'This optional client package is for managed workstations and remote desktop endpoints. Use the separate OverHead Cylinder Server installer on Windows Server or Windows IoT.')
    app.quit()
  })
} else {
  require('./electron-main.cjs')
}
