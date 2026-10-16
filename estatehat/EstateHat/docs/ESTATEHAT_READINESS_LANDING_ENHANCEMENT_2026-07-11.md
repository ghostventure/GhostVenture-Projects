# EstateHat Readiness Landing Enhancement

Date: 2026-07-11

## Scope

Reviewed the current EstateHat Next.js source and enhanced the public landing page to better expose the newer operational work already present in the app: government account lanes, jurisdiction coverage, reputation grading, listing review, legal readiness, and featured-placement mechanics.

## Changes

- Added a public landing-page "Readiness command center" section in `src/MarketingLanding.jsx`.
- Added five user-facing readiness signals:
  - Role fit
  - Jurisdiction
  - Trust record
  - Review path
  - Desktop software
- Added compact badges for US-51 baseline, government lanes, profile reputation, listing review, and the Windows app.
- Added public-facing language that the Windows desktop software is available for users who prefer an installed workspace.
- Added a direct `Download Windows Installer ZIP` link to `/downloads/EstateHat-Windows-Installer.zip`.
- Kept the unpacked desktop bundle ZIP available as an advanced secondary download at `/downloads/EstateHat-Windows-Desktop.zip`.
- Added a `Verify SHA-256` link to `/downloads/SHA256SUMS.txt` and surfaced the ZIP hash on the landing page.

## Windows Download Contract

- Primary public download: `https://estatehat.web.app/downloads/EstateHat-Windows-Installer.zip`
- Local primary file: `public/downloads/EstateHat-Windows-Installer.zip`
- Primary ZIP contents: `EstateHat-Setup-1.0.0.exe`
- Primary user-facing label: `Download Windows Installer ZIP`
- Primary installer ZIP SHA-256: `a7c966eda2e34e85828fa88d519b6c7f4c70365f59ad0a5d8a44ef8940997a02`
- Installer EXE SHA-256 retained in `public/downloads/SHA256SUMS.txt`: `f8ffa9601abecdb4c5a43f9b565f9d195c2179c2000b986a5e3d42b68b09312f`
- Secondary advanced download: `https://estatehat.web.app/downloads/EstateHat-Windows-Desktop.zip`
- Local secondary file: `public/downloads/EstateHat-Windows-Desktop.zip`
- Secondary source bundle: `release/win-unpacked`
- Secondary bundle ZIP SHA-256: `e2d61a2470062fa61abc243d9c6c8772bfb033b23f5e013c17f0d0dc5be996fb`
- Verification file: `https://estatehat.web.app/downloads/SHA256SUMS.txt`
- Download cache policy: `firebase.json` applies `Cache-Control: no-cache` to `/downloads/**`.
- Preserved the existing calm EstateHat visual style and mobile stacking behavior.
- Fixed `tests/compliance-mechanics.test.mjs` so it resolves the current repository root from `import.meta.url` instead of an old absolute path.

## Windows Download Release Steps

When replacing the Windows public package:

1. Put the installer EXE at `release/EstateHat-Setup-1.0.0.exe` or update the documented filename if the version changes.
2. Rebuild the primary ZIP:

   ```bash
   rm -f public/downloads/EstateHat-Windows-Installer.zip
   (cd release && zip -q ../public/downloads/EstateHat-Windows-Installer.zip EstateHat-Setup-1.0.0.exe)
   ```

3. If the advanced unpacked bundle changes, rebuild:

   ```bash
   rm -f public/downloads/EstateHat-Windows-Desktop.zip
   (cd release && zip -qr ../public/downloads/EstateHat-Windows-Desktop.zip win-unpacked)
   ```

4. Regenerate hashes:

   ```bash
   sha256sum public/downloads/EstateHat-Windows-Installer.zip public/downloads/EstateHat-Windows-Desktop.zip release/EstateHat-Setup-1.0.0.exe > public/downloads/SHA256SUMS.txt
   ```

5. Update `WINDOWS_INSTALLER_HASH` in `src/MarketingLanding.jsx`.
6. Run `npm test` and `npm run build`.
7. Deploy with `npm run deploy:hosting`.
8. Confirm the live download URL returns `200` with `content-type: application/zip`.

## Why

The newer EstateHat implementation already contains substantial post-login systems, but the public page was underselling them. This pass gives users and stakeholders a clearer first-screen path from the marketing promise to the actual workflow depth inside EstateHat.

## Verification

Run:

```bash
npm test
npm run build
```

The test fix is required before the compliance suite can validate this working tree reliably.

Last verified live on 2026-07-11:

- `https://estatehat.web.app/downloads/EstateHat-Windows-Installer.zip` returned `200`.
- `https://estatehat.web.app/downloads/SHA256SUMS.txt` returned the installer ZIP, advanced bundle ZIP, and raw EXE hashes.
