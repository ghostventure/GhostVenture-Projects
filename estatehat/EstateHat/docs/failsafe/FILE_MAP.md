# EstateHat File Map

## Web app

- `src/main.jsx`: app bootstrap, auth resolution, service worker registration
- `src/backend.js`: shared profile/data helpers and special account mapping
- `src/estatehat-platform-alpha.jsx`: main application UI and workflows
- `src/AuthScreen.jsx`: sign-in and sign-up flows
- `src/authBranding.js`: EstateHat auth copy and branding template selection
- `src/firebase.js`: Firebase app/auth/firestore initialization

## Hosting

- `firebase.json`: Firebase Hosting configuration
- `.firebaserc`: Firebase project alias

## PWA/performance

- `public/sw.js`: service worker
- `public/manifest.webmanifest`: web manifest
- `public/icons/estatehat-icon.svg`: app icon
- `index.html`: root document metadata and safe-area viewport setup

## iOS

- `capacitor.config.json`: Capacitor config
- `ios/App/App.xcodeproj`: Xcode project
- `ios/App/App/AppDelegate.swift`: native app delegate

## Windows desktop

- `electron/main.cjs`: Electron main process
- `electron/preload.cjs`: Electron preload bridge

## Documentation

- `docs/PROJECT_STATUS.md`
- `docs/OPERATIONS.md`
- `docs/PROFILE_SECURITY_NOTES.md`
- `docs/IOS_SETUP.md`
- `docs/WINDOWS_SETUP.md`
- `docs/failsafe/ROLLBACK_NOTES.md`
