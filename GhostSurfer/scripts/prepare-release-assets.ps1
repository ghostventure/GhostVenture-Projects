param(
    [string]$HostingRoot = 'https://ghost-surfer-browser.web.app/downloads'
)

$ErrorActionPreference = 'Stop'
$downloadDirectory = Join-Path $PSScriptRoot '..\site\downloads'
$checksumPath = Join-Path $downloadDirectory 'SHA256SUMS.txt'
New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null
if (-not (Test-Path -LiteralPath $checksumPath -PathType Leaf)) {
    throw "Release checksum manifest was not found: $checksumPath"
}

$assets = foreach ($line in [IO.File]::ReadAllLines($checksumPath)) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line -notmatch '^(?<hash>[A-Fa-f0-9]{64})\s+(?<name>[^\r\n]+)$') {
        throw "Invalid checksum manifest line: $line"
    }

    $name = $Matches.name.Trim()
    if ([IO.Path]::GetFileName($name) -ne $name -or $name -eq '.' -or $name -eq '..') {
        throw "Unsafe release asset name in checksum manifest: $name"
    }
    @{ Name = $name; Sha256 = $Matches.hash.ToUpperInvariant() }
}

if (-not $assets) { throw 'The release checksum manifest contains no assets.' }
if (($assets.Name | Select-Object -Unique).Count -ne $assets.Count) {
    throw 'The release checksum manifest contains duplicate asset names.'
}

foreach ($asset in $assets) {
    $destination = Join-Path $downloadDirectory $asset.Name
    if (Test-Path -LiteralPath $destination -PathType Leaf) {
        $existingHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
        if ($existingHash -eq $asset.Sha256) {
            Write-Host "Verified release asset $($asset.Name)."
            continue
        }
    }

    $temporaryPath = "$destination.download"
    $encodedName = [Uri]::EscapeDataString($asset.Name)
    $assetUrl = "$($HostingRoot.TrimEnd('/'))/$encodedName"
    & curl.exe --fail --location --silent --show-error --retry 3 --retry-delay 2 --output $temporaryPath $assetUrl
    if ($LASTEXITCODE -ne 0) {
        throw "Download failed for $($asset.Name) with curl exit code $LASTEXITCODE."
    }

    $downloadedHash = (Get-FileHash -LiteralPath $temporaryPath -Algorithm SHA256).Hash
    if ($downloadedHash -ne $asset.Sha256) {
        [System.IO.File]::Delete([IO.Path]::GetFullPath($temporaryPath))
        throw "SHA-256 verification failed for $($asset.Name)."
    }

    Move-Item -LiteralPath $temporaryPath -Destination $destination -Force
    Write-Host "Downloaded and verified $($asset.Name)."
}
