# FoxHub Architecture

Last updated: 2026-04-02

## Product pillars

FoxHub should be built as a communication-first platform.

- Messaging is the retention engine.
- Wallet is the transaction spine.
- Circles are the trust graph.
- Discover and mini-apps are expansion layers.

## What exists right now

The current repository is not just planning material. It already contains:

- local onboarding flow
- local and Firebase-backed repository modes
- email/password Firebase auth path
- Firestore subscription-based state restoration
- chat threads and message composer
- unread count and presence UI state
- outbound message status progression
- contacts and direct-thread creation
- circles
- wallet activity stub
- channels/broadcast surface
- moments-style feed
- discover and mini-app launcher shell
- QR-oriented identity and service shortcuts

## Current runtime architecture

### Entry path

- `src/main.jsx`
  - mounts the app
- `src/App.jsx`
  - lightweight controller for onboarding, async actions, modal state, and lazy-loading the authenticated shell
  - contains an important hook-order constraint: derived hooks must stay above the loading return
- `src/FoxHubShell.jsx`
  - authenticated workspace UI

### State path

- `src/useFoxHubStore.js`
  - the app-facing state hook
  - subscribes to repository state
  - exposes async mutation helpers for sign-in, profile updates, messages, wallet events, moments, and direct threads

### Backend path

- `src/repository.js`
  - runtime backend selector
  - lazy-loads either local or Firebase implementation
- `src/repository-local.js`
  - browser-persistence fallback using local storage
- `src/repository-firebase.js`
  - email/password auth path
  - Firestore seed creation
  - snapshot subscriptions for live state
- `src/firebase.js`
  - Firebase app, auth, and Firestore initialization

## Current Firestore layout

Current speed-first Firestore structure is scoped under `users/{uid}`:

- root user document
- `contacts`
- `circles`
- `channels`
- `walletEvents`
- `moments`
- `threads`
- `threads/{threadId}/messages`

This is intentionally simple and optimized for speed of implementation, not final scale.

## Phase 1: Core identity

- email/phone auth
- username and handle reservation
- profile documents
- trust states
- blocked users and safety controls

## Phase 2: Messaging

- direct messages
- group chat
- media attachments
- read receipts
- presence
- notifications

## Phase 3: Wallet

- internal ledger
- balances
- P2P transfers
- merchant profiles
- payout pipeline
- compliance review queues

## Phase 4: Mini-app platform

- mini-app manifest
- capability permissions
- signed launches
- embedded runtime
- billing hooks
- analytics and moderation

## Suggested early collections

- `users`
- `users/{uid}/contacts`
- `users/{uid}/circles`
- `users/{uid}/channels`
- `users/{uid}/walletEvents`
- `users/{uid}/moments`
- `users/{uid}/threads`
- `users/{uid}/threads/{threadId}/messages`

## Performance architecture

The repository now uses code-splitting:

- main entry chunk stays relatively small
- authenticated shell is lazy-loaded
- Firebase backend path is lazy-loaded only when config exists

This keeps local-mode startup lighter and prevents Firebase from inflating the initial bundle when it is not needed.

## Non-negotiable backend concerns

- abuse prevention
- moderation tooling
- audit logs
- permissions model
- rate limits
- payment-risk controls
