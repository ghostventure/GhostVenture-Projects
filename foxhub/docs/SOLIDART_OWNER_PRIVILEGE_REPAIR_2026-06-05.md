# Solid Art Owner Privilege Repair - 2026-06-05

## Summary

`solidartentertainment@gmail.com` is now recognized as a FoxHub founder/owner account in the app and Firestore rules.

## Account

- Owner email: `solidartentertainment@gmail.com`
- Owner UID: `43caVpuJfHaHEJdsvaGu5vKpttw1`
- Legacy owner email still supported: `founder@foxhubapp.com`

## Root Cause

The live app and Firestore rules still had several hardcoded checks for `founder@foxhubapp.com`.

That meant `solidartentertainment@gmail.com` could authenticate, but founder profile repair, operator access bootstrap, staff sync, Management routing, and operator-only Firestore writes could still hit `missing or insufficient permissions`.

## Fixes

- Added shared owner-email rules in `src/rules.js`.
- Updated Firebase repository owner/staff detection to recognize `solidartentertainment@gmail.com`.
- Allowed known owner emails to bootstrap `operatorAccess/{uid}` even before owner custom claims are present.
- Updated app routing and Management dashboard founder checks to use the shared owner-email helper.
- Updated post-login routing so authenticated owner accounts redirect to `/management` even when sign-in starts from `/landing` or `/`.
- Updated Firestore rules:
  - Added `43caVpuJfHaHEJdsvaGu5vKpttw1` as a founder UID.
  - Added `solidartentertainment@gmail.com` as a founder email.
  - Added `canManagePlatform()` so the known founder UID can perform platform management actions even without custom claims.
  - Kept `founder@foxhubapp.com` as a supported legacy owner email.
- Updated founder smoke scripts to use the configured smoke email instead of hardcoding `founder@foxhubapp.com`.

## Related Rules Drift Fixed

The current Firestore rules were also updated for newer app behavior:

- Invite status now allows `expired`.
- Invite docs now allow `expiredAt`.
- Invite docs now allow `expirationReason`.

## Verification

Run:

- `npm test`
- `npm run smoke:public`
- `npm run build`

Live Firebase verification after deploy:

- Sign in to `/management` with `solidartentertainment@gmail.com`.
- Confirm the account routes to Management.
- Confirm the app creates/repairs:
  - `users/43caVpuJfHaHEJdsvaGu5vKpttw1`
  - `operatorAccess/43caVpuJfHaHEJdsvaGu5vKpttw1`
  - `staffMembers/43caVpuJfHaHEJdsvaGu5vKpttw1`
- Confirm applicant review or invite creation no longer throws `missing or insufficient permissions`.

## Custom Claims Note

The rules now allow the known founder UID to self-repair owner access. Firebase Auth custom claims are still useful, but this repair removes the hard dependency on claims for the known solidart owner UID.
