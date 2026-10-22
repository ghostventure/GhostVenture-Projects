param(
  [Parameter(Mandatory = $true)][string]$InstallerPath,
  [Parameter(Mandatory = $true)][string]$ExpectedSigner
)

$ErrorActionPreference = 'Stop'

if ([IO.Path]::GetExtension($InstallerPath) -ne '.exe') {
  throw 'The release artifact must be a Windows installer executable.'
}
if ([string]::IsNullOrWhiteSpace($ExpectedSigner)) {
  throw 'Set OVERHEAD_EXPECTED_SIGNER to the exact subject of the approved organization certificate.'
}
if (-not (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
  throw "Installer not found: $InstallerPath"
}

$signature = Get-AuthenticodeSignature -LiteralPath $InstallerPath
if ($signature.Status -ne 'Valid') {
  throw "Installer signature status is $($signature.Status); a valid organization signature is required."
}
if ($signature.SignerCertificate.Subject -cne $ExpectedSigner) {
  throw "Installer signer does not match the configured organization signer. Actual subject: $($signature.SignerCertificate.Subject)"
}

Write-Output "Verified signed installer: $($signature.SignerCertificate.Subject)"
