# GS Install Manager

GS Install Manager installs, updates from a local package, launches, and uninstalls Ghost Surfer for the current Windows user. It uses the Ghost Surfer logo, allows one running manager instance per user, and leaves browser profile data in place when the app is updated or removed.

## For users

### Install

1. Download and extract the current Ghost Surfer package from the [Firebase website](https://ghost-surfer-browser.web.app/).
2. Run **GS Install Manager.exe** from the extracted folder.
3. Review the bundled Legal & Consent information and accept the Terms/License to continue on first launch. The manager displays the consent dialog again when its legal-content version changes.
4. Select **Install**. The manager checks the app package, Windows version and architecture, disk space, install-folder access, and Visual C++ runtime before changing browser program files.

The package includes a `Ghost Surfer` folder beside the manager. The manager detects it automatically. If it cannot, select an extracted payload folder or a package ZIP in the manager.

### Update, launch, or uninstall

The manager checks whether Ghost Surfer is installed in `%LOCALAPPDATA%\Programs\Ghost Surfer` when it opens and after each operation. **Install** is available when the app is absent; **Update**, **Launch**, and **Uninstall** are available when it is present. Manager updates use the bundled or selected local package.

Ghost Surfer also has a separate GitHub release checker in **General → Ghost Surfer Updates**. That browser control looks for a compatible release package and asks before applying an update that closes and restarts the browser.

If Ghost Surfer is open during a manager install or update, the manager queues the operation and waits for the user to close the browser; it does not force-close it. A queued operation can be canceled. Program files are staged and checked before they replace the installed app.

Uninstall removes the application and its Ghost Surfer shortcuts. Bookmarks, history, website profile, and other browser data remain under `%LOCALAPPDATA%\GhostSurferLocal\Ghost Surfer`.

### Required Microsoft runtime

The x64 package supports Windows 10 version 1809 (build 17763) or newer and Windows 11. It requires the Microsoft Visual C++ v14 x64 runtime, version 14.28 or newer. If the runtime is missing or outdated, the manager asks for consent before downloading it from Microsoft's HTTPS endpoint. It verifies the download source, Microsoft Authenticode signer, and SHA-256 before requesting Windows UAC approval. Declining consent or UAC stops the install/update before Ghost Surfer's program files change.

The manager checks requirements on the computer where it runs. It does not send browser data, browsing history, or profile contents to the manager's publisher.

## Build from source

Build on Windows x64 with Python 3.13. From the `GhostSurfer` project root, install the pinned dependencies:

```powershell
py -3 -m pip install -r requirements.txt
```

Build Ghost Surfer and the manager:

```powershell
py -3 -m PyInstaller --clean -y "Ghost Surfer.spec" --distpath dist --workpath build
Push-Location install-manager
py -3 -m PyInstaller --clean -y "GS Install Manager.spec" --distpath dist --workpath build
Pop-Location
```

Then create the manager-plus-browser distribution folder:

```powershell
./install-manager/Build-Distribution.ps1
```

The output is `install-manager/distribution/GS Install Manager for Ghost Surfer/`, with `GS Install Manager.exe` beside the `Ghost Surfer` application directory. The manager executable alone does not contain the browser payload.

## Website and release assets

The current published browser package is **0.2.0** at [ghost-surfer-browser.web.app](https://ghost-surfer-browser.web.app/). Large ZIPs are hosted on Firebase Hosting rather than committed to GitHub. `site/downloads/SHA256SUMS.txt` records the published asset hashes.

From the project root, `npm run deploy` runs `scripts/prepare-release-assets.ps1` first. That script downloads the ZIPs named in its asset list from the live Hosting site and verifies their SHA-256 values; the Firebase CLI then deploys the website. This step preserves already-published packages and does not create or upload a new package. Update the release asset, checksum manifest, and preparation list together when preparing a new release.
