# Ghost Surfer

Ghost Surfer is a Windows browser built with Python, PySide6, and Qt WebEngine. The current browser release is **0.2.2**. DuckDuckGo is the default home page; the address-bar search provider is a separate setting and defaults to Startpage.

## What it includes

- **Browsing and tabs:** bookmarks, history, named sessions, split view, tab groups, reader view, PDF export, page search, and a searchable shortcuts guide.
- **Privacy controls:** first-party cookie choices, third-party cookie blocking, permission restrictions, tracker alerts, and an alert-only IP tripwire for a limited set of known lookup services.
- **Compatibility and accessibility:** temporary per-site JavaScript and image overrides, interface text sizing, high contrast, reduced browser-scroll motion, and visible keyboard focus.
- **Recovery and cleanup:** crash-session recovery, browser-data backup and restore, profile reset with an optional bookmark keep, cookie/cache controls, and download management.
- **Optional Personal Data Vault:** store names, addresses, phone numbers, usernames, and passwords in a Windows account-encrypted module. It can be selected during install or toggled in Settings; credit cards are not stored.
- **Personal data consent guard:** pause common sensitive HTML form submissions, show each requested field, and send only the fields the user selects. Optional monthly RDAP registration checks provide risk signals without claiming to verify a company's identity.
- **Optional local extensions:** import Manifest V3 packages from a local ZIP or unpacked folder, review their declared permissions, then explicitly enable or remove them in **Ghost Control > Extensions**. Extension mode uses a separate persistent browser profile and is off by default; switching modes requires a restart. This is Qt WebEngine MV3 support, not Chrome Web Store or native-messaging compatibility.
- **Optional ChatGPT bridge module:** a disabled-by-default, loopback-only MCP server that exposes user-approved current-page metadata, visible text, and HTTP(S) navigation. It asks in Ghost Surfer before each request, does not access saved passwords, and does not execute arbitrary scripts. ChatGPT requires a separately configured supported Secure MCP Tunnel or HTTPS MCP host; this module alone cannot connect ChatGPT to a local browser.
- **Updates:** the browser can check GitHub releases for a compatible Ghost Surfer package, verify and stage it, and ask before applying an update that closes and restarts the browser.

Privacy controls reduce some tracking; they do not make a direct connection anonymous. The IP tripwire recognizes only a limited set of client-side lookup patterns and allows recognized requests to continue. A site can still observe the network address used for its connection.

Extensions can access or change pages covered by their declared permissions. Ghost Surfer does not automatically download extensions, and newly imported packages remain disabled until the user enables them. Extension mode stores cookies and website data under a separate local profile; disabling extension mode leaves those files and installed packages in place.

The ChatGPT bridge binds only to `127.0.0.1:8765` while enabled. It shares no page data until the user approves a specific request in Ghost Surfer. The bridge module is bundled with the browser application; adding it in ChatGPT requires a supported Secure MCP Tunnel or a trusted HTTPS MCP host, the platform authentication/API key required by that service, and ChatGPT account/workspace access for custom MCP apps. The installer does not provision a remote relay, tunnel, API key, or ChatGPT access.

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
