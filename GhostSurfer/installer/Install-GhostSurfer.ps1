param(
    [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'Programs\Ghost Surfer'),
    [switch]$DesktopShortcut
)

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'Ghost Surfer'
$appExe = Join-Path $source 'Ghost Surfer.exe'
if (-not (Test-Path -LiteralPath $appExe -PathType Leaf)) {
    throw "The application payload was not found at '$appExe'. Extract the full installer package before running this script."
}

$installPath = [IO.Path]::GetFullPath($InstallDirectory)
$running = Get-Process -Name 'Ghost Surfer' -ErrorAction SilentlyContinue | Where-Object {
    try { [IO.Path]::GetFullPath($_.Path) -eq (Join-Path $installPath 'Ghost Surfer.exe') } catch { $false }
}
if ($running) { throw 'Close Ghost Surfer before installing or updating it.' }

New-Item -ItemType Directory -Path $installPath -Force | Out-Null
Copy-Item -Path (Join-Path $source '*') -Destination $installPath -Recurse -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Uninstall-GhostSurfer.ps1') -Destination $installPath -Force

$shell = New-Object -ComObject WScript.Shell
$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Ghost Surfer'
New-Item -ItemType Directory -Path $startMenu -Force | Out-Null
$shortcut = $shell.CreateShortcut((Join-Path $startMenu 'Ghost Surfer.lnk'))
$shortcut.TargetPath = Join-Path $installPath 'Ghost Surfer.exe'
$shortcut.WorkingDirectory = $installPath
$shortcut.Save()

if ($DesktopShortcut) {
    $shortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Ghost Surfer.lnk'))
    $shortcut.TargetPath = Join-Path $installPath 'Ghost Surfer.exe'
    $shortcut.WorkingDirectory = $installPath
    $shortcut.Save()
}

Write-Output "Installed Ghost Surfer to: $installPath"
Start-Process -FilePath (Join-Path $installPath 'Ghost Surfer.exe') -WorkingDirectory $installPath
