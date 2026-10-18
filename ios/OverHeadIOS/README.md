# OverHead for iPhone

This is the native SwiftUI companion for OverHead. It deliberately uses the existing Firebase project and the same `profiles`, `workspaces`, `customers`, `tasks`, and `approvals` contract as the web workspace. It is not a webview wrapper.

## Included native behavior

- Firebase email/password sign-in, password reset, workspace creation, and verified-email gate
- Role-aware workspace access (`Administrator`, `Manager`, and `Staff`)
- Live Firestore customer, task, and approval queues; Firebase's iOS client provides offline persistence and sync retry behavior
- Native SwiftUI tabs, sheets, form controls, accessibility labels supplied by system controls, and Dynamic Type-compatible layouts
- Adaptive navigation: compact iPhones keep a tab bar while iPads running iPadOS 18 or later can use Apple's sidebar-adaptable tab layout in full screen, Split View, or Stage Manager
- Keychain storage of only the last successful email address; no raw password persistence
- Face ID, Touch ID, or device-passcode lock whenever the app enters the background

## Open it on iPad

1. Copy the `OverHeadIOS` folder to Files or a Git repository accessible from the iPad.
2. The production Firebase iOS app is already registered as `OverHead iOS` with bundle identifier `com.blacklion.overhead`; its **GoogleService-Info.plist** is included in this source package.
3. Open the folder in Swift Playgrounds on iPad, allow the Firebase Swift Package dependency to resolve, and run it.
5. Use the same Firebase project (`overhead-office`) and ensure Email/Password Authentication remains enabled.

## App Store/TestFlight boundary

This source is ready for native build work, but an App Store binary cannot be generated or signed on Windows. Use Swift Playgrounds on iPad or Xcode on a Mac, sign in with the Apple Developer account, choose the final bundle ID/team, test on device, then archive/upload to TestFlight. App Store uploads currently need a build made with Xcode 26 or later and an iOS/iPadOS 26 SDK. Do not publish an App Store listing until the real Firebase iOS configuration, privacy manifest/label audit, and production-device sign-in test have succeeded.

## Validation checklist

- Create/sign in with a verified workspace account.
- Confirm the profile's role and workspace ID are loaded from Firestore.
- Add a task and customer; confirm the website/Desktop workspace sees the same records.
- Request an approval as Staff; approve it as a Manager/Administrator.
- Background the iPhone app, then verify device authentication is required before data returns.
- Test password reset and sign-out.
- Test compact and large devices: a current iPhone, a current iPad in portrait and landscape, iPad Split View, and Stage Manager resizing where available. Confirm Dynamic Type and VoiceOver remain usable.
- Inspect the final archived app's privacy report and the Firebase SDK privacy manifests. Complete the App Store Connect privacy label from the actual production data flows; do not claim that customer records or account email are uncollected.
