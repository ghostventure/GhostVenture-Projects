const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const pkg = require(path.join(root, 'package.json'))
const electronVersion = require(path.join(root, 'node_modules', 'electron', 'package.json')).version
const expectedSigner = String(process.env.OVERHEAD_EXPECTED_SIGNER || '').trim()
const certificate = process.env.CSC_LINK || process.env.WIN_CSC_LINK
if (Boolean(expectedSigner) !== Boolean(certificate)) throw new Error('Configure both OVERHEAD_EXPECTED_SIGNER and CSC_LINK/WIN_CSC_LINK for signed output, or leave both unset for a local unsigned build.')
const signedBuild = Boolean(expectedSigner && certificate)
if (!signedBuild) console.warn('Building a local unsigned manager. GitHub SHA-512 checks remain enabled; do not present this package as a publisher-signed release.')

const stage = path.join(root, 'build', 'install-manager-stage')
const output = path.join(root, 'release', 'install-manager')
fs.rmSync(stage, { recursive: true, force: true })
fs.mkdirSync(stage, { recursive: true })
for (const file of ['main.cjs', 'preload.cjs', 'index.html', 'manager.css', 'manager.js', 'compatibility.cjs', 'signer-policy.json']) {
  fs.copyFileSync(path.join(root, 'installation-manager', file), path.join(stage, file))
}
fs.copyFileSync(path.join(root, 'public', 'overhead.ico'), path.join(stage, 'overhead.ico'))
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({
  name: 'overhead-install-manager',
  version: pkg.version,
  description: 'Signed installation and configuration manager for OverHead Desktop.',
  author: pkg.author,
  private: true,
  main: 'main.cjs',
  devDependencies: { electron: electronVersion },
}, null, 2))
fs.writeFileSync(path.join(stage, 'signer-policy.json'), JSON.stringify({ expectedSigner, allowUnsigned: !signedBuild }, null, 2))

const builderCli = path.join(root, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js')
const config = {
  appId: `com.blacklion.overhead.installmanager.${pkg.version.replace(/[^0-9A-Za-z.-]/g, '-')}`,
  productName: 'OverHead Install Manager',
  electronVersion,
  asar: true,
  electronFuses: {
    runAsNode: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    grantFileProtocolExtraPrivileges: false,
  },
  directories: { output },
  files: ['**/*'],
  npmRebuild: false,
  forceCodeSigning: signedBuild,
  win: {
    icon: 'overhead.ico',
    target: [{ target: 'portable', arch: ['x64'] }],
    artifactName: `OverHead-Install-Manager-${pkg.version}-win-x64.exe`,
    ...(signedBuild ? { publisherName: [expectedSigner] } : {}),
  },
}
fs.mkdirSync(output, { recursive: true })
const configPath = path.join(root, 'build', 'install-manager-builder.json')
fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
let result
try {
  result = spawnSync(process.execPath, [builderCli, '--projectDir', stage, '--win', 'portable', '--x64', '--config', configPath], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
} finally {
  fs.rmSync(configPath, { force: true })
}
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status || 1)
const managerArtifact = path.join(output, `OverHead-Install-Manager-${pkg.version}-win-x64.exe`)
if (!fs.existsSync(managerArtifact)) throw new Error(`The signed manager artifact was not created: ${managerArtifact}`)
const companionDirectory = path.join(root, 'build', 'install-manager-companion')
fs.mkdirSync(companionDirectory, { recursive: true })
fs.copyFileSync(managerArtifact, path.join(companionDirectory, 'OverHead Install Manager.exe'))
fs.writeFileSync(path.join(companionDirectory, 'publisher-policy.json'), JSON.stringify({ expectedSigner, allowUnsigned: !signedBuild }, null, 2))
console.log(`${signedBuild ? 'Publisher-signed' : 'Local unsigned'} manager package created in ${output}`)
