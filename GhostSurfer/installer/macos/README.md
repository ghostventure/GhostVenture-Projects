# Ghost Surfer macOS installer and updater

`build-installer.sh` builds a universal Apple silicon and Intel macOS app, creates an installer package, makes a Sparkle update ZIP, and signs `site/appcast-macos.xml` using Sparkle's `generate_appcast` tool. The default version is 0.2.0. Set `VERSION`, `OUTPUT_PACKAGE`, `DERIVED_DATA_PATH`, or `UPDATES_DIR` to customize the build.

The updater uses Sparkle 2 and the EdDSA public key embedded in `macOS/Info.plist`. The matching private key must remain in the release maintainer's macOS login Keychain. Do not export or commit that private key. `generate_appcast` must be run with access to that same key whenever the feed is changed.

The app bundle is ad-hoc signed when no `APP_SIGN_IDENTITY` is provided, which allows Sparkle's code-signature checks but is not an Apple Developer ID signature. The `.pkg` itself remains unsigned and unnotarized, so Gatekeeper may require manual approval. For normal public distribution, set `APP_SIGN_IDENTITY`, `INSTALLER_SIGN_IDENTITY`, and `NOTARY_PROFILE` to Developer ID Application, Developer ID Installer, and `notarytool` keychain profile values. Signing and notarization make first-run installation smoother.

The version 0.1.0 package has no updater. Those installs must install version 0.2.0 manually once; future appcast releases can update through Sparkle after the user opts in. The update prompt links the Privacy Policy and Terms, automatic checks are disabled until the user agrees, and users can turn automatic updates off in the app menu. Update requests do not include browsing history, bookmarks, or page contents; anonymous system profiling is disabled.
