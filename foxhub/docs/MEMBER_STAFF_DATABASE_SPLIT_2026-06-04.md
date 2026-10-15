# Member / Staff Database Split - 2026-06-04

## Summary

FoxHub now treats member users and FoxHub-employed staff as two separate Firestore profile databases.

## Databases

- `users/{uid}`
  - FoxHub member database.
  - Created during public member sign-up on `/signin`.
  - Stores member profile, onboarding/access state, member app state, user record snapshots, and member-owned subcollections.

- `staffMembers/{uid}`
  - FoxHub staff database.
  - Created or refreshed when an authorized founder, manager, administrator, reviewer, or staff account signs in through the Firebase repository path.
  - Stores internal staff identity fields such as role, department, title, employment status, staff flags, and references back to the member profile and operator access record.

- `operatorAccess/{uid}`
  - Staff permissions and access-control database.
  - Stores operator role, scopes, state, and grant metadata.
  - This remains separate from `staffMembers/{uid}` so staff identity and staff permissions are not the same record.

## Behavior

- Public member sign-up writes to `users/{uid}` only.
- Management/founder/staff sign-in writes to `users/{uid}` and, when the account is staff/management/founder authorized, also upserts `staffMembers/{uid}`.
- Staff accounts still need Firebase Auth plus platform-operator/founder authorization before staff records can be created or updated.
- The founder account can bootstrap its own staff record through the existing founder UID fallback.

## Files Updated

- `src/repository-firebase.js`
- `src/repository-local.js`
- `src/App.jsx`
- `src/FoxHubShell.jsx`
- `src/styles.css`
- `firestore.rules`
- `scripts/release-smoke.mjs`
- `docs/MEMBER_STAFF_DATABASE_SPLIT_2026-06-04.md`

## GUI / Functional Modes

- `/signin` is explicitly marked as the `Member database` mode. It writes public member sign-ups and member sign-ins to `users/{uid}`.
- `/management` is explicitly marked as the `Staff database` mode. Authorized staff, management, and founder accounts can create or refresh `staffMembers/{uid}`.
- The Management workspace shows the current split between:
  - `users/{uid}` for member profile/app state
  - `staffMembers/{uid}` for FoxHub employee identity
  - `operatorAccess/{uid}` for permissions and scopes
- The local repository fallback mirrors the split with a separate `foxhub-alpha-staff-members` local storage bucket so desktop/static testing keeps the same shape.

## Verification

Passed after implementation:

- `node --check src/repository-firebase.js` (pass)
- `node --check src/repository-local.js` (pass)
- `npm test` (pass)
- `npm run smoke:public` (pass; includes `npm run vite:build` and release bundle marker checks)
- `npm run build` (pass)
- `npx firebase-tools deploy --only firestore:rules,hosting --project foxhub-superapp` (pass)

Release smoke now checks the generated app bundle for `Member database`, `Staff database`, `staffMembers`, and `operatorAccess`, plus the CSS markers for the new database-mode panels.

## Live Deploy / Shell Fetch Note

The live deploy completed successfully and Firebase Hosting served the app at `https://foxhub-superapp.web.app`.

- Firestore rules compiled and were released to `cloud.firestore`.
- Hosting found 12 files in `dist`, uploaded them, finalized the version, and released the new version.
- Live homepage returned `HTTP/2 200`.
- Live homepage `Last-Modified`: `Thu, 04 Jun 2026 07:21:08 GMT`.

During post-deploy verification, sandboxed shell fetches of the live JS/CSS asset bodies appeared as `0` bytes when using commands like `curl -s URL | wc -c`. A follow-up sniff showed this was not a Firebase Hosting issue:

- The asset headers still returned `HTTP/2 200` and the expected JS `content-length: 389750`.
- Direct sandbox checks later exposed DNS failures such as `Could not resolve host` / `EAI_AGAIN`.
- Running the same curl request outside the sandbox downloaded the full live JS body to `/tmp/foxhub-live-js.curl`.
- `/tmp/foxhub-live-js.curl` was `389750` bytes and contained `Member database`, `Staff database`, `staffMembers`, and `operatorAccess`.

Conclusion: the earlier `0` byte body check was a local sandbox DNS/network artifact amplified by silent curl piping, not an empty deployed Firebase asset.
