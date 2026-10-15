# Local Auth Registration Guard - 2026-06-01

## Summary

FoxHub static/local sign-in no longer creates a new account when an unknown email is entered.

On 2026-06-01, live Firebase Hosting was also rebuilt with the Firebase web app config so hosted sign-in uses Firebase Auth/Firestore instead of the local fallback.

## Behavior

- Sign-up creates the applicant/member profile.
- Sign-in requires a registered saved profile for that email.
- Live user-facing auth is consolidated to email/password only.
- User-facing Google and email-link sign-in controls are not part of the current workflow.
- Applicants must use the same email and password created during sign-up after invite approval or manager review.
- Local sign-up stores a password hash for future local sign-in checks.
- Local sign-in rejects the wrong password when a saved password hash exists.
- The founder manager account keeps its separate hashed credential path.

## Verification

- Added regression coverage for unknown-email sign-in rejection.
- Added regression coverage for wrong-password rejection.
- Created Firebase Web app `foxhub-web` for project `foxhub-superapp`.
- Rebuilt the Vite bundle with Firebase public config.
- Deployed Hosting and Firestore rules together.
- Confirmed Firebase Auth rejects an unknown-email password sign-in with `INVALID_LOGIN_CREDENTIALS`.
- Provisioned the founder manager email in Firebase Auth and confirmed password sign-in returns `registered: true`.
- Confirmed founder custom claims include platform operator, owner, founder, role owner, and full owner scopes.
- Added `npm run smoke:auth` to repeat unknown-user rejection and optional known-user/claim checks.
- Current deploy and live verification stay consolidated in `docs/CURRENT_HANDOFF_2026-05-31.md`.
