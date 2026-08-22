$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$release = Join-Path $root 'release'
$output = Join-Path $release 'SHA256SUMS.txt'
$package = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json

if (-not (Test-Path $release)) {
  New-Item -ItemType Directory -Path $release | Out-Null
}

$installer = Get-ChildItem -Path $release -File -Filter 'OverHead-Setup-*-win-x64.exe' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($installer) {
  $sha512Hasher = [Security.Cryptography.SHA512]::Create()
  try {
    $sha512 = [Convert]::ToBase64String($sha512Hasher.ComputeHash([IO.File]::ReadAllBytes($installer.FullName)))
  } finally {
    $sha512Hasher.Dispose()
  }
  $latest = @(
    "version: $($package.version)"
    "files:"
    "  - url: $($installer.Name)"
    "    sha512: $sha512"
    "    size: $($installer.Length)"
    "path: $($installer.Name)"
    "sha512: $sha512"
    "releaseDate: '$((Get-Date).ToUniversalTime().ToString('o'))'"
  )
  $latest | Set-Content -LiteralPath (Join-Path $release 'latest.yml') -Encoding ASCII
}

$files = Get-ChildItem -Path $release -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like '*.exe' -or $_.Name -like '*.zip' -or $_.Name -like '*.blockmap' -or $_.Name -eq 'latest.yml' }
$lines = foreach ($file in $files) {
  $hash = Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256
  "$($hash.Hash)  $($file.Name)"
}

$lines | Set-Content -LiteralPath $output -Encoding ASCII
Write-Output "Wrote $output"
