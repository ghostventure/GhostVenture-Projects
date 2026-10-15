# Rapport Section Rework - 2026-06-04

## Summary

The Rapport section was tightened into a focused people-and-trust workspace.

## What changed

- Renamed the top copy from a broad "Rapport Graph" pitch into a direct Rapport workspace description.
- Added a Rapport command center with summary cards for:
  - trusted people
  - strongest introductions
  - private groups
  - review items
- Added a trusted introductions panel that prioritizes high-trust contacts and direct messaging.
- Kept the Rapport surface focused on contacts, circles, groups, friend requests, trust records, profile reputation, and professional endorsements.
- Renamed "Needs becoming services" to "Service trust signals" so it reads as rapport context instead of a market surface.
- Removed duplicate feed, official account, local classified, creator media, demand, sentiment, and relationship-graph blocks from Rapport because those workflows already live in Home, Services, Market, Management, or Tools.
- Added mobile CSS for the new command center and summary grid.
- Added release smoke markers for the new Rapport copy and CSS classes.

## Verification

- `npm test` passed.
- `npm run smoke:public` passed.
- `npm run build` passed.

## Deploy target

- Firebase Hosting project: `foxhub-superapp`
- Public site: `https://foxhub-superapp.web.app`
