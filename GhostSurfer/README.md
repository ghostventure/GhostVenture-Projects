# Ghost Surfer

This folder is the consolidated Ghost Surfer project: Windows and Linux desktop browsers, native iOS and macOS browser clients, installation managers, installer scripts, and the Firebase Hosting website.

The desktop app is built with Python, PySide6, and QtWebEngine. It includes a labeled navigation rail, consistent rounded controls, a scrollable control center, download actions, theme and zoom controls, and a single privacy notice for cookie choices and Ghost Guard alerts. See the [user guide](docs/USER_GUIDE.md) for browser controls, shortcuts, and consent behavior.

## Project contents

- `ghost_surfer.py` and `Ghost Surfer.spec`: Windows browser application and PyInstaller build definition.
- `manager/linux/`: compiled, standalone Go installation manager for Linux x86_64/glibc; see [the Linux guide](docs/LINUX.md).
- `manager/platform_selector.py` and `manager/release_workflow.py`: shared platform and verified-release selection logic used by manager workflows.
- `requirements.txt`: Python dependencies for building the desktop app.
- `installer/`: per-user PowerShell installer and uninstaller scripts.
- `site/`: public website, policies, icons, release notes, and checksum manifest.
- `firebase.json` and `.firebaserc`: Firebase Hosting configuration for `ghost-surfer-browser`.
- `scripts/prepare-release-assets.ps1`: downloads and verifies public ZIP assets before deployment.
- `iOS/`: native SwiftUI and WebKit app for iPhone and iPad.
- `macOS/`: native SwiftUI and WebKit app for Mac, reusing the iOS browser state and privacy rules.
- `installer/macos/`: universal `.pkg` build script and installer notes.

The website is the installation orchestrator: it detects the visitor's OS family and architecture, then offers a manager only when its package is marked ready and available. The manager checks the system in more detail and selects an app release from `site/downloads/installer-manifest.json`. The Linux x86_64 manager is live on Firebase Hosting; the Windows and Mac manager routes remain unavailable until those managers are provided. The Linux and Windows desktop releases are published on GitHub v0.2.6. The Mac app archive and its signed Sparkle updates are hosted on Firebase. App filenames and hashes are listed in `site/downloads/SHA256SUMS.txt`.

## Website presentation

The site-wide Ghost Surfer name uses a spectral serif, icy gradient, and blue-purple glow across visible page copy. This is a CSS treatment on the existing static HTML/CSS site; it does not add a framework or change the site's runtime.

## Production Homepage Recovery

The current consolidated homepage baseline and exact Firebase recovery commands are recorded in [docs/HOMEPAGE_RECOVERY_2026-11-08.md](docs/HOMEPAGE_RECOVERY_2026-11-08.md). Keep that record updated after any Hosting release so the last known-good page can be restored without reconstructing it from memory.

## Run and build the desktop app

Install Python 3.13 and build dependencies:

```powershell
py -3 -m pip install -r requirements.txt
```

Run from source:

```powershell
py -3 ghost_surfer.py
```

Build the Windows application folder:

```powershell
npm run build:desktop
```

## Native Apple apps

Open `iOS/GhostSurfer.xcodeproj` to build the iPhone and iPad app, or `macOS/GhostSurferMac.xcodeproj` to build the Mac app. Both targets use SwiftUI and WebKit and support macOS 14 or iOS 17 and later.

To create a universal Mac package, run `installer/macos/build-installer.sh` from this folder. The script currently defaults to version 0.2.0; set `VERSION` to the intended release and update the app's version metadata before creating a new public release. The hosted Mac app is version 0.2.3. The package is unsigned and unnotarized; the app bundle is ad-hoc signed. A Developer ID Application and Installer identity is recommended for Gatekeeper-friendly distribution. Existing 0.1.0 installs need a one-time reinstall before in-app updates are available.

## Linux installation and manager build

The Linux app release is an x86_64/glibc archive, built and smoke-checked on Kali Linux with glibc 2.43. The standalone Linux manager detects the distribution ID, version, `ID_LIKE` family, architecture, and glibc before selecting a release. Only Kali is currently verified; other glibc distributions receive a warning, and Alpine/musl, ARM, and 32-bit systems are unsupported. See [docs/LINUX.md](docs/LINUX.md) for installation, manager commands, compatibility, and build details.

To compile the manager from this folder:

```bash
cd manager/linux
GO111MODULE=off go test ./...
GO111MODULE=off CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o ghost-surfer-manager .
```

## Deploy the website

Use the GitHub [`codex/ghost-surfer-site-linux-20261108`](https://github.com/ghostventure/GhostVenture-Projects/tree/codex/ghost-surfer-site-linux-20261108) site source. Before deploying, restore `site/downloads/Ghost-Surfer-macOS-0.2.3.pkg` from `https://ghost-surfer-browser.web.app/downloads/Ghost-Surfer-macOS-0.2.3.pkg`; `.gitignore` excludes it. Restore the signed `appcast-macos.xml` and referenced update archives without editing their contents. Verify the installer against `site/downloads/SHA256SUMS.txt`, then deploy **Hosting only** (`firebase deploy --only hosting --project ghost-surfer-browser`).

Install Node.js, then run these commands from this folder:

```powershell
npm ci
npx firebase login
npm run deploy
```

The deployment command publishes only Firebase Hosting. The app-release hashes are listed in `site/downloads/SHA256SUMS.txt`; manager package checksums and readiness states are in `site/downloads/installer-manifest.json`. The Linux manager archive is part of the source tree. Restore other ignored Mac release files as described above before deploying.
