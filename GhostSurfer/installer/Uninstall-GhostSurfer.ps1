$ErrorActionPreference = 'Stop'
$installPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$appExe = Join-Path $installPath 'Ghost Surfer.exe'
$running = Get-Process -Name 'Ghost Surfer' -ErrorAction SilentlyContinue | Where-Object {
    try { [IO.Path]::GetFullPath($_.Path) -eq $appExe } catch { $false }
}
if ($running) { throw 'Close Ghost Surfer before uninstalling it.' }

$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Ghost Surfer'
Remove-Item -LiteralPath $startMenu -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Ghost Surfer.lnk') -Force -ErrorAction SilentlyContinue
$parent = Split-Path -Parent $installPath
$leaf = Split-Path -Leaf $installPath
$expected = Join-Path $env:LOCALAPPDATA 'Programs\Ghost Surfer'
if ([IO.Path]::GetFullPath($installPath) -ne [IO.Path]::GetFullPath($expected)) {
    throw 'Refusing to remove an installation outside the standard per-user program directory.'
}
Remove-Item -LiteralPath $installPath -Recurse -Force
Write-Output 'Ghost Surfer was removed. Browser data in LocalAppData was kept.'
