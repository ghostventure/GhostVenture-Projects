# Self Profile Editor Upgrade - 2026-06-05

## Summary

The self-profile editor was upgraded from a basic input stack into a consolidated profile management surface.

## What changed

- Added a richer `Profile editor` modal layout.
- Added a live public preview card for the user's public OneID profile.
- Added completion, access, and badge status cards.
- Consolidated fields into grouped sections:
  - Public identity
  - Role and community
  - Account controls
  - Verified badge
  - Invite tools
- Replaced the one-line Bio input with a multi-line textarea.
- Kept email and protected account details out of editable public identity fields.
- Added a sticky save bar with profile preview and completion status.
- Added responsive layout rules for mobile.
- Added release smoke markers for the editor copy and CSS classes.

## Persistence enhancement

- Added saved profile fields for:
  - pronouns
  - website/link
  - availability
  - interests and strengths
- Wired the new fields through:
  - default profile state
  - profile normalization
  - local profile updates
  - Firebase profile updates
  - Google/Firebase profile initialization
- Added regression coverage proving the new fields survive save, sign out, and sign in.

## Verification

- Pending final smoke/build/deploy after this enhancement.
