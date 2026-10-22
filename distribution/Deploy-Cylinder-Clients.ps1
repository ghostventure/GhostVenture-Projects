[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
  [string[]]$ComputerName,
  [string]$StageTo,
  [switch]$Install,
  [PSCredential]$Credential
)

$ErrorActionPreference = 'Stop'
$installerName = 'OverHead-Cylinder-Client-Setup.exe'
$installerPath = Join-Path $PSScriptRoot $installerName
$checksumPath = Join-Path $PSScriptRoot 'SHA256SUMS.txt'

if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf) -or -not (Test-Path -LiteralPath $checksumPath -PathType Leaf)) {
  throw "The client package is incomplete. Keep $installerName and SHA256SUMS.txt beside this script."
}

$checksumLine = Get-Content -LiteralPath $checksumPath | Where-Object { $_ -match "\s+$([regex]::Escape($installerName))$" } | Select-Object -First 1
if (-not $checksumLine -or $checksumLine -notmatch '^([A-Fa-f0-9]{64})\s+') {
  throw "SHA256SUMS.txt has no valid digest for $installerName."
}
$expectedHash = $Matches[1].ToUpperInvariant()
$actualHash = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash.ToUpperInvariant()
if ($actualHash -ne $expectedHash) { throw 'The client installer failed its SHA-256 integrity check.' }
$signature = Get-AuthenticodeSignature -LiteralPath $installerPath
if ($signature.Status -ne 'Valid') { throw "The client installer does not have a valid trusted Authenticode signature ($($signature.Status))." }

$actions = 0
if ($StageTo) {
  if ($PSCmdlet.ShouldProcess($StageTo, 'Stage the verified Cylinder workstation client package')) {
    New-Item -ItemType Directory -Path $StageTo -Force | Out-Null
    Copy-Item -LiteralPath $installerPath -Destination (Join-Path $StageTo $installerName) -Force
    Copy-Item -LiteralPath $checksumPath -Destination (Join-Path $StageTo 'SHA256SUMS.txt') -Force
    Copy-Item -LiteralPath $PSCommandPath -Destination (Join-Path $StageTo 'Deploy-Cylinder-Clients.ps1') -Force
    $actions += 1
    Write-Output "Staged verified client package to $StageTo"
  }
}

if ($ComputerName) {
  if (-not $Install) { throw 'Use -Install with -ComputerName to run a remote workstation installation.' }
  foreach ($computer in $ComputerName) {
    if (-not $computer.Trim()) { continue }
    if (-not $PSCmdlet.ShouldProcess($computer, 'Install the verified Cylinder client over PowerShell remoting')) { continue }
    $sessionArgs = @{ ComputerName = $computer; ErrorAction = 'Stop' }
    if ($Credential) { $sessionArgs.Credential = $Credential }
    $session = New-PSSession @sessionArgs
    try {
      $os = Invoke-Command -Session $session -ScriptBlock {
        $productName = (Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -Name ProductName).ProductName
        if ($productName -notmatch 'Windows 10|Windows 11' -or $productName -match 'Windows Server|IoT') {
          throw "Cylinder Client deployment supports Windows 10/11 workstations only; detected '$productName'."
        }
        $productName
      }
      Write-Output "Validated ${computer}: $os"
      $remotePath = Invoke-Command -Session $session -ScriptBlock {
        $path = Join-Path $env:ProgramData 'OverHeadCylinder\ClientDeployment'
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        $path
      }
      $remoteInstaller = Join-Path ([string]$remotePath) $installerName
      Copy-Item -LiteralPath $installerPath -Destination $remoteInstaller -ToSession $session -Force
      $result = Invoke-Command -Session $session -ScriptBlock {
        param($path, $expected)
        $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToUpperInvariant()
        if ($actual -ne $expected) { throw 'The copied Cylinder installer failed its SHA-256 check.' }
        $signature = Get-AuthenticodeSignature -LiteralPath $path
        if ($signature.Status -ne 'Valid') { throw "The copied client installer has no valid trusted signature ($($signature.Status))." }
        $process = Start-Process -FilePath $path -ArgumentList @('/S') -Wait -PassThru
        if ($process.ExitCode -ne 0) { throw "The client installer returned exit code $($process.ExitCode)." }
        [pscustomobject]@{ ComputerName = $env:COMPUTERNAME; ExitCode = $process.ExitCode }
      } -ArgumentList $remoteInstaller, $expectedHash
      $actions += 1
      Write-Output "Installed Cylinder Client on $($result.ComputerName)"
    } finally {
      Remove-PSSession -Session $session -ErrorAction SilentlyContinue
    }
  }
}

if (-not $StageTo -and -not $ComputerName) {
  throw 'Specify -StageTo \\server\share to prepare a VPN distribution share, or -ComputerName HOST -Install to deploy through configured PowerShell remoting.'
}

Write-Output "Completed $actions distribution action(s). The client uses the workspace Rank, department, device, and policy controls in Cylinder."
