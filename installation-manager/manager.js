const byId = (id) => document.getElementById(id)
const state = { snapshot: null, release: null, releaseCheckFailed: false, dataRootDraft: '', busy: false, selectedBackup: '', initialReleaseCheckStarted: false, snapshotRequestId: 0 }

function formatReleaseDate(value) {
  const date = new Date(value || '')
  return Number.isNaN(date.getTime()) ? 'publication date unavailable' : new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(date)
}

function hideWelcome() {
  byId('welcome-screen').classList.add('hidden')
}

function refreshWelcome() {
  const snapshot = state.snapshot
  if (!snapshot) return
  const product = snapshot.productName || 'OverHead'
  const edition = snapshot.edition ? `${snapshot.edition} · ` : ''
  byId('edition-badge').lastChild.textContent = ` ${edition}${product}`
  byId('manage-product-title').textContent = `Manage ${product}`
  byId('uninstall-title').textContent = `Uninstall ${product}`
  byId('uninstall').textContent = `Uninstall ${product}`
  byId('welcome-lead').textContent = `One place to install, update, remove, and configure ${product}.`
  byId('auto-check-description').textContent = `${product} checks its official update feed on its normal schedule. Changes take effect the next time it starts.`
  byId('choose-data').dataset.locked = String(!snapshot.supportsCustomDataRoot)
  byId('choose-data').disabled = !snapshot.supportsCustomDataRoot
  byId('data-folder-description').textContent = snapshot.supportsCustomDataRoot
    ? 'Workspace database, settings, and app-local browser state. Moving it copies and verifies files first; the app must be closed.'
    : 'Cylinder Server uses its separate standard data folder. The Manager does not move or copy Desktop data into it.'
  if (snapshot.launchedForUpdate) { hideWelcome(); return }
  if (snapshot.installed) {
    byId('first-install-consent').classList.add('hidden')
    byId('consent-declined').classList.add('hidden')
    byId('welcome-intro').classList.remove('hidden')
  }
  const hasInstallTarget = Boolean(snapshot.productId && snapshot.productId !== 'unsupported')
  const needsConsent = hasInstallTarget && snapshot.installAllowed && !snapshot.installed && !snapshot.firstInstallConsentAccepted
  byId('welcome-install-state').textContent = snapshot.installed
    ? `${product} ${snapshot.version || 'is installed'} is already on this computer.`
    : !snapshot.installAllowed && hasInstallTarget
      ? `${product} is not eligible for installation on this ${snapshot.edition || 'Windows'} system. Choose a product compatible with this device.`
    : snapshot.firstInstallConsentAccepted
      ? `No ${product} installation was found. First-install consent was recorded on ${formatReleaseDate(snapshot.firstInstallConsentAt)}.`
      : `No ${product} installation was found. First-time users review the installation notices before installing.`
  byId('welcome-continue').textContent = needsConsent ? 'Review first-install notices' : snapshot.installed || !snapshot.installAllowed ? 'Open Install Manager' : 'Continue to installation'
  byId('welcome-continue').disabled = false
  byId('notice-updated-date').textContent = formatReleaseDate(snapshot.firstInstallNoticeUpdatedAt)
  const compatibility = snapshot.compatibility
  const os = compatibility?.detected?.os
  const hardware = compatibility?.detected?.hardware
  byId('welcome-compatibility-state').textContent = compatibility?.supported
    ? `Compatibility check passed: ${os?.caption || 'Windows'} build ${os?.build || ''}, native x64 hardware, at least 2 logical processors and 4 GB RAM, Windows PowerShell ${compatibility.detected.powershell?.version || '5.1+'}, and bundled Electron/Chromium/Node runtimes present. Detected ${hardware?.processorName || 'processor'}; ${hardware?.logicalProcessors || 'unknown'} logical processors; ${hardware?.memoryBytes ? `${(hardware.memoryBytes / (1024 ** 3)).toFixed(1)} GB RAM` : 'RAM unknown'}. Free space is checked against the installer, backup, and install reserve before download.`
    : `Installation is blocked by the compatibility check: ${(compatibility?.blockers || ['System requirements could not be verified.']).join(' ')}`
  const trust = byId('welcome-trust-state')
  if (snapshot.managerTrustMode === 'local-unsigned') {
    trust.textContent = 'This Manager build is unsigned. Its local policy allows unsigned files for local testing. SHA-512 checks verify that a download matches GitHub release metadata; they do not identify who published it.'
    trust.classList.remove('hidden')
    byId('consent-trust-state').textContent = 'This Manager build is unsigned. SHA-512 verifies a file against GitHub metadata, but does not independently verify the publisher.'
    byId('consent-trust-state').classList.remove('hidden')
  } else if (snapshot.managerTrusted && snapshot.managerSigner) {
    trust.textContent = `This Manager's publisher signature was verified: ${snapshot.managerSigner}.`
    trust.classList.remove('hidden')
    byId('consent-trust-state').textContent = `This Manager's publisher signature was verified: ${snapshot.managerSigner}.`
    byId('consent-trust-state').classList.remove('hidden')
  } else {
    byId('consent-trust-state').classList.add('hidden')
  }
  if (snapshot.firstInstallConsentAccepted) {
    byId('welcome-consent-state').textContent = `First-install disclosures accepted ${formatReleaseDate(snapshot.firstInstallConsentAt)}. This record is encrypted and stored locally for this Windows account.`
    byId('welcome-consent-state').classList.remove('hidden')
  }
}

function updateWelcomeRelease() {
  if (state.release) {
    byId('welcome-release-state').textContent = state.release.compatibility?.ready
      ? `Latest ${state.release.productName || state.snapshot?.productName || 'OverHead'} release: ${state.release.version}, published ${formatReleaseDate(state.release.publishedAt)}.`
      : `Latest release ${state.release.version} is not ready to install: ${(state.release.compatibility?.blockers || ['storage or compatibility checks did not pass']).join(' ')}`
  } else if (state.releaseCheckFailed) {
    byId('welcome-release-state').textContent = 'GitHub could not be checked right now. You can continue to the Manager and retry the release check later.'
  }
}

function toast(message, error = false) {
  const item = byId('toast')
  item.textContent = message
  item.className = `toast show${error ? ' error' : ''}`
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => { item.className = 'toast' }, 5000)
}

function setProgress(message, percent = null) {
  byId('progress-message').textContent = message
  byId('progress-fill').style.width = percent === null ? '0%' : `${Math.max(0, Math.min(100, percent))}%`
}

function setBusy(busy) {
  state.busy = busy
  document.querySelectorAll('button, input, select').forEach((control) => {
    control.disabled = busy || control.dataset.locked === 'true'
  })
  if (!busy) { refreshActionStates(); refreshConfigState() }
}

function refreshActionStates() {
  const snapshot = state.snapshot
  const trusted = Boolean(snapshot?.managerTrusted)
  byId('install-release').disabled = state.busy || !trusted || !snapshot?.compatibility?.supported || !snapshot?.supportedWindows?.supported || !state.release?.canInstall
  byId('uninstall').disabled = state.busy || !trusted || !snapshot?.installed
  byId('check-release').disabled = state.busy || !trusted || !snapshot?.compatibility?.supported
  byId('check-release').textContent = state.releaseCheckFailed ? 'Retry GitHub check' : 'Check GitHub release'
  byId('install-release').textContent = state.releaseCheckFailed
    ? 'No verified release'
    : state.release
      ? state.release.newer ? `Update to ${state.release.version}` : state.release.same ? `Repair ${state.release.version}` : 'Update unavailable'
      : `Install or update ${snapshot?.productName || 'OverHead'}`
  byId('remove-confirm-wrap').classList.toggle('hidden', !byId('remove-data').checked)
  byId('confirm-restore').disabled = state.busy || !state.selectedBackup || byId('restore-confirm').value !== 'RESTORE OVERHEAD DATA'
}

function refreshConfigState() {
  const snapshot = state.snapshot
  if (!snapshot) return
  const changed = byId('auto-check').checked !== snapshot.autoCheck
    || byId('launch-at-login').checked !== snapshot.launchAtLogin
    || state.dataRootDraft !== snapshot.dataRoot
  byId('save-config').disabled = state.busy || !changed
  if (!state.busy) byId('config-message').textContent = changed ? 'Configuration changes are not applied yet.' : ''
}

function setOperationSummary(message, kind = '') {
  const summary = byId('operation-summary')
  summary.textContent = message
  summary.className = `operation-summary${kind ? ` ${kind}` : ''}`
  summary.classList.remove('hidden')
}

function scheduleManagerAutoClose() {
  let remaining = 10
  const update = () => {
    setProgress(`Installation complete. Install Manager closes in ${remaining} seconds.`, 100)
    if (remaining === 0) {
      clearInterval(timer)
      window.installManager.closeManager()
      return
    }
    remaining -= 1
  }
  update()
  const timer = window.setInterval(update, 1000)
}

function showGlobal(message, kind = '') {
  const banner = byId('global-status')
  banner.className = `status-banner${kind ? ` ${kind}` : ''}`
  banner.lastElementChild.textContent = message
}

async function refreshSnapshot() {
  const requestId = ++state.snapshotRequestId
  try {
    const snapshot = await window.installManager.snapshot()
    if (requestId !== state.snapshotRequestId) return
    state.snapshot = snapshot
    const s = state.snapshot
    const productPicker = byId('product-select')
    const products = Array.isArray(s.products) && s.products.length ? s.products : [
      { id: 'desktop', productName: 'OverHead Desktop' },
      { id: 'cylinder-server', productName: 'OverHead Cylinder Server' },
    ]
    productPicker.replaceChildren(...products.map((product) => {
      const option = document.createElement('option')
      option.value = product.id
      option.textContent = `${product.productName}${product.installed ? ` · Installed${product.version ? ` ${product.version}` : ''}` : product.installAllowed === false ? ' · Not supported on this edition' : ''}`
      return option
    }))
    if (products.some((product) => product.id === s.productId)) productPicker.value = s.productId
    refreshWelcome()
    byId('installed-version').textContent = s.installed ? (s.version || 'Installed; version unavailable') : 'Not installed'
    byId('install-location').textContent = s.installLocation || '—'
    byId('install-location').title = s.installLocation || ''
    byId('windows-status').textContent = s.compatibility?.supported
      ? `${s.compatibility.detected.os?.caption || 'Windows'} · native x64 · ${s.compatibility.detected.hardware?.logicalProcessors || '—'} threads · ${s.compatibility.detected.hardware?.memoryBytes ? `${(s.compatibility.detected.hardware.memoryBytes / (1024 ** 3)).toFixed(1)} GB RAM` : 'RAM unavailable'}`
      : `Blocked · ${(s.compatibility?.blockers || [s.supportedWindows.version || 'Compatibility not verified']).join(' ')}`
    byId('publisher-status').textContent = s.managerTrustMode === 'local-unsigned' ? 'Local unsigned build · GitHub hashes checked' : s.managerTrusted ? `Verified · ${s.managerSigner}` : 'Not verified'
    byId('auto-check').checked = s.autoCheck
    byId('launch-at-login').checked = s.launchAtLogin
    byId('data-root').textContent = s.dataRoot
    state.dataRootDraft = s.dataRoot
    const trusted = s.managerTrusted
    if (!s.compatibility?.supported && s.installed) showGlobal(`${s.productName} is installed, but this system is not compatible with its installation or updates. You can still uninstall it; choose a compatible product to install or update.`, 'warning')
    else if (!s.compatibility?.supported) showGlobal(`Installation blocked by compatibility check: ${(s.compatibility?.blockers || [s.supportedWindows.version]).join(' ')}`, 'error')
    else if (s.managerTrustMode === 'local-unsigned') showGlobal('Local unsigned build. GitHub SHA-512 and any available Authenticode signature are checked before installation.', 'warning')
    else if (!trusted) showGlobal('Publisher verification is unavailable. Install, update, and uninstall are locked until an approved signed manager is installed.', 'warning')
    else if (!s.supportedWindows.supported) showGlobal('This computer does not meet the supported Windows requirements.', 'warning')
    else if (s.appRunning) showGlobal(`${s.productName} is open. Save your work; the manager will ask before closing it for an install, update, or removal.`, 'warning')
    else showGlobal(s.installed ? `${s.productName} ${s.version || ''} is installed.` : `${s.productName} is not installed.`)
    refreshActionStates()
    refreshConfigState()
    refreshWelcome()
    const firstInstallConsentIsCurrent = !s.launchedForUpdate && (s.installed || s.firstInstallConsentAccepted)
    if (!state.initialReleaseCheckStarted && trusted && s.supportedWindows.supported && firstInstallConsentIsCurrent) {
      state.initialReleaseCheckStarted = true
      checkRelease()
    } else if (!firstInstallConsentIsCurrent && !s.launchedForUpdate) {
      byId('release-title').textContent = 'Review notices before contacting GitHub'
      byId('release-detail').textContent = 'No release check or installer download is started until you review the disclosures and choose “Yes, I agree”.'
      byId('welcome-release-state').textContent = 'GitHub release metadata will be requested only after you choose “Yes, I agree”.'
    }
  } catch (error) {
    if (requestId !== state.snapshotRequestId) return
    showGlobal(error.message || String(error), 'error')
    toast(error.message || String(error), true)
  }
}

async function checkRelease() {
  setBusy(true)
  state.releaseCheckFailed = false
  setProgress('Checking the official GitHub release…')
  try {
    state.release = await window.installManager.checkLatest()
    state.releaseCheckFailed = false
    byId('release-title').textContent = `Latest ${state.release.productName || state.snapshot?.productName || 'OverHead'} version: ${state.release.version}`
    byId('release-detail').textContent = state.release.currentVersion
      ? (state.release.newer ? `Installed ${state.release.currentVersion}. The manager will back up data, remove the current installation, and install the verified update.` : state.release.same ? `Installed ${state.release.currentVersion}. Reinstall is available: the manager will remove this copy and install it again from the verified release.` : `Installed ${state.release.currentVersion}. The available release is older, so installation is blocked.`)
      : `${state.release.productName || state.snapshot?.productName || 'OverHead'} is not installed. The manager will verify and back up its data before installation.`
    byId('release-detail').textContent += ` Published ${formatReleaseDate(state.release.publishedAt)}.`
    if (state.release.compatibility && !state.release.compatibility.ready) {
      byId('release-detail').textContent += ` Installation blocked: ${state.release.compatibility.blockers.join(' ')}`
    }
    updateWelcomeRelease()
    setProgress(`Release feed checked · ${state.release.version}`, 100)
    byId('install-release').textContent = state.release.newer ? `Update to ${state.release.version}` : state.release.same ? `Repair ${state.release.version}` : 'Update unavailable'
    refreshActionStates()
  } catch (error) {
    state.release = null
    state.releaseCheckFailed = true
    byId('release-title').textContent = 'Release check failed'
    byId('release-detail').textContent = error.message || String(error)
    byId('install-release').textContent = 'Check release to retry'
    toast(error.message || String(error), true)
    updateWelcomeRelease()
  } finally { setBusy(false) }
}

byId('welcome-continue').addEventListener('click', () => {
  const needsConsent = state.snapshot && state.snapshot.productId !== 'unsupported' && state.snapshot.installAllowed && !state.snapshot.installed && !state.snapshot.firstInstallConsentAccepted
  if (needsConsent) {
    byId('welcome-intro').classList.add('hidden')
    byId('first-install-consent').classList.remove('hidden')
    byId('consent-terms').focus()
    return
  }
  hideWelcome()
})
byId('welcome-back').addEventListener('click', () => {
  byId('first-install-consent').classList.add('hidden')
  byId('welcome-intro').classList.remove('hidden')
})
byId('decline-review').addEventListener('click', () => {
  byId('consent-declined').classList.add('hidden')
  byId('first-install-consent').classList.remove('hidden')
})
byId('decline-exit').addEventListener('click', () => window.installManager.closeManager())
byId('decline-first-install').addEventListener('click', () => {
  byId('first-install-consent').classList.add('hidden')
  byId('consent-declined').classList.remove('hidden')
})
byId('welcome-legal-center').addEventListener('click', async () => {
  try { await window.installManager.openLegalCenter() } catch (error) { toast(error.message || 'Could not open the Legal Center.', true) }
})
byId('consent-open-legal-center').addEventListener('click', async () => {
  try { await window.installManager.openLegalCenter() } catch (error) { toast(error.message || 'Could not open the Legal Center.', true) }
})
function refreshConsentAction() {
  byId('accept-first-install').disabled = !['consent-terms', 'consent-privacy', 'consent-install', 'consent-draft'].every((id) => byId(id).checked)
}
document.querySelectorAll('.consent-checks input').forEach((input) => input.addEventListener('change', refreshConsentAction))
byId('accept-first-install').addEventListener('click', async () => {
  const button = byId('accept-first-install')
  button.disabled = true
  byId('consent-error').classList.add('hidden')
  try {
    const result = await window.installManager.recordFirstInstallConsent({ consentDecision: 'Yes, I agree', termsAccepted: true, privacyAcknowledged: true, installNoticeAccepted: true, draftStatusAcknowledged: true })
    if (result.alreadyInstalled) {
      byId('first-install-consent').classList.add('hidden')
      byId('consent-declined').classList.add('hidden')
      byId('welcome-intro').classList.remove('hidden')
      hideWelcome()
      toast(`${result.productName || 'OverHead'} is already installed. No first-install consent was saved; checking for updates.`)
      await refreshSnapshot()
      return
    }
    state.snapshot.firstInstallConsentAccepted = true
    state.snapshot.firstInstallConsentAt = result.acceptedAt
    refreshWelcome()
    byId('first-install-consent').classList.add('hidden')
    byId('welcome-intro').classList.remove('hidden')
    byId('welcome-consent-state').textContent = `First-install disclosures accepted ${formatReleaseDate(result.acceptedAt)}. This record is encrypted and stored locally for this Windows account.`
    byId('welcome-consent-state').classList.remove('hidden')
    hideWelcome()
    toast('Consent recorded locally. Continue with installation when ready.')
    state.initialReleaseCheckStarted = true
    checkRelease()
  } catch (error) {
    byId('consent-error').textContent = error.message || 'The consent record could not be saved.'
    byId('consent-error').classList.remove('hidden')
    refreshConsentAction()
  }
})

async function loadBackups() {
  const list = byId('backup-list')
  list.replaceChildren()
  try {
    const backups = await window.installManager.listBackups()
    if (!backups.length) {
      const empty = document.createElement('p')
      empty.className = 'empty-state'
      empty.textContent = 'No local backups yet. Installing or uninstalling OverHead creates a verified backup.'
      list.append(empty)
      return
    }
    for (const backup of backups) {
      const row = document.createElement('div')
      row.className = 'backup-row'
      if (state.selectedBackup === backup.id) row.classList.add('selected')
      const detail = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = new Date(backup.createdAt).toLocaleString()
      const info = document.createElement('span')
      info.textContent = `${backup.fileCount} files · ${backup.source}`
      detail.append(title, info)
      const button = document.createElement('button')
      button.className = 'secondary'
      button.textContent = state.selectedBackup === backup.id ? 'Selected' : 'Select to restore'
      button.setAttribute('aria-pressed', String(state.selectedBackup === backup.id))
      button.addEventListener('click', () => {
        state.selectedBackup = backup.id
        loadBackups()
        byId('restore-confirm-wrap').classList.remove('hidden')
        byId('restore-confirm').value = ''
        refreshActionStates()
      })
      row.append(detail, button)
      list.append(row)
    }
  } catch (error) { toast(error.message || String(error), true) }
}

document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((item) => {
    const selected = item === tab
    item.classList.toggle('active', selected)
    item.setAttribute('aria-selected', String(selected))
    item.tabIndex = selected ? 0 : -1
  })
  document.querySelectorAll('.panel').forEach((panel) => {
    const selected = panel.id === tab.dataset.tab
    panel.classList.toggle('active-panel', selected)
    panel.hidden = !selected
  })
  if (tab.dataset.tab === 'backup-panel') loadBackups()
}))

document.querySelectorAll('.tab').forEach((tab) => {
  tab.tabIndex = tab.classList.contains('active') ? 0 : -1
  tab.addEventListener('keydown', (event) => {
    const tabs = [...document.querySelectorAll('.tab')]
    const current = tabs.indexOf(tab)
    const next = event.key === 'ArrowRight' ? (current + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (current - 1 + tabs.length) % tabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
    if (next < 0) return
    event.preventDefault()
    tabs[next].click()
    tabs[next].focus()
  })
})

byId('refresh-status').addEventListener('click', refreshSnapshot)
byId('product-select').addEventListener('change', async (event) => {
  state.release = null
  state.releaseCheckFailed = false
  state.initialReleaseCheckStarted = false
  setBusy(true)
  try {
    await window.installManager.selectProduct(event.target.value)
  } catch (error) { toast(error.message || String(error), true) }
  finally { setBusy(false) }
  await refreshSnapshot()
})
byId('check-release').addEventListener('click', checkRelease)
byId('remove-data').addEventListener('change', refreshActionStates)
byId('remove-confirm').addEventListener('input', refreshActionStates)
byId('restore-confirm').addEventListener('input', refreshActionStates)
byId('auto-check').addEventListener('change', refreshConfigState)
byId('launch-at-login').addEventListener('change', refreshConfigState)
byId('install-release').addEventListener('click', async () => {
  setBusy(true)
  try {
    const result = await window.installManager.install()
    toast(result.replaced ? `${result.productName} ${result.previousVersion || 'existing copy'} removed and ${result.version} installed. Verified backup: ${result.backupPath}` : `${result.productName} ${result.version} installed. Verified backup: ${result.backupPath}`)
    setOperationSummary(`${result.productName} ${result.version}, published ${formatReleaseDate(state.release?.publishedAt)}, installed and verified. Its local data was preserved. Verified backup: ${result.backupPath}`)
    setProgress(`Installed and verified · ${result.version}`, 100)
    await refreshSnapshot()
    state.release = null
    scheduleManagerAutoClose()
  } catch (error) { toast(error.message || String(error), true); setProgress(error.message || 'Installation failed'); setOperationSummary(error.message || 'Installation failed. Your data backup remains available in Backups & restore.', 'error') }
  finally { setBusy(false) }
})
byId('uninstall').addEventListener('click', async () => {
  const removeData = byId('remove-data').checked
  if (removeData && byId('remove-confirm').value !== 'REMOVE MY OVERHEAD DATA') return toast('Type REMOVE MY OVERHEAD DATA to confirm.', true)
  setBusy(true)
  try {
    const result = await window.installManager.uninstall({ removeData, confirmationText: byId('remove-confirm').value })
    toast(result.dataRemoved ? `${result.productName} was removed. Its local data was deleted after a verified backup.` : `${result.productName} was removed. Its local data and verified backup were kept.`)
    setOperationSummary(result.dataRemoved ? `${result.productName} was removed. Its local data was deleted after a verified backup at ${result.backupPath}.` : `${result.productName} was removed. Its local data was kept. Verified backup: ${result.backupPath}`)
    setProgress('Uninstallation complete', 100)
    await refreshSnapshot()
  } catch (error) { toast(error.message || String(error), true); setProgress(error.message || 'Uninstallation failed'); setOperationSummary(error.message || 'Uninstallation failed. Review installation status and backups.', 'error') }
  finally { setBusy(false) }
})
byId('choose-data').addEventListener('click', async () => {
  const selected = await window.installManager.chooseDataRoot()
  if (selected) { state.dataRootDraft = selected; byId('data-root').textContent = selected; refreshConfigState() }
})
byId('save-config').addEventListener('click', async () => {
  setBusy(true)
  const outcomes = []
  try {
    const autoCheck = byId('auto-check').checked
    const launchAtLogin = byId('launch-at-login').checked
    await window.installManager.setAutoCheck(autoCheck)
    await window.installManager.setLaunchAtLogin(launchAtLogin)
    outcomes.push(`Automatic update checks ${autoCheck ? 'enabled' : 'disabled'}.`)
    outcomes.push(`Launch at Windows sign-in ${launchAtLogin ? 'enabled' : 'disabled'}.`)
    if (state.dataRootDraft !== state.snapshot.dataRoot) {
      const result = await window.installManager.configureDataRoot(state.dataRootDraft)
      outcomes.push(`Data copied and verified; backup at ${result.backupPath}. Restart OverHead to use the new folder.`)
    }
    byId('config-message').textContent = outcomes.join(' ' ) || 'Configuration applied.'
    toast(outcomes.join(' ') || 'Configuration applied.')
    setOperationSummary(outcomes.join(' ') || 'Configuration applied.')
    await refreshSnapshot()
  } catch (error) { byId('config-message').textContent = error.message || String(error); toast(error.message || String(error), true); setOperationSummary(`Configuration may be partially applied. ${error.message || 'Refresh status before retrying.'}`, 'error'); await refreshSnapshot() }
  finally { setBusy(false) }
})
byId('open-data').addEventListener('click', () => window.installManager.openDataRoot())
byId('open-backups').addEventListener('click', () => window.installManager.openBackups())
byId('confirm-restore').addEventListener('click', async () => {
  setBusy(true)
  try {
    const result = await window.installManager.restore({ backupId: state.selectedBackup, confirmationText: byId('restore-confirm').value })
    const retainedPath = result.previousDataPath || result.safetyBackupPath
    toast(`Data restored. Previous data is retained at ${retainedPath}.`)
    setOperationSummary(`Data restored and verified. Previous data is retained at ${retainedPath}.`)
    byId('restore-confirm-wrap').classList.add('hidden')
    state.selectedBackup = ''
    await refreshSnapshot()
    await loadBackups()
  } catch (error) { toast(error.message || String(error), true); setOperationSummary(error.message || 'Restore failed. Current data and the selected backup were left in place.', 'error') }
  finally { setBusy(false) }
})

window.installManager.onProgress(({ stage, message, percent }) => {
  setProgress(message, percent)
  if (stage === 'auto-close') setOperationSummary(message)
})
refreshSnapshot()
