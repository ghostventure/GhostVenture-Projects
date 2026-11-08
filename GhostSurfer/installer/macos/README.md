# Ghost Surfer macOS installer

`build-installer.sh` builds a universal Apple silicon and Intel release app, then packages it as a component installer that places **Ghost Surfer.app** in `/Applications`.

Run it from the GhostSurfer project folder:

```sh
./installer/macos/build-installer.sh
```

The default output is `Ghost-Surfer-macOS-0.1.0.pkg` beside this README. Set `VERSION`, `OUTPUT_PACKAGE`, or `DERIVED_DATA_PATH` to customize the build.

For a signed, notarized public release, set `APP_SIGN_IDENTITY`, `INSTALLER_SIGN_IDENTITY`, and `NOTARY_PROFILE` to valid Apple Developer ID Application, Developer ID Installer, and `notarytool` keychain profile values. Without these identities, the build produces an unsigned local package; macOS Gatekeeper will require the user to approve it manually.
