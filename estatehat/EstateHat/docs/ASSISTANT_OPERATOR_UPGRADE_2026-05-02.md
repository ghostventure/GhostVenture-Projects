# Assistant Operator Upgrade

Date: 2026-05-02

## Scope

Deepened the EstateHat in-app assistant so it behaves more like a guided workspace operator and less like a flat FAQ panel.

Primary file:

- `src/estatehat-platform-alpha.jsx`

## What Changed

- Expanded assistant intent coverage for:
  - featured placements
  - Verified Profile billing
  - organized messaging / conversation routing
- Added role and workspace context signals so the assistant now reflects:
  - account role
  - current workspace
  - trust/profile state
  - saved listing count
  - live featured placement count
  - admin access state when applicable
- Added workspace playbooks so the assistant shows:
  - what this workspace is for
  - the next likely steps
  - direct action buttons tied to that workspace
- Added role-driven route shortcuts for:
  - sellers
  - service providers
  - admins
  - default buyer flows
- Added recent guided route memory so users can return to prior assistant routes without retyping a query
- Widened the desktop assistant shell and converted the topic area into a two-column layout for easier scanning on larger screens

## Assistant Behavior

The assistant now provides four simultaneous layers:

1. Query routing
2. Current workspace plan
3. Role-aware route shortcuts
4. Recent guided route recall

This makes the panel more useful for users who need explicit step-by-step direction instead of open-ended exploration.

## Product Intent

This pass deliberately biases the assistant toward low-friction guidance:

- less abstract navigation language
- more immediate “go here next” behavior
- repeated orientation for users who are easily lost
- stronger emphasis on next-step routing instead of passive information display

## Verification

Verified locally:

- `npm run build`

## Deploy Status

This pass is Hosting-deployable and does not depend on the still-blocked Functions deployment path.

Backend note remains unchanged:

- Functions deployment is still blocked by missing secret `SQUARE_ACCESS_TOKEN`
- Stripe-related setup is no longer the active blocker

## Follow-up Gaps

The assistant is stronger, but it is still not a full multi-step copilot.

Future upgrade targets:

- live blocker detection from transaction/profile state
- multi-step guided flows that remember progression
- more aggressive reading-level simplification
- narrower decision trees for lower-skill users
- assistant analytics / usage logging
