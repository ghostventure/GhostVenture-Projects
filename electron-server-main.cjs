const { app, dialog } = require('electron')
const { execFileSync } = require('node:child_process')

process.env.OVERHEAD_DEPLOYMENT_MODE = 'cylinder'

function isSupportedServerPlatform() {
  if (process.platform !== 'win32') return false
  try {
    const output = execFileSync('reg.exe', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', '/v', 'ProductName'], { encoding: 'utf8', windowsHide: true })
    return /Windows Server|\bIoT\b/i.test(output)
  } catch {
    return false
  }
}

if (!isSupportedServerPlatform()) {
  app.whenReady().then(() => {
    dialog.showErrorBox('OverHead Cylinder requires Windows Server or Windows IoT', 'This deployment is licensed and built for Windows Server or a Windows IoT edition. Install the standard OverHead desktop app on Windows 10 or Windows 11.')
    app.quit()
  })
} else {
  require('./electron-main.cjs')
}
