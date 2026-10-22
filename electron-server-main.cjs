const { app, dialog } = require('electron')
const { execFileSync } = require('node:child_process')

process.env.OVERHEAD_DEPLOYMENT_MODE = 'cylinder'
process.env.OVERHEAD_CYLINDER_VARIANT = 'server'

function isSupportedServerPlatform() {
  if (process.platform !== 'win32') return false
  try {
    const output = execFileSync('reg.exe', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', '/v', 'ProductName'], { encoding: 'utf8', windowsHide: true, timeout: 5000, maxBuffer: 16384 })
    return /Windows Server|\bIoT\b/i.test(output)
  } catch {
    return false
  }
}

if (!isSupportedServerPlatform()) {
  app.whenReady().then(() => {
    dialog.showErrorBox('OverHead Cylinder Server requires Windows Server or Windows IoT', 'This deployment is for a Windows Server or Windows IoT host. For Windows 10 or Windows 11 endpoints managed by Cylinder, install the optional Cylinder Workstation Client package.')
    app.quit()
  })
} else {
  require('./electron-main.cjs')
}
