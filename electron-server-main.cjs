const { app, dialog } = require('electron')
const { detectCylinderHost } = require('./cylinder-platform.cjs')

process.env.OVERHEAD_DEPLOYMENT_MODE = 'cylinder'
process.env.OVERHEAD_CYLINDER_VARIANT = 'server'

function isSupportedServerPlatform() {
  return detectCylinderHost().variant === 'server'
}

if (!isSupportedServerPlatform()) {
  app.whenReady().then(() => {
    dialog.showErrorBox('OverHead Cylinder Server requires Windows Server or Windows IoT', 'This deployment is for a Windows Server or Windows IoT host. For Windows 10 or Windows 11 endpoints managed by Cylinder, install the optional Cylinder Workstation Client package.')
    app.quit()
  })
} else {
  require('./electron-main.cjs')
}
