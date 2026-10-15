# foxhub-superapp Hosting Undeploy - 2026-06-12

## Summary

Disabled Firebase Hosting for the prior FoxHub project `foxhub-superapp` after copying the site to `foxhub-c984b`.

## Action

- Disabled Hosting site: `foxhub-superapp`
- Prior URL: `https://foxhub-superapp.web.app`
- Firebase account used: `solidartentertainment@gmail.com`
- Command: `npx firebase-tools hosting:disable --project foxhub-superapp --site foxhub-superapp --force`

## Verification

- `https://foxhub-superapp.web.app/` now returns `404 Not Found`.
- The disabled old URL no longer contains the FoxHub app root.
- `https://foxhub-c984b.web.app/` remains live.
- `npm run smoke:live` passed with `FOXHUB_LIVE_URL=https://foxhub-c984b.web.app`.

## Active Hosting

- Active copied Hosting URL: `https://foxhub-c984b.web.app`
- Latest verified copied Hosting `Last-Modified`: `Fri, 12 Jun 2026 13:32:14 GMT`
