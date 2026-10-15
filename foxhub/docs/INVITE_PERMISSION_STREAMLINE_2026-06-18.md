# Invite Permission Streamline - 2026-06-18

## Summary

FoxHub invite creation now uses one live Firestore contract for current founder accounts, future founder/staff accounts, and any signed-in account that creates its own invite document.

The live issue was a Firestore `missing or insufficient permissions` failure during invite creation for `solidartentertainment@gmail.com`. The account could sign in and had priority founder access, but the invite create rule still rejected valid new invite documents.

## What Changed

- Split invite creation validation into `validInviteCreate(inviteId)` in `firestore.rules`.
- Kept invite creation account-neutral: the rule checks signed-in ownership of the new invite document, not a hardcoded founder email, founder UID, platform-operator claim, or owner claim.
- Kept the one-active-code behavior by allowing only the creator to expire their own active or sponsor-pending invite during replacement.
- Changed previous-code expiration in `src/repository-firebase.js` to use Firestore `serverTimestamp()` for `expiresAt` and `expiredAt`, avoiding browser clock drift against server-time rules.
- Updated `scripts/founder-invite-smoke.mjs` to accept either:
  - `FOXHUB_AUTH_SMOKE_EMAIL` for one account
  - `FOXHUB_AUTH_SMOKE_EMAILS` for comma-separated multi-account verification
- Added `.env.example` placeholders for the live invite smoke variables.

## Current Live Accounts Verified

The multi-account live smoke passed for:

- `solidartentertainment@gmail.com`
- `founder@foxhubapp.com`

Final Auth export confirmed those are the only intended live Auth accounts in `foxhub-superapp` after cleanup.

## Verification

Commands run:

```bash
npm test
FOXHUB_AUTH_SMOKE_EMAILS='solidartentertainment@gmail.com,founder@foxhubapp.com' FOXHUB_AUTH_SMOKE_PASSWORD='...' npm run smoke:founder:invite
npx firebase-tools auth:export /tmp/foxhub-auth-users-final-streamline.json --project foxhub-superapp --format=json
```

Results:

- `npm test` passed.
- Multi-account live founder invite smoke passed for 2 accounts.
- Firestore rules were deployed to `foxhub-superapp`.
- Hosting had already been deployed for the matching Firebase repository change.

## Files Updated

- `firestore.rules`
  - `validInviteCreate(inviteId)`
  - account-neutral invite creation rule
- `src/repository-firebase.js`
  - server-owned previous-invite expiration timestamps
- `scripts/founder-invite-smoke.mjs`
  - single-account and comma-separated multi-account invite smoke
- `tests/local-profile-persistence.test.mjs`
  - regression coverage for account-neutral invite creation and replacement expiration
- `.env.example`
  - live smoke env placeholders

## Operational Notes

- New current/founder/staff accounts should not need a separate invite-rule patch if they create invites under their own signed-in UID.
- To add another account to recurring invite verification, append it to `FOXHUB_AUTH_SMOKE_EMAILS`.
- Keep passwords out of docs. Use environment variables for live smoke runs.
