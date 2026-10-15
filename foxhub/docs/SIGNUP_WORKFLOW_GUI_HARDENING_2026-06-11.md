# Signup Workflow GUI Hardening - 2026-06-11

## Summary

Improved the FoxHub signup workflow and GUI to reduce avoidable user hiccups before social traffic arrives.

## What shipped

- Fixed a route-state hiccup where `/signin` could force the form back to sign-in after opening the sign-up path.
- Added a `Signup readiness` panel to member signup surfaces.
- The readiness panel shows email/password, access path, profile basics, 18+ date of birth, and robot-check status before submit.
- Added date-of-birth input to the onboarding auth signup path so it does not fail later with a missing age gate.
- Added an 18+ maximum date guard to signup DOB fields.
- Signup submit buttons now stay disabled until the visible readiness checks are complete.
- Strong password validation now applies to all member signup paths, including local/preview mode.
- Kept management/staff sign-in separate from member signup hardening.

## Files changed

- `src/App.jsx`
- `src/styles.css`
- `scripts/release-smoke.mjs`
- `docs/SIGNUP_WORKFLOW_GUI_HARDENING_2026-06-11.md`
- `docs/PROJECT_STATUS.md`
- `docs/CURRENT_HANDOFF_2026-05-31.md`
- `docs/DOCS_INDEX.md`

## Verification

Completed:

- `node --check src/captchaGuard.js` (pass)
- `npm test` (pass, 24 tests)
- `npm run vite:build` (pass)
- `npm run release:check` (pass)
- `npm run deploy:hosting` (pass)
- live `/signin` HTTP 200
- live `/assets/index-S8QCikxn.js` HTTP 200
- live `/assets/index-D_qFznDb.css` HTTP 200
- live Hosting `Last-Modified`: `Thu, 11 Jun 2026 18:15:35 GMT`
- live bundle content check found `Signup readiness`, `Email and strong password`, `Profile basics complete`, `18+ date of birth`, `Robot check complete`, `signup-readiness-panel`, and `signup-readiness-item`.
