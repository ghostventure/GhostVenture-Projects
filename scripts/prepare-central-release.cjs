// Build the Desktop, Cylinder Server, and optional Cylinder Client packages.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const AdmZip = require('adm-zip')

const root = path.resolve(__dirname, '..')
const packageJson = require('../package.json')
const releaseRoot = path.join(root, 'release', 'current')
const targets = [
  {
    name: 'desktop',
    version: packageJson.version,
    executable: 'OverHead.exe',
    installer: `OverHead-Setup-${packageJson.version}-win-x64.exe`,
    zip: `OverHead-Desktop-${packageJson.version}-win-x64.zip`,
    feed: 'latest.yml',
    args: [],
  },
  {
    name: 'cylinder-client',
    version: packageJson.version,
    executable: 'OverHead-Cylinder-Client.exe',
    installer: `OverHead-Cylinder-Client-Setup-${packageJson.version}-win-x64.exe`,
    zip: `OverHead-Cylinder-Client-${packageJson.version}-win-x64.zip`,
    feed: 'latest.yml',
    args: [
      '--config.extraMetadata.main=electron-cylinder-client-main.cjs',
      '--config.productName=OverHead-Cylinder-Client',
      '--config.appId=com.blacklion.overhead.cylinder.client',
      '--config.win.artifactName=OverHead-Cylinder-Client-Setup-${version}-win-x64.${ext}',
      '--config.nsis.shortcutName=OverHead-Cylinder-Client',
    ],
  },
  {
    name: 'cylinder',
    version: packageJson.version,
    executable: 'OverHead-Cylinder.exe',
    installer: `OverHead-Cylinder-Setup-${packageJson.version}-win-x64.exe`,
    zip: `OverHead-Cylinder-${packageJson.version}-win-x64.zip`,
    feed: 'latest.yml',
    args: [
      '--config.extraMetadata.main=electron-server-main.cjs',
      '--config.productName=OverHead-Cylinder',
      '--config.appId=com.blacklion.overhead.cylinder',
      '--config.win.artifactName=OverHead-Cylinder-Setup-${version}-win-x64.${ext}',
      '--config.nsis.shortcutName=OverHead-Cylinder',
      '--config.nsis.include=build/cylinder-server-installer.nsh',
    ],
  },
]

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: true, shell: process.platform === 'win32' && command.toLowerCase().endsWith('.cmd') })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`)
}

function parseVersion(value, label) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value || '')) {
    throw new Error(`Set ${label} to a valid product version (for example 0.3.19).`)
  }
}

function writeUpdaterFeed(target, output) {
  const installer = path.join(output, target.installer)
  const buffer = fs.readFileSync(installer)
  const sha512 = require('node:crypto').createHash('sha512').update(buffer).digest('base64')
  const feed = [
    `version: ${target.version}`,
    'files:',
    `  - url: ${target.installer}`,
    `    sha512: ${sha512}`,
    `    size: ${buffer.length}`,
    `path: ${target.installer}`,
    `sha512: ${sha512}`,
    `releaseDate: '${new Date().toISOString()}'`,
    '',
  ].join('\n')
  fs.writeFileSync(path.join(output, target.feed), feed, 'ascii')
}

function stageCylinderClientPackage(target, output) {
  const packageDirectory = path.join(root, 'build', 'cylinder-client-package')
  fs.mkdirSync(packageDirectory, { recursive: true })
  const installerName = 'OverHead-Cylinder-Client-Setup.exe'
  const installerPath = path.join(output, target.installer)
  fs.copyFileSync(installerPath, path.join(packageDirectory, installerName))
  fs.copyFileSync(path.join(root, 'distribution', 'Deploy-Cylinder-Clients.ps1'), path.join(packageDirectory, 'Deploy-Cylinder-Clients.ps1'))
  const sha256 = require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(packageDirectory, installerName))).digest('hex')
  fs.writeFileSync(path.join(packageDirectory, 'SHA256SUMS.txt'), `${sha256}  ${installerName}\n`, 'ascii')
  console.log(`Staged optional Cylinder workstation client package at ${packageDirectory}`)
}

function main() {
  parseVersion(packageJson.version, 'package.json version')
  if (process.argv.includes('--plan')) {
    console.log(JSON.stringify({ releaseRoot, targets }, null, 2))
    return
  }
  if (!process.env.OVERHEAD_EXPECTED_SIGNER) throw new Error('Set OVERHEAD_EXPECTED_SIGNER to the approved signing certificate subject before preparing a release.')
  if (!process.env.CSC_LINK && !process.env.WIN_CSC_LINK) throw new Error('Set CSC_LINK (or WIN_CSC_LINK) to the approved Windows signing certificate before preparing a release.')

  fs.mkdirSync(releaseRoot, { recursive: true })
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'])
  const builder = path.join(root, 'node_modules', 'electron-builder', 'cli.js')
  for (const target of targets) {
    if (target.name === 'cylinder') {
      const stagedPackage = path.join(root, 'build', 'cylinder-client-package')
      if (!fs.existsSync(path.join(stagedPackage, 'OverHead-Cylinder-Client-Setup.exe')) || !fs.existsSync(path.join(stagedPackage, 'SHA256SUMS.txt'))) {
        throw new Error('The signed standalone Cylinder Client package must be staged before building the Cylinder Server installer.')
      }
    }
    const output = path.join(releaseRoot, target.name)
    fs.mkdirSync(output, { recursive: true })
    run(process.execPath, [builder, '--win', 'nsis', '--x64', `--config.directories.output=${output}`, `--config.extraMetadata.version=${target.version}`, ...target.args])

    const unpacked = path.join(output, 'win-unpacked')
    const executable = path.join(unpacked, target.executable)
    if (!fs.existsSync(executable)) throw new Error(`${target.name} application payload is missing: ${executable}`)
    const archive = new AdmZip()
    const archiveFolder = target.name === 'cylinder' ? 'OverHead-Cylinder' : target.name === 'cylinder-client' ? 'OverHead-Cylinder-Client' : 'OverHead-Desktop'
    archive.addLocalFolder(unpacked, archiveFolder)
    archive.writeZip(path.join(output, target.zip))

    const installerPath = path.join(output, target.installer)
    const signature = spawnSync('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
      path.join(__dirname, 'assert-windows-installer-signature.ps1'),
      '-InstallerPath', installerPath, '-ExpectedSigner', process.env.OVERHEAD_EXPECTED_SIGNER,
    ], { encoding: 'utf8', windowsHide: true })
    if (signature.error || signature.status !== 0) throw new Error((signature.stderr || signature.stdout || signature.error?.message || `${target.name} signature check failed`).trim())
    console.log(signature.stdout.trim())

    writeUpdaterFeed(target, output)

    const checksumFiles = [target.installer, `${target.installer}.blockmap`, target.feed, target.zip]
      .filter(name => fs.existsSync(path.join(output, name)))
    const lines = checksumFiles.map(name => `${require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(output, name))).digest('hex')}  ${name}`)
    fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`, 'ascii')
    if (target.name === 'cylinder-client') stageCylinderClientPackage(target, output)
  }

  const manifest = {
    schema: 'overhead-central-release-v1',
    preparedAt: new Date().toISOString(),
    distribution: 'Firebase Hosting: overhead-office.web.app',
    targets: Object.fromEntries(targets.map(({ name, version, installer, zip, feed }) => [name, { version, installer, zip, feed, directory: name }])),
  }
  fs.writeFileSync(path.join(releaseRoot, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Prepared central release at ${releaseRoot}`)
}

try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
