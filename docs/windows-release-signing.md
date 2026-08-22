# Windows release signing

OverHead is configured to require Authenticode signing for a production Windows installer. A release build must fail instead of creating an unsigned installer.

Before running `npm run dist:win`, configure a valid Black Lion Studios code-signing certificate and the corresponding Windows signing tool in the release environment. Verify the finished installer with:

```powershell
Get-AuthenticodeSignature .\release\OverHead-Setup-<version>-win-x64.exe
```

Only distribute the installer when the signature status is `Valid` and the signer is the expected publisher. A self-signed certificate is not commercially trusted and is not an acceptable substitute.
