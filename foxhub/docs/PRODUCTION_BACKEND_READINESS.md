# FoxHub Production Backend Readiness

FoxHub currently has a deployed static Vite Hosting surface and a build-verified Next/API foundation.

## Current State

- Static Hosting deploy: active on `https://foxhub-superapp.web.app`
- Next app build: verified with `npm run build`
- Next/Firebase Functions adapter: present
- Functions deploy: blocked until the Firebase project has the required billing/backend setup

## Required Before Production Backend

- Choose the production backend host:
  - Firebase Functions with Blaze enabled
  - Vercel
  - Cloud Run
  - another managed runtime
- Move sensitive actions behind server authority:
  - wallet and payment decisions
  - merchant payout changes
  - role grants
  - moderation enforcement
  - account recovery
- Add server-side audit writes for sensitive actions.
- Add backend route smoke tests.
- Add deployment rollback notes.

## Current Safe Position

The current static Hosting app is acceptable for alpha/demo surfaces and local-first workflows.

It should not be treated as a full production backend for payments, compliance, merchant settlement, or admin enforcement until the server-authoritative path is deployed and tested.
