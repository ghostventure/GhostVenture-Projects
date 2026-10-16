# EstateHat iOS Setup

The iOS app is scaffolded with Capacitor and lives in `ios/App`.

## Local workflow

Build and sync the web app into the native iOS project:

```bash
npm run sync:ios
```

This command was successfully executed during the 2026-04-11 update pass.

Open the Xcode project:

```bash
npm run open:ios
```

## Current app identifiers

- App name: `EstateHat`
- Bundle ID: `com.estatehat.app`

## What is already done

- Capacitor is installed.
- The native iOS project was generated.
- Web assets are copied from `dist/` into the native app during sync.
- The iOS shell mirrors the current web app because it loads the same built `dist/` output.
- Current mirrored features include:
  - production-mode roles and admin oversight
  - webmaster and administrator profile mapping
  - watchlist
  - saved searches
  - recent views
  - cached listing bootstrap
  - footer/legal content pages
  - PWA-safe viewport and safe-area handling

## What you still need on the Apple side

- Set your Apple Team in Xcode.
- Configure signing and provisioning.
- Add the final app icon, launch assets, and App Store metadata.
- Build to a simulator or device from Xcode.
- Submit through App Store Connect when ready.

## Important paths

- Capacitor config: `capacitor.config.json`
- Native iOS project: `ios/App`
- Xcode project: `ios/App/App.xcodeproj`
