const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('overheadBilling', {
  getEntitlements: () => ipcRenderer.invoke('billing:get-entitlements'),
  getActivity: () => ipcRenderer.invoke('billing:get-activity'),
  getProfile: () => ipcRenderer.invoke('billing:get-active-profile'),
  saveProfile: (payload) => ipcRenderer.invoke('billing:save-profile', payload),
  createCheckout: (payload) => ipcRenderer.invoke('billing:create-embedded-checkout', payload),
  startTrial: (payload) => ipcRenderer.invoke('billing:start-free-gold-trial', payload),
  cancelAndRefund: () => ipcRenderer.invoke('billing:cancel-with-unused-time-refund'),
  createReceipt: () => ipcRenderer.invoke('billing:create-receipt'),
  close: () => ipcRenderer.invoke('billing:close-module'),
})
