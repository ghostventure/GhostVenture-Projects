# Public Display Name Retention - 2026-06-06

## Change

Public Display name now saves as a durable profile field for current and future accounts.

## What Changed

- Added `displayName` to the default profile contract.
- Updated profile normalization so the visible Public Display name field writes both `name` and `displayName`.
- Updated local profile signup, sign-in repair, save, founder profile rebuilds, invite contact snapshots, and durable-profile merge logic to keep `displayName` synced to the saved public name.
- Updated Firebase profile reads/writes so `displayName` is included in managed profile fields, canonical user profiles, profile repair checks, user records, Google sign-in profiles, password signups, and profile updates.
- Hardened stale-profile behavior so an older `displayName` cannot override a newly typed Public Display name.

## Account Coverage

- Current accounts: the next profile load/save repairs missing `displayName` from the saved public `name`.
- Future accounts: member signup creates both `name` and `displayName` immediately.
- Founder/staff accounts: custom founder/staff public names remain editable and are mirrored to `displayName`.

## Verification

- `npm test`
  - 17/17 passing.
  - Regression coverage now checks saved profile name and `displayName` after sign-out/sign-in.
  - Regression coverage now checks partial profile edits preserve `displayName`.
  - Regression coverage now checks founder profile and future member signup include `displayName`.
- `npm run build`
  - Passed.
- `npm run smoke:public`
  - Passed.

## Deploy

Deploy target:

```bash
npx firebase-tools deploy --only hosting --project foxhub-superapp
```

Live URL:

```text
https://foxhub-superapp.web.app
```
