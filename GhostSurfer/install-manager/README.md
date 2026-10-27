# GS Install Manager

GS Install Manager is a per-user Windows tool for installing, updating from a local package, launching, or removing Ghost Surfer. It does not remove Ghost Surfer's browser profile or browsing data.
The manager uses the Ghost Surfer logo and runs as a single instance per Windows user; reopening it focuses the existing window.
On first launch, one Legal & Consent dialog presents the full Terms, License, Privacy, Cookies, Acceptable Use, Refunds/Downloads, Security, Accessibility, Copyright/IP, Third-Party Notices, Compliance Overview, Support, and Legal Overview pages in nested scrollable tabs. It also includes a manager-specific install/update/uninstall and prerequisite-download disclosure. The DMCA tab reports the site's rights-holder contact details without claiming a statutory agent or legal service. The user checks the Terms/License acceptance box to continue. Acceptance is stored per user with the legal-content version and shown again when that version changes. Help / Legal reopens the same dialog.

## Build

Build on Windows x64 with Python 3.13 and the pinned project requirements (`PySide6==6.12.0`, `PyInstaller==6.21.0`). From the `GhostSurfer` project root, install them with:

```powershell
py -3 -m pip install -r requirements.txt
```

Then build the manager:

```powershell
py -3 -m PyInstaller --clean -y "GS Install Manager.spec" --distpath dist --workpath build
```

The standalone executable is `dist\GS Install Manager.exe`.

## One-click distribution

Place `GS Install Manager.exe` beside a folder named `Ghost Surfer` that contains `Ghost Surfer.exe` and `_internal`. The manager auto-detects that sibling payload at launch; manual ZIP/folder selection remains available as a fallback. To build the distribution folder, run `Build-Distribution.ps1` after building Ghost Surfer and GS Install Manager. The standalone manager executable does not embed the roughly 548 MiB app payload.

## Preflight and prerequisites

Each time the manager runs, it inspects the current PC's Windows version/build and architecture, Microsoft Visual C++ x64 runtime, install-folder writability, and available disk space. A selected Ghost Surfer ZIP or payload folder is checked for the executable, app-local VC runtime DLLs, Qt WebEngine process/modules/resources, and Qt Windows platform plugin. The x64 package requires Windows 10 1809 (build 17763) or newer, Windows 11, and the Microsoft Visual C++ v14 x64 runtime version 14.28 or newer.

Install / Update runs directly. If the VC++ runtime is missing or too old, the manager first asks once for consent to install it. After consent, it downloads the current x64 redistributable from Microsoft's official `https://aka.ms/vc14/vc_redist.x64.exe` link, requires an HTTPS redirect to a Microsoft-owned domain, verifies the Authenticode signature and signer, hashes the downloaded file and confirms the hash still matches before launch, then asks Windows for UAC approval. If consent or UAC is declined, or the download is offline or invalid, installation stops before Ghost Surfer program files are changed. When the required runtime is already present, there is no prerequisite prompt.

WebEngine files must be present in the chosen app package; the manager refuses incomplete packages instead of sourcing individual Qt binaries. The preflight runs on the computer where GS Install Manager is launched. Other computers are checked only when the manager runs on them.

## Install behavior

- Install path: `%LOCALAPPDATA%\Programs\Ghost Surfer`.
- On startup and after each operation, the manager checks that standard install path. If absent, Install is enabled and Update is disabled. If present, Update, Launch, and Uninstall are enabled and Install is disabled.
- Updates stage and validate new files before swapping program files. The previous program directory is kept until the new directory is in place.
- A running Ghost Surfer copy is detected by its full executable path. Install/Update is queued with an in-app status message; the manager waits for the user to close Ghost Surfer at a convenient time and never force-terminates it. A queued operation can be canceled.
- Start Menu shortcut is created; Desktop shortcut is optional.
- Install, Update, and Uninstall run directly when clicked. Uninstall is limited to the standard app directory and Ghost Surfer shortcuts; it does not touch `%LOCALAPPDATA%\GhostSurferLocal\Ghost Surfer`.
