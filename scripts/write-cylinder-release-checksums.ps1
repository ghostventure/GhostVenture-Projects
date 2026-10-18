$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$release = Join-Path $root 'release'
$package = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$installer = Get-ChildItem -LiteralPath $release -File -Filter "OverHead-Cylinder-Setup-$($package.version)-win-x64.exe" | Select-Object -First 1

if (-not $installer) {
  throw "Cylinder installer for version $($package.version) was not found."
}

$sha512Hasher = [Security.Cryptography.SHA512]::Create()
try {
  $sha512 = [Convert]::ToBase64String($sha512Hasher.ComputeHash([IO.File]::ReadAllBytes($installer.FullName)))
} finally {
  $sha512Hasher.Dispose()
}

$latest = @(
  "version: $($package.version)"
  'files:'
  "  - url: $($installer.Name)"
  "    sha512: $sha512"
  "    size: $($installer.Length)"
  "path: $($installer.Name)"
  "sha512: $sha512"
  "releaseDate: '$((Get-Date).ToUniversalTime().ToString('o'))'"
)
$latest | Set-Content -LiteralPath (Join-Path $release 'cylinder-latest.yml') -Encoding ASCII

$files = Get-ChildItem -LiteralPath $release -File | Where-Object {
  $_.Name -like 'OverHead-Cylinder-Setup-*.exe' -or
  $_.Name -like 'OverHead-Cylinder-Setup-*.exe.blockmap' -or
  $_.Name -like 'OverHead-Cylinder-*-win-x64.zip' -or
  $_.Name -eq 'cylinder-latest.yml'
}
$lines = foreach ($file in $files) {
  $hash = Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256
  "$($hash.Hash)  $($file.Name)"
}
$lines | Set-Content -LiteralPath (Join-Path $release 'CYLINDER-SHA256SUMS.txt') -Encoding ASCII
Write-Output "Wrote Cylinder release manifests for $($package.version)."
