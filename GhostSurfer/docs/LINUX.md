# Ghost Surfer for Linux

Ghost Surfer ships as a portable x86_64 Linux archive with the application bundle, a per-user installer, an uninstaller, and a companion command-line installation manager. The release build targets glibc 2.28 so it can run on newer glibc-based desktop distributions without Python or Qt installed. It does not require administrator access.

## Build the archive

Linux release builds must use the checked-in glibc 2.28 manylinux workflow. Building on a newer host raises the glibc floor and makes the resulting package incompatible with older distributions. The workflow is available as **Build Ghost Surfer for Linux** in GitHub Actions.

The workflow uses the PySide6 6.9.3 x86_64 wheel built for glibc 2.28 and produces a timestamped `release-linux-x86_64-<UTC timestamp>/` directory containing the archive and `SHA256SUMS.txt`. Qt 6.10 and newer Linux binary packages require glibc 2.34, so the Linux build pins a compatible Qt release separately from the Windows build.

## Install

Extract the archive, then install it for the current user:

```bash
tar -xzf GhostSurfer-Linux-x86_64.tar.gz
cd GhostSurfer-Linux-x86_64
./install-linux.sh
```

The installer places the application under `~/.local/opt/ghost-surfer`, adds an application-menu entry and icon, and starts the browser. It also installs `ghost-surfer-manager` under `~/.local/bin`. No `sudo` is needed.

The app bundle includes Python, Qt, and the browser engine, but still relies on the Linux desktop's graphics, input, audio, and certificate libraries. On minimal installs, provide the distribution's equivalents of `libX11`, `libxcb`, `libxkbcommon`, `libXrandr`, `libXdamage`, `libXcomposite`, `libXi`, `libasound`, and NSS (`libnss3`). These are standard desktop runtime libraries on mainstream Ubuntu, Debian, Fedora, and openSUSE desktop installations; minimal/server installs may need them added with the system package manager. PyInstaller also reports an OpenSSL Qt TLS backend version mismatch in the build image, so validate HTTPS on representative distros before publishing.

Use the manager to check the install, launch the browser, update from a newly extracted package, or remove the app:

```bash
ghost-surfer-manager status
ghost-surfer-manager launch
ghost-surfer-manager update /path/to/GhostSurfer-Linux-x86_64
ghost-surfer-manager uninstall
```

Close Ghost Surfer before updating or uninstalling. The manager preserves browser profile data and settings when it removes the program.

## Run from source

Install Python 3 and the dependencies in `requirements.txt`, then run:

```bash
python3 ghost_surfer.py
```

Tor routing uses a local SOCKS service on `127.0.0.1:9050` or `127.0.0.1:9150` if one is listening when Ghost Surfer starts. Linux builds use the same browser privacy controls and local profile format as the Windows app.

## Release notes

The package targets x86_64 Linux distributions using glibc 2.28 or newer. It does not cover Alpine/musl, 32-bit systems, glibc older than 2.28, or ARM builds. Those require separate Qt/WebEngine builds. The archive is built, but this release has not yet been launched and checked on representative distros; do that before publishing it as a public download. The Windows PowerShell installer and release asset preparation scripts remain Windows-specific.
