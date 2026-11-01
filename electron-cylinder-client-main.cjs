const { app, dialog } = require('electron')
const { detectCylinderHost } = require('./cylinder-platform.cjs')

process.env.OVERHEAD_DEPLOYMENT_MODE = 'cylinder'
process.env.OVERHEAD_CYLINDER_VARIANT = 'client'

function isSupportedWorkstation() {
  return detectCylinderHost().variant === 'client'
}

if (!isSupportedWorkstation()) {
  app.whenReady().then(() => {
    dialog.showErrorBox('Cylinder Client requires Windows 10 or Windows 11', 'This optional client package is for managed workstations and remote desktop endpoints. Use the separate OverHead Cylinder Server installer on Windows Server or Windows IoT.')
    app.quit()
  })
} else {
  require('./electron-main.cjs')
}
