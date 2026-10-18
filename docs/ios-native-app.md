# OverHead iOS native application handoff

The native app source is at `ios/OverHeadIOS`. It is a SwiftUI application package intended to open in Swift Playgrounds on iPad or Xcode on macOS. It uses Firebase's Apple SDK rather than Electron, React, or a webview.

## Shared data contract

The app intentionally consumes existing secure Firestore paths:

- `profiles/{uid}` for role/workspace identity
- `workspaces/{workspaceId}/tasks`
- `workspaces/{workspaceId}/customers`
- `workspaces/{workspaceId}/approvals`

Firestore rules remain the authority. The mobile UI does not grant additional access or bypass email-verification, workspace membership, role, or status checks.

## Security decisions

- Firebase Auth retains the authenticated session using its native supported mechanism.
- OverHead saves only the last successful email address in the iOS Keychain to prefill sign-in; it never writes a raw password.
- The screen locks on backgrounding and uses `LocalAuthentication` with device-owner authentication, allowing Face ID, Touch ID, or the device passcode.
- A missing/inactive Firestore profile signs the user out instead of opening a local-only workspace.

## Current iPhone and iPad compatibility work

- The package deployment target is iOS 17. That keeps the app available to devices running iOS/iPadOS 17 or newer, including current iPhone and iPad releases, while the final upload is built using the current Xcode 26 / iOS 26 SDK requirement.
- The primary SwiftUI `TabView` uses Apple's `sidebarAdaptable` style when iOS/iPadOS 18 or later is available. iPhone stays compact with a tab bar; iPad gains the platform sidebar/tab treatment and can resize through Split View and Stage Manager without a device-specific screen tree.
- Screens use system `List`, `Form`, `NavigationStack`, sheets, Dynamic Type-aware text styles, and flexible stacks rather than fixed pixel frames. Device validation must still cover large Dynamic Type, landscape iPad, Split View, Stage Manager, VoiceOver, and hardware-keyboard focus.
- The app deliberately does not request tracking permission or use the advertising identifier. Before App Store submission, generate the final Xcode privacy report, review privacy manifests embedded by Firebase packages, add an accurate app privacy manifest only for APIs the app itself uses, and complete the App Store Connect privacy label from the real account/customer data flows.

## Required owner setup

The production Firebase iOS app has been registered in `overhead-office` with bundle identifier `com.blacklion.overhead` and Firebase App ID `1:619775654054:ios:bd812a115cd4788bb4dc67`. Its bundle-specific `GoogleService-Info.plist` is in the native source package. Do not replace it with the web configuration.

Before App Store distribution, enroll the publishing Apple account, select its Team in Swift Playgrounds/Xcode, create the App Store Connect record, test against real production Firebase Authentication and Firestore rules, then submit through TestFlight. These account-controlled steps cannot be completed from this Windows checkout.

## Consumer release rule

The public iPhone build must never require a customer to install Swift Playgrounds, configure Firebase, use a bundle identifier, manage a plist, or interpret a developer error. Those are release-team steps only. The customer flow must stay: install from TestFlight/App Store, open, sign in or create a workspace, verify email once when creating an account, then work. Before public distribution, run a hands-on usability pass with people who did not build the app; record every point where they hesitate, then remove or explain it in the interface.
