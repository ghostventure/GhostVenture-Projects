# Ghost Surfer for Linux

The Linux desktop build uses the Ghost Surfer 0.2.6 browser code, including the shared privacy controls, tab and bookmark tools, download handling, extension support, data-request guard, and update interface. Linux uses a per-user install and Linux-specific update packages. Browser data stays outside the application directory during updates and removal.

## Build on Linux

This build targets x86_64 Linux with glibc. It does not support Alpine/musl, 32-bit systems, or ARM. It was built and smoke-checked on Kali Linux with glibc 2.43; compatibility with older distributions must be verified separately. The package includes Python and Qt WebEngine, but desktop system libraries may still be required.

Install the pinned dependencies and build the versioned archive:

```bash
python3 -m venv .venv-linux
.venv-linux/bin/python -m pip install -r requirements-linux.txt
PYTHON=.venv-linux/bin/python scripts/build-linux.sh
```

The script creates `release-linux-x86_64-<UTC timestamp>/` with a self-contained PyInstaller app directory, per-user installer and manager, `release.json`, the `.tar.gz` archive, and `SHA256SUMS.txt`. The archive includes Python, Qt, and Qt WebEngine. Desktop system graphics, input, audio, and certificate libraries are still required; minimal installations may need their distribution's `libX11`, `libxcb`, `libxkbcommon`, XRandR/XDamage/XComposite/Xi, ALSA, and NSS libraries.

## Install and manage

Extract the archive, then install as your regular user:

```bash
tar -xzf GhostSurfer-Linux-x86_64-v0.2.6.tar.gz
cd GhostSurfer-Linux-x86_64
./install-linux.sh
```

The installer places the browser in `~/.local/opt/ghost-surfer`, adds a desktop entry and icon, and installs `ghost-surfer-manager` in `~/.local/bin`. It does not need `sudo`. The installation is replaced as a managed per-user bundle; browser data is stored separately and preserved.

```bash
ghost-surfer-manager status
ghost-surfer-manager launch
ghost-surfer-manager update /path/to/extracted/GhostSurfer-Linux-x86_64
ghost-surfer-manager uninstall
```

Close the browser before a manual update or removal. The installer refuses to overwrite an unmanaged directory or a running app.

## Automatic updates

Linux builds check GitHub releases at startup by default. They accept only newer stable Linux release assets named `GhostSurfer-Linux-x86_64-v<version>.tar.gz`. Before staging an update, Ghost Surfer verifies GitHub's SHA-256 asset digest or a matching entry in the release checksum manifest, then validates the archive paths and package metadata. Downloads and application of an update both require user confirmation. The updater installs into the managed per-user directory and preserves the browser profile.

Browser state and backup files are written atomically with owner-only file permissions. A random per-user key stored beside the browser state as `.browser-data-integrity-key` authenticates the state file so edits are detected; existing state from older builds is re-sealed on first launch. By default the key is under `~/.local/share/GhostSurferLocal/Ghost Surfer/` (or the corresponding `$XDG_DATA_HOME` path). The key and profile directory must remain owned by the current account. This can detect accidental or casual edits, but it cannot stop the same account, root, malware running as that account, or a compromised update publisher from replacing the app or its key.

The v0.2.6 Linux archive is published with this source build. An installed 0.2.6 browser can only update after a newer stable release includes a matching Linux archive and `SHA256SUMS.txt`; the manifest must list the exact archive filename and digest. SHA-256 detects corruption and mismatched assets; it is not a publisher signature.

## Runtime limits

The package architecture is x86_64 and its glibc compatibility is bounded by the build host and PySide6 wheel. ARM, 32-bit Linux, musl, and older glibc distributions need separate builds. HTTPS behavior and the bundled Qt TLS backend should be checked on each distribution before claiming broad compatibility.
