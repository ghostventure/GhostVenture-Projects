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

The Linux x86_64 manager bundle is built and included at its Hosting path; its
manifest checksum is set and the route is enabled. Windows and Mac remain
disabled until their platform manager bundles are built and uploaded.
Manager bundles must not include a pinned browser build; they fetch the catalog
and select a compatible release at install time.

The shared implementation in `platform_selector.py` detects the target and
chooses the newest compatible release. On Linux it reads `/etc/os-release` as
data to identify the exact distro ID, version, pretty name, and `ID_LIKE`
derivative family; it also checks architecture and libc. A release can list
multiple distro IDs or derivative families in one `compatibleTargets` group
when they share a verified runtime. Family membership alone is not considered
proof of compatibility. `release_workflow.py` loads the catalog
over HTTPS, resolves the selected app URL, downloads into a private cache, and
checks SHA-256 before returning a package path to the OS-specific install
adapter. It rejects non-HTTPS package URLs, unsafe filenames, oversized files,
and mismatched checksums. Local manifests are supported for development with
`--manifest site/downloads/installer-manifest.json --select-only`.

The manager reads
`https://ghost-surfer-browser.web.app/downloads/installer-manifest.json`.
Each app release entry supplies OS constraints, architecture, package URL, and
SHA-256. The selected manager must finish its install/update/reinstall adapter
only after `release_workflow.py` has verified the package.

## Lifecycle contract

Each platform manager must provide install, update, reinstall, and uninstall
actions. Reinstall uses the same compatibility checks and verified package
download as install. Complete uninstall removes the manager, Ghost Surfer
program files, and shortcuts. Browser profile data is kept unless the user
explicitly chooses to remove it.

## Current release routing

- Windows: Windows 10 build 17763 or newer, or Windows 11; x86_64. The package
  includes GS Install Manager and the browser payload.
- Linux: x86_64 glibc package. The manager identifies the distro derivative
  and version, then matches an explicit compatible target group. Kali Linux
  with glibc 2.43 is the verified current target; other derivatives use the
  generic fallback with a compatibility warning until grouped and verified.
- Mac: macOS 14 or newer, Apple silicon or Intel. The universal package uses
  the macOS Installer; the app's Sparkle updater manages later updates.

The selector reports an unverified Linux baseline as a warning. A platform
manager must show that warning before installation and must not silently choose
an incompatible release. If no release supports the detected system, it must
stop and explain why. The manager artifacts are not yet present in this source
checkout; the routes remain disabled until platform teams upload them.
