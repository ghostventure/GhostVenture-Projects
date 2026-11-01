const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('installManager', {
  snapshot: () => ipcRenderer.invoke('manager:snapshot'),
  selectProduct: (targetId) => ipcRenderer.invoke('manager:select-product', targetId),
  closeManager: () => ipcRenderer.invoke('manager:close'),
  recordFirstInstallConsent: (payload) => ipcRenderer.invoke('manager:record-first-install-consent', payload),
  openLegalCenter: () => ipcRenderer.invoke('manager:open-legal-center'),
  checkLatest: () => ipcRenderer.invoke('manager:check-latest'),
  install: () => ipcRenderer.invoke('manager:install'),
  uninstall: (payload) => ipcRenderer.invoke('manager:uninstall', payload),
  setAutoCheck: (enabled) => ipcRenderer.invoke('manager:set-auto-check', enabled),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('manager:set-launch-at-login', enabled),
  configureDataRoot: (path) => ipcRenderer.invoke('manager:configure-data-root', path),
  chooseDataRoot: () => ipcRenderer.invoke('manager:choose-data-root'),
  openBackups: () => ipcRenderer.invoke('manager:open-backups'),
  openDataRoot: () => ipcRenderer.invoke('manager:open-data-root'),
  listBackups: () => ipcRenderer.invoke('manager:list-backups'),
  restore: (payload) => ipcRenderer.invoke('manager:restore', payload),
  onProgress: (callback) => {
    const listener = (_event, progress) => callback(progress)
    ipcRenderer.on('manager:progress', listener)
    return () => ipcRenderer.removeListener('manager:progress', listener)
  },
})
