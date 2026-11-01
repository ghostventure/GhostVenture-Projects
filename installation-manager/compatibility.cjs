const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const MIN_WINDOWS_10_BUILD = 17763
const POWERSHELL_MINIMUM = '5.1'
const MIN_LOGICAL_PROCESSORS = 2
const MIN_MEMORY_BYTES = 4 * 1024 ** 3
const MIN_INSTALL_TARGET_BYTES = 1024 ** 3
const SYSTEM_INFORMATION_CACHE_MS = 30_000

let cachedSystemInformation = null
let cachedSystemInformationAt = 0

function encodedPowerShell(script) {
  return Buffer.from(script, 'utf16le').toString('base64')
}

function readSystemInformation() {
  if (process.platform !== 'win32') {
    return { available: false, error: 'The Install Manager only supports Windows.' }
  }

  // A single manager window can request compatibility several times while the
  // user moves through the workflow. Avoid launching PowerShell and repeating
  // CIM hardware queries for each request. This short cache is scoped to this
  // process and only stores a successful snapshot; storage and integrity are
  // still checked live by assessCompatibility.
  const now = Date.now()
  if (cachedSystemInformation && now - cachedSystemInformationAt < SYSTEM_INFORMATION_CACHE_MS) {
    return { ...cachedSystemInformation }
  }

  const script = [
    "$ErrorActionPreference='Stop'",
    "$ps=$PSVersionTable.PSVersion",
    "$auth=Get-Command Get-AuthenticodeSignature -ErrorAction SilentlyContinue",
    "$cim=Get-Command Get-CimInstance -ErrorAction SilentlyContinue",
    "$os=$null;$computer=$null;$processor=$null;$edition='';$productName=''",
    "if($cim){try{$os=Get-CimInstance Win32_OperatingSystem; $computer=Get-CimInstance Win32_ComputerSystem; $processor=Get-CimInstance Win32_Processor | Select-Object -First 1; $cv=Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion' -ErrorAction SilentlyContinue; $edition=[string]$cv.EditionID; $productName=[string]$cv.ProductName}catch{}}",
    "[pscustomobject]@{powershellVersion=$ps.ToString();authenticodeAvailable=[bool]$auth;cimAvailable=[bool]$cim;osCaption=[string]$os.Caption;osVersion=[string]$os.Version;osBuild=[int]$os.BuildNumber;osArchitecture=[string]$os.OSArchitecture;systemType=[string]$computer.SystemType;productType=[int]$os.ProductType;operatingSystemSKU=[int]$os.OperatingSystemSKU;editionID=$edition;productName=$productName;processorName=[string]$processor.Name;processorArchitecture=[int]$processor.Architecture;logicalProcessors=[int]$processor.NumberOfLogicalProcessors;cores=[int]$processor.NumberOfCores;memoryBytes=[UInt64]$computer.TotalPhysicalMemory}|ConvertTo-Json -Compress -Depth 3",
  ].join(';')
  const result = spawnSync('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive',
    '-EncodedCommand', encodedPowerShell(script),
  ], { encoding: 'utf8', windowsHide: true, timeout: 20000 })

  if (result.error) return { available: false, error: result.error.message || 'Windows PowerShell could not be started.' }
  if (result.status !== 0) return { available: false, error: String(result.stderr || result.stdout || 'Windows PowerShell system query failed.').trim() }
  try {
    const information = { available: true, ...JSON.parse(String(result.stdout || '').trim()) }
    cachedSystemInformation = information
    cachedSystemInformationAt = Date.now()
    return { ...information }
  }
  catch { return { available: false, error: 'Windows PowerShell returned unreadable system information.' } }
}

function versionAtLeast(actual, minimum) {
  const a = String(actual || '').split('.').map((part) => Number(part) || 0)
  const b = String(minimum || '').split('.').map((part) => Number(part) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0)
  }
  return true
}

function classifyWindowsProduct(system = {}, preferredTargetId = '') {
  const caption = String(system.osCaption || '')
  const editionId = String(system.editionID || '')
  const productName = String(system.productName || '')
  const productType = Number(system.productType) || 0
  const editionSource = `${editionId} ${productName} ${caption}`
  const edition = /iot/i.test(editionSource) ? 'IoT'
    : /server/i.test(editionSource) ? 'Server'
      : /enterprise/i.test(editionSource) ? 'Enterprise'
    : /professional|\bpro\b/i.test(editionSource) ? 'Pro'
      : /home|\bcore\b/i.test(editionSource) ? 'Home'
        : /education/i.test(editionSource) ? 'Education'
          : ''
  const isIotHost = /iot/i.test(`${editionId} ${productName} ${caption}`)
  const isServer = [2, 3].includes(productType) || /Windows\s+Server/i.test(`${productName} ${caption}`)
  if (preferredTargetId === 'desktop' || preferredTargetId === 'cylinder-server' || preferredTargetId === 'cylinder-client') {
    const automatic = classifyWindowsProduct(system)
    const isDesktop = preferredTargetId === 'desktop'
    const isCylinderClient = preferredTargetId === 'cylinder-client'
    const isWindowsClient = /Windows\s+(10|11)\b/i.test(caption)
    const clientEditionSupported = ['Home', 'Pro', 'Enterprise', 'Education'].includes(edition)
    const canInstall = isCylinderClient
      ? system.available && productType === 1 && isWindowsClient && clientEditionSupported
      : automatic.id === preferredTargetId
    const targetName = isDesktop ? 'OverHead Desktop' : isCylinderClient ? 'OverHead Cylinder Client' : 'OverHead Cylinder Server'
    const role = isDesktop || isCylinderClient ? 'workstation' : 'server'
    return {
      ...automatic,
      id: preferredTargetId,
      productName: targetName,
      role,
      releaseCheckAllowed: canInstall,
      installAllowed: canInstall,
      reason: canInstall
        ? (isDesktop ? edition + ' Windows workstation selected for OverHead Desktop.' : isCylinderClient ? edition + ' Windows workstation selected for OverHead Cylinder Client.' : 'This Windows Server or IoT host is selected for OverHead Cylinder Server.')
        : (isDesktop
            ? 'OverHead Desktop can be installed only on a supported Windows 10/11 Home, Pro, or Enterprise workstation.'
            : isCylinderClient
              ? 'OverHead Cylinder Client requires a supported Windows 10/11 workstation edition.'
              : 'OverHead Cylinder Server can be installed only on a supported Windows Server or Windows IoT host.'),
    }
  }
  if (isServer || isIotHost) {
    return {
      id: 'cylinder-server',
      productName: 'OverHead Cylinder Server',
      edition: edition || 'Windows Server',
      role: 'server',
      detected: true,
      releaseCheckAllowed: true,
      installAllowed: true,
      reason: 'This Windows Server or IoT host is selected for OverHead Cylinder Server.',
    }
  }
  const isWindowsClient = /Windows\s+(10|11)\b/i.test(caption)
  if (system.available && productType === 1 && isWindowsClient && ['Home', 'Pro', 'Enterprise'].includes(edition)) {
    return {
      id: 'desktop',
      productName: 'OverHead Desktop',
      edition: edition || 'Windows workstation',
      role: 'workstation',
      detected: true,
      releaseCheckAllowed: true,
      installAllowed: true,
      reason: `${edition || 'This Windows 10/11 workstation'} is selected for OverHead Desktop.`,
    }
  }
  return {
    id: 'unsupported',
    productName: 'No compatible product selected',
    edition: edition || (caption ? 'Unsupported Windows edition' : 'Unknown edition'),
    role: 'unsupported',
    detected: Boolean(system.available),
    releaseCheckAllowed: false,
    installAllowed: false,
    reason: 'Use a supported Windows 10/11 Home, Pro, or Enterprise workstation for OverHead Desktop, or a supported Windows Server/IoT host for OverHead Cylinder Server.',
  }
}

function runtimeIntegrity({ packaged = true, resourcesPath = process.resourcesPath, executablePath = process.execPath } = {}) {
  const missing = []
  if (!process.versions?.electron) missing.push('Electron runtime')
  if (!process.versions?.chrome) missing.push('bundled Chromium runtime')
  if (!process.versions?.node) missing.push('bundled Node.js runtime')
  try {
    if (!executablePath || !fs.statSync(executablePath).isFile()) missing.push('Install Manager executable')
  } catch { missing.push('Install Manager executable') }
  if (packaged) {
    try {
      if (!resourcesPath || !fs.statSync(path.join(resourcesPath, 'app.asar')).isFile()) missing.push('packaged app.asar')
    } catch { missing.push('packaged app.asar') }
  }
  return {
    status: missing.length ? 'package-integrity-failure' : (packaged ? 'verified-components-present' : 'development-runtime-present'),
    missing,
    versions: {
      electron: process.versions?.electron || '',
      chromium: process.versions?.chrome || '',
      node: process.versions?.node || '',
    },
  }
}

function resolveExistingDirectory(candidate) {
  let current = path.resolve(candidate || os.tmpdir())
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current)
    if (parent === current) return ''
    current = parent
  }
  try { return fs.statSync(current).isDirectory() ? current : path.dirname(current) }
  catch { return '' }
}

function inspectFreeSpace(candidate) {
  const directory = resolveExistingDirectory(candidate)
  if (!directory || typeof fs.statfsSync !== 'function') {
    return { path: candidate || '', inspectedPath: directory, available: false, availableBytes: null, blockSize: null, volume: '' }
  }
  try {
    const volume = path.parse(path.resolve(directory)).root || directory
    const stats = fs.statfsSync(directory)
    const blockSize = Number(stats.bsize) || 0
    const freeBlocks = Number(stats.bavail)
    return {
      path: candidate || '', inspectedPath: directory, available: Number.isFinite(freeBlocks) && blockSize > 0,
      availableBytes: Number.isFinite(freeBlocks) && blockSize > 0 ? freeBlocks * blockSize : null,
      blockSize: blockSize || null, volume: volume.toLowerCase(),
    }
  } catch {
    return { path: candidate || '', inspectedPath: directory, available: false, availableBytes: null, blockSize: null, volume: '' }
  }
}

function measureDirectory(root) {
  const resolved = path.resolve(root || '')
  const result = { path: resolved, exists: false, readable: true, fileCount: 0, logicalBytes: 0, manifestBytesEstimate: 0, error: '' }
  if (!root || !fs.existsSync(resolved)) return result
  result.exists = true
  const walk = (directory) => {
    let entries
    try { entries = fs.readdirSync(directory, { withFileTypes: true }) }
    catch (error) {
      result.readable = false
      result.error ||= error.message || 'A data folder could not be inspected.'
      return
    }
    for (const entry of entries) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile()) {
        try {
          const size = fs.statSync(full).size
          result.fileCount += 1
          result.logicalBytes += size
          result.manifestBytesEstimate += 192 + Buffer.byteLength(path.relative(resolved, full), 'utf8')
        } catch (error) {
          result.readable = false
          result.error ||= error.message || 'A data file could not be inspected.'
        }
      }
    }
  }
  walk(resolved)
  return result
}

function inspectStorage({
  installerSizeBytes = null,
  dataRoot = '',
  downloadRoot = '',
  backupRoot = '',
  installRoot = '',
} = {}) {
  const data = measureDirectory(dataRoot)
  const installerSize = Number(installerSizeBytes)
  const knownInstallerSize = Number.isSafeInteger(installerSize) && installerSize > 0
  const dataDestination = inspectFreeSpace(dataRoot)
  const backupDestination = inspectFreeSpace(backupRoot)
  const downloadDestination = inspectFreeSpace(downloadRoot)
  const installDestination = installRoot ? inspectFreeSpace(installRoot) : null
  const demands = new Map()

  const addDemand = (destination, bytes, reason) => {
    if (!destination?.available || !destination.volume) return
    const demand = demands.get(destination.volume) || { volume: destination.volume, availableBytes: destination.availableBytes, requiredBytes: 0, reasons: [] }
    demand.requiredBytes += bytes
    demand.reasons.push({ reason, bytes })
    demands.set(destination.volume, demand)
  }

  // The backup directory is an additional full copy. A per-file manifest is
  // also written; 128 bytes per record plus a small header covers its JSON.
  const manifestBytes = data.manifestBytesEstimate + 512
  const backupBytes = data.logicalBytes + manifestBytes
  const restoreMarginBytes = data.exists ? Math.max(1024 * 1024, data.fileCount * 4096) : 0
  const restoreBytes = data.logicalBytes + restoreMarginBytes
  if (data.exists) addDemand(dataDestination, restoreBytes, 'post-install verified data-restore staging')
  addDemand(backupDestination, backupBytes, 'verified user-data backup and manifest')
  if (knownInstallerSize) addDemand(downloadDestination, installerSize, 'installer download')
  if (knownInstallerSize && installDestination) {
    addDemand(installDestination, Math.max(MIN_INSTALL_TARGET_BYTES, installerSize * 4), 'conservative installation and extraction capacity')
  }

  const volumes = [...demands.values()].map((volume) => ({
    ...volume,
    sufficient: volume.availableBytes >= volume.requiredBytes,
    freeAfterReservedBytes: volume.availableBytes - volume.requiredBytes,
  }))
  const insufficient = volumes.filter((volume) => !volume.sufficient)
  const cannotInspect = [
    ...(data.exists ? [dataDestination] : []), backupDestination, downloadDestination,
    ...(knownInstallerSize && installDestination ? [installDestination] : []),
  ].some((destination) => !destination.available)
  const readyToProceed = data.readable && knownInstallerSize && !cannotInspect && insufficient.length === 0
  const installRootInfo = installDestination ? {
    ...installDestination,
    minimumFreeBytes: knownInstallerSize ? Math.max(MIN_INSTALL_TARGET_BYTES, installerSize * 4) : MIN_INSTALL_TARGET_BYTES,
    note: 'The installation volume must have at least 1 GiB or four times the verified installer size available, whichever is larger.',
  } : null

  let status = 'ready'
  if (!knownInstallerSize) status = 'not-assessed'
  else if (!data.readable || cannotInspect || insufficient.length) status = 'blocked'
  return {
    status,
    readyToProceed,
    installerBytes: knownInstallerSize ? installerSize : null,
    backup: { ...data, manifestBytesEstimate: manifestBytes, requiredBytes: backupBytes, destination: backupDestination },
    restore: { requiredBytes: restoreBytes, destination: dataDestination },
    download: { requiredBytes: knownInstallerSize ? installerSize : null, destination: downloadDestination },
    volumes,
    insufficientVolumes: insufficient,
    installTarget: installRootInfo,
    notes: [
      'The installation-volume threshold is a conservative reserve because GitHub metadata does not publish the unpacked install size.',
      `Detected hardware must meet ${MIN_LOGICAL_PROCESSORS} logical processors and ${MIN_MEMORY_BYTES / (1024 ** 3)} GB RAM.`,
    ],
  }
}

function assessCompatibility(options = {}) {
  const system = options.systemInformation || readSystemInformation()
  const runtime = runtimeIntegrity(options.runtime || {})
  const blockers = []
  const selection = options.selection || classifyWindowsProduct(system)
  const windows = system.available ? {
    caption: system.osCaption || '',
    version: system.osVersion || '',
    build: Number(system.osBuild) || 0,
    architecture: system.osArchitecture || '',
    systemType: system.systemType || '',
    productType: Number(system.productType) || 0,
    operatingSystemSKU: Number(system.operatingSystemSKU) || 0,
    editionID: system.editionID || '',
    edition: selection.edition,
  } : null
  const powerShellVersion = system.powershellVersion || ''
  const isSupportedWindowsName = selection.id === 'desktop' && /Windows\s+(10|11)\b/i.test(windows?.caption || '')
  const isSupportedCylinderClient = selection.id === 'cylinder-client'
    && /Windows\s+(10|11)\b/i.test(windows?.caption || '')
    && ['Home', 'Pro', 'Enterprise', 'Education'].includes(selection.edition)
  const isServerProductType = [2, 3].includes(Number(windows?.productType)) || /iot/i.test(`${system.editionID || ''} ${system.productName || ''} ${windows?.caption || ''}`)
  const isCompatibleBuild = Boolean(windows && Number(windows.build) >= MIN_WINDOWS_10_BUILD)
  const reportsNativeX64 = String(windows?.systemType || '').trim().toLowerCase() === 'x64-based pc'
  const corroboratesNativeX64 = Number(system.processorArchitecture) === 9
    && process.arch === 'x64'
    && /^(?:64-bit|x64|amd64)$/i.test(String(windows?.architecture || '').trim())
  const isNativeX64 = reportsNativeX64 || corroboratesNativeX64
  const hasPowerShell = system.available && versionAtLeast(powerShellVersion, POWERSHELL_MINIMUM)
  const hasSignatureCommand = Boolean(system.authenticodeAvailable)
  const logicalProcessors = Number(system.logicalProcessors) || 0
  const memoryBytes = Number(system.memoryBytes) || 0

  if (!system.available) blockers.push(`Required Windows PowerShell check failed: ${system.error}`)
  else {
    if (selection.id === 'cylinder-server') {
      if (!isServerProductType) blockers.push('OverHead Cylinder Server requires Windows Server or Windows IoT, but the system product type could not be verified.')
      if (!isCompatibleBuild) blockers.push(`OverHead Cylinder Server requires Windows Server 2019/Windows IoT build ${MIN_WINDOWS_10_BUILD} or later.`)
    } else if (selection.id === 'cylinder-client') {
      if (!isSupportedCylinderClient || Number(windows?.productType) !== 1) blockers.push('OverHead Cylinder Client requires a Windows 10/11 Home, Pro, Enterprise, or Education workstation.')
      if (!isCompatibleBuild) blockers.push('OverHead Cylinder Client requires Windows build ' + MIN_WINDOWS_10_BUILD + ' or later.')
    } else if (selection.id !== 'desktop') blockers.push(selection.reason)
    else if (!isSupportedWindowsName || !['Home', 'Pro', 'Enterprise'].includes(selection.edition) || !isCompatibleBuild) blockers.push(`OverHead Desktop requires a Windows 10/11 Home, Pro, or Enterprise workstation at build ${MIN_WINDOWS_10_BUILD} or later.`)
    if (!isNativeX64 || process.arch !== 'x64') blockers.push('This release requires native x64 Windows hardware; ARM64 and emulated x64 systems are not enabled for this build.')
    if (logicalProcessors < MIN_LOGICAL_PROCESSORS) blockers.push(`This release requires at least ${MIN_LOGICAL_PROCESSORS} logical CPU processors.`)
    if (memoryBytes < MIN_MEMORY_BYTES) blockers.push(`This release requires at least ${MIN_MEMORY_BYTES / (1024 ** 3)} GB of physical memory.`)
    if (!hasPowerShell) blockers.push(`Windows PowerShell ${POWERSHELL_MINIMUM} or later is required.`)
    if (!hasSignatureCommand) blockers.push('The Windows PowerShell Get-AuthenticodeSignature command is missing.')
  }
  if (runtime.missing.length) blockers.push(`Package integrity failure: missing ${runtime.missing.join(', ')}.`)

  const storage = inspectStorage(options.storage || {})
  if (storage.status === 'blocked') {
    if (!storage.backup.readable) blockers.push(`The user-data folder could not be fully inspected: ${storage.backup.error || 'unknown read error'}`)
    if (!storage.backup.destination.available) blockers.push('Free space could not be checked for the backup destination.')
    if (!storage.download.destination.available) blockers.push('Free space could not be checked for the installer download destination.')
    if (storage.backup.exists && !storage.restore.destination.available) blockers.push('Free space could not be checked for post-install data-restore staging.')
    if (storage.installTarget && !storage.installTarget.available) blockers.push('Free space could not be checked for the installation destination.')
    for (const volume of storage.insufficientVolumes) blockers.push(`Insufficient space on ${volume.volume}: ${volume.requiredBytes} bytes required for the installer, verified backup, and installation reserve, ${volume.availableBytes} available.`)
  }

  const softwareSupported = blockers.every((blocker) => !blocker.startsWith('Insufficient space') && !blocker.startsWith('Free space could not') && !blocker.startsWith('The user-data folder could not'))
  const supported = softwareSupported && storage.status !== 'blocked'
  const status = !softwareSupported ? (runtime.missing.length ? 'package-integrity-failure' : 'unsupported')
    : storage.status === 'blocked' ? 'storage-blocked'
      : storage.status === 'not-assessed' ? 'preflight-required' : 'ready'

  return {
    selection,
    supported,
    status,
    ready: supported && storage.readyToProceed,
    blockers,
    detected: {
      os: windows,
      powershell: system.available ? {
        available: true,
        version: powerShellVersion,
        minimum: POWERSHELL_MINIMUM,
        authenticodeAvailable: hasSignatureCommand,
        cimAvailable: Boolean(system.cimAvailable),
      } : { available: false, error: system.error || '' },
      runtime,
      hardware: {
        processArchitecture: process.arch,
        nativeSystemType: windows?.systemType || '',
        processorName: system.processorName || '',
        processorArchitectureCode: Number.isFinite(Number(system.processorArchitecture)) ? Number(system.processorArchitecture) : null,
        logicalProcessors: Number(system.logicalProcessors) || null,
        cores: Number(system.cores) || null,
        memoryBytes: Number(system.memoryBytes) || null,
        minimumLogicalProcessors: MIN_LOGICAL_PROCESSORS,
        minimumMemoryBytes: MIN_MEMORY_BYTES,
        minimumRequirements: `${MIN_LOGICAL_PROCESSORS} logical processors, ${MIN_MEMORY_BYTES / (1024 ** 3)} GB RAM, native x64 hardware, and sufficient installer/backup/install space.`,
      },
    },
    storage,
  }
}

module.exports = {
  MIN_WINDOWS_10_BUILD,
  POWERSHELL_MINIMUM,
  MIN_LOGICAL_PROCESSORS,
  MIN_MEMORY_BYTES,
  MIN_INSTALL_TARGET_BYTES,
  assessCompatibility,
  classifyWindowsProduct,
  inspectStorage,
  readSystemInformation,
  runtimeIntegrity,
}
