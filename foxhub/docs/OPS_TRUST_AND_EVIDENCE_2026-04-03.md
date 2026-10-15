# FoxHub Ops, Trust, And Evidence Expansion

Date: 2026-04-03

## Summary

This note records the post-platform-expansion work that pushed FoxHub closer to an operator-driven product instead of a surface-only prototype.

The emphasis in this pass was:

- operator workflows
- verification queue handling
- auditability
- notifications
- device-session controls
- reputation moderation
- document and evidence tracking

## What was added

FoxHub now has durable state for:

- `verificationCases`
- `auditEvents`
- `notificationEvents`
- `deviceSessions`
- `ratingRecords`
- `ratingModerationQueue`
- `reputationSnapshots`
- `documentVault`
- `operatorActions`

## Implementation files

- `src/data.js`
- `src/useFoxHubStore.js`
- `src/repository.js`
- `src/repository-local.js`
- `src/repository-firebase.js`
- `src/repository-locked.js`
- `src/App.jsx`
- `src/FoxHubShell.jsx`
- `firestore.rules`

## Functional changes

### Verification queue

FoxHub now supports:

- case creation
- case resolution
- queue ownership
- requested evidence/items
- review and follow-up states

The `Services` surface includes an `Operator queue` that can open, approve, and follow up on cases.

### Audit trail

FoxHub now records more operational events into `auditEvents`, including:

- sign-in
- sign-out
- moderation case recording
- rating changes
- rating moderation resolution
- verification case creation/resolution
- device revocation
- document uploads

### Notification center

FoxHub now creates internal notifications for:

- new sessions
- session end
- moderation outcomes
- verification updates
- rating/review events
- document uploads

### Device sessions

FoxHub now tracks device-session records and exposes revoke controls in the operator layer.

### Reputation and moderation

FoxHub now has:

- durable rating records
- moderation queue entries for low ratings
- aggregate reputation snapshots
- explicit operator resolution actions

### Document vault and evidence handling

FoxHub now has a `documentVault` and `operatorActions` layer.

That means:

- chat attachments can generate durable document-vault records
- manual evidence uploads can be added through the operator layer
- operator-side actions are logged separately from generic audit events

### Operational coupling added to existing flows

- listing reviews create verification cases
- listing flags create verification cases
- merchant payment holds create merchant verification follow-up
- cash-out holds create payout verification follow-up
- attachments can be mirrored into the document vault

## Current Services operator surface

The `Services` tab now exposes:

- `Operator queue`
- `Notification center`
- `Document vault`
- `Operator actions`
- `Audit trail`
- `Device sessions`

## What is real now vs still limited

### Implemented in this repo

- persistent operator queue state
- persistent audit/notification/device/document/action records
- operator review actions in the current shell
- runtime persistence in local and Firebase modes
- Firestore rules updated to allow the added state shape

### Still not fully real

- server-owned authorization/claims for admin-only behavior
- true binary file storage with signed retrieval
- real push delivery infrastructure
- real server-side workflow enforcement beyond client/runtime logic
- privileged back-office roles enforced outside the client

## Verification performed

Verified with:

1. `npm run build`
2. headless Chromium runtime checks against the rebuilt app
3. direct verification that `Services` rendered:
   - `Operator queue`
   - `Notification center`
   - `Document vault`
   - `Operator actions`
   - `Audit trail`
   - `Device sessions`
4. `npm run deploy:hosting`
5. `npm run sync:android`
6. `npm run sync:ios`

## Recommended next backend-grade step

1. server-trusted operator/admin roles
2. Firebase Storage-backed documents/media
3. tighter server-side enforcement for operator actions
4. real push/queue delivery instead of in-app notification state only
