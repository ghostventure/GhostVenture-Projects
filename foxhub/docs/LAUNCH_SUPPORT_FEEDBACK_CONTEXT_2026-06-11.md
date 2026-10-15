# Launch Support Feedback Context - 2026-06-11

## Summary

Added launch-support workflow tweaks so ad visitors who hit a signup issue can send more useful support context with less back-and-forth.

## What shipped

- Added a `Launch support is open` note to the landing page.
- Added signup feedback categories for captcha, readiness, and ad-link issues.
- Signup feedback now requires contact email and a short issue description before preparing the support email.
- Signup feedback records now include campaign source, path, URL, referrer, viewport, time zone, and user agent.
- The support email draft includes the same launch context.
- Added a `Launch context` card on the public sign-up help page.

## Files changed

- `src/App.jsx`
- `src/styles.css`
- `scripts/release-smoke.mjs`
- `docs/LAUNCH_SUPPORT_FEEDBACK_CONTEXT_2026-06-11.md`
- `docs/PROJECT_STATUS.md`
- `docs/CURRENT_HANDOFF_2026-05-31.md`
- `docs/DOCS_INDEX.md`

## Verification

Completed:

- `npm run release:check` (pass)
- `npm run deploy:hosting` (pass)
- live `/` HTTP 200
- live `/feedback` HTTP 200
- live `/assets/index-DO3mPdsA.js` content check found launch-support feedback strings.
- live `/assets/index-CnR6gLBV.css` content check found `launch-support-note` and `feedback-context-card`.
- live Hosting `Last-Modified`: `Thu, 11 Jun 2026 20:13:24 GMT`
