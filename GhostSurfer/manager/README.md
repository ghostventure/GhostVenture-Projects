# Ghost Surfer Installation Managers

The website and platform managers share one release-routing contract:
[`site/downloads/installer-manifest.json`](../site/downloads/installer-manifest.json).
The website identifies the visitor's OS family and architecture, then offers a
manager package only when its manifest entry is ready and the same-origin
archive is present. A downloaded manager makes the detailed compatibility
decision and selects an app release from the catalog.

## Current manager packages

| Platform | Manager package | Status |
| --- | --- | --- |
| Linux x86_64 | [`ghost-surfer-manager-linux-x86_64.tar.gz`](../site/downloads/managers/linux/ghost-surfer-manager-linux-x86_64.tar.gz) | Ready; SHA-256 is in the manifest |
| Windows x86_64 | `downloads/managers/windows/ghost-surfer-manager-windows-x86_64.zip` | Awaiting platform manager upload |
| Mac, Intel x86_64 | [`Ghost-Surfer-Install-Manager-macOS-1.0.zip`](../site/downloads/managers/macos/Ghost-Surfer-Install-Manager-macOS-1.0.zip) | Ready; runs on Apple silicon through Rosetta 2 |

Do not mark an entry `ready` until its package exists at the declared path and
its SHA-256 has been checked. Managers fetch the catalog at install time; they
must not pin an app payload in the manager archive.

## Linux manager

The standalone Go manager source is in `linux/`. The compiled x86_64 binary is
bundled on the site in the Linux tar.gz manager package. Extract it and run it
as the regular desktop user, without `sudo`:

```bash
tar -xzf ghost-surfer-manager-linux-x86_64.tar.gz
./ghost-surfer-manager
```

With no action, it installs Ghost Surfer. It installs its reusable command at
`~/.local/bin/ghost-surfer-manager` and keeps its executable under
`~/.local/opt/ghost-surfer-manager`.

Supported actions:

- `install` (default), `update`, and `reinstall`
- `status`, `launch`, and `plan`
- `uninstall`, which removes the app and manager but preserves the browser
  profile; pass `--remove-profile` only when the profile should also be deleted

The manager reads `/etc/os-release` (or `/usr/lib/os-release`) as data, checks
the distro ID, version, `ID_LIKE`, architecture, and glibc version, then reads
the catalog over HTTPS. It checks the downloaded app archive against the
catalog's SHA-256 before handing it to `install-linux.sh`. It installs for the
current user and does not need administrator privileges.

Kali Linux with glibc 2.43 is the currently verified target. Other glibc
derivatives use an explicitly unverified fallback and require the user to
review the warning and opt in with `--allow-unverified`. Add distributions to
a shared verified group only after confirming their runtime compatibility.
Alpine/musl, ARM, and 32-bit systems are not supported by this manager build.

Build and check the Linux manager from `manager/linux/`:

```bash
GO111MODULE=off go test ./...
GO111MODULE=off CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o ghost-surfer-manager .
```

## Other platform managers

The catalog currently describes Windows 10 build 17763 or newer / Windows 11
on x86_64, and Mac on macOS 14 or newer for Apple silicon or Intel. The Mac
manager bundle is an Intel x86_64 app; Apple silicon users may need to install
Rosetta 2 to launch it. The Windows manager package is still awaiting upload.
The Mac app uses its native installer and optional signed Sparkle updates.
