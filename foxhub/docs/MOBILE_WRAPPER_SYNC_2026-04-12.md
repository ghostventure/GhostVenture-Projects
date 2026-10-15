# FoxHub Mobile Wrapper Sync (2026-04-12)

## Request

Update the Android and iOS app wrappers after the 100-component Blueprint functionalization pass.

## Result

Completed.

The latest production web bundle, including the functional Blueprint room, was built and synced into both Capacitor native wrappers.

## iOS

Command run:

```bash
npm run sync:ios
```

Result:

- Vite production build: pass
- Web assets copied from `dist` to `ios/App/App/public`
- `ios/App/App/capacitor.config.json` regenerated
- iOS Capacitor plugins updated
- `Package.swift` written
- Capacitor sync finished successfully

## Android

Command run:

```bash
npm run sync:android
```

Result:

- Vite production build: pass
- Web assets copied from `dist` to `android/app/src/main/assets/public`
- `android/app/src/main/assets/capacitor.config.json` regenerated
- Android Capacitor plugins updated
- Capacitor sync finished successfully

## Synced web bundle

The synced bundle includes:

- `Blueprint` left-rail room
- 100 installed structural components
- per-component `Enable`, category action, and `Open` controls
- feature flag writes
- analytics events
- reliability queue entries
- category-specific runtime actions for profile, marketplace, MerchantOS, wallet, compliance, operator, mini-program, and discovery mechanics

## Not performed

Native IDE launch/build was not run in this pass.

- iOS native build/signing requires Xcode environment and signing setup.
- Android APK/AAB build was not requested in this step.

## 2026-04-17 Mobile Wrapper Refresh

Synced the latest FoxHub bundle into both mobile wrappers after the security smoke and social wording pass.

The synced mobile bundle includes:

- landing-page wording updates
- `Grow Locally`, `Goodies`, `Organizer`, and `Back Room` user-facing labels
- grouped Grow Locally screen
- friendlier sign-in, loading, footer, mini app, and helper language
- client-side operator-access change that checks the `platformOperator` custom claim
- latest built assets:
  - `index-B0uogFlE.js`
  - `FoxHubShell-CPGpm9Es.js`
  - `repository-firebase-C9f16-pV.js`
  - `repository-local-DlLd_8Wi.js`
  - `repository-locked-C6Yx48iu.js`
  - `index-WJbIIiqU.css`

### Commands Run

```bash
npm run sync:ios
npm run sync:android
```

### iOS Result

- Vite production build: pass
- Web assets copied to `ios/App/App/public`
- `ios/App/App/capacitor.config.json` regenerated
- iOS Capacitor plugins updated
- `Package.swift` written
- Push Notifications plugin detected
- Native compile was not run because `xcodebuild` is not installed in this environment

### Android Result

- Vite production build: pass
- Web assets copied to `android/app/src/main/assets/public`
- `android/app/src/main/assets/capacitor.config.json` regenerated
- Android Capacitor plugins updated
- Push Notifications plugin detected

### Android Native Build Check

Attempted:

```bash
./gradlew --no-daemon assembleDebug -Djava.net.preferIPv4Stack=true
```

Result:

- The sandboxed run could not start Gradle's local file-lock service.
- The escalated run reached Gradle but failed because the host JVM is Java 25 early access:
  - `openjdk version "25.0.3-ea"`
  - Gradle/Groovy rejected it with `Unsupported class file major version 69`.

Use a supported Android build JDK, preferably JDK 17, before running the native Android build again.

## 2026-04-17 Green Color Refresh

Synced both mobile wrappers again after changing FoxHub's solid blue accent and shading system to solid green.

The synced mobile bundle includes:

- green accent variables and selected states
- green focus, tab, button, and border treatments
- green-tinted light background and cool card shading
- latest built assets:
  - `index-B8uw8eJG.js`
  - `FoxHubShell-DOqL22oz.js`
  - `index-Qsw34WaC.css`

### Commands Run

```bash
npm run sync:ios
npm run sync:android
```

### Result

- iOS web assets copied to `ios/App/App/public`
- Android web assets copied to `android/app/src/main/assets/public`
- both wrapper index files reference the latest green bundle

## 2026-04-17 Fox-Head Logo Refresh

Synced both mobile wrappers again after replacing the visible `F` brand mark with a vector fox-head mark.

The synced mobile bundle includes:

- shared `FoxHeadMark` SVG component
- fox-head mark in the landing brand
- fox-head mark in the app header
- fox-head mark for the Fox Board navigation glyph
- latest built assets:
  - `index-DZas8ITg.js`
  - `FoxHubShell-hQOOj-3N.js`
  - `index-C0hlL3G_.css`

### Commands Run

```bash
npm run sync:ios
npm run sync:android
```

### Result

- iOS web assets copied to `ios/App/App/public`
- Android web assets copied to `android/app/src/main/assets/public`
- both wrapper index files reference the latest fox-head logo bundle

## 2026-04-17 Start Near Me Refresh

Synced both mobile wrappers again after installing the beginner-friendly `Start Near Me` path in Fox Board.

The synced mobile bundle includes:

- `What do you want to do today?` beginner path
- city entry and save behavior
- browser location permission handling with manual city fallback
- local listing, people, and tool counts
- plain next-step buttons for help, buying/selling, local people, gigs, posting needs, and business tools
- latest built assets:
  - `index-CzRbhwGh.js`
  - `FoxHubShell-99D-rYT7.js`
  - `index-DdWcRVPM.css`

### Commands Run

```bash
npm run sync:ios
npm run sync:android
```

### Result

- iOS web assets copied to `ios/App/App/public`
- Android web assets copied to `android/app/src/main/assets/public`
- both wrapper index files reference the latest Start Near Me bundle
