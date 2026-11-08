# Ghost Surfer

This folder is the consolidated Ghost Surfer project: the Windows browser app, native iOS and macOS browser clients, installer scripts, and the Firebase Hosting website.

The desktop app is built with Python, PySide6, and QtWebEngine. It includes a labeled navigation rail, consistent rounded controls, a scrollable control center, download actions, theme and zoom controls, and a single privacy notice for cookie choices and Ghost Guard alerts. See the [user guide](docs/USER_GUIDE.md) for browser controls, shortcuts, and consent behavior.

## Project contents

- `ghost_surfer.py` and `Ghost Surfer.spec`: Windows browser application and PyInstaller build definition.
- `requirements.txt`: Python dependencies for building the desktop app.
- `installer/`: per-user PowerShell installer and uninstaller scripts.
- `site/`: public website, policies, icons, release notes, and checksum manifest.
- `firebase.json` and `.firebaserc`: Firebase Hosting configuration for `ghost-surfer-browser`.
- `scripts/prepare-release-assets.ps1`: downloads and verifies public ZIP assets before deployment.
- `iOS/`: native SwiftUI and WebKit app for iPhone and iPad.
- `macOS/`: native SwiftUI and WebKit app for Mac, reusing the iOS browser state and privacy rules.
- `installer/macos/`: universal `.pkg` build script and installer notes.

Release installers stay on Firebase Hosting rather than being committed to GitHub. Their names and hashes are recorded in `site/downloads/SHA256SUMS.txt`.

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

To create the universal Mac package, run `installer/macos/build-installer.sh` from this folder. It creates `installer/macos/Ghost-Surfer-macOS-0.2.3.pkg`, a Sparkle update ZIP, and a signed appcast under `site/`. The app bundle is ad-hoc signed; the installer itself has no Apple Developer ID signature, so macOS may ask for one-time approval. The site documents that step. Existing 0.1.0 installs need a one-time reinstall before in-app updates are available.

## Deploy the website

Install Node.js, then run these commands from this folder:

```powershell
npm ci
npx firebase login
npm run deploy
```

The deploy command downloads the current Windows release ZIP from GitHub and checks its SHA-256 before Firebase CLI publishes the website. The Mac `.pkg` and Windows ZIP are hosted as Firebase download assets; checksums are listed in `site/downloads/SHA256SUMS.txt`.
