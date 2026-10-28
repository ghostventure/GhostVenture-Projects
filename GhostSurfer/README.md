# Ghost Surfer

This folder is the consolidated Ghost Surfer project: the Windows and Linux browser app packaging, user guide and installers, and the Firebase Hosting website.

The desktop app is built with Python, PySide6, and QtWebEngine. It includes a labeled navigation rail, consistent rounded controls, a scrollable control center, download actions, theme and zoom controls, and a single privacy notice for cookie choices and Ghost Guard alerts. See the [user guide](docs/USER_GUIDE.md) for browser controls, shortcuts, and consent behavior.

## Project contents

- `ghost_surfer.py`: cross-platform Python/PySide6 browser application.
- `Ghost Surfer.spec`: Windows PyInstaller build definition.
- `requirements.txt`: Python dependencies for building the desktop app.
- `installer/`: Windows per-user PowerShell installer and uninstaller scripts.
- `scripts/build-linux.sh` and `scripts/*-linux.sh`: Linux archive build, per-user installer, and installation manager.
- `site/`: public website, policies, icons, release notes, and checksum manifest.
- `firebase.json` and `.firebaserc`: Firebase Hosting configuration for `ghost-surfer-browser`.
- `scripts/prepare-release-assets.ps1`: downloads and verifies public ZIP assets before deployment.

The large ZIP release assets stay on Firebase Hosting rather than being committed to GitHub. Their names and hashes are recorded in `site/downloads/SHA256SUMS.txt`.

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

The broad-compatibility Linux archive is built by the GitHub Actions workflow in a glibc 2.28 environment. Run **Build Ghost Surfer for Linux** from the Actions tab to generate the x86_64 archive and checksum. A Kali-local build has a newer glibc and must not be distributed as the cross-distro package.

See [docs/LINUX.md](docs/LINUX.md) for the compatibility floor, Linux installation manager, and release guidance. Linux dependencies are pinned in `requirements-linux.txt`; Windows continues to use `requirements.txt`.

## Deploy the website

Install Node.js, then run these commands from this folder:

```powershell
npm ci
npx firebase login
npm run deploy
```

The deploy command downloads the release ZIPs from the live site and checks their SHA-256 values before Firebase CLI publishes the website. This keeps the complete source project together without storing files larger than GitHub's individual-file size limit.
