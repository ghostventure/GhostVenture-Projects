param(
    [string]$ReleaseRoot = 'https://github.com/ghostventure/GhostVenture-Projects/releases/download/v0.2.6'
)

$ErrorActionPreference = 'Stop'
$downloadDirectory = Join-Path $PSScriptRoot '..\site\downloads'
New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null

$assets = @(
    @{
        Name = 'GhostSurfer-Setup-v0.2.6.zip'
        Sha256 = 'B6BF707DEB45ED99DB0609AEF58B4A3E0DED34C4E63DE736E99FA391FD8C0839'
    }
)

foreach ($asset in $assets) {
    $destination = Join-Path $downloadDirectory $asset.Name
    if (Test-Path -LiteralPath $destination -PathType Leaf) {
        $existingHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
        if ($existingHash -eq $asset.Sha256) {
            Write-Host "Verified existing release asset $($asset.Name)."
            continue
        }
    }

    $temporaryPath = "$destination.download"
    $assetUrl = "$($ReleaseRoot.TrimEnd('/'))/$($asset.Name)"
    & curl.exe --fail --location --silent --show-error --retry 3 --retry-delay 2 --output $temporaryPath $assetUrl
    if ($LASTEXITCODE -ne 0) {
        throw "Download failed for $($asset.Name) with curl exit code $LASTEXITCODE."
    }

    $downloadedHash = (Get-FileHash -LiteralPath $temporaryPath -Algorithm SHA256).Hash
    if ($downloadedHash -ne $asset.Sha256) {
        [System.IO.File]::Delete((Resolve-Path -LiteralPath $temporaryPath).Path)
        throw "SHA-256 verification failed for $($asset.Name)."
    }

    Move-Item -LiteralPath $temporaryPath -Destination $destination -Force
    Write-Host "Downloaded and verified $($asset.Name)."
}
