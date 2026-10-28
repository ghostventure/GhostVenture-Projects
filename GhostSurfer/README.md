# Ghost Surfer

Ghost Surfer is a Windows browser built with Python, PySide6, and Qt WebEngine. The current published browser package is **0.2.0**. DuckDuckGo is the default home page; the address-bar search provider is a separate setting and defaults to Startpage.

## What it includes

- **Browsing and tabs:** bookmarks, history, named sessions, split view, tab groups, reader view, PDF export, page search, and a searchable shortcuts guide.
- **Privacy controls:** first-party cookie choices, third-party cookie blocking, permission restrictions, tracker alerts, and an alert-only IP tripwire for a limited set of known lookup services.
- **Compatibility and accessibility:** temporary per-site JavaScript and image overrides, interface text sizing, high contrast, reduced browser-scroll motion, and visible keyboard focus.
- **Recovery and cleanup:** crash-session recovery, browser-data backup and restore, profile reset with an optional bookmark keep, cookie/cache controls, and download management.
- **Updates:** the browser can check GitHub releases for a compatible Ghost Surfer package, verify and stage it, and ask before applying an update that closes and restarts the browser.

Privacy controls reduce some tracking; they do not make a direct connection anonymous. The IP tripwire recognizes only a limited set of client-side lookup patterns and allows recognized requests to continue. A site can still observe the network address used for its connection.

For operating instructions, see the [Ghost Surfer User Guide](docs/USER_GUIDE.md). For installation requirements and the manager workflow, see [GS Install Manager](install-manager/README.md).

## Install the current package

Download the current Windows ZIP from the [Ghost Surfer website](https://ghost-surfer-browser.web.app/), extract it, and run **GS Install Manager.exe**. Choose **Install**. The manager checks the Windows version, architecture, package files, disk space, and Microsoft Visual C++ runtime. It asks for consent before downloading a required Visual C++ component. Ghost Surfer installs per user under `%LOCALAPPDATA%\Programs\Ghost Surfer`; browser profile data stays under `%LOCALAPPDATA%\GhostSurferLocal\Ghost Surfer`.

The manager's **Update** action uses the bundled or selected local package. The browser's **General → Ghost Surfer Updates** control checks GitHub releases. A release must contain a compatible Ghost Surfer package with verifiable integrity data before the browser will stage it.

## Project layout

- `ghost_surfer.py` and the adjacent Python modules: browser application.
- `install-manager/`: GS Install Manager source, build spec, legal pages, and distribution script.
- `installer/`: per-user installer and uninstaller scripts used by package workflows.
- `docs/USER_GUIDE.md`: browser controls and user-facing workflows.
- `site/`: Firebase-hosted website, policies, release notes, checksum manifest, and download links.
- `scripts/prepare-release-assets.ps1`: downloads the release ZIPs listed in the script from the live site and verifies their SHA-256 values before a Hosting deploy.

Large release ZIPs are hosted on Firebase rather than stored in Git. Their published names and hashes are listed in `site/downloads/SHA256SUMS.txt` and in the release-asset preparation script.

## Build from source

Build on Windows x64 with Python 3.13. The pinned dependencies are in `requirements.txt`:

```powershell
py -3 -m pip install -r requirements.txt
```

Build Ghost Surfer from this directory:

```powershell
py -3 -m PyInstaller --clean -y "Ghost Surfer.spec" --distpath dist --workpath build
```

Build GS Install Manager from its directory:

```powershell
Set-Location install-manager
py -3 -m PyInstaller --clean -y "GS Install Manager.spec" --distpath dist --workpath build
Set-Location ..
```

After both builds succeed, create the one-click distribution folder:

```powershell
./install-manager/Build-Distribution.ps1
```

The manager executable and browser payload are separate build outputs. The distribution script puts them together; it does not build or publish the Firebase download ZIP.

## Firebase website

The Firebase project and Hosting site are `ghost-surfer-browser`. Install Node.js, then from this directory run:

```powershell
npm ci
npx firebase login
npm run deploy
```

The deploy script first downloads the release assets listed in `scripts/prepare-release-assets.ps1` from the live site and verifies each SHA-256. It then publishes `site/` to Firebase Hosting. A new installer must be packaged, uploaded, and added to the checksum and asset lists as part of the release process; the preparation script only downloads and verifies already-published assets.
