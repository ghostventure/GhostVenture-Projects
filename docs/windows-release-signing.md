# Windows release signing

OverHead is configured to require Authenticode signing for a production Windows installer. A release build must fail instead of creating an unsigned installer.

The root electron-builder configuration sets `build.forceCodeSigning` to `true`. Set `OVERHEAD_EXPECTED_SIGNER` to the exact signer certificate subject in the release environment. Checksum generation and Firebase publishing verify the Authenticode status and exact subject before producing or publishing update artifacts.

Before running a package command, configure a valid Black Lion Studios code-signing certificate and the corresponding Windows signing tool in the release environment. Verify an installer with:

```powershell
Get-AuthenticodeSignature .\release\current\desktop\OverHead-Setup-<version>-win-x64.exe
```

Only distribute the installer when the signature status is `Valid` and the signer is the expected publisher. A self-signed certificate is not commercially trusted and is not an acceptable substitute.

## Central release workflow

The central workspace keeps Desktop, Cylinder Server, and Cylinder Client packages together while preserving separate app IDs, user data, and update channels. All three package versions come from `package.json`.

1. Set `CSC_LINK`, `CSC_KEY_PASSWORD`, and `OVERHEAD_EXPECTED_SIGNER` using the approved organization certificate. Keep certificate files and passwords outside the repository.
2. Review the shared version in `package.json`.
3. Run `npm run release:plan` to review the versions and output paths.
4. Run `npm run release:prepare`. The signed installers, updater manifests, blockmaps, ZIPs, checksums, and release manifest go under `release/current/desktop`, `release/current/cylinder-client`, and `release/current/cylinder`.
5. Review all three installers and the generated `release/current/release-manifest.json`.
6. Run `npm run release:deploy` to verify all three signatures and publish their update feeds and current downloads in one Firebase Hosting release. Firebase Tools is found automatically when installed locally or in npm's cache; use `OVERHEAD_FIREBASE_TOOLS` to pin another installation.
7. Run `npm run release:verify` to compare the public updater feeds and downloaded installer hashes with the prepared release.

The release script preserves previous versioned ZIP URLs by redirecting them to the newest package for the same product. It does not deploy the full site or change user data. The currently installed local OverHead application is not upgraded by packaging or publishing; installation is a separate operational step.
