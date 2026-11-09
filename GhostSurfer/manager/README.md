# Ghost Surfer Installation Manager

The installer manifest at `site/downloads/installer-manifest.json` is the shared
release-routing contract. The website detects the OS family and architecture,
then routes the visitor to that platform's manager package. The manager reads
the same manifest, checks the exact OS version and architecture, then chooses
the newest compatible Ghost Surfer release.

## Manager artifact handoff

Platform teams publish manager-only bundles at these Hosting paths:

- `site/downloads/managers/windows/ghost-surfer-manager-windows-x86_64.zip`
- `site/downloads/managers/linux/ghost-surfer-manager-linux-x86_64.tar.gz`
- `site/downloads/managers/macos/ghost-surfer-manager-macos-universal.zip`

Set the matching `managerPackages` entry's `sha256` and change its status to
`ready` only after the manager bundle is built, validated, and present at that
path. The website keeps the route disabled until both conditions are met.
Manager bundles must not include a pinned browser build; they fetch the catalog
and select a compatible release at install time.

The manager reads `https://ghost-surfer-browser.web.app/downloads/installer-manifest.json`.
Each app release entry supplies its OS constraints, architecture, download URL,
and SHA-256. The manager must verify the downloaded package against that hash
before installation.

## Lifecycle contract

Each platform manager must provide install, update, reinstall, and uninstall
actions. Reinstall uses the same compatibility checks and verified package
download as install. Complete uninstall removes the manager, Ghost Surfer
program files, and shortcuts. Browser profile data is kept unless the user
explicitly chooses to remove it.

## Current release routing

- Windows: Windows 10 build 17763 or newer, or Windows 11; x86_64. The package
  includes GS Install Manager and the browser payload.
- Linux: x86_64 glibc package. Kali Linux with glibc 2.43 is the verified
  baseline; older glibc versions are unverified. The archive includes the
  per-user installer and management commands.
- Mac: macOS 14 or newer, Apple silicon or Intel. The universal package uses
  the macOS Installer; the app's Sparkle updater manages later updates.

The selector reports an unverified Linux baseline as a warning. A platform
manager must show that warning before installation and must not silently choose
an incompatible release. If no release supports the detected system, it must
stop and explain why. The manager artifacts are not yet present in this source
checkout; the routes remain disabled until platform teams upload them.
