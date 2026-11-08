# Ghost Surfer for macOS

Native macOS browser client built with SwiftUI and WebKit. It shares the browser state, privacy rules, bookmarks, history, and private tab behavior with the iOS version while using a Mac window layout, sidebar, and keyboard shortcuts.

## Build and run

Open `GhostSurferMac.xcodeproj` in Xcode and run the `GhostSurferMac` scheme on macOS 14 or later. The target uses only Apple's WebKit and SwiftUI frameworks.

From the `GhostSurfer` project folder, run `./installer/macos/build-installer.sh` to create the universal installer package. The `.pkg` installs into `/Applications`; signing and notarization requirements are described in `../installer/macos/README.md`.

Keyboard shortcuts include Command-T for a new tab, Command-Shift-N for a private tab, Command-L to focus the address bar, Command-D to bookmark the current page, and Command-[ / Command-] for back and forward navigation.

## Platform notes

- Tracker protection uses WebKit content rules for a built-in list of advertising and analytics hosts.
- Top-level HTTP navigations are upgraded to HTTPS where possible.
- Private tabs use a non-persistent WebKit website data store and are excluded from history.
- macOS WebKit manages cookie behavior; it does not expose the desktop app's per-site cookie interception.
- Optional local Tor routing from the desktop app is not part of this native Mac version.
