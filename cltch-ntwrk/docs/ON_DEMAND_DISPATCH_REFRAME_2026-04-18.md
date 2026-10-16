# CLTCH On-Demand Dispatch Reframe - 2026-04-18

CLTCH.NTWRK is now framed as an on-demand gig dispatch app, not a passive listing board or generic dashboard.

## Product Center

The core flow is:

1. Host requests talent.
2. CLTCH surfaces nearby available performers.
3. A performer accepts.
4. The booking moves through live status.
5. Event day closes with payout and review.

Shared language now follows:

- Request
- Match
- Accept
- Arrive
- Complete
- Pay + Review

## What Changed

- Updated the public homepage copy around on-demand gig dispatch.
- Changed the shared quick-dock button from `Components` to `Dispatch Kit`.
- Changed the component modal from `CLTCH Component Library` to `CLTCH Dispatch Kit`.
- Changed the install summary to `145 on-demand tools installed`.
- **Correction (2026-10-16):** those entries were proposals, not installed tools. The Enable/Run buttons only wrote local activity markers; the current UI labels them as proposed concepts and only opens related pages. See `docs/CLTCH_MODERNIZATION_2026-10-16.md`.
- Reframed shared page action hubs:
  - Host pages now lead with `Request Talent Now`.
  - Performer pages lead with availability, nearby requests, and accepted jobs.
  - Gig Radar is now framed as `Nearby Live Requests`.
  - Auth is framed as entering dispatch.
- Added a shared dispatch status rail:
  - Request
  - Match
  - Accept
  - Arrive
  - Complete
  - Pay + Review

## Files

- `index.html`
- `site-init.js`
- `cltch-boilerplate.css`
- `mobile-web/index.html`
- `mobile-web/site-init.js`
- `mobile-web/cltch-boilerplate.css`

## Verification

- `node --check /home/sniper-lion-main/Documents/CLTCH.NTWRK/site-init.js` passed.
- `node --check /home/sniper-lion-main/Documents/CLTCH.NTWRK/mobile-web/site-init.js` passed.
- `npm run build:mobile` passed.
- `npm run sync:android` passed.
- `npm run sync:ios` passed after rerunning by itself. The first parallel attempt hit a temporary `mobile-web` rebuild race while Android was also syncing.

## Recovery Notes

- If CLTCH starts reading like a generic dashboard again, start with `getHubConfig()` in `site-init.js`.
- If the public entry page drifts, start with `index.html`.
- If the dispatch rail breaks on mobile, start with `.cltch-dispatch-flow` in `cltch-boilerplate.css`, then rerun `npm run build:mobile`.
