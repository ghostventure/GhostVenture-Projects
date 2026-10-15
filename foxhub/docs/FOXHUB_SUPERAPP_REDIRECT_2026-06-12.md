# foxhub-superapp Redirect - 2026-06-12

## Summary

Re-enabled the prior `foxhub-superapp` Hosting site as a redirect-only site pointing to the active copied FoxHub deployment at `https://foxhub-c984b.web.app`.

## Installed

- Added `firebase.redirect-superapp.json`.
- Added a minimal `redirect-public/index.html` fallback page.
- Deployed the redirect-only Hosting config to project `foxhub-superapp`.

## Redirect Target

- From: `https://foxhub-superapp.web.app`
- To: `https://foxhub-c984b.web.app`
- Redirect type: `301`

## Verification

The following old paths return `301` to `https://foxhub-c984b.web.app`:

- `/`
- `/signin`
- `/management`
- `/anything/deep`

The active copied site still passes:

- `FOXHUB_LIVE_URL=https://foxhub-c984b.web.app npm run smoke:live`
