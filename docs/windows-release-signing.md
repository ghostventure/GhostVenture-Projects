# Windows release signing

The Windows packages currently linked from the OverHead website are unsigned, and their release pages disclose that publisher identity is not verified. This is the current early distribution stage; it is not a claim of verified publisher identity. Before a broader paid distribution, use a trusted organization-owned Authenticode certificate and verify the published package.

Before running `npm run dist:win`, configure a valid Black Lion Studios code-signing certificate and the corresponding Windows signing tool in the release environment. Verify the finished installer with:

```powershell
Get-AuthenticodeSignature .\release\OverHead-Setup-<version>-win-x64.exe
```

For a signed release, distribute the installer only when the signature status is `Valid` and the signer is the expected publisher. A self-signed certificate is not commercially trusted and is not an acceptable substitute. Keep certificate and password outside the repository. Apple signing and notarization are a separate, paid later-stage decision and are intentionally deferred for now.
