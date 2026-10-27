$ErrorActionPreference = 'Stop'
$managerRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$projectRoot = [IO.Path]::GetFullPath((Join-Path $managerRoot '..'))
$managerExe = [IO.Path]::GetFullPath((Join-Path $managerRoot 'dist\GS Install Manager.exe'))
$appPayload = [IO.Path]::GetFullPath((Join-Path $projectRoot 'dist\Ghost Surfer'))
$distributionRoot = [IO.Path]::GetFullPath((Join-Path $managerRoot 'distribution\GS Install Manager for Ghost Surfer'))
$distributedApp = [IO.Path]::GetFullPath((Join-Path $distributionRoot 'Ghost Surfer'))

if ($managerExe -ne (Join-Path $managerRoot 'dist\GS Install Manager.exe')) { throw 'Unexpected manager executable path.' }
if ($appPayload -ne (Join-Path $projectRoot 'dist\Ghost Surfer')) { throw 'Unexpected Ghost Surfer payload path.' }
if ($distributedApp -ne (Join-Path $distributionRoot 'Ghost Surfer')) { throw 'Unexpected distribution payload path.' }
if (-not (Test-Path -LiteralPath $managerExe -PathType Leaf)) { throw 'Build GS Install Manager before packaging the distribution.' }
if (-not (Test-Path -LiteralPath (Join-Path $appPayload 'Ghost Surfer.exe') -PathType Leaf)) { throw 'Build Ghost Surfer before packaging the distribution.' }
if (-not (Test-Path -LiteralPath (Join-Path $appPayload '_internal') -PathType Container)) { throw 'Ghost Surfer WebEngine runtime payload is incomplete.' }

New-Item -ItemType Directory -Path $distributionRoot -Force | Out-Null
Copy-Item -LiteralPath $managerExe -Destination $distributionRoot -Force
if (Test-Path -LiteralPath $distributedApp) {
    Remove-Item -LiteralPath $distributedApp -Recurse -Force
}
Copy-Item -LiteralPath $appPayload -Destination $distributionRoot -Recurse -Force
Write-Output "Distribution created at: $distributionRoot"
