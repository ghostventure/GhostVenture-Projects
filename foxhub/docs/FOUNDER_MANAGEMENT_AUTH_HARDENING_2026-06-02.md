# Founder Management Auth Hardening - 2026-06-02

## Summary

This note records the live fixes made after founder/management testing exposed fragile auth, Firestore, waitlist, and routing behavior.

Current live manager URL:

`https://foxhub-superapp.web.app/management`

Founder email:

`founder@foxhubapp.com`

Do not store or repeat the founder password in docs.

## What Changed

### Dedicated management route

- Added `/management` as a separate page for managers, founders, and administrators.
- Added a dedicated Management sign-in panel with staff/admin/founder copy.
- Kept `/signin` as the member sign-in surface.
- Changed the normal sign-in page Management button to route to `/management`.
- Signing out while on `/management` returns the user to `/management`.
- Password recovery initiated from `/management` returns to the management recovery path.

### Management dashboard routing

- `/management` now derives the active shell tab as `staff` immediately.
- This prevents stale browser/session tab state from showing Home or another member tab after founder login.
- Dashboard actions from Management can still navigate into other app tools by leaving the management route and switching tabs.

### Founder Firebase Auth and claims

- Provisioned `founder@foxhubapp.com` in Firebase Auth.
- Confirmed password sign-in through Firebase Identity Toolkit.
- Added owner/founder custom claims:
  - `platformOperator: true`
  - `owner: true`
  - `founder: true`
  - `role: "owner"`
  - full owner/admin/management scopes

### Founder Firestore permissions

- Added Firestore rule support for platform operators to:
  - read applicant user records
  - update narrow applicant access review fields
  - create queued transactional email event records
- Added a founder UID fallback for the owner account so the founder can initialize its own user profile/subtree and operator-access document even before the first Firestore user profile exists.
- Added owner/full-scope operator access repair so older narrower staff records can self-upgrade for founder.

### Founder waitlist lockout fix

- Fixed the founder profile canonicalization path in `src/repository-firebase.js`.
- `founder@foxhubapp.com` is now forced to remain:
  - `authenticated: true`
  - `accessState: "priority"`
  - `onboarded: true`
  - `role: "founder"`
  - `waitlistEndsAt: ""`
- This prevents incomplete Firestore bootstrap data from putting founder into monthly review/waitlist behavior.

### Email/password-only auth workflow

- Removed user-facing Google and email-link sign-in controls from the app path.
- Kept the workflow as:
  - user signs up with email/password
  - invite users get immediate access
  - no-invite users go to manager review
  - approved users sign in with the same email/password
- Static/local fallback now rejects unknown sign-in emails instead of creating accounts.
- Local fallback stores password hashes for sign-up and validates hashes on sign-in.

### Password recovery

- Added `Forgot password?` on sign-in.
- Added Firebase password reset email request flow.
- Added reset-link validation via Firebase action code.
- Added new-password form with password strength and confirmation checks.
- Security-question recovery is not active yet because FoxHub does not collect security questions during sign-up.

### Applicant manager review

- No-invite applicants remain in review until Management approves, prioritizes, holds, or rejects.
- Manager decisions update access state.
- Manager decisions record applicant email notices locally and queue `transactionalEmailEvents` in Firebase mode.
- Firestore rules allow only narrow applicant access decision fields for platform-operator review writes.

### Repeatable smoke checks

Added repeatable smoke helpers:

- `npm run smoke:auth`
  - verifies Firebase rejects unknown users
  - optionally verifies a known account and founder claims when env vars are provided
- `scripts/founder-repository-smoke.mjs`
  - signs in as founder through the Firebase repository path
  - verifies founder is authenticated, priority, onboarded, founder role, and not waitlisted
- `scripts/founder-firestore-write-smoke.mjs`
  - granular Firestore write smoke used to diagnose founder permission failures
- `npm run smoke:founder:invite`
  - signs in as founder through the Firebase repository path
  - verifies the founder profile is authenticated, priority, onboarded, and founder-role
  - creates a founder-owned invite through the same live invite creation path used by the app
  - supports `FOXHUB_AUTH_SMOKE_EMAILS` for comma-separated multi-account verification

## Files Changed

- `src/App.jsx`
  - `/management` route
  - Management sign-in page
  - management-route tab forcing
  - password recovery page routing
  - auth workflow copy and handlers
- `src/repository-firebase.js`
  - Firebase password reset helpers
  - founder canonical profile override
  - founder operator-access owner repair
  - repository debug labels for smoke diagnosis
- `src/repository-local.js`
  - local registered-email guard
  - local password-hash sign-in checks
  - local fallback password reset errors
- `src/repository-locked.js`
  - locked-mode password reset errors
- `src/repository.js`
  - password reset API forwarding
- `src/useFoxHubStore.js`
  - password reset actions
  - founder session/operator enrichment
- `src/styles.css`
  - sign-in recovery row/link styling
- `firestore.rules`
  - operator applicant review permissions
  - transactional email event creation
  - founder UID fallback
  - owner/founder operator role and scope support
- `scripts/firebase-auth-smoke.mjs`
  - Firebase Auth smoke checks
- `scripts/founder-repository-smoke.mjs`
  - founder repository sign-in and access-state smoke
- `scripts/founder-firestore-write-smoke.mjs`
  - granular founder Firestore write diagnostic smoke
- `scripts/founder-invite-smoke.mjs`
  - founder invite creation smoke check
  - multi-account coverage through `FOXHUB_AUTH_SMOKE_EMAILS`
- `package.json`
  - added `smoke:auth`
  - added `smoke:founder:invite`

## Verification

Latest confirmed checks:

- `npm test` passed.
- `npm run smoke:auth` passed.
- `npm run smoke:public` passed.
- Founder repository smoke passed.
- Founder invite smoke passed.
- Current multi-account invite smoke coverage is documented in `docs/INVITE_PERMISSION_STREAMLINE_2026-06-18.md`.
- Live `/management` returned HTTP 200.
- Latest verified Hosting timestamp in the current handoff: `Tue, 02 Jun 2026 03:24:05 GMT`.

## Production Notes

- Founder/admin access is production-sensitive. Verify founder sign-in before changing auth, routing, profile repair, or Firestore rules.
- Do not rely on local-only behavior for live access decisions.
- Applicant decision email records are queued, but production email delivery still needs final transactional sender/template configuration.
- Stripe Billing remains a guarded setup surface, not live billing.
- Moment photo uploads still use compressed data URL attachments; production media should move to object storage with moderation/scanning.
