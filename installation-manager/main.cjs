const { app, BrowserWindow, dialog, ipcMain, protocol, safeStorage, screen, shell } = require('electron')
const { spawn, spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { Readable } = require('node:stream')
const { pipeline } = require('node:stream/promises')
const { assessCompatibility, classifyWindowsProduct, readSystemInformation } = require('./compatibility.cjs')

const PRODUCT = 'OverHead'
const MANAGER_SCHEME = 'overhead-manager'
const MANAGER_ENTRY_URL = `${MANAGER_SCHEME}://manager/index.html`
const MANAGER_ASSETS = new Map([
  ['index.html', 'text/html; charset=utf-8'],
  ['manager.css', 'text/css; charset=utf-8'],
  ['manager.js', 'text/javascript; charset=utf-8'],
])
const GITHUB_RELEASES_API_URL = 'https://api.github.com/repos/ghostventure/GhostVenture-Projects/releases?per_page=100'
const GITHUB_RELEASE_DOWNLOAD_BASE = 'https://github.com/ghostventure/GhostVenture-Projects/releases/download'
const APPDATA = process.env.APPDATA || path.join(app.getPath('home'), 'AppData', 'Roaming')
const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local')
const MANAGER_ROOT = path.join(APPDATA, 'OverHead Install Manager')
const MANAGER_CONFIG = path.join(MANAGER_ROOT, 'manager.json')
const BACKUP_ROOT = path.join(LOCALAPPDATA, 'OverHead Install Manager', 'Backups')
const DOWNLOAD_ROOT = path.join(LOCALAPPDATA, 'OverHead Install Manager', 'Downloads')
const PRODUCT_TARGETS = {
  desktop: {
    id: 'desktop', productName: 'OverHead Desktop', shortName: 'OverHead',
    displayNamePattern: '^OverHead(?:\\s+\\d[\\w.-]*)?$', processName: 'OverHead.exe', executableName: 'OverHead.exe',
    uninstallerName: 'Uninstall OverHead.exe', installDirectoryName: 'OverHead', dataPath: path.join(APPDATA, 'OverHead'),
    backupRoot: BACKUP_ROOT, backupPrefix: 'OverHead', startupValue: 'OverHead', configDataKey: 'desktopDataRoot', supportsCustomDataRoot: true,
    installerName: (version) => `OverHead-Setup-${version}-win-x64.exe`,
    installerPattern: /^OverHead-Setup-\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?-win-x64\.exe$/,
  },
  'cylinder-server': {
    id: 'cylinder-server', productName: 'OverHead Cylinder Server', shortName: 'OverHead Cylinder',
    displayNamePattern: '^OverHead-Cylinder(?:\\s+\\d[\\w.-]*)?$', processName: 'OverHead-Cylinder.exe', executableName: 'OverHead-Cylinder.exe',
    uninstallerName: 'Uninstall OverHead-Cylinder.exe', installDirectoryName: 'OverHead-Cylinder', dataPath: path.join(APPDATA, 'OverHead Cylinder'),
    backupRoot: path.join(BACKUP_ROOT, 'Cylinder Server'), backupPrefix: 'OverHead-Cylinder', startupValue: 'OverHead-Cylinder',
    configDataKey: '', supportsCustomDataRoot: false,
    installerName: (version) => `OverHead-Cylinder-Setup-${version}-win-x64.exe`,
    installerPattern: /^OverHead-Cylinder-Setup-\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?-win-x64\.exe$/,
  },
}
const FIRST_INSTALL_NOTICE_UPDATED_AT = '2026-11-01'
const FIRST_INSTALL_NOTICE_REVISION = 'overhead-first-install-legal-notice-2026-11-01-v3'
const POLICY = require('./signer-policy.json')
const RELEASE_FEED_CACHE_MS = 30000
const MAX_DIAGNOSTIC_LOG_BYTES = 256 * 1024
let mainWindow
let operationRunning = false
const releaseFeedCache = new Map()
const releaseFeedInFlight = new Map()

protocol.registerSchemesAsPrivileged([{ scheme: MANAGER_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }])

async function registerManagerProtocol() {
  await protocol.handle(MANAGER_SCHEME, (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed.', { status: 405 })
    let url
    try { url = new URL(request.url) } catch { return new Response('Invalid Manager asset URL.', { status: 400 }) }
    const asset = url.hostname === 'manager' ? decodeURIComponent(url.pathname.replace(/^\//, '')) : ''
    const contentType = MANAGER_ASSETS.get(asset)
    if (!contentType || asset.includes('/') || asset.includes('\\') || asset.includes('..')) return new Response('Manager asset not found.', { status: 404 })
    try {
      const contents = fs.readFileSync(path.join(__dirname, asset))
      return new Response(request.method === 'HEAD' ? null : contents, {
        headers: { 'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' },
      })
    } catch {
      return new Response('Manager asset could not be read.', { status: 404 })
    }
  })
}

function releaseVersion(release) {
  return String(release?.tag_name || '').match(/(?:^|[^0-9])v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:$|[^0-9])/)?.[1] || ''
}

function compatibilityRuntime() {
  return { packaged: app.isPackaged, resourcesPath: process.resourcesPath, executablePath: process.execPath }
}

function getProductTarget(targetId = 'desktop') {
  const target = PRODUCT_TARGETS[targetId]
  if (!target) throw new Error('This Windows edition does not have a supported OverHead install target.')
  return target
}

function detectProductSelection(systemInformation = readSystemInformation(), requestedTargetId = '', installedProducts = null) {
  const config = readManagerConfig()
  let targetId = PRODUCT_TARGETS[requestedTargetId] ? requestedTargetId
    : PRODUCT_TARGETS[config.selectedProductId] ? config.selectedProductId
      : ''
  let installedTargets = null
  if (!targetId && systemInformation.available) {
    installedTargets = findInstalledTargets(installedProducts)
    if (installedTargets.length === 1) targetId = installedTargets[0]
  }
  const selection = targetId
    ? classifyWindowsProduct(systemInformation, targetId)
    : classifyWindowsProduct(systemInformation)
  return { systemInformation, selection, installedTargets }
}

function compatibilityForOperation({ feed = null, installed = null, systemInformation = null, selection = null } = {}) {
  const detected = systemInformation ? { systemInformation, selection: selection || classifyWindowsProduct(systemInformation) } : detectProductSelection()
  const targetId = detected.selection.id
  const target = PRODUCT_TARGETS[targetId]
  return assessCompatibility({
    systemInformation: detected.systemInformation,
    selection: detected.selection,
    runtime: compatibilityRuntime(),
    storage: feed && target ? {
      installerSizeBytes: feed.size,
      dataRoot: configuredDataRoot(targetId),
      downloadRoot: DOWNLOAD_ROOT,
      backupRoot: target.backupRoot,
      installRoot: installed?.installLocation || path.join(process.env.ProgramFiles || 'C:\\Program Files', target.installDirectoryName),
    } : {},
  })
}

function isTrustedGitHubUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'github.com' || url.hostname.endsWith('.githubusercontent.com'))
  } catch { return false }
}

const RETRYABLE_HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504])
const RETRY_DELAY_MS = [500, 1500]

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function fetchWithRetry(url, options, timeoutMs) {
  let lastError
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
      if (!RETRYABLE_HTTP_STATUS.has(response.status) || attempt === 2) return response
      lastError = new Error(`Temporary HTTP ${response.status} response.`)
      await response.body?.cancel()
    } catch (error) { lastError = error }
    if (attempt < 2) await pause(RETRY_DELAY_MS[attempt])
  }
  throw lastError || new Error('The network request failed after retries.')
}

function fileSha512(filePath) {
  const descriptor = fs.openSync(filePath, 'r')
  const hash = crypto.createHash('sha512')
  const buffer = Buffer.allocUnsafe(1024 * 1024)
  let size = 0
  try {
    let bytesRead = 0
    while ((bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      size += bytesRead
      hash.update(buffer.subarray(0, bytesRead))
    }
  } finally { fs.closeSync(descriptor) }
  return { size, sha512: hash.digest('base64') }
}

app.setPath('userData', MANAGER_ROOT)

function safeJson(filePath, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) } catch { return fallback }
}

function writeJsonAtomically(filePath, value, failureMessage = 'The settings could not be saved locally.') {
  const directory = path.dirname(filePath)
  const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`
  try {
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2), { encoding: 'utf8', flag: 'wx' })
    fs.renameSync(temporaryPath, filePath)
  } catch (error) {
    try { fs.rmSync(temporaryPath, { force: true }) } catch {}
    throw new Error(`${failureMessage} ${error.message}`)
  }
}

function readManagerConfig() {
  return safeJson(MANAGER_CONFIG, { desktopDataRoot: '' })
}

function readFirstInstallConsent(config = readManagerConfig()) {
  try {
    if (!safeStorage.isEncryptionAvailable() || !config.firstInstallConsentEncrypted) return null
    const plaintext = safeStorage.decryptString(Buffer.from(config.firstInstallConsentEncrypted, 'base64'))
    return JSON.parse(plaintext)
  } catch { return null }
}

function hasCurrentFirstInstallConsent(targetId = 'desktop', config = readManagerConfig()) {
  const consent = readFirstInstallConsent(config)
  return Boolean(consent
    && consent.noticeUpdatedAt === FIRST_INSTALL_NOTICE_UPDATED_AT
    && consent.noticeRevision === FIRST_INSTALL_NOTICE_REVISION
    && consent.consentDecision === 'Yes, I agree'
    && consent.termsAccepted === true
    && consent.privacyAcknowledged === true
    && consent.installNoticeAccepted === true
    && consent.draftStatusAcknowledged === true
    && consent.productTargetId === targetId
    && consent.acceptedAt)
}

function recordFirstInstallConsent(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('First-install consent details are invalid.')
  const { selection } = detectProductSelection()
  if (!PRODUCT_TARGETS[selection.id]) throw new Error(selection.reason)
  const existingInstallation = findInstalledApp(selection.id)
  if (existingInstallation.installLocation) {
    return {
      accepted: false,
      alreadyInstalled: true,
      productId: selection.id,
      productName: getProductTarget(selection.id).productName,
      version: installedAppVersion(existingInstallation, selection.id) || String(existingInstallation.version || ''),
    }
  }
  if (payload.consentDecision !== 'Yes, I agree' || payload.termsAccepted !== true || payload.privacyAcknowledged !== true || payload.installNoticeAccepted !== true || payload.draftStatusAcknowledged !== true) {
    throw new Error('Accept each required first-install disclosure before continuing.')
  }
  const config = readManagerConfig()
  const acceptedAt = new Date().toISOString()
  const consent = {
    productTargetId: selection.id,
    consentDecision: 'Yes, I agree',
    termsAccepted: true,
    privacyAcknowledged: true,
    installNoticeAccepted: true,
    draftStatusAcknowledged: true,
    noticeUpdatedAt: FIRST_INSTALL_NOTICE_UPDATED_AT,
    noticeRevision: FIRST_INSTALL_NOTICE_REVISION,
    acceptedAt,
    termsDocument: 'Terms of Use Draft',
    privacyDocument: 'Privacy and Data-Minimization Draft',
    installDocument: 'First Installation and Data Handling Notice',
  }
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows account encryption is unavailable. First-install consent cannot be safely recorded on this device.')
  config.firstInstallConsentEncrypted = safeStorage.encryptString(JSON.stringify(consent)).toString('base64')
  writeJsonAtomically(MANAGER_CONFIG, config, 'The consent record could not be saved locally.')
  return { accepted: true, acceptedAt, noticeUpdatedAt: FIRST_INSTALL_NOTICE_UPDATED_AT, noticeRevision: FIRST_INSTALL_NOTICE_REVISION }
}

function configuredDataRoot(targetId = 'desktop') {
  const target = getProductTarget(targetId)
  if (!target.supportsCustomDataRoot) return target.dataPath
  const configured = String(readManagerConfig()[target.configDataKey] || '').trim()
  if (!path.isAbsolute(configured)) return target.dataPath
  const resolved = path.normalize(configured)
  assertDataRootSafe(resolved, targetId)
  return resolved
}

function pathsOverlap(left, right) {
  const a = path.resolve(left).toLowerCase()
  const b = path.resolve(right).toLowerCase()
  const isWithin = (parent, child) => {
    const relative = path.relative(parent, child).toLowerCase()
    return !relative || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  }
  return isWithin(a, b) || isWithin(b, a)
}

function assertDataRootSafe(root, targetId = 'desktop') {
  const target = getProductTarget(targetId)
  const resolved = path.resolve(root)
  if (resolved === path.parse(resolved).root || resolved.length < 8) throw new Error('The selected data folder is too broad to use safely.')
  if (pathsOverlap(resolved, MANAGER_ROOT) || pathsOverlap(resolved, target.backupRoot) || pathsOverlap(resolved, BACKUP_ROOT)) throw new Error('The selected product data folder cannot overlap manager settings or backup storage.')
}

function emitProgress(stage, message, percent = null) {
  mainWindow?.webContents.send('manager:progress', { stage, message, percent })
}

function runPowerShell(script) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    encoding: 'utf8', windowsHide: true, timeout: 30000,
  })
  if (result.error || result.status !== 0) throw new Error((result.stderr || result.stdout || result.error?.message || 'Windows verification command failed.').trim())
  return String(result.stdout || '').trim()
}

function inspectSignature(filePath) {
  const encodedPath = Buffer.from(filePath, 'utf8').toString('base64')
  const output = runPowerShell(`$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPath}')); $s=Get-AuthenticodeSignature -LiteralPath $p; [pscustomobject]@{status=[string]$s.Status;subject=[string]$s.SignerCertificate.Subject}|ConvertTo-Json -Compress`)
  return JSON.parse(output || '{}')
}

function expectedSigner() {
  return String(POLICY.expectedSigner || '').trim()
}

function assessTrust(result) {
  const expected = expectedSigner()
  if (expected) return { trusted: result.status === 'Valid' && result.subject === expected, mode: 'publisher-signed' }
  if (POLICY.allowUnsigned && ['Valid', 'NotSigned'].includes(result.status)) return { trusted: true, mode: 'local-unsigned' }
  return { trusted: false, mode: 'unconfigured' }
}

function verifyTrustedFile(filePath) {
  const result = inspectSignature(filePath)
  if (assessTrust(result).trusted) return result
  if (!expectedSigner()) throw new Error('This local manager has no signing policy that permits the current file.')
  throw new Error(`Publisher check failed for ${path.basename(filePath)}. Expected a valid signature from the approved OverHead publisher.`)
}

function normalizeInstalledApp(entry, target) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) entry = {}
  if (!entry.installLocation && entry.uninstallString) {
    const escapedUninstaller = target.uninstallerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = String(entry.uninstallString).match(new RegExp(`^\\s*"?(.+?)\\\\${escapedUninstaller}"?(?:\\s|$)`, 'i'))
    if (match) entry.installLocation = match[1]
  }
  return entry
}

function parseInstalledApp(output, target) {
  try { return normalizeInstalledApp(JSON.parse(output || '{}'), target) } catch { return {} }
}

function readInstalledProductsIndividually() {
  return Object.fromEntries(Object.keys(PRODUCT_TARGETS).map((targetId) => [targetId, findInstalledApp(targetId)]))
}

function findInstalledApp(targetId = 'desktop') {
  const target = getProductTarget(targetId)
  const output = runPowerShell(`$roots=@('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'); $entry=Get-ItemProperty $roots -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match '${target.displayNamePattern}' } | Sort-Object { [version]($_.DisplayVersion -replace '[^0-9.]','') } -Descending | Select-Object -First 1; if($entry){[pscustomobject]@{displayName=$entry.DisplayName;version=$entry.DisplayVersion;installLocation=$entry.InstallLocation;uninstallString=$entry.UninstallString}|ConvertTo-Json -Compress}else{'{}'}`)
  return parseInstalledApp(output, target)
}

function findInstalledProducts() {
  const descriptors = Object.values(PRODUCT_TARGETS).map(({ id, displayNamePattern }) => ({ id, displayNamePattern }))
  const encodedDescriptors = Buffer.from(JSON.stringify(descriptors), 'utf8').toString('base64')
  const output = runPowerShell(`$json=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedDescriptors}')); $targets=@(ConvertFrom-Json -InputObject $json); $roots=@('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'); $entries=@(Get-ItemProperty -Path $roots -ErrorAction SilentlyContinue); $result=[ordered]@{}; foreach($target in $targets){ $pattern=[string]$target.displayNamePattern; $entry=$entries | Where-Object { $_.DisplayName -match $pattern } | Sort-Object { try { [version]($_.DisplayVersion -replace '[^0-9.]','') } catch { [version]'0.0' } } -Descending | Select-Object -First 1; if($entry){$result[[string]$target.id]=[pscustomobject]@{displayName=[string]$entry.DisplayName;version=[string]$entry.DisplayVersion;installLocation=[string]$entry.InstallLocation;uninstallString=[string]$entry.UninstallString}}else{$result[[string]$target.id]=@{}} }; ConvertTo-Json -InputObject $result -Depth 4 -Compress`)
  let entries
  try {
    entries = JSON.parse(output)
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('Invalid product inventory shape.')
  } catch {
    // If the combined response is malformed, use the established per-product reader
    // so a parsing issue cannot make an existing installation appear absent.
    return readInstalledProductsIndividually()
  }
  for (const [targetId, target] of Object.entries(PRODUCT_TARGETS)) {
    const entry = entries[targetId]
    if (!Object.prototype.hasOwnProperty.call(entries, targetId) || !entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return readInstalledProductsIndividually()
    }
  }
  return Object.fromEntries(Object.entries(PRODUCT_TARGETS).map(([targetId, target]) => [
    targetId,
    parseInstalledApp(JSON.stringify(entries[targetId] || {}), target),
  ]))
}

function findInstalledTargets(installedProducts = null) {
  const products = installedProducts || findInstalledProducts()
  return Object.keys(PRODUCT_TARGETS).filter((targetId) => products[targetId]?.installLocation)
}

function writeDiagnosticLog(fileName, kind, detail, maxEntryLength = 1200) {
  try {
    fs.mkdirSync(MANAGER_ROOT, { recursive: true })
    const allowedNames = new Set(['manager-errors.log', 'renderer-diagnostics.log'])
    const destination = path.join(MANAGER_ROOT, allowedNames.has(fileName) ? fileName : 'manager-errors.log')
    const sanitized = String(detail?.stack || detail?.message || detail).replace(/[\r\n]+/g, ' ').slice(0, maxEntryLength)
    const line = Buffer.from(`${new Date().toISOString()} ${kind}: ${sanitized}\n`, 'utf8')
    let currentSize = 0
    try { currentSize = fs.statSync(destination).size } catch {}
    if (currentSize + line.length <= MAX_DIAGNOSTIC_LOG_BYTES) {
      fs.appendFileSync(destination, line)
      return
    }

    let existing = Buffer.alloc(0)
    if (currentSize > 0) {
      let descriptor
      try {
        descriptor = fs.openSync(destination, 'r')
        const tailLength = Math.min(currentSize, MAX_DIAGNOSTIC_LOG_BYTES)
        existing = Buffer.allocUnsafe(tailLength)
        fs.readSync(descriptor, existing, 0, tailLength, currentSize - tailLength)
      } catch { existing = Buffer.alloc(0) } finally {
        if (descriptor !== undefined) fs.closeSync(descriptor)
      }
    }
    const combined = Buffer.concat([existing, line])
    let start = Math.max(0, combined.length - MAX_DIAGNOSTIC_LOG_BYTES)
    const nextLine = combined.indexOf(0x0a, start)
    if (nextLine >= 0) start = nextLine + 1
    fs.writeFileSync(destination, combined.subarray(start))
  } catch {}
}

function appIsRunning(targetId = 'desktop') {
  const target = getProductTarget(targetId)
  const output = runPowerShell(`$main=Get-CimInstance Win32_Process -Filter \"Name='${target.processName}'\" -ErrorAction Stop | Where-Object { -not ($_.CommandLine -match '(?:^|\\s)--type(?:=|\\s)') }; [bool]$main | ConvertTo-Json -Compress`)
  return JSON.parse(output || 'false') === true
}

function readFeed(text, targetId = 'desktop') {
  const target = getProductTarget(targetId)
  const version = text.match(/^version:\s*([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)\s*$/m)?.[1]
  const fileName = text.match(/^\s+-\s+url:\s*(\S+)\s*$/m)?.[1]
  const sha512 = text.match(/^\s+sha512:\s*([A-Za-z0-9+/=]+)\s*$/m)?.[1]
  const size = Number(text.match(/^\s+size:\s*(\d+)\s*$/m)?.[1])
  const allowedName = version ? target.installerName(version) : ''
  if (!version || allowedName !== fileName || !sha512 || !Number.isSafeInteger(size) || size < 1) throw new Error(`The official ${target.productName} update feed is missing valid installer metadata.`)
  return { productId: target.id, productName: target.productName, version, fileName, sha512, size }
}

async function fetchLatest(targetId = 'desktop') {
  const cached = releaseFeedCache.get(targetId)
  if (cached && Date.now() - cached.cachedAt < RELEASE_FEED_CACHE_MS) return { ...cached.feed }
  if (releaseFeedInFlight.has(targetId)) return releaseFeedInFlight.get(targetId)
  const inFlight = fetchLatestFromGitHub(targetId)
  releaseFeedInFlight.set(targetId, inFlight)
  try {
    const feed = await inFlight
    releaseFeedCache.set(targetId, { feed, cachedAt: Date.now() })
    return { ...feed }
  } finally {
    releaseFeedInFlight.delete(targetId)
  }
}

async function fetchLatestFromGitHub(targetId = 'desktop') {
  const target = getProductTarget(targetId)
  const response = await fetchWithRetry(GITHUB_RELEASES_API_URL, {
    cache: 'no-store', headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  }, 20000)
  if (!response.ok) throw new Error(`GitHub releases returned HTTP ${response.status}.`)
  const releases = await response.json()
  const candidates = (Array.isArray(releases) ? releases : []).filter((release) => {
    if (release?.draft || release?.prerelease || !Array.isArray(release.assets)) return false
    // Only semver-stable releases are eligible. A release mislabeled as stable
    // must not make a numerically higher -beta/-rc version look newer.
    return /^\d+\.\d+\.\d+$/.test(releaseVersion(release))
      && release.assets.some((asset) => target.installerPattern.test(asset?.name || ''))
      && release.assets.some((asset) => asset?.name === 'latest.yml')
  }).sort((a, b) => compareVersions(releaseVersion(b), releaseVersion(a)) || Date.parse(b.published_at || '') - Date.parse(a.published_at || ''))
  const release = candidates[0]
  if (!release) throw new Error(`GitHub has no compatible stable ${target.productName} release.`)
  const tag = String(release.tag_name || '')
  const version = releaseVersion(release)
  const installer = release.assets.find((asset) => asset.name === target.installerName(version))
  const feedAsset = release.assets.find((asset) => asset.name === 'latest.yml')
  if (!version || !installer?.browser_download_url || !feedAsset?.browser_download_url) throw new Error(`The latest ${target.productName} release is missing its compatible installer or metadata.`)
  const feedUrl = new URL(feedAsset.browser_download_url)
  if (!isTrustedGitHubUrl(feedUrl.href) || feedUrl.hostname !== 'github.com') throw new Error('The GitHub update metadata URL is not trusted.')
  const feedResponse = await fetchWithRetry(feedUrl, { redirect: 'follow' }, 20000)
  if (!feedResponse.ok) throw new Error(`GitHub installer metadata returned HTTP ${feedResponse.status}.`)
  if (!isTrustedGitHubUrl(feedResponse.url)) throw new Error('GitHub update metadata redirected to an untrusted host.')
  const feed = readFeed(await feedResponse.text(), targetId)
  if (feed.version !== version || feed.fileName !== installer.name || feed.size !== Number(installer.size)) throw new Error('GitHub release metadata does not match the selected installer asset.')
  const installerUrl = new URL(installer.browser_download_url)
  if (!isTrustedGitHubUrl(installerUrl.href) || installerUrl.hostname !== 'github.com') throw new Error('The GitHub installer URL is not trusted.')
  return { ...feed, publishedAt: release.published_at || '', releaseTag: tag, url: installerUrl.href }
}

async function checkLatest() {
  const detected = detectProductSelection()
  const selection = detected.selection
  if (!selection.releaseCheckAllowed || !PRODUCT_TARGETS[selection.id]) throw new Error(selection.reason)
  const target = getProductTarget(selection.id)
  const installed = findInstalledApp(target.id)
  if (!installed.installLocation && !hasCurrentFirstInstallConsent(target.id)) {
    throw new Error(`Review the first-install notices and choose “Yes, I agree” before contacting GitHub for ${target.productName} release information.`)
  }
  const initialCompatibility = compatibilityForOperation({ installed, systemInformation: detected.systemInformation, selection })
  if (!initialCompatibility.supported) throw new Error(`This device cannot install ${target.productName}:\n${initialCompatibility.blockers.join('\n')}`)
  const feed = await fetchLatest(target.id)
  const currentVersion = installedAppVersion(installed, target.id) || String(installed.version || '').trim()
  const comparison = currentVersion ? compareVersions(feed.version, currentVersion) : 1
  const compatibility = compatibilityForOperation({ feed, installed, systemInformation: detected.systemInformation, selection })
  return { ...feed, currentVersion, newer: comparison > 0, same: Boolean(currentVersion) && comparison === 0, compatibility, canInstall: selection.installAllowed && comparison >= 0 && compatibility.ready }
}

function compareVersions(left, right) {
  const a = String(left || '0').split(/[.-]/).map((part) => Number(part) || 0)
  const b = String(right || '0').split(/[.-]/).map((part) => Number(part) || 0)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0)
  }
  return 0
}

async function downloadVerifiedInstaller(feed) {
  fs.mkdirSync(DOWNLOAD_ROOT, { recursive: true })
  const destination = path.join(DOWNLOAD_ROOT, feed.fileName)
  if (fs.existsSync(destination)) {
    const cached = fileSha512(destination)
    if (cached.size === feed.size && cached.sha512 === feed.sha512) {
      verifyTrustedFile(destination)
      return destination
    }
    fs.rmSync(destination, { force: true })
  }
  const partial = `${destination}.partial`
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let size = 0
    const hash = crypto.createHash('sha512')
    try {
      const response = await fetchWithRetry(feed.url, { redirect: 'follow' }, 180000)
      if (!response.ok || !response.body) throw new Error(`Installer download failed with HTTP ${response.status}.`)
      const finalUrl = new URL(response.url)
      if (!isTrustedGitHubUrl(finalUrl.href)) throw new Error('The installer download redirected to an untrusted host.')
      const source = Readable.fromWeb(response.body)
      const meter = async function * () {
        for await (const chunk of source) {
          size += chunk.length
          if (size > feed.size) throw new Error('The installer download exceeded the advertised file size.')
          hash.update(chunk)
          emitProgress('download', `Downloading OverHead ${feed.version} (${Math.floor(size / feed.size * 100)}%)`, Math.floor(size / feed.size * 100))
          yield chunk
        }
      }
      await pipeline(Readable.from(meter()), fs.createWriteStream(partial, { flags: 'w' }))
      if (size !== feed.size || hash.digest('base64') !== feed.sha512) throw new Error('Installer size or SHA-512 did not match the official update feed.')
      fs.renameSync(partial, destination)
      verifyTrustedFile(destination)
      return destination
    } catch (error) {
      fs.rmSync(partial, { force: true })
      if (/exceeded the advertised file size|SHA-512 did not match|redirected to an untrusted host/i.test(error.message || '')) throw error
      if (attempt === 2) throw error
      emitProgress('download-retry', `Download interrupted. Retrying (${attempt + 2} of 3)...`)
      await pause(RETRY_DELAY_MS[attempt])
    }
  }
  throw new Error('The OverHead installer could not be downloaded after retries.')
}

function directoryManifest(root) {
  const records = []
  if (!fs.existsSync(root)) return records
  const walk = (directory) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, item.name)
      if (item.isDirectory()) walk(full)
      else if (item.isSymbolicLink()) throw new Error(`A symbolic link was found in the OverHead data folder: ${path.relative(root, full)}. Move or remove it before updating so the full data set can be verified.`)
      else if (item.isFile()) {
        const descriptor = fs.openSync(full, 'r')
        const hash = crypto.createHash('sha256')
        const buffer = Buffer.allocUnsafe(1024 * 1024)
        let size = 0
        try {
          let bytesRead = 0
          while ((bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
            size += bytesRead
            hash.update(buffer.subarray(0, bytesRead))
          }
        } finally { fs.closeSync(descriptor) }
        records.push({ path: path.relative(root, full), size, sha256: hash.digest('hex') })
      }
    }
  }
  walk(root)
  return records.sort((a, b) => a.path.localeCompare(b.path))
}

function createDataBackup(targetId = 'desktop') {
  const target = getProductTarget(targetId)
  const source = configuredDataRoot(targetId)
  fs.mkdirSync(target.backupRoot, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const destination = path.join(target.backupRoot, `${target.backupPrefix}-${timestamp}`)
  fs.mkdirSync(destination, { recursive: true })
  try {
    const before = directoryManifest(source)
    if (fs.existsSync(source)) fs.cpSync(source, path.join(destination, 'data'), { recursive: true, errorOnExist: true, force: false })
    const after = directoryManifest(path.join(destination, 'data'))
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('The data backup did not match the source files. Installation was stopped.')
    fs.writeFileSync(path.join(destination, 'backup-manifest.json'), JSON.stringify({ productTargetId: targetId, createdAt: new Date().toISOString(), source, files: after }, null, 2), 'utf8')
    return { path: destination, fileCount: after.length }
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true })
    throw error
  }
}

function preserveDataFromBackup(backupPath, targetId = 'desktop') {
  const target = configuredDataRoot(targetId)
  const backupData = path.join(backupPath, 'data')
  const manifest = safeJson(path.join(backupPath, 'backup-manifest.json'), null)
  if (!manifest || !Array.isArray(manifest.files)) throw new Error('The pre-update data backup has no valid integrity manifest.')
  const current = directoryManifest(target)
  if (JSON.stringify(current) === JSON.stringify(manifest.files)) return { preserved: true, restored: false, previousDataPath: '' }
  const stage = `${target}.manager-restore-${crypto.randomUUID()}`
  const previous = `${target}.manager-after-update-${crypto.randomUUID()}`
  fs.mkdirSync(path.dirname(target), { recursive: true })
  if (fs.existsSync(backupData)) fs.cpSync(backupData, stage, { recursive: true, errorOnExist: true, force: false })
  if (JSON.stringify(directoryManifest(stage)) !== JSON.stringify(manifest.files)) {
    fs.rmSync(stage, { recursive: true, force: true })
    throw new Error('The saved user data failed verification. Existing data was left untouched.')
  }
  const hadCurrent = fs.existsSync(target)
  if (hadCurrent) fs.renameSync(target, previous)
  try {
    if (fs.existsSync(stage)) fs.renameSync(stage, target)
  } catch (error) {
    if (hadCurrent && fs.existsSync(previous)) fs.renameSync(previous, target)
    throw error
  }
  if (JSON.stringify(directoryManifest(target)) !== JSON.stringify(manifest.files)) throw new Error('User data was restored from backup but did not pass its final integrity check.')
  return { preserved: true, restored: true, previousDataPath: hadCurrent ? previous : '' }
}

async function ensureNoAppRunning(targetId = 'desktop') {
  const target = getProductTarget(targetId)
  if (!appIsRunning(targetId)) return
  const result = dialog.showMessageBoxSync(mainWindow, {
    type: 'warning', buttons: ['Close OverHead and Continue', 'Cancel'], defaultId: 1, cancelId: 1,
    title: `Close ${target.shortName} first`, message: `${target.shortName} is currently running.`,
    detail: `Save your work. The manager will ask ${target.shortName} to close normally and will not force-stop it.`,
  })
  if (result !== 0) throw new Error('Installation was cancelled. OverHead is still open.')
  runPowerShell(`$main=Get-CimInstance Win32_Process -Filter "Name='${target.processName}'" -ErrorAction SilentlyContinue | Where-Object { -not ($_.CommandLine -match '(?:^|\\s)--type(?:=|\\s)') }; foreach($item in $main){$process=Get-Process -Id $item.ProcessId -ErrorAction SilentlyContinue; if($process -and $process.MainWindowHandle -ne 0){[void]$process.CloseMainWindow()}}`)
  const until = Date.now() + 30000
  while (appIsRunning(targetId) && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 250))
  if (appIsRunning(targetId)) throw new Error(`${target.shortName} did not close within 30 seconds. Close it manually, then try again.`)
}

function launchInstaller(installerPath, installLocation = '', managerConsentRecorded = false) {
  return new Promise((resolve, reject) => {
    const args = ['/S']
    if (managerConsentRecorded) args.push('/OVERHEAD_MANAGER_CONSENT=1')
    if (installLocation) args.push(`/D=${installLocation}`)
    const child = spawn(installerPath, args, { detached: false, stdio: 'ignore', windowsHide: true })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`OverHead setup exited with code ${code ?? 'unknown'}.`)))
  })
}

async function removeInstalledProgram(installed, targetId = 'desktop', operation = 'replace') {
  const target = getProductTarget(targetId)
  if (!new RegExp(target.displayNamePattern, 'i').test(installed.displayName || '') || !installed.installLocation) throw new Error(`The registered ${target.productName} installation could not be identified safely.`)
  const installLocation = path.resolve(installed.installLocation)
  const uninstaller = path.resolve(installLocation, target.uninstallerName)
  if (!fs.existsSync(uninstaller) || path.dirname(uninstaller).toLowerCase() !== installLocation.toLowerCase()) {
    throw new Error('The registered OverHead uninstaller is missing or outside its installation folder.')
  }
  const isUninstall = operation === 'uninstall'
  emitProgress(isUninstall ? 'uninstall' : 'replace', isUninstall ? `Removing ${target.productName}...` : `Removing the existing ${target.productName} program...`)
  await new Promise((resolve, reject) => {
    const child = spawn(uninstaller, ['/S'], { detached: false, stdio: 'ignore', windowsHide: true })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`The OverHead uninstaller exited with code ${code ?? 'unknown'}.`)))
  })
  const until = Date.now() + 15000
  while (Date.now() < until) {
    const remaining = findInstalledApp(targetId)
    if (!remaining.installLocation && !fs.existsSync(path.join(installLocation, target.executableName))) return
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(isUninstall ? 'The OverHead installation was not fully removed.' : 'The existing OverHead installation was not fully removed. The new version was not started.')
}

function installedAppVersion(entry, targetId = 'desktop') {
  const target = getProductTarget(targetId)
  if (!entry?.installLocation) return ''
  const executable = path.join(entry.installLocation, target.executableName)
  if (!fs.existsSync(executable)) return ''
  const encodedPath = Buffer.from(executable, 'utf8').toString('base64')
  const output = runPowerShell(`$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPath}')); (Get-Item -LiteralPath $p).VersionInfo.ProductVersion`)
  return String(output || '').trim()
}

function processIsRunning(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return false
  const result = spawnSync('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true })
  return result.status === 0 && new RegExp(`,\\s*"${pid}"(?:,|$)`).test(result.stdout || '')
}

async function waitForParentExit(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return
  const until = Date.now() + 30000
  while (processIsRunning(pid) && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 250))
  if (processIsRunning(pid)) throw new Error('OverHead is still closing. Close it and retry the update.')
}

async function installLatest({ consented = false, parentPid = 0, targetId = '' } = {}) {
  if (operationRunning) throw new Error('Another manager operation is already running.')
  operationRunning = true
  try {
    const detected = detectProductSelection(undefined, targetId)
    const selection = detected.selection
    if (!selection.installAllowed || !PRODUCT_TARGETS[selection.id]) throw new Error(selection.reason)
    const target = getProductTarget(selection.id)
    const system = compatibilityForOperation({ systemInformation: detected.systemInformation, selection })
    if (!system.supported) throw new Error(`Installation is blocked by the system compatibility check:\n• ${system.blockers.join('\n• ')}`)
    verifyTrustedFile(process.execPath)
    await waitForParentExit(parentPid)
    await ensureNoAppRunning(target.id)
    const installed = findInstalledApp(target.id)
    if (!installed.installLocation && !hasCurrentFirstInstallConsent(target.id)) {
      throw new Error(`Review and accept the first-install disclosures in the Welcome screen before installing ${target.productName}.`)
    }
    emitProgress('check', `Checking the official ${target.productName} update feed…`)
    const feed = await fetchLatest(target.id)
    const currentVersion = installedAppVersion(installed, target.id) || String(installed.version || '').trim()
    if (currentVersion && compareVersions(feed.version, currentVersion) < 0) throw new Error(`The official feed offers ${feed.version}, older than installed ${currentVersion}. Installation stopped.`)
    const preflight = compatibilityForOperation({ feed, installed, systemInformation: detected.systemInformation, selection })
    if (!preflight.ready) throw new Error(`Installation stopped before download, backup, or removal because the preflight did not pass:\n• ${preflight.blockers.join('\n• ') || 'Required storage capacity could not be verified.'}`)
    const installerPath = await downloadVerifiedInstaller(feed)
    if (installed.installLocation && !consented) {
      const answer = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning', buttons: ['Remove and install', 'Cancel'], defaultId: 1, cancelId: 1,
        title: `Replace the current ${target.productName} installation`,
        message: `The manager will remove ${target.productName} ${currentVersion || '(version unknown)'} and install version ${feed.version}.`,
        detail: 'A verified backup will be created first. Your local data will be kept. The existing program is removed before the new version is installed.',
      })
      if (answer !== 0) throw new Error('Replacement was cancelled. The current OverHead installation was left in place.')
    }
    emitProgress('backup', 'Creating and checking a full user-data backup…')
    const backup = createDataBackup(target.id)
    if (installed.installLocation) await removeInstalledProgram(installed, target.id)
    emitProgress('install', `Installing ${target.productName} ${feed.version}…`)
    try { await launchInstaller(installerPath, installed.installLocation || '', true) } catch (error) {
      throw new Error(`The previous program was removed, but installing version ${feed.version} failed. Your data backup is at ${backup.path}. ${error.message}`)
    }
    emitProgress('verify', 'Verifying the installed version and publisher…')
    const dataResult = preserveDataFromBackup(backup.path, target.id)
    const after = findInstalledApp(target.id)
    const actualVersion = installedAppVersion(after, target.id)
    if (!after.installLocation || actualVersion !== feed.version) throw new Error(`Setup finished, but Windows reports ${actualVersion || 'no installation'} instead of ${feed.version}. Your data backup is at ${backup.path}.`)
    verifyTrustedFile(path.join(after.installLocation, target.executableName))
    return { installed: true, productId: target.id, productName: target.productName, replaced: Boolean(installed.installLocation), previousVersion: currentVersion, version: actualVersion, installLocation: after.installLocation, backupPath: backup.path, backupFiles: backup.fileCount, dataRestored: dataResult.restored, previousDataPath: dataResult.previousDataPath }
  } finally {
    operationRunning = false
  }
}

async function uninstallApp(payload = {}) {
  if (operationRunning) throw new Error('Another manager operation is already running.')
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Uninstall options are invalid.')
  if (payload.removeData !== undefined && typeof payload.removeData !== 'boolean') throw new Error('Choose whether local OverHead data should be kept or removed.')
  if (payload.confirmationText !== undefined && typeof payload.confirmationText !== 'string') throw new Error('The uninstall confirmation is invalid.')
  if (payload.removeData && payload.confirmationText !== 'REMOVE MY OVERHEAD DATA') throw new Error('Type REMOVE MY OVERHEAD DATA to confirm deleting local OverHead data.')
  operationRunning = true
  try {
    const detected = detectProductSelection()
    const selection = detected.selection
    let targetId = PRODUCT_TARGETS[selection.id] ? selection.id : ''
    if (!targetId) {
      const installedTargets = findInstalledTargets()
      if (installedTargets.length !== 1) throw new Error(installedTargets.length > 1 ? 'More than one OverHead product is installed. Select the product to uninstall from a compatible Windows edition.' : selection.reason)
      targetId = installedTargets[0]
    }
    const target = getProductTarget(targetId)
    verifyTrustedFile(process.execPath)
    await ensureNoAppRunning(target.id)
    const installed = findInstalledApp(target.id)
    if (!installed.installLocation) throw new Error(`${target.productName} is not installed on this computer.`)
    const backup = createDataBackup(target.id)
    try {
      await removeInstalledProgram(installed, target.id, 'uninstall')
    } catch (error) {
      throw new Error(`${error.message} Your data backup is available at ${backup.path}`)
    }
    if (payload.removeData) {
      const dataRoot = path.resolve(configuredDataRoot(target.id))
      const allowedParent = path.resolve(APPDATA)
      const isCanonical = dataRoot === path.resolve(target.dataPath)
      const customPath = target.supportsCustomDataRoot && Boolean(readManagerConfig()[target.configDataKey])
      if (!isCanonical && !customPath) throw new Error('The data folder did not match a known product location. It was kept for safety.')
      if (dataRoot.toLowerCase() === allowedParent.toLowerCase() || pathsOverlap(dataRoot, MANAGER_ROOT) || pathsOverlap(dataRoot, BACKUP_ROOT) || pathsOverlap(dataRoot, target.backupRoot)) throw new Error('The selected data path is too broad to remove safely.')
      fs.rmSync(dataRoot, { recursive: true, force: false })
      if (customPath) {
        const config = readManagerConfig()
        delete config[target.configDataKey]
        writeJsonAtomically(MANAGER_CONFIG, config, 'The custom data folder setting could not be cleared.')
      }
    }
    return { uninstalled: true, productId: target.id, productName: target.productName, dataRemoved: Boolean(payload.removeData), backupPath: backup.path, backupFiles: backup.fileCount }
  } finally {
    operationRunning = false
  }
}

function setAutoCheck(enabled) {
  if (typeof enabled !== 'boolean') throw new Error('Choose whether automatic update checks should be on or off.')
  const targetId = detectProductSelection().selection.id
  const file = path.join(configuredDataRoot(targetId), 'update-preferences.json')
  const current = safeJson(file, { autoCheck: true, lastAttemptAt: '' })
  current.autoCheck = Boolean(enabled)
  writeJsonAtomically(file, current, 'The update preference could not be saved locally.')
  return current.autoCheck
}

function selectProduct(targetId) {
  if (operationRunning) throw new Error('Wait for the current manager operation to finish before changing products.')
  if (typeof targetId !== 'string' || !PRODUCT_TARGETS[targetId]) throw new Error('Choose OverHead Desktop or OverHead Cylinder Server.')
  const config = readManagerConfig()
  config.selectedProductId = targetId
  writeJsonAtomically(MANAGER_CONFIG, config, 'The selected product could not be saved.')
  return snapshot()
}

function setLaunchAtLogin(enabled) {
  if (typeof enabled !== 'boolean') throw new Error('Choose whether OverHead should start when you sign in to Windows.')
  const targetId = detectProductSelection().selection.id
  const target = getProductTarget(targetId)
  const name = target.startupValue
  const key = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
  const installed = findInstalledApp(targetId)
  const executable = installed.installLocation ? path.join(installed.installLocation, target.executableName) : ''
  if (enabled && (!executable || !fs.existsSync(executable))) throw new Error(`Install ${target.productName} before enabling launch at sign-in.`)
  const encodedExe = Buffer.from(`"${executable}"`, 'utf8').toString('base64')
  const script = enabled
    ? `$v=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedExe}')); New-Item -Path '${key}' -Force|Out-Null; Set-ItemProperty -Path '${key}' -Name '${name}' -Value $v`
    : `Remove-ItemProperty -Path '${key}' -Name '${name}' -ErrorAction SilentlyContinue`
  runPowerShell(script)
  return Boolean(enabled)
}

function configureDataRoot(destinationPath) {
  if (operationRunning) throw new Error('Another manager operation is already running.')
  if (typeof destinationPath !== 'string') throw new Error('Choose a folder for OverHead data.')
  operationRunning = true
  try {
    const targetId = detectProductSelection().selection.id
    const target = getProductTarget(targetId)
    if (!target.supportsCustomDataRoot) throw new Error(`${target.productName} uses its standard protected data folder, which cannot be changed here.`)
    const source = path.resolve(configuredDataRoot(targetId))
    const requestedPath = String(destinationPath || '').trim()
    if (!path.isAbsolute(requestedPath)) throw new Error('Choose an absolute folder for OverHead data.')
    const destination = path.resolve(requestedPath)
    assertDataRootSafe(destination, targetId)
    if (destination.toLowerCase() === source.toLowerCase()) throw new Error('Choose a different folder for OverHead data.')
    const appRoot = path.resolve(APPDATA)
    if (destination.toLowerCase() === appRoot.toLowerCase() || pathsOverlap(destination, source)) throw new Error('Choose a folder outside the current OverHead data tree.')
    if (appIsRunning(targetId)) throw new Error(`Close ${target.shortName} before moving its data folder.`)
    if (fs.existsSync(destination) && fs.readdirSync(destination).length) throw new Error('The selected folder is not empty. Choose an empty folder so existing files are not overwritten.')
    const backup = createDataBackup(targetId)
    fs.mkdirSync(destination, { recursive: true })
    const before = directoryManifest(source)
    if (fs.existsSync(source)) fs.cpSync(source, destination, { recursive: true, errorOnExist: true, force: false })
    const after = directoryManifest(destination)
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`The data move did not verify. Original data is unchanged; backup is at ${backup.path}.`)
    const config = readManagerConfig()
    config.desktopDataRoot = destination
    writeJsonAtomically(MANAGER_CONFIG, config, 'The new data folder setting could not be saved.')
    return { dataRoot: destination, backupPath: backup.path, fileCount: after.length }
  } finally {
    operationRunning = false
  }
}

async function snapshot() {
  const systemInformation = readSystemInformation()
  const installedProducts = systemInformation.available ? findInstalledProducts() : {}
  const detected = detectProductSelection(systemInformation, '', installedProducts)
  const selection = detected.selection
  let targetId = PRODUCT_TARGETS[selection.id] ? selection.id : ''
  if (!detected.systemInformation.available) targetId = targetId || 'desktop'
  else if (!targetId) {
    const installedTargets = detected.installedTargets || findInstalledTargets(installedProducts)
    targetId = installedTargets.length === 1 ? installedTargets[0] : 'desktop'
  }
  const target = getProductTarget(targetId)
  const compatibility = compatibilityForOperation({ systemInformation: detected.systemInformation, selection })
  const firstInstallConsent = readFirstInstallConsent()
  const consentAccepted = hasCurrentFirstInstallConsent(targetId)
  if (!compatibility.detected.powershell.available) {
    return {
      productId: selection.id, productName: selection.productName || 'Unsupported Windows edition', edition: selection.edition || '', selectionReason: selection.reason,
      installAllowed: selection.installAllowed,
      products: Object.keys(PRODUCT_TARGETS).map((productId) => ({
        id: productId,
        productName: getProductTarget(productId).productName,
        installed: false,
        version: '',
        installAllowed: false,
      })),
      installed: false, version: '', installLocation: '', managerSignature: 'Not checked', managerSigner: '',
      expectedSignerConfigured: Boolean(expectedSigner()), managerTrusted: false, managerTrustMode: 'unconfigured',
      dataRoot: configuredDataRoot(targetId), customDataRoot: target.supportsCustomDataRoot && Boolean(readManagerConfig()[target.configDataKey]), supportsCustomDataRoot: target.supportsCustomDataRoot, autoCheck: true,
      launchAtLogin: false, appRunning: false,
      supportedWindows: { supported: false, version: 'Windows system checks unavailable', is64Bit: process.arch === 'x64' },
      compatibility, firstInstallConsentAccepted: false, firstInstallConsentAt: '',
      firstInstallNoticeUpdatedAt: FIRST_INSTALL_NOTICE_UPDATED_AT,
      launchedForUpdate: process.argv.includes('--install-update'), backupRoot: target.backupRoot,
    }
  }
  const installed = installedProducts?.[targetId] || findInstalledApp(targetId)
  const manager = inspectSignature(process.execPath)
  const managerTrust = assessTrust(manager)
  installedProducts[targetId] = installed
  const appVersion = installedAppVersion(installed, targetId)
  const config = readManagerConfig()
  const startupName = Buffer.from(target.startupValue, 'utf8').toString('base64')
  const startup = runPowerShell(`$n=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${startupName}')); $item=Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -ErrorAction SilentlyContinue; if($item){$property=$item.PSObject.Properties[$n];if($property){[string]$property.Value}}`)
  const preferences = safeJson(path.join(configuredDataRoot(targetId), 'update-preferences.json'), { autoCheck: true })
  const os = compatibility.detected.os
  return {
    productId: selection.id, productName: installed.installLocation && !PRODUCT_TARGETS[selection.id] ? target.productName : (selection.productName || target.productName), edition: selection.edition || '', selectionReason: selection.reason,
    installAllowed: selection.installAllowed,
    products: Object.keys(PRODUCT_TARGETS).map((productId) => {
      const productTarget = getProductTarget(productId)
      const productInstall = installedProducts[productId]
      const productSelection = classifyWindowsProduct(detected.systemInformation, productId)
      return { id: productId, productName: productTarget.productName, installed: Boolean(productInstall.installLocation), version: installedAppVersion(productInstall, productId), installAllowed: productSelection.installAllowed }
    }),
    installed: Boolean(installed.installLocation), version: appVersion, installLocation: installed.installLocation || '',
    managerSignature: manager.status, managerSigner: manager.subject || '', expectedSignerConfigured: Boolean(expectedSigner()),
    managerTrusted: managerTrust.trusted,
    managerTrustMode: managerTrust.mode,
    dataRoot: configuredDataRoot(targetId), customDataRoot: target.supportsCustomDataRoot && Boolean(config[target.configDataKey]), supportsCustomDataRoot: target.supportsCustomDataRoot, autoCheck: preferences.autoCheck !== false,
    launchAtLogin: Boolean(startup), appRunning: appIsRunning(targetId),
    supportedWindows: { supported: compatibility.supported, version: `${os?.caption || 'unknown'} build ${os?.build || 'unknown'}`, edition: selection.edition || '', productType: os?.productType || 0, is64Bit: os?.architecture?.toLowerCase().includes('64') || false },
    compatibility,
    firstInstallConsentAccepted: consentAccepted,
    firstInstallConsentAt: consentAccepted ? firstInstallConsent?.acceptedAt : '',
    firstInstallNoticeUpdatedAt: FIRST_INSTALL_NOTICE_UPDATED_AT,
    launchedForUpdate: process.argv.includes('--install-update'),
    backupRoot: target.backupRoot,
  }
}

function listBackups() {
  const targetId = detectProductSelection().selection.id
  const target = getProductTarget(targetId)
  if (!fs.existsSync(target.backupRoot)) return []
  return fs.readdirSync(target.backupRoot, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => {
      const folder = path.join(target.backupRoot, item.name)
      const manifest = safeJson(path.join(folder, 'backup-manifest.json'), null)
      const legacyDesktopBackup = targetId === 'desktop' && !manifest?.productTargetId
      return manifest && (manifest.productTargetId === targetId || legacyDesktopBackup) && Array.isArray(manifest.files) ? {
        id: item.name, createdAt: manifest.createdAt || '', source: manifest.source || '', fileCount: manifest.files.length,
      } : null
    })
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

async function restoreBackup(payload = {}) {
  if (operationRunning) throw new Error('Another manager operation is already running.')
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Restore options are invalid.')
  if (typeof payload.backupId !== 'string' || typeof payload.confirmationText !== 'string') throw new Error('Choose a backup and enter the restore confirmation text.')
  if (payload.confirmationText !== 'RESTORE OVERHEAD DATA') throw new Error('Type RESTORE OVERHEAD DATA to confirm replacing the current local data.')
  operationRunning = true
  try {
    const targetId = detectProductSelection().selection.id
    const target = getProductTarget(targetId)
    await ensureNoAppRunning(targetId)
    const id = String(payload.backupId || '')
    if (!new RegExp(`^${target.backupPrefix}-[0-9TZ-]+$`).test(id)) throw new Error(`Choose a valid ${target.productName} backup first.`)
    const backupFolder = path.resolve(target.backupRoot, id)
    if (!backupFolder.startsWith(`${path.resolve(target.backupRoot)}${path.sep}`)) throw new Error('The selected backup is outside the manager backup folder.')
    const backupData = path.join(backupFolder, 'data')
    const manifest = safeJson(path.join(backupFolder, 'backup-manifest.json'), null)
    const legacyDesktopBackup = targetId === 'desktop' && !manifest?.productTargetId
    if (!manifest || (manifest.productTargetId !== targetId && !legacyDesktopBackup) || !Array.isArray(manifest.files)) throw new Error('The selected backup has no valid manifest for this product.')
    const actual = directoryManifest(backupData)
    if (JSON.stringify(actual) !== JSON.stringify(manifest.files)) throw new Error('The selected backup failed its SHA-256 integrity check.')
    const currentBackup = createDataBackup(targetId)
    const dataRoot = configuredDataRoot(targetId)
    const stage = `${dataRoot}.restore-${crypto.randomUUID()}`
    const previous = `${dataRoot}.before-restore-${crypto.randomUUID()}`
    fs.mkdirSync(path.dirname(dataRoot), { recursive: true })
    fs.cpSync(backupData, stage, { recursive: true, errorOnExist: true, force: false })
    if (JSON.stringify(directoryManifest(stage)) !== JSON.stringify(manifest.files)) {
      fs.rmSync(stage, { recursive: true, force: true })
      throw new Error('The staged restore did not match the selected backup. Current data remains untouched.')
    }
    const hadCurrent = fs.existsSync(dataRoot)
    if (hadCurrent) fs.renameSync(dataRoot, previous)
    try { fs.renameSync(stage, dataRoot) } catch (error) {
      if (hadCurrent && fs.existsSync(previous)) fs.renameSync(previous, dataRoot)
      throw error
    }
    return { restored: true, backupPath: backupFolder, safetyBackupPath: currentBackup.path, previousDataPath: hadCurrent ? previous : '' }
  } finally {
    operationRunning = false
  }
}

function isTrustedSender(event) {
  return Boolean(mainWindow && event.sender === mainWindow.webContents && event.senderFrame?.url === MANAGER_ENTRY_URL)
}

function bind(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error('This request did not come from OverHead Install Manager.')
    try {
      return await handler(...args)
    } catch (error) {
      writeDiagnosticLog('manager-errors.log', channel, error, 1800)
      throw error
    }
  })
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay()
  const windowWidth = Math.max(1, Math.min(1120, workArea.width - 32))
  const windowHeight = Math.max(1, Math.min(900, workArea.height - 32))
  mainWindow = new BrowserWindow({
    width: windowWidth, height: windowHeight, center: true, resizable: false, maximizable: false, fullscreenable: false, title: 'OverHead Install Manager',
    backgroundColor: '#f2f5fa', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !app.isPackaged },
  })
  mainWindow.on('close', (event) => {
    if (!operationRunning) return
    event.preventDefault()
    dialog.showMessageBox(mainWindow, { type: 'warning', buttons: ['Continue'], title: 'Update still running', message: 'Keep Install Manager open until the operation finishes.' })
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  const writeRendererDiagnostic = (kind, detail) => {
    writeDiagnosticLog('renderer-diagnostics.log', kind, detail, 1200)
  }
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    writeRendererDiagnostic(`renderer-console-${level}`, `${message} (${sourceId}:${line})`)
  })
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    writeRendererDiagnostic('renderer-process-gone', JSON.stringify(details))
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, { type: 'error', buttons: ['Close'], title: 'Install Manager could not display', message: 'The Manager display process stopped unexpectedly.', detail: `Reason: ${details.reason || 'unknown'}. Relaunch the Manager after this message closes.` })
    }
  })
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return
    const detail = `${errorDescription} (${errorCode}) at ${validatedURL}`
    writeRendererDiagnostic('page-load-failed', detail)
    dialog.showMessageBox(mainWindow, { type: 'error', buttons: ['Close'], title: 'Install Manager could not load', message: 'The Manager could not load its local interface.', detail })
  })
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl !== MANAGER_ENTRY_URL) event.preventDefault()
  })
  mainWindow.loadURL(MANAGER_ENTRY_URL).catch((error) => {
    writeRendererDiagnostic('page-load-rejected', error?.stack || error)
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, { type: 'error', buttons: ['Close'], title: 'Install Manager could not load', message: 'The Manager could not load its local interface.', detail: error?.message || String(error) })
    }
  })
  mainWindow.webContents.on('did-finish-load', async () => {
    try {
      const renderState = await mainWindow.webContents.executeJavaScript(`(() => {
        const main = document.querySelector('main')
        const welcome = document.getElementById('welcome-screen')
        const css = [...document.styleSheets].map(sheet => ({ href: sheet.href, disabled: sheet.disabled }))
        return {
          href: location.href,
          readyState: document.readyState,
          title: document.title,
          bodyTextLength: document.body?.innerText?.length || 0,
          bodyChildren: document.body?.children?.length || 0,
          mainTextLength: main?.innerText?.length || 0,
          mainDisplay: main ? getComputedStyle(main).display : 'missing',
          mainVisibility: main ? getComputedStyle(main).visibility : 'missing',
          mainRect: main ? (() => { const r = main.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })() : null,
          welcomeDisplay: welcome ? getComputedStyle(welcome).display : 'missing',
          welcomeClass: welcome?.className || 'missing',
          stylesheetCount: css.length,
          stylesheets: css,
          installManagerApi: Boolean(window.installManager),
        }
      })()`)
      writeRendererDiagnostic('dom-state', JSON.stringify(renderState))
    } catch (error) { writeRendererDiagnostic('dom-state-failed', error?.stack || error) }
  })
}

function parentPidFromArgs(args) {
  const value = args.find((argument) => argument.startsWith('--parent-pid='))?.split('=')[1] || ''
  return /^\d+$/.test(value) ? Number(value) : 0
}

function consumeUpdateConsentTicket(args, parentPid) {
  const ticketId = args.find((argument) => argument.startsWith('--consent-ticket='))?.split('=')[1] || ''
  const requestedTargetId = args.find((argument) => argument.startsWith('--product-id='))?.split('=')[1] || ''
  if (!/^[a-f0-9]{64}$/.test(ticketId) || (requestedTargetId && !PRODUCT_TARGETS[requestedTargetId]) || !Number.isSafeInteger(parentPid) || parentPid < 1 || !safeStorage.isEncryptionAvailable()) return ''
  const directory = path.join(LOCALAPPDATA, 'OverHead Install Manager', 'Update Consent')
  const ticketPath = path.join(directory, `${ticketId}.consent`)
  let encrypted
  try {
    encrypted = fs.readFileSync(ticketPath, 'utf8')
    // Remove the ticket before using it so it cannot be replayed if an install fails.
    fs.rmSync(ticketPath, { force: false })
    } catch { return '' }
  try {
    const record = JSON.parse(safeStorage.decryptString(Buffer.from(encrypted, 'base64')))
    const age = Date.now() - Number(record.consentedAt)
    const targetId = PRODUCT_TARGETS[record.productId] && (!requestedTargetId || requestedTargetId === record.productId) ? record.productId : ''
    return record.affirmative === true
      && record.parentPid === parentPid
      && Number.isFinite(age) && age >= 0 && age <= 120000
      ? targetId
      : ''
  } catch { return '' }
}

async function runCommandInstallUpdate(args, parentPid) {
  if (operationRunning) {
    emitProgress('busy', 'Another manager operation is already in progress.')
    mainWindow?.show()
    mainWindow?.focus()
    return
  }
  const approvedTargetId = consumeUpdateConsentTicket(args, parentPid)
  if (!approvedTargetId) {
    const message = 'This update launch has no valid, product-specific approval ticket. Start the update again from OverHead and approve it there.'
    emitProgress('error', message)
    await dialog.showMessageBox(mainWindow, { type: 'error', buttons: ['Close'], title: 'Update approval required', message })
    return
  }
  try {
    const result = await installLatest({ consented: true, parentPid, targetId: approvedTargetId })
    scheduleManagerExitAfterInstall(`OverHead ${result.version} is installed and verified. ${result.dataRestored ? 'User data was restored to its pre-update state and verified. ' : 'User data is unchanged and verified. '}Backup: ${result.backupPath}`)
  } catch (error) {
    emitProgress('error', error.message || String(error))
    await dialog.showMessageBox(mainWindow, {
      type: 'error', buttons: ['Close'], title: 'OverHead update needs attention',
      message: error.message || String(error), detail: 'The manager has not intentionally changed or deleted user data.',
    })
  }
}

function scheduleManagerExitAfterInstall(summary) {
  let remaining = 10
  const report = () => emitProgress('auto-close', `${summary} Manager closes in ${remaining} seconds.`, 100)
  report()
  const timer = setInterval(() => {
    remaining -= 1
    if (remaining <= 0) {
      clearInterval(timer)
      app.quit()
      return
    }
    report()
  }, 1000)
}

bind('manager:snapshot', snapshot)
bind('manager:close', () => app.quit())
bind('manager:record-first-install-consent', recordFirstInstallConsent)
bind('manager:open-legal-center', () => shell.openExternal('https://overhead-office.web.app/legal/'))
bind('manager:check-latest', checkLatest)
bind('manager:install', () => installLatest())
bind('manager:uninstall', uninstallApp)
bind('manager:set-auto-check', setAutoCheck)
bind('manager:select-product', selectProduct)
bind('manager:set-launch-at-login', setLaunchAtLogin)
bind('manager:configure-data-root', configureDataRoot)
bind('manager:choose-data-root', async () => {
  const target = getProductTarget(detectProductSelection().selection.id)
  if (!target.supportsCustomDataRoot) throw new Error(`${target.productName} uses its standard data folder.`)
  const result = await dialog.showOpenDialog(mainWindow, { title: `Choose ${target.productName} data folder`, properties: ['openDirectory', 'createDirectory'] })
  return result.canceled ? '' : result.filePaths[0]
})
bind('manager:open-backups', async () => shell.openPath(getProductTarget(detectProductSelection().selection.id).backupRoot))
bind('manager:open-data-root', async () => shell.openPath(configuredDataRoot(detectProductSelection().selection.id)))
bind('manager:list-backups', listBackups)
bind('manager:restore', restoreBackup)

const lock = app.requestSingleInstanceLock()
if (!lock) app.quit()
else {
  app.on('second-instance', (_event, args) => {
    if (mainWindow?.isMinimized()) mainWindow.restore()
    mainWindow?.show()
    mainWindow?.focus()
    if (args.includes('--install-update')) setTimeout(() => runCommandInstallUpdate(args, parentPidFromArgs(args)), 150)
  })
  app.whenReady().then(async () => {
    await registerManagerProtocol()
    const managerSession = require('electron').session.defaultSession
    managerSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
    managerSession.setPermissionCheckHandler(() => false)
    createWindow()
    if (process.argv.includes('--install-update')) setTimeout(() => runCommandInstallUpdate(process.argv, parentPidFromArgs(process.argv)), 400)
  })
}
