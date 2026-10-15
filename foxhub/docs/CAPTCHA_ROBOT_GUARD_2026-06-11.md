# Captcha Robot Guard - 2026-06-11

## Summary

Added a first-party robot-check gate to FoxHub member signup and access requests.

## What shipped

- Added `src/captchaGuard.js` for captcha challenge creation and validation.
- Signup now shows a `Robot check` card on the member `/signin` signup flow, the early-access overlay, and the onboarding auth overlay.
- The challenge includes a visible answer field and a hidden website honeypot field.
- Wrong answers, missing answers, stale challenges, and filled honeypot fields are rejected.
- Local and Firebase repository signup paths reject direct signup payloads without a valid captcha proof.
- Management/staff sign-in is not captcha-gated, so staff access remains separate from public member signup.

## Files changed

- `src/captchaGuard.js`
- `src/App.jsx`
- `src/repository-local.js`
- `src/repository-firebase.js`
- `src/styles.css`
- `tests/captcha-guard.test.mjs`
- `tests/local-profile-persistence.test.mjs`
- `scripts/release-smoke.mjs`
- `docs/CAPTCHA_ROBOT_GUARD_2026-06-11.md`
- `docs/PROJECT_STATUS.md`
- `docs/CURRENT_HANDOFF_2026-05-31.md`
- `docs/DOCS_INDEX.md`

## Verification

Completed:

- `node --check src/captchaGuard.js` (pass)
- `node --check src/repository-local.js` (pass)
- `node --check src/repository-firebase.js` (pass)
- `node --check tests/captcha-guard.test.mjs` (pass)
- `node --check tests/local-profile-persistence.test.mjs` (pass)
- `npm test` (pass, 24 tests)
- `npm run release:check` (pass)
- `npm run deploy:hosting` (pass)
- live `/signin` HTTP 200
- live `/assets/index-DKpyfyTK.js` HTTP 200
- live `/assets/index-CFbtPTaO.css` HTTP 200
- live `/assets/repository-local-BPuhNiuR.js` HTTP 200
- live `/assets/repository-firebase-CiF86nps.js` HTTP 200
- live Hosting `Last-Modified`: `Thu, 11 Jun 2026 17:43:46 GMT`
- live bundle content check found `Robot check`, `Keep remotes and robots out`, `Refresh check`, `Robot check answer does not match`, `captcha-gate`, and `captcha-honeypot`.
