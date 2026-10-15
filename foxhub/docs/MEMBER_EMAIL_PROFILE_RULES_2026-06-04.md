# Member Email And Profile Rules - 2026-06-04

## Summary

Member accounts now treat email, username, and public display name as separate fields.

## Rules

- Member sign-up uses the member's current personal email address.
- Member sign-up treats email as a unique account identity. If an email is already registered, the user must sign in with it or use another email address.
- Member profile setup uses:
  - `email` for sign-in/account identity
  - `handle` for the custom username
  - `name` for the public display name
- Profile edits keep the registered account email. Users can edit their username and public display name, but the account email remains the signed-in identity.
- The signed-in account email is shown in the user's own profile editor account section as a read-only account identity field.
- The public display name does not have to be a first and last legal name.
- `foxhub.*` email domains are reserved for FoxHub staff and management accounts.
- Normal member sign-up rejects any email whose domain contains `foxhub`, including `foxhub.com`, `foxhub.io`, `foxhubapp.com`, and future suffixes.
- The reserved-domain rule is suffix-agnostic: if the domain contains `foxhub`, the address is treated as staff-only.
- Repeated blocked attempts are counted per reserved email in browser storage. After the third blocked attempt, the member form returns a lockout-style message that directs staff email requests through FoxHub management approval.
- Member sign-up ignores client-supplied staff/manager flags. A user cannot self-approve a FoxHub-domain staff email through the public member form.
- If an existing member profile still has a `foxhub.*` placeholder email but Firebase Auth has a real non-FoxHub email, the Firebase repository canonicalization now resolves the member profile email to the authenticated real email.
- Staff and management records can retain FoxHub-domain addresses through the separate staff/management path.

## Seed Data Cleanup

The visible demo users no longer use `@foxhub.test` addresses. Non-staff sample users were moved to `example.com` placeholder emails so staff views do not imply that members are supposed to use FoxHub-owned email domains.

## Files Updated

- `src/App.jsx`
- `src/rules.js`
- `src/repository-firebase.js`
- `src/repository-local.js`
- `src/data.js`
- `scripts/release-smoke.mjs`
- `tests/local-profile-persistence.test.mjs`

## Verification

Passed:

- `npm test`
- `npm run smoke:public`
- `npm run build`

Regression coverage added:

- Local member sign-up rejects `member@foxhub.test`.
- Local member sign-up rejects `member@foxhub.io`.
- Local member sign-up rejects `member@foxhub.biz`.
- Local member sign-up rejects arbitrary future suffixes like `member@foxhub.anything`.
- Local member sign-up still rejects FoxHub-domain emails when the draft tries to spoof `staffAccess` or `managerAccess`.
- The third repeated blocked attempt returns the stronger blocked/management-approval message.
- Local member sign-up rejects an email that is already registered.
- Local profile editing keeps the registered email even if a different email value is submitted.
