# Ghost Surfer for iOS

The iOS app is a native SwiftUI browser built on `WKWebView`. It carries over Ghost Surfer's private search, tabs, bookmarks, history, HTTPS upgrades, tracker protection, and a central Ghost Control panel.

## Build

Open `GhostSurfer.xcodeproj` in Xcode and run the `GhostSurfer` scheme on an iOS 17 or later simulator or device. The app uses Apple's WebKit framework and has no third-party package dependencies.

## Platform notes

- Tracker protection uses WebKit content rules for a built-in list of known advertising and analytics hosts.
- Top-level HTTP navigations are upgraded to HTTPS where a secure URL is available.
- Private tabs use a non-persistent WebKit website data store and are not written to the app's history list.
- Regular tabs use WebKit's built-in cookie and tracking protections. iOS WebKit does not expose the desktop app's per-site cookie interception controls.
- The desktop app's optional local Tor routing is not available in this iOS version.
