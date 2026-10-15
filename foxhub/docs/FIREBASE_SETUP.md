# FoxHub Firebase Setup

Last updated: 2026-05-27

## Purpose

This file documents how FoxHub currently expects Firebase to be configured.

Current Firebase project used for deployment:

- `foxhub-superapp`

Current Hosting URL:

- `https://foxhub-superapp.web.app`

Required Firebase CLI deploy account:

- `solidartentertainment@gmail.com`

Do not deploy FoxHub from `blacklionmediastudio@gmail.com`. That account can access other Firebase projects in this workspace, but the CLI receives `HTTP 403, The caller does not have permission` when it tries to access Hosting sites for `foxhub-superapp`.

Preferred public domain:

- `https://foxhub.com` (`FoxHub.com`)

Set `VITE_FOXHUB_PUBLIC_URL` and `NEXT_PUBLIC_FOXHUB_PUBLIC_URL` to the custom domain once Firebase Hosting and DNS are connected.

## Environment file

Create a `.env` file in the repo root using `.env.example` as the template.

Required variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Deploy account check

Before deploying, confirm the active Firebase CLI account and project access:

```bash
npx firebase-tools login:list
npx firebase-tools projects:list
npx firebase-tools hosting:sites:list --project foxhub-superapp
```

Expected account:

```text
solidartentertainment@gmail.com
```

Expected project:

```text
foxhub-superapp
```

If the CLI is logged in as the wrong account, reauthenticate in an interactive terminal:

```bash
npx firebase-tools logout
npx firebase-tools login --reauth --no-localhost
```

Then log in as `solidartentertainment@gmail.com` and rerun:

```bash
npm run deploy:hosting
```

## Current Firebase behavior

When all Firebase variables are present:

- FoxHub initializes Firebase
- the repository switches from local storage to Firestore-backed mode
- auth uses anonymous sign-in for now
- user seed documents are created under `users/{uid}` when needed
- app state is restored through Firestore subscriptions

When Firebase variables are missing:

- FoxHub stays in local mode
- state persists in browser local storage

## Current Firestore tree

Current implementation uses:

- `users/{uid}`
- `users/{uid}/contacts/{contactId}`
- `users/{uid}/circles/{circleId}`
- `users/{uid}/channels/{channelId}`
- `users/{uid}/walletEvents/{eventId}`
- `users/{uid}/moments/{momentId}`
- `users/{uid}/threads/{threadId}`
- `users/{uid}/threads/{threadId}/messages/{messageId}`

## Current auth model

Current auth is intentionally minimal but no longer anonymous-only:

- email/password sign-up
- email/password sign-in
- sign-out support
- onboarding inside the app marks the profile as `onboarded`
- no phone, OAuth, or session-linking flow yet

## Runtime note

If Firebase mode appears fine in build output but the app still fails at runtime, inspect `src/App.jsx` hook ordering before assuming Hosting or Firebase is broken. A real hook-order bug in that file caused a live runtime failure on 2026-04-02 and was fixed by moving derived hooks above the early loading return.

## Current files involved

- `src/firebase.js`
- `src/repository.js`
- `src/repository-firebase.js`
- `.env.example`
- `firestore.rules`
- `firebase.json`

## Current Firestore rules

The repo now includes a first-pass `firestore.rules` file.

Current behavior:

- authenticated users can only read and write their own `users/{uid}` document tree
- the same owner-only rule applies to contacts, circles, channels, wallet events, moments, threads, and thread messages

This is intentionally narrow and safer than leaving the database open, but it is still only a first-pass rule set.

## Next Firebase tasks

1. add proper sign-in providers
2. add Firestore security rules
3. add server timestamps consistently to all user-generated records
4. add presence and notification strategy
5. add storage integration for media
