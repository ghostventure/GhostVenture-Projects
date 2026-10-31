param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$')]
    [string]$Version
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourcePath = Join-Path $projectRoot 'ghost_surfer.py'
$versionLine = Select-String -LiteralPath $sourcePath -Pattern '^APP_VERSION\s*=\s*"(?<version>[^"]+)"\s*$'
if (-not $versionLine -or $versionLine.Matches[0].Groups['version'].Value -ne $Version) {
    throw "Requested package version $Version does not match APP_VERSION in ghost_surfer.py. Update the app version and release notes first."
}

Push-Location $projectRoot
try {
    & py -3 -m PyInstaller --clean -y 'Ghost Surfer.spec' --distpath dist --workpath build
    if ($LASTEXITCODE -ne 0) { throw "Ghost Surfer build failed with exit code $LASTEXITCODE." }

    Push-Location (Join-Path $projectRoot 'install-manager')
    try {
        & py -3 -m PyInstaller --clean -y 'GS Install Manager.spec' --distpath dist --workpath build
        if ($LASTEXITCODE -ne 0) { throw "GS Install Manager build failed with exit code $LASTEXITCODE." }
    }
    finally {
        Pop-Location
    }

    & (Join-Path $projectRoot 'install-manager\Build-Distribution.ps1')
    if ($LASTEXITCODE -ne 0) { throw "Distribution assembly failed with exit code $LASTEXITCODE." }
}
finally {
    Pop-Location
}

$managerRoot = Join-Path $projectRoot 'install-manager'
$distributionRoot = Join-Path $managerRoot 'distribution\GS Install Manager for Ghost Surfer'
$packageName = "Ghost-Surfer-Setup-Windows-$Version.zip"
$packagePath = Join-Path $projectRoot "site\downloads\$packageName"
$checksumPath = Join-Path $projectRoot 'site\downloads\SHA256SUMS.txt'

if (-not (Test-Path -LiteralPath (Join-Path $distributionRoot 'GS Install Manager.exe') -PathType Leaf) -or
    -not (Test-Path -LiteralPath (Join-Path $distributionRoot 'Ghost Surfer\Ghost Surfer.exe') -PathType Leaf)) {
    throw 'The assembled distribution is missing the manager or Ghost Surfer executable.'
}
if (Test-Path -LiteralPath $packagePath) {
    throw "Refusing to replace an existing release package: $packagePath"
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($packagePath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    $root = [IO.Path]::GetFullPath($distributionRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    foreach ($file in Get-ChildItem -LiteralPath $distributionRoot -File -Recurse) {
        $relativeName = $file.FullName.Substring($root.Length).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive,
            $file.FullName,
            $relativeName,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
    foreach ($scriptName in @('Install-GhostSurfer.ps1', 'Uninstall-GhostSurfer.ps1')) {
        $scriptPath = Join-Path $projectRoot "installer\$scriptName"
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive,
            $scriptPath,
            $scriptName,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
}
finally {
    $archive.Dispose()
}

$packageHash = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash
$existingLines = if (Test-Path -LiteralPath $checksumPath -PathType Leaf) {
    [IO.File]::ReadAllLines($checksumPath)
} else {
    @()
}
if ($existingLines | Where-Object { $_ -match "\s+$([regex]::Escape($packageName))$" }) {
    [IO.File]::Delete($packagePath)
    throw "The checksum manifest already contains $packageName; choose a new release version."
}

$updatedLines = @($existingLines | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
$updatedLines += "$packageHash  $packageName"
$temporaryManifest = "$checksumPath.tmp"
[IO.File]::WriteAllLines($temporaryManifest, $updatedLines, [Text.UTF8Encoding]::new($false))
Move-Item -LiteralPath $temporaryManifest -Destination $checksumPath -Force

Write-Output "Package: $packagePath"
Write-Output "SHA-256: $packageHash"
Write-Output 'Package includes the app, install manager, and updater install/uninstall scripts.'
Write-Output 'Next: update the website download link and release notes, then run npm run deploy.'
