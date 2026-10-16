# EstateHat Profile, Vault, Match, And Brand Refresh

Date: 2026-04-23

## Scope

This refresh upgraded several shared Next/Vite shell surfaces together:

- `My Info` profile tab
- `Document Vault`
- `Match Services` `Relevant Bodies` section
- main shell brand icon in place of the `EH` placeholder

## Installed changes

### My Info

- Added a top-level `My Info Health` overview with account posture cards.
- Added an `Action Queue` that surfaces the highest-signal profile, verification, legal, trust, and security follow-ups.
- Added a `Recent Activity` timeline for profile writes, verification queue state, trust status, and latest security event.
- Kept the existing deep profile, database, legal, compliance, billing, and trust controls intact underneath the new overview layer.

### Document Vault

- Added vault readiness summary cards.
- Added richer upload intake controls for category, packet type, and review priority.
- Added queue search, status filtering, and sort controls.
- Expanded document rows with review owner, due state, and priority cues.
- Reworked the preview pane with readiness progress, release checklist, routing/party status, and a stronger audit timeline.

### Match Services

- Renamed `Daisy-chain introductions` to `Relevant Bodies`.
- Added overview cards for active bodies, market scope, and timing path.
- Added role-specific panels for agent, inspector, and lender with lane, touchpoints, and trigger guidance.
- Updated the request CTA and saved-state message to match the new section language.

### Brand icon

- Replaced the hard-coded `EH` nav badge with the existing EstateHat icon asset:
  - `public/icons/estatehat-icon.svg`

## Files changed

- `src/estatehat-platform-alpha.jsx`
- `src/GuiFeatureViews.jsx`

## Verification

- `npm run build` passed

## Notes

- The existing `npm test` harness is still blocked by the local Node test-runner environment issue:
  - `Missing internal module 'internal/deps/brace-expansion'`
- Deployment should continue through the normal hosting flow after build verification.
