# FoxHub Auth, Presence, And Operator Access Expansion

Date: 2026-04-03

## Summary

This note records the backend-focused pass that upgraded FoxHub beyond password-only auth and purely UI-level session state.

The emphasis in this pass was:

- stronger Firebase auth entry options
- durable presence and read-state tracking
- browser notification registration
- durable self user-record syncing
- server-owned operator-access records

## What was added

FoxHub now has working or persisted support for:

- Google sign-in
- email-link sign-in initiation
- persisted `presenceState`
- persisted `lastSeenAt`
- persisted `lastActiveAt`
- persisted `threadReadState`
- persisted `notificationSubscriptions`
- persisted `operatorAccessRecords`
- persisted self `userRecords`

## Implementation files

- `src/App.jsx`
- `src/useFoxHubStore.js`
- `src/repository.js`
- `src/repository-local.js`
- `src/repository-firebase.js`
- `src/repository-locked.js`
- `src/data.js`
- `firestore.rules`

## Functional changes

### Auth expansion

FoxHub now supports:

- email and password sign-in
- Google popup sign-in in Firebase mode
- email-link sign-in initiation in Firebase mode

The sign-in page now exposes:

- `Continue with Google`
- `Email me a sign-in link`

The sign-up page now exposes:

- `Start with Google`

Local mode falls back safely, and locked native mode rejects these actions cleanly until Firebase-backed secure mode is configured.

### Presence and read state

FoxHub now persists:

- profile `presenceState`
- `lastSeenAt`
- `lastActiveAt`
- `threadReadState`

The store updates presence on focus, blur, and visibility changes, and thread selection now records a durable read-state record instead of only clearing UI unread state.

### Browser notifications

FoxHub now tracks browser notification permission and registration through `notificationSubscriptions`.

The profile panel now includes a browser-notification action so the user can enable alerts for:

- verification events
- wallet events
- operator and review events

When permission is granted, unread FoxHub notification events can raise browser notifications while the document is not visible.

### Self user-record syncing

FoxHub now keeps a synced self-facing `userRecords` entry instead of relying only on seeded sample records.

The Firebase path writes a current user snapshot during:

- seed repair
- sign-in
- Google sign-in
- profile update
- sign-out state change

### Operator access

FoxHub now has a dedicated Firestore-backed `/operatorAccess/{uid}` document path.

This is the first server-owned access-control surface added outside the main client state document.

The current repo seeds operator-access records for platform operator emails:

- `ops@foxhub.app`
- `security@foxhub.app`
- `support@foxhub.app`

## Firestore rule changes

The Firestore profile schema moved to version `4`.

The rules now allow the added persisted state:

- `presenceState`
- `lastSeenAt`
- `lastActiveAt`
- `authMethod`
- `ratingRecords`
- `ratingModerationQueue`
- `reputationSnapshots`
- `userRecords`
- `documentVault`
- `operatorActions`
- `operatorAccessRecords`
- `notificationSubscriptions`
- `threadReadState`

The rules also now define:

- valid auth methods
- valid presence states
- `/operatorAccess/{uid}` access rules

## What is real now vs still limited

### Implemented in this repo

- Google sign-in client flow
- email-link initiation flow
- durable presence/read-state persistence
- browser notification permission registration
- server-owned operator-access documents
- synced self user-record snapshots

### Still not fully real

- phone auth
- native push delivery across iOS and Android
- backend-issued custom claims for operator role assignment
- real storage-backed media and document pipelines
- payment/provider credentials and live processor activation

## Verification performed

Verified with:

1. `npm run build`
2. headless Chromium render check against local preview
3. `npx firebase-tools deploy --only hosting,firestore --project foxhub-superapp --non-interactive`

## Deployment state

This pass was deployed to:

- `https://foxhub-superapp.web.app`

## Wrapper follow-up

After this pass, the next required wrapper step is to sync:

- Android assets
- iOS assets
- Windows desktop build artifacts
