# Auth Workflow Consolidation - 2026-06-03

## Summary

FoxHub member authentication now uses one public member entry route:

`https://foxhub-superapp.web.app/signin`

The sign-in page contains a member mode switch for existing-account sign-in and new-account sign-up. Management remains separate at `/management` for founders, managers, and administrators.

## What Changed

- Consolidated member sign-in and sign-up onto `/signin`.
- Changed landing/footer sign-up actions to open `/signin` in sign-up mode instead of opening a separate overlay.
- Fixed the auth submit handler so `/signin` respects the selected member mode.
- Kept `/management` forced to staff sign-in mode.
- Streamlined sign-in to email, password, password recovery, and management entry.
- Streamlined sign-up to:
  - email
  - password
  - invite code or manager-review request
  - name
  - handle
  - city
  - date of birth / 18+ gate
- Updated invite sign-up copy to match the sponsor approval workflow: the current user tied to the invite must approve or deny the new account before access opens.
- Updated no-invite sign-up copy to route expectations through FoxHub Management approval or denial.
- Added compact profile-grid styling for the sign-up fields with mobile single-column fallback.

## Behavior

- Existing users sign in with the email and password registered during sign-up.
- New users create credentials once and reuse the same credentials after invite approval or manager review.
- Invite-code sign-ups do not imply immediate access; they wait for the current user's sponsor decision.
- No-invite sign-ups submit an application to Management.
- Management, founder, and administrator sign-in remains on `/management`.

## Files Updated

- `src/App.jsx`
- `src/styles.css`
- `docs/AUTH_WORKFLOW_CONSOLIDATION_2026-06-03.md`
- `docs/CURRENT_HANDOFF_2026-05-31.md`
- `docs/PROJECT_STATUS.md`
- `docs/DOCS_INDEX.md`

## Verification

- `npm test` passed.
- `npm run vite:build` passed.
- `npm run smoke:public` passed.
- `npm run smoke:founder:invite` was not run to completion because `FOXHUB_AUTH_SMOKE_EMAIL` was not set in the shell.
- Local built `/signin` returned HTTP 200 from Vite preview.
- Firebase Hosting deploy completed for `foxhub-superapp`.
- Live `/signin` returned HTTP 200.
- Live `Last-Modified`: `Wed, 03 Jun 2026 09:17:56 GMT`.
- Live bundle `assets/index-C6jw0Rpp.js` contains:
  - `Single sign-on rule`
  - `The current user who invited you must approve or deny`
  - `No invite yet? Send the application to FoxHub Management`
  - `Sign up`

## Deployment

Command:

```bash
npm run deploy:hosting
```

Live URL:

`https://foxhub-superapp.web.app/signin`
