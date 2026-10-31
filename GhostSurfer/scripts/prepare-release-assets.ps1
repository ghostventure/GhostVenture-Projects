param(
    [string]$HostingRoot = 'https://ghost-surfer-browser.web.app/downloads'
)

$ErrorActionPreference = 'Stop'
$downloadDirectory = Join-Path $PSScriptRoot '..\site\downloads'
New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null

$assets = @(
    @{
        Name = 'Ghost-Surfer-Setup-Windows-2026-10-17.zip'
        Sha256 = 'D76640BACDD20D2F8E3BB13FD8638970F683962A95B9920118BF2A3E0D851595'
    },
    @{
        Name = 'Ghost-Surfer-Setup-Windows-2026-10-27.zip'
        Sha256 = 'B2E813A48451D18157A899F4220BC7742832CBB2EB229738E98392EA55C37896'
    },
    @{
        Name = 'Ghost-Surfer-Setup-Windows-2026-10-31.zip'
        Sha256 = 'EB1A7542F382855CA50E671078D489EFAEAD913FCBED865E298C995B4EBC3EB3'
    },
    @{
        Name = 'Ghost-Surfer-Browser-Windows.zip'
        Sha256 = '149617247AE51B518BB750AB4772577E74BBAEE34D9A9BB7FB6C52BF5A69B0FD'
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
    $assetUrl = "$($HostingRoot.TrimEnd('/'))/$($asset.Name)"
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
