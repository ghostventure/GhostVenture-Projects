const { app, BrowserWindow, Menu, Notification, Tray, dialog, ipcMain, safeStorage, shell } = require('electron')
const log = require('electron-log/main')
const { autoUpdater } = require('electron-updater')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const backend = require('./electron-backend.cjs')

let mainWindow = null
let lockTimer = null
let backendInitError = ''
let tray = null
let appReady = false
const iconPath = path.join(__dirname, 'public', 'overhead.ico')
const INACTIVITY_LOCK_MS = 30 * 60 * 1000
const MAX_RECOVERY_RETRIES = 3
const DEVELOPER_EMAIL = 'solidartentertainment@gmail.com'
const DEPLOYMENT_MODE = process.env.OVERHEAD_DEPLOYMENT_MODE === 'cylinder' ? 'cylinder' : 'desktop'
const UPDATE_FEED_URL = process.env.OVERHEAD_UPDATE_URL || `https://overhead-office.web.app/updates${DEPLOYMENT_MODE === 'cylinder' ? '/cylinder' : ''}`
const STARTUP_UPDATE_TIMEOUT_MS = 2500
const STARTUP_RECOVERY_HTML = 'data:text/html;charset=utf-8,' + encodeURIComponent([
  '<!doctype html><html><head><meta charset="utf-8"><title>OverHead Recovery</title>',
  '<style>body{font:16px system-ui,-apple-system,"Segoe UI",sans-serif;background:#edf1f4;color:#18212b;margin:0;display:grid;min-height:100vh;place-items:center}.card{max-width:520px;padding:32px;background:white;border-radius:18px;box-shadow:0 18px 50px #1a27301c}h1{margin-top:0}p{line-height:1.55}button{background:#152b3d;color:#fff;border:0;border-radius:9px;padding:11px 16px;font-weight:700;cursor:pointer}</style></head>',
  '<body><main class="card"><h1>OverHead is recovering</h1><p>The main screen could not finish loading. Your local information was left untouched.</p>',
  `<p>Close this screen and reopen OverHead to try again. If it keeps happening, contact ${DEVELOPER_EMAIL}.</p>`,
  '<button onclick="window.close()">Close recovery screen</button></main></body></html>',
].join(''))
// This desktop console does not need GPU acceleration. Keeping rendering on the
// CPU avoids a common launch failure on machines with older or unstable drivers.
app.disableHardwareAcceleration()
app.setPath('userData', path.join(app.getPath('appData'), DEPLOYMENT_MODE === 'cylinder' ? 'OverHead Cylinder' : 'OverHead'))
const recoveryStatePath = path.join(app.getPath('userData'), 'runtime-recovery.json')
log.initialize()
log.transports.file.level = 'info'
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.autoRunAppAfterInstall = true
let updateState = {
  status: 'not-checked',
  feedUrl: UPDATE_FEED_URL,
  version: '',
  message: '',
  checkedAt: '',
}
const singleInstanceLock = app.requestSingleInstanceLock()
const watchedFiles = [
  'electron-main.cjs',
  'electron-preload.cjs',
  path.join('dist', 'index.html'),
]

process.on('uncaughtException', (error) => {
  log.error('OverHead main-process exception', error)
  if (app.isReady()) showStartupRecovery('OverHead ran into a startup problem. The recovery screen is open so you can retry safely.')
})

process.on('unhandledRejection', (reason) => {
  log.error('OverHead unhandled main-process rejection', reason)
})

function readRecoveryState() {
  try {
    return JSON.parse(fs.readFileSync(recoveryStatePath, 'utf8'))
  } catch {
    return { launchAttempts: 0, rendererRecoveries: 0, lastIssue: '', updatedAt: '' }
  }
}

function writeRecoveryState(nextState) {
  fs.mkdirSync(path.dirname(recoveryStatePath), { recursive: true })
  fs.writeFileSync(recoveryStatePath, JSON.stringify({ ...nextState, updatedAt: new Date().toISOString() }, null, 2), 'utf8')
}

function markLaunchAttempt() {
  const current = readRecoveryState()
  const next = { ...current, launchAttempts: Number(current.launchAttempts || 0) + 1 }
  writeRecoveryState(next)
  return next
}

function markLaunchHealthy() {
  writeRecoveryState({ launchAttempts: 0, rendererRecoveries: 0, lastIssue: 'healthy' })
}

function showRecoveryFailure(reason) {
  const message = `OverHead tried to recover 3 times and still could not stay responsive.\n\nPlease email ${DEVELOPER_EMAIL} with a screenshot and the issue: ${reason}`
  log.error(message)
  writeRecoveryState({ launchAttempts: 0, rendererRecoveries: 0, lastIssue: reason })
}

function showStartupRecovery(reason) {
  log.error('OverHead startup recovery', reason)
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = new BrowserWindow({
      width: 660,
      height: 460,
      minWidth: 520,
      minHeight: 380,
      title: 'OverHead Recovery',
      icon: iconPath,
      backgroundColor: '#edf1f4',
      autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    })
    mainWindow.on('closed', () => { mainWindow = null })
  }
  mainWindow.loadURL(STARTUP_RECOVERY_HTML).catch((error) => log.error('OverHead recovery screen could not load', error))
  mainWindow.show()
  mainWindow.focus()
}

function recoverRenderer(reason) {
  const current = readRecoveryState()
  const recoveryCount = Number(current.rendererRecoveries || 0) + 1
  writeRecoveryState({ ...current, rendererRecoveries: recoveryCount, lastIssue: reason })
  if (recoveryCount > MAX_RECOVERY_RETRIES) {
    showRecoveryFailure(reason)
    return
  }
  log.warn(`OverHead renderer recovery ${recoveryCount}/${MAX_RECOVERY_RETRIES}: ${reason}`)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy()
  }
  createWindow()
}

function hashFile(filePath) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
  } catch {
    return ''
  }
}

function integrityReport() {
  const root = __dirname
  const files = watchedFiles.map((relativePath) => {
    const absolutePath = path.join(root, relativePath)
    return {
      relativePath,
      exists: fs.existsSync(absolutePath),
      hash: hashFile(absolutePath),
    }
  })
  const missing = files.filter((file) => !file.exists).length
  const emptyHashes = files.filter((file) => file.exists && !file.hash).length
  const report = {
    generatedAt: new Date().toISOString(),
    appPath: root,
    status: missing || emptyHashes ? 'attention' : 'clean',
    files,
    notes: [
      'Runtime hashes detect unexpected local file replacement for watched files.',
      'Installer signature and OS protections remain separate verification layers.',
      'External camera photos cannot be blocked by software and require screen/privacy policy controls.',
    ],
  }
  if (singleInstanceLock) backend.persistIntegritySnapshot(report, app.getVersion())
  return report
}

function isTrustedSender(event) {
  try {
    const senderUrl = event.senderFrame?.url || ''
    const expectedUrl = new URL(`file://${path.join(__dirname, 'dist', 'index.html').replace(/\\/g, '/')}`).href
    return event.sender === mainWindow?.webContents && senderUrl === expectedUrl
  } catch {
    return false
  }
}

function trustedHandler(handler) {
  return async (event, ...args) => {
    if (!isTrustedSender(event)) {
      const senderUrl = event.senderFrame?.url || 'unknown sender'
      log.warn(`Blocked IPC request from ${senderUrl}`)
      throw new Error('This request did not come from the OverHead desktop window. Please restart OverHead and try again.')
    }
    try {
      return await handler(event, ...args)
    } catch (error) {
      // Electron otherwise exposes only its generic "Error invoking remote method"
      // text to the user, which is not enough to identify a failed desktop action.
      log.error('OverHead IPC request failed', {
        channel: event.type || 'invoke',
        senderUrl: event.senderFrame?.url || 'unknown sender',
        message: error?.message || String(error),
      })
      throw error
    }
  }
}

function openAllowedExternal(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    return ['overhead.local', 'support.overhead.local'].includes(parsed.hostname)
  } catch {
    return false
  }
}

function createWindow() {
  if (focusMainWindow()) return
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 700,
    title: 'OverHead',
    icon: iconPath,
    backgroundColor: '#edf1f4',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'electron-preload.cjs'),
    },
  })

  try {
    mainWindow.setContentProtection(true)
  } catch (error) {
    log.warn('OverHead could not enable window content protection', error)
  }

  mainWindow.webContents.once('did-finish-load', () => {
    markLaunchHealthy()
  })

  mainWindow.on('unresponsive', () => {
    recoverRenderer('Renderer became unresponsive.')
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    recoverRenderer(`Renderer process ended: ${details.reason || 'unknown'}.`)
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return
    showStartupRecovery(`The main screen could not load (${errorCode}: ${errorDescription}) at ${validatedURL || 'local app file'}.`)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (openAllowedExternal(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault())

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault()
      if (openAllowedExternal(url)) shell.openExternal(url)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    if (lockTimer) clearTimeout(lockTimer)
  })

  mainWindow.on('blur', () => {
    if (lockTimer) clearTimeout(lockTimer)
    lockTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('security-lock')
        if (Notification.isSupported()) {
          new Notification({ title: 'OverHead locked', body: 'The desktop session was protected after inactivity.', icon: iconPath }).show()
        }
      }
    }, INACTIVITY_LOCK_MS)
  })

  mainWindow.on('focus', () => {
    if (lockTimer) clearTimeout(lockTimer)
  })

  const appPage = path.join(__dirname, 'dist', 'index.html')
  if (!fs.existsSync(appPage)) {
    showStartupRecovery('The OverHead screen files are missing. Reinstall OverHead to restore them.')
    return
  }
  mainWindow.loadFile(appPage).catch((error) => showStartupRecovery(`The main screen could not start: ${error.message || String(error)}`))
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  return true
}

function powerCycle() {
  log.info('OverHead power cycle requested from the desktop window')
  app.relaunch()
  app.exit(0)
  return { restarting: true }
}

function createTray() {
  if (tray) return
  tray = new Tray(iconPath)
  tray.setToolTip('OverHead Desktop')
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Open OverHead',
      click: () => {
        if (!mainWindow) createWindow()
        mainWindow.show()
        mainWindow.focus()
      },
    },
    {
      label: 'Install Downloaded Update',
      click: () => installDownloadedUpdate(),
    },
    {
      label: 'Lock Session',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('security-lock')
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]))
}

function updaterStatus() {
  return {
    enabled: true,
    autoDownload: autoUpdater.autoDownload,
    channel: autoUpdater.channel || 'latest',
    configured: app.isPackaged,
    ...updateState,
    note: app.isPackaged
      ? 'OverHead checks for updates before opening. Downloaded updates install when you close the app.'
      : 'Source mode skips live update checks. Packaged releases check before the main window opens.',
  }
}

function setUpdateState(status, details = {}) {
  updateState = { ...updateState, status, checkedAt: new Date().toISOString(), ...details }
  log.info('OverHead update status', updateState)
}

function installDownloadedUpdate() {
  if (updateState.status !== 'downloaded') {
    return { installing: false, message: 'No downloaded update is ready to install.' }
  }
  setUpdateState('installing')
  autoUpdater.quitAndInstall(false, true)
  return { installing: true }
}

async function verifyUpdateFeed() {
  const manifestUrl = `${UPDATE_FEED_URL.replace(/\/+$/, '')}/latest.yml`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), STARTUP_UPDATE_TIMEOUT_MS)
  try {
    const response = await fetch(manifestUrl, { signal: controller.signal })
    const manifest = await response.text()
    if (!response.ok || !/^version:\s*\S+/m.test(manifest)) {
      throw new Error('The update feed is not published yet.')
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function checkForUpdatesBeforeLaunch() {
  if (!app.isPackaged) {
    setUpdateState('source-mode', { message: 'Live update checks are skipped while running from source.' })
    return updaterStatus()
  }
  try {
    await verifyUpdateFeed()
    autoUpdater.setFeedURL({ provider: 'generic', url: UPDATE_FEED_URL })
    setUpdateState('checking')
    const check = autoUpdater.checkForUpdates().catch((error) => {
      setUpdateState('unavailable', { message: error?.message || 'Update service could not be reached.' })
      return null
    })
    await Promise.race([
      check,
      new Promise((resolve) => setTimeout(resolve, STARTUP_UPDATE_TIMEOUT_MS)),
    ])
  } catch (error) {
    setUpdateState('unavailable', { message: error?.message || 'Update service could not be reached.' })
  }
  return updaterStatus()
}

autoUpdater.on('update-available', (info) => {
  setUpdateState('downloading', { version: info.version || '', message: 'A newer OverHead update is downloading.' })
  autoUpdater.downloadUpdate().catch((error) => {
    setUpdateState('download-failed', { message: error?.message || 'The update could not be downloaded.' })
  })
})

autoUpdater.on('update-not-available', () => setUpdateState('current', { message: 'This is the latest OverHead version.' }))

autoUpdater.on('download-progress', (progress) => {
  setUpdateState('downloading', { message: `Downloading update: ${Math.round(progress.percent || 0)}%` })
})

autoUpdater.on('update-downloaded', (info) => {
  setUpdateState('downloaded', { version: info.version || '', message: 'Update downloaded and will install when OverHead closes.' })
  if (Notification.isSupported()) {
    new Notification({ title: 'OverHead update ready', body: 'The update will install when you close OverHead.', icon: iconPath }).show()
  }
})

autoUpdater.on('error', (error) => {
  if (updateState.status !== 'download-failed') setUpdateState('unavailable', { message: error?.message || 'Update service could not be reached.' })
})

if (!singleInstanceLock) {
  log.info('OverHead second launch detected; handing control to the existing instance.')
  app.quit()
}

if (singleInstanceLock) {
  app.on('second-instance', () => {
    if (!focusMainWindow()) log.info(`OverHead second launch received before startup completed (ready: ${appReady}).`)
  })
}

if (singleInstanceLock) app.whenReady().then(async () => {
    const launchState = markLaunchAttempt()
    if (launchState.launchAttempts > MAX_RECOVERY_RETRIES) {
      showRecoveryFailure(launchState.lastIssue || 'Startup did not complete.')
      showStartupRecovery('OverHead detected repeated incomplete launches. The recovery screen is available instead of closing the app.')
      return
    }
    await checkForUpdatesBeforeLaunch()
    try {
      backend.initBackend(app, {
        secureStore: {
          available: safeStorage.isEncryptionAvailable(),
          encryptString: (text) => safeStorage.encryptString(text).toString('base64'),
          decryptString: (text) => safeStorage.decryptString(Buffer.from(text, 'base64')),
        },
      })
      log.info('OverHead backend initialized')
    } catch (error) {
      backendInitError = error.message || 'Backend initialization failed.'
      log.error('OverHead backend initialization failed', error)
    }
    ipcMain.handle('integrity-report', trustedHandler(() => integrityReport()))
    ipcMain.handle('backend:bootstrap', trustedHandler(() => {
      if (backendInitError) throw new Error(backendInitError)
      return backend.getBootstrap()
    }))
    ipcMain.handle('backend:health', trustedHandler(() => {
      if (backendInitError) return { status: 'attention', backendInitError }
      return backend.getHealth()
    }))
    ipcMain.handle('auth:register', trustedHandler((_event, payload) => backend.registerSharedProfile(payload)))
    ipcMain.handle('auth:register-customer', trustedHandler((_event, payload) => backend.registerCustomerAccess(payload)))
    ipcMain.handle('auth:sign-in', trustedHandler((_event, payload) => backend.signInSharedProfile(payload)))
    ipcMain.handle('auth:remembered-sign-in', trustedHandler(() => backend.getRememberedSignIn()))
    ipcMain.handle('auth:resume-session', trustedHandler(() => backend.resumeRememberedSession()))
    ipcMain.handle('auth:verify-email', trustedHandler((_event, payload) => backend.verifyEmail(payload)))
    ipcMain.handle('session:lock', trustedHandler((_event, sessionId) => backend.lockSession(sessionId)))
    ipcMain.handle('customers:list', trustedHandler(() => backend.listCustomers()))
    ipcMain.handle('tasks:list', trustedHandler(() => backend.listTasks()))
    ipcMain.handle('tasks:update-status', trustedHandler((_event, payload) => backend.updateTaskStatus(payload)))
    ipcMain.handle('jobs:queue', trustedHandler((_event, payload) => backend.queueWorkflowJob(payload)))
    ipcMain.handle('jobs:process-due', trustedHandler(() => backend.processDueJobs()))
    ipcMain.handle('jobs:list', trustedHandler(() => backend.listWorkflowJobs()))
    ipcMain.handle('customers:create', trustedHandler((_event, payload) => backend.createCustomer(payload)))
    ipcMain.handle('documents:select-file', trustedHandler(async () => {
      const result = await dialog.showOpenDialog({ title: 'Choose customer document', properties: ['openFile'], filters: [{ name: 'Supported documents', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'png', 'jpg', 'jpeg'] }] })
      return result.canceled ? { canceled: true, filePath: '' } : { canceled: false, filePath: result.filePaths[0] || '' }
    }))
    ipcMain.handle('documents:attach', trustedHandler((_event, payload) => backend.attachCustomerDocument(payload)))
    ipcMain.handle('documents:open', trustedHandler(async (_event, documentId) => {
      const error = await shell.openPath(backend.getStoredDocumentPath(documentId))
      if (error) throw new Error(error)
      return { opened: true }
    }))
    ipcMain.handle('customers:create-portal-invite', trustedHandler((_event, payload) => backend.createCustomerPortalInvite(payload)))
    ipcMain.handle('appointments:create', trustedHandler((_event, payload) => backend.createAppointment(payload)))
    ipcMain.handle('quotes:create', trustedHandler((_event, payload) => backend.createQuote(payload)))
    ipcMain.handle('invoices:create', trustedHandler((_event, payload) => backend.createInvoice(payload)))
    ipcMain.handle('operations:assign-customer', trustedHandler((_event, payload) => backend.assignOperationalCustomer(payload)))
    ipcMain.handle('operations:update-status', trustedHandler((_event, payload) => backend.updateOperationalStatus(payload)))
    ipcMain.handle('microsoft:connect', trustedHandler(async (_event, payload) => backend.connectMicrosoft(payload, (deviceCode) => {
      shell.openExternal(deviceCode.verificationUri).catch((error) => log.error('Could not open Microsoft sign-in', error))
      BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('microsoft-device-code', deviceCode))
    })))
    ipcMain.handle('microsoft:list-connections', trustedHandler(() => backend.listMicrosoftConnections()))
    ipcMain.handle('microsoft:preview-import', trustedHandler((_event, payload) => backend.previewMicrosoftImport(payload)))
    ipcMain.handle('microsoft:import-preview', trustedHandler((_event, payload) => backend.importMicrosoftPreview(payload)))
    ipcMain.handle('playbooks:apply', trustedHandler((_event, payload) => backend.applyCustomerPlaybook(payload)))
    ipcMain.handle('guided-launch:build', trustedHandler(() => backend.buildGuidedLaunchPlan()))
    ipcMain.handle('legal:acknowledge', trustedHandler((_event, payload) => backend.acknowledgeLegal(payload)))
    ipcMain.handle('fraud:list', trustedHandler(() => backend.listFraudSignals()))
    ipcMain.handle('stripe:authorization-url', trustedHandler(() => backend.getStripeAuthorizationUrl()))
    ipcMain.handle('stripe:open-authorization', trustedHandler(async () => {
      const result = backend.getStripeAuthorizationUrl()
      await shell.openExternal(result.url)
      return result
    }))
    ipcMain.handle('stripe:save-connection', trustedHandler((_event, payload) => backend.saveStripeConnection(payload)))
    ipcMain.handle('stripe:list-connections', trustedHandler(() => backend.listStripeConnections()))
    ipcMain.handle('stripe:import-snapshot', trustedHandler((_event, payload) => backend.importStripeSnapshot(payload)))
    ipcMain.handle('stripe:list-imports', trustedHandler(() => backend.listStripeImports()))
    ipcMain.handle('payments:list-records', trustedHandler(() => backend.listPaymentRecords()))
    ipcMain.handle('square:authorization-url', trustedHandler(() => backend.getSquareAuthorizationUrl()))
    ipcMain.handle('square:open-authorization', trustedHandler(async () => {
      const result = backend.getSquareAuthorizationUrl()
      await shell.openExternal(result.url)
      return result
    }))
    ipcMain.handle('square:save-connection', trustedHandler((_event, payload) => backend.saveSquareConnection(payload)))
    ipcMain.handle('square:import-snapshot', trustedHandler((_event, payload) => backend.importSquareSnapshot(payload)))
    ipcMain.handle('square:list-connections', trustedHandler(() => backend.listSquareConnections()))
    ipcMain.handle('square:list-imports', trustedHandler(() => backend.listSquareImports()))
    ipcMain.handle('billing:create-embedded-checkout', trustedHandler((_event, payload) => backend.createEmbeddedCheckout(payload)))
    ipcMain.handle('billing:start-free-gold-trial', trustedHandler(() => backend.startFreeGoldTrial()))
    ipcMain.handle('billing:cancel-with-unused-time-refund', trustedHandler(() => backend.cancelSubscriptionWithUnusedTimeRefund()))
    ipcMain.handle('billing:get-entitlements', trustedHandler(() => backend.getRemoteEntitlements()))
    ipcMain.handle('billing:get-activity', trustedHandler(() => backend.getRemoteBillingActivity()))
    ipcMain.handle('entitlements:get', trustedHandler(() => backend.getEntitlementState()))
    ipcMain.handle('billing:save-profile', trustedHandler((_event, payload) => backend.saveBillingProfile(payload)))
    ipcMain.handle('billing:list-profiles', trustedHandler(() => backend.listBillingProfiles()))
    ipcMain.handle('users:list', trustedHandler(() => backend.listUserProfiles()))
    ipcMain.handle('users:create-staff', trustedHandler((_event, payload) => backend.createStaffAccount(payload)))
    ipcMain.handle('users:update', trustedHandler((_event, payload) => backend.updateUserProfile(payload)))
    ipcMain.handle('licenses:list', trustedHandler(() => backend.listLicenses()))
    ipcMain.handle('licenses:refresh-user', trustedHandler((_event, payload) => backend.refreshUserLicense(payload)))
    ipcMain.handle('employee-licenses:list', trustedHandler(() => backend.listEmployeeLicenses()))
    ipcMain.handle('employee-licenses:create', trustedHandler((_event, payload) => backend.createEmployeeLicense(payload)))
    ipcMain.handle('employee-licenses:update', trustedHandler((_event, payload) => backend.updateEmployeeLicense(payload)))
    ipcMain.handle('approvals:create', trustedHandler((_event, payload) => backend.createApprovalRequest(payload)))
    ipcMain.handle('approvals:decide', trustedHandler((_event, payload) => backend.decideApprovalRequest(payload)))
    ipcMain.handle('approvals:list', trustedHandler(() => backend.listApprovalRequests()))
    ipcMain.handle('auth:reset-password', trustedHandler((_event, payload) => backend.resetPassword(payload)))
    ipcMain.handle('toggles:update', trustedHandler((_event, payload) => backend.updateToggle(payload)))
    ipcMain.handle('support:create-ticket', trustedHandler((_event, payload) => backend.createSupportTicket(payload)))
    ipcMain.handle('support:list-shared-tickets', trustedHandler(() => backend.listSharedSupportTickets()))
    ipcMain.handle('office:checklist', trustedHandler(() => backend.buildOfficeChecklist()))
    ipcMain.handle('notes:create', trustedHandler((_event, payload) => backend.createQuickNote(payload)))
    ipcMain.handle('pdf:create-fillable', trustedHandler((_event, payload) => backend.createFillablePdf(payload)))
    ipcMain.handle('pdf:create-operational', trustedHandler((_event, payload) => backend.createOperationalDocument(payload)))
    ipcMain.handle('billing:create-receipt', trustedHandler(() => backend.createSubscriptionReceipt()))
    ipcMain.handle('compliance:create-data-request', trustedHandler((_event, payload) => backend.createDataRequest(payload)))
    ipcMain.handle('compliance:summary', trustedHandler(() => backend.getComplianceSummary()))
    ipcMain.handle('audit:list', trustedHandler((_event, limit) => backend.listAuditEvents(limit)))
    ipcMain.handle('settings:update', trustedHandler((_event, payload) => backend.updateSetting(payload)))
    ipcMain.handle('backup:create', trustedHandler(() => backend.createBackup()))
    ipcMain.handle('export:create', trustedHandler(() => backend.createDataExport()))
    ipcMain.handle('restore:validate', trustedHandler((_event, filePath) => backend.validateRestorePackage(filePath)))
    ipcMain.handle('support:create-bundle', trustedHandler(() => backend.createSupportBundle(integrityReport())))
    ipcMain.handle('updater:status', trustedHandler(() => updaterStatus()))
    ipcMain.handle('updater:install', trustedHandler(() => installDownloadedUpdate()))
    ipcMain.handle('app:power-cycle', trustedHandler(() => powerCycle()))
    createWindow()
    createTray()
    appReady = true
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
}).catch((error) => {
  showStartupRecovery(`OverHead could not complete startup: ${error?.message || String(error)}`)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
