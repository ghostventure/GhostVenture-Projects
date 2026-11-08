# Ghost Surfer

This folder is the consolidated Ghost Surfer project: Windows and Linux desktop browsers, native iOS and macOS browser clients, installer scripts, and the Firebase Hosting website.

The desktop app is built with Python, PySide6, and QtWebEngine. It includes a labeled navigation rail, consistent rounded controls, a scrollable control center, download actions, theme and zoom controls, and a single privacy notice for cookie choices and Ghost Guard alerts. See the [user guide](docs/USER_GUIDE.md) for browser controls, shortcuts, and consent behavior.

## Project contents

- `ghost_surfer.py` and `Ghost Surfer.spec`: Windows browser application and PyInstaller build definition.
- `linux_updater.py`, `requirements-linux.txt`, and `scripts/*-linux.sh`: Linux release updater and x86_64 build/install workflow; see `docs/LINUX.md`.
- `requirements.txt`: Python dependencies for building the desktop app.
- `installer/`: per-user PowerShell installer and uninstaller scripts.
- `site/`: public website, policies, icons, release notes, and checksum manifest.
- `firebase.json` and `.firebaserc`: Firebase Hosting configuration for `ghost-surfer-browser`.
- `scripts/prepare-release-assets.ps1`: downloads and verifies public ZIP assets before deployment.
- `iOS/`: native SwiftUI and WebKit app for iPhone and iPad.
- `macOS/`: native SwiftUI and WebKit app for Mac, reusing the iOS browser state and privacy rules.
- `installer/macos/`: universal `.pkg` build script and installer notes.

The current native Mac app installer stays on Firebase Hosting. Windows and Linux desktop packages are published on the GitHub v0.2.6 release. Current filenames and hashes are listed in `site/downloads/SHA256SUMS.txt`.

## Website presentation

The site-wide Ghost Surfer name uses a spectral serif, icy gradient, and blue-purple glow across visible page copy. This is a CSS treatment on the existing static HTML/CSS site; it does not add a framework or change the site's runtime.

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

To create the universal Mac package, run `installer/macos/build-installer.sh` from this folder. It creates `installer/macos/Ghost-Surfer-macOS-0.2.0.pkg`, a Sparkle update ZIP, and a signed appcast under `site/`. The package is unsigned and unnotarized; the app bundle is ad-hoc signed. A Developer ID Application and Installer identity is recommended for Gatekeeper-friendly distribution. Existing 0.1.0 installs need a one-time reinstall before in-app updates are available.

## Linux build

Build on x86_64 Linux with glibc using the pinned dependencies in `requirements-linux.txt`. Run `scripts/build-linux.sh`; details and compatibility limits are in `docs/LINUX.md`. The current package was built and smoke-checked on Kali Linux with glibc 2.43. The release archive and checksum are attached to the GitHub v0.2.6 release.

## Deploy the website

Use the GitHub [`codex/ghost-surfer-site-linux-20261108`](https://github.com/ghostventure/GhostVenture-Projects/tree/codex/ghost-surfer-site-linux-20261108) site source. Before deploying, restore `site/downloads/Ghost-Surfer-macOS-0.2.3.pkg` from `https://ghost-surfer-browser.web.app/downloads/Ghost-Surfer-macOS-0.2.3.pkg`; `.gitignore` excludes it. Restore the signed `appcast-macos.xml` and referenced update archives without editing their contents. Verify the installer against `site/downloads/SHA256SUMS.txt`, then deploy **Hosting only** (`firebase deploy --only hosting --project ghost-surfer-browser`).

Install Node.js, then run these commands from this folder:

```powershell
npm ci
npx firebase login
npm run deploy
```

The deployment command publishes only Firebase Hosting. The Mac `.pkg` is hosted by Firebase, while Windows and Linux packages are hosted by GitHub. Their names and SHA-256 values are listed in `site/downloads/SHA256SUMS.txt`.
