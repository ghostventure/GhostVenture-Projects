# Home Feed Rework - 2026-06-04

## Summary

The Home content section now functions more like a social news feed: familiar like a Facebook home stream, but organized with Reddit-style ranking, filters, voting, comment actions, and community/source labels.

## What Changed

- Added a dedicated `Home feed` / front-page section near the top of Home.
- Combined multiple existing FoxHub content sources into one feed:
  - Moments/member posts
  - Official account posts
  - Local needs/service asks
- Added feed sorting:
  - `Hot`
  - `New`
  - `Discussed`
- Added feed scopes:
  - `All`
  - `Local`
  - `Trusted`
  - `People`
- Added Reddit-style score/vote rails.
- Moment cards can be upvoted/appreciated through the existing Moment reaction system.
- Moment cards can receive quick comments from Home.
- Official cards can open their official thread or toggle follow state.
- Need/service cards can route to the market or log interest.
- Added responsive styling so the feed stacks cleanly on phones.

## Files Updated

- `src/FoxHubShell.jsx`
- `src/styles.css`
- `scripts/release-smoke.mjs`
- `docs/HOME_FEED_REWORK_2026-06-04.md`

## Verification

Passed:

- `npm test`
- `npm run smoke:public`
- `npm run build`
- `npx firebase-tools deploy --only hosting --project foxhub-superapp`

Release smoke now checks for the new Home feed strings and CSS markers:

- `Home feed`
- `Front page for your people, places, and trusted asks.`
- `Discussed`
- `home-feed-card`
- `home-feed-toolbar`

## Live Deploy

- Hosting URL: `https://foxhub-superapp.web.app`
- Live homepage returned `HTTP/2 200`.
- Live `Last-Modified`: `Thu, 04 Jun 2026 23:11:42 GMT`.
- Live shell assets include the refreshed CSS bundle `assets/index-DADmBtvC.css`.
