# Ghost Surfer macOS installer and updater

`build-installer.sh` builds a universal Apple silicon and Intel macOS app, verifies its code signature and architecture, creates an installer package and Sparkle update ZIP, signs `site/appcast-macos.xml`, then verifies the feed, archive, and release notes before finishing. The default version is 0.2.4. Set `VERSION`, `OUTPUT_PACKAGE`, `DERIVED_DATA_PATH`, or `UPDATES_DIR` to customize the build.

The updater uses Sparkle 2 and the EdDSA public key embedded in `macOS/Info.plist`. The matching private key must remain in the release maintainer's macOS login Keychain. Do not export or commit that private key. `generate_appcast` must be run with access to that same key whenever the feed is changed.

The app bundle is ad-hoc signed when no `APP_SIGN_IDENTITY` is provided, which allows Sparkle's code-signature checks but does not identify an Apple developer. The `.pkg` itself has no Apple Developer ID signature, so macOS may ask the user to approve it once. For Developer ID distribution, set `APP_SIGN_IDENTITY`, `INSTALLER_SIGN_IDENTITY`, and `NOTARY_PROFILE` to the corresponding Apple Developer credentials.

The version 0.1.0 package has no updater. Those installs must install version 0.2.4 manually once; future appcast releases can update through Sparkle after the user opts in. The update prompt links the Privacy Policy and Terms, automatic checks are disabled until the user agrees, and users can turn automatic updates off in the app menu. Update requests do not include browsing history, bookmarks, or page contents; anonymous system profiling is disabled. The Ghost Surfer app icon is built into the app bundle and appears in the Dock, Finder, and app switcher.
