# Ghost Surfer on Linux

## Install from the website

Open <https://ghost-surfer-browser.web.app/> on a supported Linux computer.
The site detects the OS family and architecture, checks the manager catalog
entry and confirms its same-origin archive is present, then enables the Linux
manager download. Browser detection does not inspect the Linux distribution;
the manager does that after download.

The current manager is for x86_64 Linux with glibc. Extract the downloaded
archive and run the manager as your normal desktop user:

```bash
tar -xzf ghost-surfer-manager-linux-x86_64.tar.gz
./ghost-surfer-manager
```

The manager reads `/etc/os-release` (or `/usr/lib/os-release`) to identify the
distribution ID, name, version, and derivative family. It also checks the
architecture and glibc, retrieves the live release catalog over HTTPS, selects
a matching release, verifies the app archive's SHA-256, and starts the app's
per-user installer. It does not require `sudo`.

The manager adds a reusable `ghost-surfer-manager` command under
`~/.local/bin/` and stores itself under `~/.local/opt/ghost-surfer-manager/`.
The app is installed under `~/.local/opt/ghost-surfer/`.

## Manager commands

Run the installed command with one of these actions:

```text
ghost-surfer-manager status
ghost-surfer-manager plan
ghost-surfer-manager update
ghost-surfer-manager reinstall
ghost-surfer-manager launch
ghost-surfer-manager uninstall
```

Running `ghost-surfer-manager` without an action starts installation. Browser
profile data is kept when uninstalling. To remove it too, place the option
before the action:

```bash
ghost-surfer-manager --remove-profile uninstall
```

## Compatibility

Ghost Surfer 0.2.6 is currently verified on Kali Linux with glibc 2.43. Other
glibc distributions are not yet verified: the manager reports the fallback
compatibility warning and stops unless the user opts in explicitly:

```bash
ghost-surfer-manager --allow-unverified install
```

That option acknowledges the warning; it does not establish compatibility.
Additional distributions may share a verified target group after their
runtime compatibility has been confirmed. Alpine/musl, ARM, and 32-bit systems
are not covered by the current Linux build.

## Build the manager

From the repository root, build the standalone, statically linked x86_64 Linux
manager with Go:

```bash
cd manager/linux
GO111MODULE=off go test ./...
GO111MODULE=off CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o ghost-surfer-manager .
```

The site's Linux manager bundle is
`site/downloads/managers/linux/ghost-surfer-manager-linux-x86_64.tar.gz`. Its
SHA-256 and readiness state are recorded in
`site/downloads/installer-manifest.json`. Recalculate the checksum and update
the manifest whenever the bundle changes.
