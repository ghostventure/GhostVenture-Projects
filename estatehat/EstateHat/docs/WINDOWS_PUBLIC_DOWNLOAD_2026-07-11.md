# Windows Public Download

Date: 2026-07-11

## Public Download URLs

- Primary Windows installer ZIP: `https://estatehat.web.app/downloads/EstateHat-Windows-Installer.zip`
- Advanced unpacked desktop bundle ZIP: `https://estatehat.web.app/downloads/EstateHat-Windows-Desktop.zip`
- SHA-256 verification file: `https://estatehat.web.app/downloads/SHA256SUMS.txt`
- Website sign-in fallback: landing-page users who do not want to download the ZIP can use the adjacent `Sign In On Website` button.

## Primary Package

The primary public Windows download is a ZIP containing the installer EXE:

- File: `public/downloads/EstateHat-Windows-Installer.zip`
- Contents: `EstateHat-Setup-1.0.0.exe`
- Source EXE: `release/EstateHat-Setup-1.0.0.exe`
- ZIP SHA-256: `a7c966eda2e34e85828fa88d519b6c7f4c70365f59ad0a5d8a44ef8940997a02`
- EXE SHA-256: `f8ffa9601abecdb4c5a43f9b565f9d195c2179c2000b986a5e3d42b68b09312f`

This is the centerpiece Windows download shown on the landing page as `Download Windows Installer ZIP`. The landing page also shows `Sign In On Website` next to it so users can continue in the web app without downloading the desktop package.

## Secondary Package

The secondary package is for users or operators who need the unpacked Electron desktop bundle:

- File: `public/downloads/EstateHat-Windows-Desktop.zip`
- Source folder: `release/win-unpacked`
- ZIP SHA-256: `e2d61a2470062fa61abc243d9c6c8772bfb033b23f5e013c17f0d0dc5be996fb`
- Landing-page label: `Advanced Bundle ZIP`

## Deployment Notes

- `firebase.json` sets `/downloads/**` to `Cache-Control: no-cache`.
- The public landing page links directly to the installer ZIP, the website sign-in flow, the hash file, and the advanced bundle ZIP.
- `public/downloads/SHA256SUMS.txt` must be regenerated whenever either ZIP or the installer EXE changes.

## Verification

Local checks used:

```bash
unzip -l public/downloads/EstateHat-Windows-Installer.zip
cat public/downloads/SHA256SUMS.txt
npm test
npm run build
```

Live checks used:

```bash
curl -I -L https://estatehat.web.app/downloads/EstateHat-Windows-Installer.zip
curl -L https://estatehat.web.app/downloads/SHA256SUMS.txt
```

The live installer ZIP returned `200` with `content-type: application/zip` after deployment.
