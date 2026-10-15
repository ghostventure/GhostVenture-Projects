# Global Section Feeds - 2026-06-04

## Summary

The Home feed pattern now carries into the rest of the main FoxHub workspaces.

## What changed

- Added a reusable `SectionFeed` surface above every non-Home tab.
- Added `buildSectionFeedItems()` to convert each workspace's existing data into feed cards.
- The feed card model supports:
  - Hot, New, and Discussed sorting
  - All, Trusted, Local, and Open scopes
  - vote-style score rails
  - workspace-aware metadata, trust badges, comment counts, and open actions
- Covered these sections:
  - Social
  - Rapport
  - Communal
  - Services / Merchant
  - Needs & Offers
  - Pay
  - UX / Goodies
  - Management
  - Tools
  - Organizer
- Kept each section's existing specialized controls below the feed instead of replacing them.
- Added section-feed CSS variants so conversation, rapport, communal, pay, staff, services, tools, and organizer cards remain visually distinct.
- Added release smoke markers for the section feed copy and CSS classes.

## Verification

- `npm test` passed.
- `npm run smoke:public` passed before documentation.
- Final smoke/build/deploy results should be recorded in `PROJECT_STATUS.md` after release.
