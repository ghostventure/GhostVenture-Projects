# Management Dashboard and Founder Logon - 2026-05-31

## Summary

FoxHub now has a founder-level manager logon path for the consolidated Management dashboard. For current live URLs and the latest deploy timestamp, use `docs/CURRENT_HANDOFF_2026-05-31.md`.

## Installed

- Added a founder manager username at `founder@foxhubapp.com`.
- Added password verification for that local static-hosting sign-in path using a SHA-256 hash comparison.
- Kept the literal password out of source and docs.
- Added a founder management profile seed with:
  - founder role
  - priority access
  - manager and staff access flags
  - active onboarding state
  - founder management access note
- Added operator-access state enrichment for the founder account:
  - owner role
  - active state
  - full owner scopes for management, members, verification, moderation, billing, documents, notifications, settings, security, and operators
  - high-trust session registration
- Updated post-login behavior so the founder manager account lands on the consolidated Management dashboard first.
- Enriched the Management dashboard with a founder profile card, access state, location, and scope chips.

## Live Behavior

The Management button on the sign-in page still routes staff toward the Management dashboard after authentication. The founder manager account also lands there directly after sign-in.

## Files Changed

- `src/repository-local.js`
  - founder manager local sign-in credential path
  - founder profile seed
- `src/useFoxHubStore.js`
  - founder manager user record enrichment
  - operator-access record insertion
  - high-trust session and security notification copy
- `src/App.jsx`
  - founder manager post-login tab routing to Management
- `src/FoxHubShell.jsx`
  - founder profile card in the consolidated Management dashboard
- `src/styles.css`
  - founder profile and management scope card styles

## Verification

Completed before handoff:

- `npm test`
- `npm run smoke:public`
- `npm run deploy:hosting`

Current live verification details are consolidated in `docs/CURRENT_HANDOFF_2026-05-31.md`.

## Production Note

This credential path applies to the current static-hosting local fallback mode. If FoxHub switches the public build to Firebase-backed auth, create the same manager account in Firebase Authentication and grant server-authoritative operator claims or Firestore-backed role records before relying on it for production staff access.

Update 2026-06-01: Live Hosting now uses the Firebase-backed runtime. The founder manager email is provisioned in Firebase Auth, password verification was confirmed through Firebase Identity Toolkit, the account has owner custom claims with full platform scopes, and existing founder operator records self-upgrade to owner/full scopes.

Update 2026-06-02: Firestore rules now include a founder UID fallback for the owner account so founder sign-in can initialize the missing Firestore user profile/subtree and operator-access document. `scripts/founder-repository-smoke.mjs` verifies the full Firebase repository sign-in path for the founder account.
