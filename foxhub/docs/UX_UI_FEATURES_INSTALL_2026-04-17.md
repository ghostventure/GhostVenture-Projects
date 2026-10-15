# FoxHub UX/UI Features Install (2026-04-17)

## Request

Install all 20 UX/UI features in the exact order provided.

## Result

Completed as a first-class `UX/UI` workspace plus shared shell controls.

## Installed Features

1. Universal Command Center
2. User Today Dashboard
3. Context-Aware Right Rail
4. Action Timeline
5. Inbox Priority Modes
6. Trust Badge System
7. Smart Empty States
8. Onboarding Progress Map
9. Mini-App Permission Review Modal
10. Payment Flow Stepper
11. Notification Inbox Upgrade
12. Operator Review Console
13. Local Discovery Map/List Toggle
14. Profile Completeness Meter
15. Saved Workspace
16. Undo / Recent Actions Toasts
17. Skeleton Loading and Offline Banners
18. Role-Based Home Layout
19. Object Detail Pages
20. Guided Create Button

## Functional Behavior

Each feature supports:

- `Activate`
  - marks the feature active
  - creates a UX event
  - sets a matching analytics feature flag
- `Run`
  - creates a feature-specific output record
  - updates run count and last-run timestamp
  - creates a recent action toast

## Output Records

- `uxCommandRuns`
- `uxTodayCards`
- `uxContextRailItems`
- `uxTimelines`
- `uxInboxModes`
- `uxTrustBadges`
- `uxEmptyStateActions`
- `uxOnboardingSteps`
- `uxMiniAppPermissionReviews`
- `uxPaymentSteppers`
- `uxNotificationInbox`
- `uxOperatorConsoleItems`
- `uxDiscoveryViews`
- `uxCompletenessMeters`
- `uxSavedWorkspaceItems`
- `uxToasts`
- `uxRuntimeBanners`
- `uxRoleHomeLayouts`
- `uxObjectDetails`
- `uxCreateMenuActions`

## UI Surfaces

- Added a primary `UX/UI` navigation room.
- Added an ordered feature registry.
- Added `Activate all 20` and `Run all in order`.
- Added a context rail preview.
- Added Today, inbox modes, trust badges, onboarding map, payment stepper, guided create, operator console, and latest-output panels.
- Expanded the quick command overlay so each UX/UI feature can be run directly.
- Added a global `Create` button that runs the guided create feature.

## Persistence

- Local mode receives the new state through the store shape migration.
- Firebase mode persists the new UX/UI arrays in the user document.
- Firestore rules were expanded with bounded list sizes for all UX/UI state arrays.

## Verification

- `npm test` passed.
- `npm run build` passed.

