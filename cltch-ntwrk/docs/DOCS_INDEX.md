# CLTCH.NTWRK Docs Index

Last updated: 2026-10-16

This file is the entry point for the current CLTCH.NTWRK repo documentation set.

## Core docs

- `CLTCH_MODERNIZATION_2026-10-16.md`
  - Current profile-data safeguards, account-copy export, PWA install flow, truthful Ops catalog scope, and verification evidence.
- `FEATURE_AUDIT_200.md`
  - Numbered 200-item delivery checklist; only evidence-backed checked items count as implemented.
- `PROJECT_STATUS.md`
  - Current implemented state of the live website, wrapper work, native alternates, and known limits.
- `SECURITY_PERFORMANCE.md`
  - Current security, cache, auth-session, and deployment-side performance posture.
  - Includes Firestore query-boundary and composite-index notes for the live site.
- `AUTH_RECOVERY_2026-04-01.md`
  - Recovery notes for the auth, cache, verification, and stale-code issues that caused sign-in instability.
- `SYSTEM_BASELINE_2026-04-01.md`
  - Consolidated live baseline for auth, performer routing, Firestore shape, query boundaries, and "do not undo" safeguards.
- `NATIVE_DATABASE_SYNC.md`
  - Database contract alignment notes for website and native scaffolds.
- `MOBILE_SETUP.md`
  - Mobile wrapper setup and sync notes.
- `STRIPE_CONNECT_SETUP.md`
  - Prepared but inactive Stripe Connect scaffold and the exact handoff required to activate automated surcharge collection later.
- `BACKEND_API_ENRICHMENT_2026-04-28.md`
  - Backend boundary upgrade covering `/api` Hosting rewrites, Cloud Functions health/session endpoints, Stripe endpoint fallback behavior, and verification.
- `WORKSPACE_UI_ENRICHMENT_2026-05-01.md`
  - Shared workspace-shell uplift for the host and performer dashboards, including new mastheads, summary cards, right-rail layout, and mobile-web sync.
- `HOMEPAGE_SERVICE_CLARITY_ROLLOUT_2026-05-21.md`
  - Homepage clarity pass adding practical service lanes, booking-room operating details, responsive public sections, mobile-web sync, and deploy validation.
- `STICKY_TILE_CARD_TABLE_CLEANUP_2026-05-22.md`
  - Current CLTCH cleanup keeping only the assistant persistent, moving quick actions back into page flow, extending shared card-table wrapping, and finalizing `musician-matched-gigs.html` on a true three-column dense desktop layout.
- `CLTCH_GUI_SECURITY_ACCESSIBILITY_ROLLOUT_2026-04-08.md`
  - Detailed implementation + test + deploy record for the latest CLTCH UX/dexterity/security/accessibility rollout.
- `CLTCH_EXPERIENCE_PLATFORM_ROLLOUT_2026-04-12.md`
  - Full feature inventory and deployment record for the large experience/security/ops expansion completed on 2026-04-12.
- `CLTCH_COMPLIANCE_ROLLOUT_2026-04-12.md`
  - Compliance-focused FAQ, Terms, Privacy, and DMCA refresh plus the documentation/test record from April 12, 2026.
- `GUI_CONTEMPORARY_THEME_REDESIGN_2026-04-12.md`
  - Contemporary Day/Night GUI redesign applied through the shared CLTCH visual system.
- `COMPONENT_LIBRARY_INSTALL_2026-04-12.md`
  - 100-component CLTCH library install with enable/run/open mechanics and mobile-web sync record.
- `HANDOFF_2026-04-17.md`
  - latest responsive optimization, mobile-web sync, deploy target, and recovery notes for returning to CLTCH later.
- `LOADED_KIT_45_INSTALL_2026-04-18.md`
  - 45 new installable CLTCH components, mechanics, and UI/UX features added to the shared component library.
- `ON_DEMAND_DISPATCH_REFRAME_2026-04-18.md`
  - CLTCH re-centered as an on-demand gig dispatch app: request, match, accept, arrive, complete, pay, and review.
- `TILE_WIDGET_WRAP_2026-04-18.md`
  - responsive tile/widget wrapping for the Dispatch Kit and shared quick action tiles.
- `NEXT_FOUNDATION_2026-04-22.md`
  - Next.js foundation added while preserving the existing static HTML and mobile wrapper paths.
- `ANDROID_APK_REFRESH_2026-04-22.md`
  - latest Android debug APK refresh after the Next foundation.
- `ANDROID_APP_SITE_PACKAGE_2026-07-15.md`
  - hosted Android app GUI page, shared Firebase Auth/user database, role-record parity, zipped APK path, and deploy verification notes.
- `PLUGZ_CLTCH_BRIDGE_2026-07-29.md`
  - Plugz Firebase to CLTCH sign-in bridge, sign-in-gated token verification, six-month membership grant, deployment record, live smoke results, and Firebase console prerequisites.
- `PLUGZ_IDENTITY_HANDOFF_2026-07-29.md`
  - Plugz-side identity handoff for required auth sequence, accepted Plugz user data, server-owned records, profile-page behavior, live endpoint checks, and real-user test checklist.

## Fast lookup

### Auth and session stability

- Verified email is required for password-protected access.
- Idle logout is 5 minutes with a 1-minute warning.
- Idle timeout stores a safe resume target and routes users back after valid re-authentication.
- Service-worker caching is disabled for the live website auth/dashboard path.
- Start with:
  - `AUTH_RECOVERY_2026-04-01.md`
  - `SECURITY_PERFORMANCE.md`

### Performer workspace

- `musician-matched-gigs.html`
  - canonical `My Matched Gigs` page
  - matched-gigs queue
  - upcoming accepted gigs list
  - cancel-booking action for future accepted gigs
  - reviews, reputation snapshot, and performer tier ladder
  - workspace masthead and dedicated right-rail control stack
- `gig-radar.html`
  - canonical `Gig Radar` page
  - incoming open-gig feed
  - match-reason chips
  - performer queue controls
  - saved gigs, sort modes, and radar summary cards
  - intended to surface only actionable gigs, not booked-date cleanup work
- `musician-profile.html`
  - `My Profile` tab
  - grouped profile sections
  - availability calendar
  - payout setup
  - Business Class request flow for Senior-tier-or-above performers
  - trust dashboard cards for overall grade, performer tier, and qualifying ratings
  - local draft recovery and unsaved-change warning
  - bounded `bookedDates` calendar cache instead of unbounded embedded history
- `musician-dashboard.html`
  - legacy compatibility route
  - still boots the performer dashboard code, but should not be the preferred link target
- `booking.html`
  - dedicated booking details page for both host and performer views
  - private booking message thread between host and assigned performer
  - performer check-in support within the pre-event window

### Host workspace

- `host.html`
  - host ops stats
  - draft-backed gig posting
  - booking timeline
  - performer profile links
  - booking details links
  - queue shortcuts for open, booked, review, and cancelled gig views
  - duplicate-to-form action for reposting older gigs
  - whole-gig cancel and reopen controls
  - workspace masthead and richer host operations shell
- `host-profile.html`
  - grouped host profile and payout setup
  - local draft recovery and unsaved-change warning

### Shared client helpers

- `app/user-db.js`
  - user summaries
  - role persistence
  - auth activity markers
- `android-app.html`
  - hosted Android-facing GUI
  - shared Firebase Auth sign-in/sign-up
  - shared `users/{uid}` summaries and `userRoles/{uid}` role routing
  - zipped Android package download link
- `app/gig-queries.js`
  - shared bounded Firestore query builders for host and performer gig reads
- `site-init.js`
  - shared splash, dexterity layer, deferred quick dock, enhanced guided assistant, and persistent theme toggle
  - assistant now includes page-specific next-step checklists, action chips, and remembered quick-question topics
  - dexterity layer now also includes a lightweight quick-jump palette
  - feature catalog is labeled as 145 proposed concepts, with no active integrations; fake enable/run controls are removed
- `app/visible-snapshot.js`
  - pauses live Firestore listeners while tabs are hidden
- `app/mode-switch.js`
  - shared host/performer mode toggle logic
- `app/idle-logout.js`
  - idle logout, warning modal, resume target storage
- `app/profile-drafts.js`
  - local draft persistence for profile forms
- `app/unsaved-changes.js`
  - before-unload and nav-leave warnings for dirty forms
- `app/performer-tier.js`
  - centralized performer tier thresholds and rating-count helpers
  - Business Class eligibility helper for `Senior` tier and above
- `app/backend-api.js`
  - shared backend endpoint resolver for same-origin `/api` and direct Cloud Functions fallback

### Next foundation

- `next.config.js`
  - baseline Next configuration.
- `app/[[...path]]/route.js`
  - catch-all Next route that serves the existing CLTCH HTML/assets and blocks internal folders.
- Commands:
  - `npm run dev`
  - `npm run build`
  - `npm run start`

## Current operational notes

- EstateHat and CLTCH.NTWRK are separated by explicit Firebase project deploy targets.
- CLTCH Hosting deploy target is `cltch-ntwrk`.
- CLTCH deploys now hard-stop unless `npm run deploy:hosting` is run from the CLTCH repo root and the repo identity matches `cltch-ntwrk`.
- Plaid code remains present but inactive on the live CLTCH website path.
- The backend boundary now includes `/api/health` and `/api/session/bootstrap`, plus Hosting rewrites for Stripe and Plaid function routes.

## Recommended reading order for future recovery work

1. `DOCS_INDEX.md`
2. `SYSTEM_BASELINE_2026-04-01.md`
3. `PROJECT_STATUS.md`
4. `AUTH_RECOVERY_2026-04-01.md`
5. `SECURITY_PERFORMANCE.md`
6. `HANDOFF_2026-04-17.md`
