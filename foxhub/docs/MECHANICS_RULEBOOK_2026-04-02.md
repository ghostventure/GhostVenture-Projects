# FoxHub Mechanics Rulebook

Last updated: 2026-04-02

This file expresses the current FoxHub mechanics as explicit if/then rules so future work has a stable behavioral baseline.

## Entry and access

- If Firebase env vars are absent and the app is running on web, then FoxHub uses local mode.
- If Firebase env vars are present, then FoxHub uses Firebase mode.
- If FoxHub is running inside Capacitor and Firebase env vars are absent, then FoxHub uses locked native mode and does not allow writable local mobile sign-in.
- If a user signs up or enters local mode with an invite code or sponsor handle, then access state becomes `priority`.
- If a user signs up or enters local mode without an invite code or sponsor handle, then access state becomes `waitlist`.
- If access state is `waitlist`, then onboarding does not complete authentication into the main workspace.
- If access state is not `waitlist` and profile requirements are met, then the user may complete onboarding and enter the workspace.

## Session behavior

- If a user is authenticated, then a 10-minute inactivity timer runs at the app-shell level.
- If there is user activity, then the inactivity timer resets.
- If there is no user activity for 10 minutes, then FoxHub signs the user out automatically and shows an inactivity notice.
- If a user signs out manually, then auth drafts, profile drafts, and visible profile overlays are cleared.

## Navigation

- If FoxHub opens a signed-in workspace, then `Chats` is the default landing tab.
- If the active tab changes, then the tab id is stored in session storage for the current browser session.
- If a saved item is opened, then FoxHub routes to the most relevant workspace for that item type.
- If a search scope is opened, then FoxHub routes to the matching workspace:
  - `messages` -> `Chats`
  - `people` or `channels` -> `Network`
  - everything else -> `Services`

## Chat and thread behavior

- If a thread is selected, then its unread count is cleared in the active state.
- If a direct thread already exists for a contact, then FoxHub opens that thread instead of creating a duplicate.
- If a new direct thread is created or reopened, then that contact’s relationship score is strengthened.
- If a message is sent, then FoxHub appends the message locally, advances status from `sent` to `delivered` to `seen`, and updates thread metadata in Firebase mode.
- If a user types in the chat composer, then the draft remains local to the chat workspace and does not re-render the whole app shell.

## Network behavior

- If a user posts a moment, then the post is created against the current profile identity.
- If a user types in the moment composer, then the draft remains local to the network workspace and does not re-render the whole app shell.
- If an official account is opened, then FoxHub routes to the mapped service thread in `Chats`.
- If an official account is followed or unfollowed, then FoxHub updates subscription state and keeps that state durable in Firebase mode.

## Pay behavior

- If a wallet action runs, then FoxHub records a wallet event and writes a thread-linked trace when applicable.
- If a QR pay flow runs, then FoxHub records QR history and routes payment behavior back into conversation context.
- If a utility card is selected, then FoxHub performs its mapped action:
  - `money` -> payment action
  - `scan` -> QR contact flow
  - `card` -> open profile
  - `saved` -> return to `Home`

## Services behavior

- If a mini-app launches, then FoxHub records recent usage, permission history, and service continuity.
- If a continuity item is opened, then FoxHub restores the matching mini-app context.
- If a QR mini-app flow runs, then FoxHub records scan history and routes the user into the service context.
- If service discovery is ranked, then FoxHub uses continuity, recency, thread type, and circle context to score the order.

## Profile behavior

- If a profile is normalized, then FoxHub sanitizes and stores:
  - `name`
  - `handle`
  - `city`
  - `bio`
  - `occupation`
  - `demographic`
  - access metadata
- If a profile is saved in Firebase mode, then it must match the Firestore rules schema.
- If a profile is saved in local mode, then it is persisted into browser local storage.
- If a profile is opened from the shell, then the profile modal loads the latest normalized profile state.

## Persistence behavior

- If FoxHub is in local mode, then state is persisted into browser local storage.
- If FoxHub is in Firebase mode, then the user doc persists profile data plus selected mechanics state:
  - favorites
  - saved items
  - mini-app recents
  - mini-app permissions
  - official account subscriptions
  - QR history
  - service continuity
- If contacts change in Firebase mode, then FoxHub batches those writes.
- If a new Firebase user is seeded, then FoxHub uses batched writes for initial profile and collection setup.

## Footer and shell behavior

- If the shell renders, then the `Legal`, `Company`, and `Product` footer groups render as a persistent footer section.
- If a user is authenticated, then `Sign out` is visible in the header and desktop session area, not only in mobile bottom navigation.
