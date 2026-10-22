const GITHUB_RELEASES_API_URL = 'https://api.github.com/repos/ghostventure/GhostVenture-Projects/releases?per_page=100'
const GITHUB_RELEASE_DOWNLOAD_BASE = 'https://github.com/ghostventure/GhostVenture-Projects/releases/download'

function isCompatibleRelease(release, deploymentMode = 'desktop') {
  if (!release || release.draft || release.prerelease || !Array.isArray(release.assets)) return false
  const assetNames = new Set(release.assets.map((asset) => asset?.name).filter(Boolean))
  const installerPrefix = deploymentMode === 'cylinder-client'
    ? 'OverHead-Cylinder-Client-Setup-'
    : deploymentMode === 'cylinder' ? 'OverHead-Cylinder-Setup-' : 'OverHead-Setup-'
  return Boolean(release.tag_name) && assetNames.has('latest.yml') && [...assetNames].some((name) =>
    name.startsWith(installerPrefix) && name.endsWith('-win-x64.exe'))
}

function latestCompatibleRelease(releases, deploymentMode = 'desktop') {
  if (!Array.isArray(releases)) return null
  return releases
    .filter((release) => isCompatibleRelease(release, deploymentMode))
    .sort((a, b) => Date.parse(b.published_at || '') - Date.parse(a.published_at || ''))[0] || null
}

function releaseFeedUrl(release) {
  if (!release?.tag_name) return null
  return `${GITHUB_RELEASE_DOWNLOAD_BASE}/${encodeURIComponent(release.tag_name)}`
}

function releaseVersion(release) {
  const tag = release?.tag_name || ''
  const match = tag.match(/(?:^|[^0-9])v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:$|[^0-9])/)
  return match ? match[1] : tag
}

function classifyReleaseUpdate(installedVersion, release) {
  const availableVersion = releaseVersion(release)
  const installed = String(installedVersion || '').match(/^(\d+)\.(\d+)\.(\d+)/)
  const available = String(availableVersion || '').match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!installed || !available) return { availableVersion, newer: false, kind: 'unknown' }
  const current = installed.slice(1).map(Number)
  const next = available.slice(1).map(Number)
  const newer = next[0] > current[0] || (next[0] === current[0] &&
    (next[1] > current[1] || (next[1] === current[1] && next[2] > current[2])))
  return {
    installedVersion: installedVersion || '',
    availableVersion,
    newer,
    kind: newer && next[0] !== current[0] ? 'major' : newer ? 'incremental' : 'current',
  }
}

function releaseInstaller(release, deploymentMode = 'desktop') {
  const prefix = deploymentMode === 'cylinder-client'
    ? 'OverHead-Cylinder-Client-Setup-'
    : deploymentMode === 'cylinder' ? 'OverHead-Cylinder-Setup-' : 'OverHead-Setup-'
  const asset = release?.assets?.find((item) => item?.name?.startsWith(prefix) && item.name.endsWith('-win-x64.exe'))
  if (!asset?.browser_download_url) return null
  try {
    const url = new URL(asset.browser_download_url)
    return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : null
  } catch { return null }
}

module.exports = {
  GITHUB_RELEASES_API_URL,
  isCompatibleRelease,
  latestCompatibleRelease,
  releaseFeedUrl,
  releaseVersion,
  classifyReleaseUpdate,
  releaseInstaller,
}
