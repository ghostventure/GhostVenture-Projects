# Public Profile Viewer - 2026-06-04

## Summary

FoxHub now has a visible public-profile viewer for other members.

## What changed

- Added a public profile modal for contacts.
- Public profiles show public-safe details only:
  - display name
  - username/handle
  - city and region
  - account type
  - trust tier
  - presence
  - peer rating summary
  - rapport score
  - join date
  - verification summary
  - public tags
- Private fields such as email and phone are not shown in the public profile modal.
- Added public profile entry points from:
  - Home feed people posts
  - global section feed contact cards
  - Rapport trusted introductions
  - Rapport introduction map
  - Rapport contact cards
  - Market seller details
- Added public profile actions:
  - message the member
  - open Rapport
- Added responsive public-profile styling.
- Added release smoke markers for the public profile copy and CSS.

## Upgrade pass

- Expanded the modal from a basic card into a richer public profile view.
- Added a trust lane meter based on rapport score.
- Added public-safe trust signal cards.
- Added a public strengths section for profile tags.
- Added a public activity grid for presence, referral context, best surface, and public stage.
- Increased the modal width and improved mobile collapse behavior.

## Showcase pass

- Reworked the profile into a showcase-style surface with a cover band and stronger identity header.
- Added a command row with reputation stats and primary actions.
- Added public role, city lane, and preferred-lane highlight cards.
- Separated trust and safety from the About section.
- Added a public milestone timeline.
- Added responsive handling for the cover, avatar, command row, and profile grids.

## Verification

- `npm test` passed before documentation.
- Final smoke/build/deploy results should be recorded in `PROJECT_STATUS.md` after release.
