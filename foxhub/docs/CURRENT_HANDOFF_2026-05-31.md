# FoxHub Current Handoff - 2026-10-15

## Purpose

This is the primary current-state handoff for FoxHub. Older dated docs remain as implementation history, but start here for the live deployed state, recent feature work, and verification.

To avoid duplicate status drift, keep live URLs, latest deploy verification, and current production guards in this file. Dated feature docs should hold implementation details, and `PROJECT_STATUS.md` should stay a short chronological index.

## Live Surface

- Active Firebase project: `foxhub-c984b`
- Prior Hosting URL: `https://foxhub-superapp.web.app` now redirects to `https://foxhub-c984b.web.app`
- Active copied Hosting URL: `https://foxhub-c984b.web.app`
- Sign-in route: `https://foxhub-c984b.web.app/signin`
- Sign-up help route: `https://foxhub-c984b.web.app/feedback`
- Management route: `https://foxhub-c984b.web.app/management`
- Preferred public domain target: `https://foxhub.com`
- Current hosted mode: Vite static bundle from `dist`
- Current auth mode: Firebase-backed Auth/Firestore runtime
- Latest verified copied Hosting `Last-Modified`: `Sat, 01 Aug 2026 12:10:43 GMT`

## Current Product State

FoxHub is an interactive alpha shell, not a production banking/payment processor.

Currently installed:

- Next.js app/backend foundation
- Vite static Hosting bundle
- local fallback persistence
- optional Firebase-backed runtime
- native mobile locked mode when Firebase is not configured
- lazy-loaded authenticated app shell
- runtime error boundaries, lazy chunk retries, and live smoke verification
- Home starts on the `Workflow queue` main workflow
- landing page with public footer routes
- consolidated `/signin` page for member sign-in and sign-up
- ad-ready canonical, Open Graph, and Twitter preview metadata on the static public entry
- public `/feedback` sign-up help route
- chat, circles, wallet, discover, channels, Moments, marketplace, services, tools, and operator surfaces
- OneID-oriented identity/profile flow
- member profile photo upload for public OneID cards
- email/password-only user-facing auth flow
- Firebase email password reset flow with a sign-in page recovery link and validated new-password page
- browser notifications, device/session, audit, and operator-control surfaces
- consolidated Management dashboard for staff, managers, moderators, and founder-level review
- dedicated `/management` page for managers, founders, and administrators
- explicit Next route files for `/management`, `/landing`, `/comparison`, `/signin`, and `/feedback`
- staff-only Management workspace navigation for staff/management accounts
- operator controls for trust, risk, settlements, compliance, notifications, audit, and copilot triage
- member self-service Account controls for profile, security, connections, notifications, support, disputes, and security concerns
- staff support operations controls for disputes, fraud holds, security incidents, support alerts, account recovery, and devices
- expanded Organizer registry with 220 components
- Android and Windows package paths

## Recent Shipped Work

### Network UX and Stripe Webhook Stability

- The member shell now announces offline and reconnect states accessibly.
- Lazy-chunk recovery uses a one-time URL marker when `sessionStorage` is blocked and removes the marker after the app shell loads.
- Both Stripe webhook paths validate signatures and payloads, deduplicate event IDs transactionally, and store event metadata without the full payload.
- Validation passed: `npm test` 34/34, including 4/4 focused runtime reliability tests; Vite and Next production builds passed.
- Hosting-only deployment to `foxhub-c984b` completed on October 15, 2026. Post-deploy smoke passed at 390px and 1440px for public pages, sign-in, password recovery, and footer behavior; `/`, `/signin`, `/management`, `/feedback`, and `/android/` returned HTTP 200 with no JavaScript errors. The authenticated member layout was not exercised, and the Stripe webhook was not live-tested.
- The webhook backend was not deployed. See `docs/NETWORK_AND_STRIPE_WEBHOOK_STABILITY_2026-10-15.md` for the current deployment limits and validation record.

### Main Workflow And Dashboard Route Guard

- Home now starts from `Workflow queue`, making the optimized workflow the main member/staff launch path.
- Added explicit Next route files for `/management`, `/landing`, and `/comparison` so dashboard access does not depend only on static Hosting rewrites.
- Staff accounts see the Management dashboard lane; member accounts remain blocked from `/management`.
- `scripts/release-smoke.mjs` and `scripts/live-smoke.mjs` now require `Workflow queue`, `Run daily member loop`, `Open Management dashboard`, and `Management locked` markers.
- Required verification for workflow/dashboard changes: `npm test`, `npm run build`, `npm run smoke:public`, `npm run deploy:hosting`, and `npm run smoke:live`.
- Deploy verified at `https://foxhub-c984b.web.app` with latest live timestamp `Sat, 01 Aug 2026 12:10:43 GMT`.
- Detailed record: `docs/MAIN_WORKFLOW_AND_DASHBOARD_ROUTE_GUARD_2026-08-01.md`

### foxhub-superapp Hosting Disabled

- Disabled Firebase Hosting for prior project `foxhub-superapp`.
- Verified `https://foxhub-superapp.web.app/` returns `404 Not Found` and no app root.
- Confirmed `https://foxhub-c984b.web.app` remains live and passes `npm run smoke:live`.
- Detailed record: `docs/FOXHUB_SUPERAPP_UNDEPLOY_2026-06-12.md`

### foxhub-superapp Redirect

- Re-enabled prior `foxhub-superapp` Hosting as a redirect-only site.
- Old root and nested paths now return `301` to `https://foxhub-c984b.web.app`.
- Confirmed `https://foxhub-c984b.web.app` still passes live smoke.
- Detailed record: `docs/FOXHUB_SUPERAPP_REDIRECT_2026-06-12.md`

### foxhub-c984b Project Copy

- Copied the current FoxHub static Hosting site to Firebase project `foxhub-c984b`.
- Created a Firebase Web App named `FoxHub` in `foxhub-c984b`.
- Built the copied bundle with `foxhub-c984b` Firebase runtime config and `https://foxhub-c984b.web.app` public metadata.
- Deployed through `blacklionmediastudio@gmail.com`.
- Live smoke passed for `/`, `/signin`, `/management`, and `/feedback`.
- Verified live bundle markers for `foxhub-c984b`, `foxhub-c984b.firebaseapp.com`, and the new Web App ID.
- Firestore default database is active in `foxhub-c984b`, and `firestore.rules` was deployed successfully.
- Firestore seed data, Auth provider setup, Storage, custom domains, and Next API Functions remain follow-up work if `foxhub-c984b` becomes the primary project.
- Detailed record: `docs/FOXHUB_C984B_PROJECT_COPY_2026-06-12.md`

### Runtime Reliability Hardening

- Added top-level and authenticated-shell React runtime error boundaries.
- Added recovery actions for render failures instead of blank-screen failure.
- Added retry and one-time reload behavior for stale lazy chunk/deploy failures.
- Added local runtime event logging for browser errors, unhandled rejections, lazy import retries, and online/offline transitions.
- Added `npm run smoke:live` to validate deployed routes and bundle markers after Hosting deploy.
- Verification: `npm run release:check`, `npm run deploy:hosting`, and `npm run smoke:live` passed.
- Latest live timestamp: `Fri, 12 Jun 2026 13:12:14 GMT`.
- Detailed record: `docs/RUNTIME_RELIABILITY_HARDENING_2026-06-12.md`

### Member Profile Photos

- Members can add, replace, and remove a `Profile photo` from the profile editor.
- The control accepts JPG, JPEG, PNG, GIF, and SVG vector images through the shared optimized upload pipeline.
- Saved photos render in the live public OneID preview and public profile modal.
- Local and Firebase profile persistence now carry `profilePhoto`, `profilePhotoUrl`, `profilePhotoName`, and `profilePhotoType`.
- Verification: `node --check` passed for changed plain JS files and `npm run release:check` passed with profile photo smoke markers and a local persistence regression assertion.
- Detailed record: `docs/PROFILE_PHOTO_UPLOAD_2026-06-12.md`

### Windows Browser Management Gate

- Staff clicking `Management` now opens a Management credentials gate before the staff dashboard renders.
- Management access is blocked for Android and iOS browser sessions.
- Windows browser sessions use a Windows Hello / platform security-key prompt so sensitive verification happens outside the React page.
- Backend support is implemented through `POST /api/management/webauthn/challenge` and `POST /api/management/webauthn/verify`, with Firebase ID-token validation, server-side staff/management checks, Windows user-agent rejection, challenge validation, Firestore access events, and short Management session records.
- The static hosted bundle keeps a Windows Hello local fallback only when the backend challenge route is unavailable, so staff are not locked out before Blaze enables the API deploy.
- Desktop nav, bottom nav, header Management entry, and quick menu paths share the same gate.
- Verification: `npm run release:check` passed and `npm run build:next:functions` passed with the Management WebAuthn API routes included in the Next build.
- Deployment note: `npm run deploy:next` reached Firebase deployment but was blocked because `foxhub-superapp` is not on the Blaze pay-as-you-go plan, so the backend-required client was not published over the current live static Hosting bundle.
- Detailed record: `docs/WINDOWS_BROWSER_MANAGEMENT_GATE_2026-06-12.md`

### Local People and Merchant Application

- Member profiles now carry ZIP/postal data across signup, profile editing, local persistence, and Firebase persistence.
- Home now shows `People local to you`, matching exact ZIP first and prompting members to add a ZIP when missing.
- Services now includes an in-app merchant application that creates a staff-reviewable onboarding queue item, risk signal, notification, profile merchant status, and audit event.
- Once staff advances the application to active, the member view switches from application intake to an approved `Merchant dashboard` with inventory, orders, storefront settings, fulfillment, returns, and payout cadence controls.
- Verification: `npm run release:check` passed, Firebase Hosting deploy passed, live `/`, `/signin`, `/management`, and `/feedback` returned HTTP 200, and live assets contained the local people, merchant application, and approved seller dashboard markers.
- Detailed record: `docs/LOCAL_PEOPLE_AND_MERCHANT_APPLICATION_2026-06-11.md`

### Member and Staff Controls Expansion

- Members now have a Home `Account controls` surface for profile/account settings, connection permissions, messages/blocking, notifications, support/dispute help, security concern reporting, device-session review, and trusted-contact management.
- Staff Management now includes support operations, support case creation, fraud/security escalation, support priority mode, support macros, support alerts, dispute queue, fraud hold queue, security concern queue, and device/account recovery review.
- Detailed record: `docs/MEMBER_STAFF_CONTROLS_EXPANSION_2026-06-11.md`

### Staff Management Console Separation

- Staff and management accounts no longer receive the member workspace navigation.
- Management accounts are limited to Management, Staff Tools, and Control Library.
- Management route/tab guarding redirects staff users away from member tabs while allowing Staff Tools and Control Library to stay active.
- The Management workspace now exposes actual staff controls for trust recalculation, operator copilot, priority alerts, notification digest, audit, merchant risk, settlements, and compliance.
- Member application, verification, moderation, and applicant email queues remain available.
- Detailed record: `docs/STAFF_MANAGEMENT_CONSOLE_2026-06-11.md`

### Ad Traffic Prep

- Static hosted entry now includes canonical URL, Open Graph, and Twitter large-card metadata for ad/social previews.
- Next metadata now matches the public ad positioning.
- Public landing copy now leads with `Your private circle for local trust.`
- The primary landing CTA is `Request early access`.
- The first screen now explains invite-priority vs Management-review access before the proof tiles.
- A four-step public section now explains profile creation, invite/request choice, approval, and sign-up help.
- Social cards now use the self-hosted `/foxhub-social-preview.png` image.
- Release smoke now verifies the canonical and social-preview tags.
- Suggested paid/social links should keep `utm_source`, `utm_medium`, and `utm_campaign` parameters.
- Detailed record: `docs/AD_TRAFFIC_PREP_2026-06-10.md`

### Auth Workflow Consolidation

- Member sign-in and sign-up now share `/signin`.
- The page has a sign-in/sign-up switch instead of a separate public sign-up overlay.
- Sign-in stays nimble: email, password, forgot-password recovery, and Management entry.
- Sign-up is streamlined to credentials, access path, profile basics, and 18+ date-of-birth gate.
- Landing/footer sign-up actions now open `/signin` in sign-up mode.
- Invite-code sign-ups correctly state that the current user tied to the invite must approve or deny the request before access opens.
- No-invite sign-ups correctly state that the application goes to FoxHub Management for approval or denial.
- `/management` remains the separate staff/founder/admin route and is forced to staff sign-in mode.
- Detailed record: `docs/AUTH_WORKFLOW_CONSOLIDATION_2026-06-03.md`

### Local Auth Registration Guard

- Static/local sign-in now requires a registered saved profile instead of creating a new account from any email.
- Local sign-up stores a password hash and sign-in rejects mismatched passwords when a hash exists.
- Live Hosting now builds with Firebase web app config, so hosted sign-in verifies credentials through Firebase Auth instead of the local fallback.
- Auth UI is consolidated to one path: sign up with email/password, then sign in with the same email/password after invite approval or manager review.
- User-facing Google and email-link sign-in controls were removed from the sign-in and sign-up paths.
- Firestore rules now allow platform operators to read applicant user records, update the narrow applicant access decision fields, and queue transactional email event records.
- Forgot-password recovery now sends the Firebase password reset email, validates the emailed action code on `/signin?mode=reset`, and lets the user set a new password before returning to sign-in.
- Detailed record: `docs/LOCAL_AUTH_REGISTRATION_GUARD_2026-06-01.md`

### Sign-In Enrichment

- Enriched `/signin` with return context, runtime/account cues, access highlights, and app preview.
- Detailed record: `docs/SIGNIN_AND_MOMENTS_ENRICHMENT_2026-05-31.md`

### Moments Enrichment

- Expanded reactions and added photo posting with attachment support.
- Detailed record: `docs/SIGNIN_AND_MOMENTS_ENRICHMENT_2026-05-31.md`

### Stripe Billing Components

- Stripe packages and webhook scaffolding are installed.
- Added a guarded Stripe Billing panel in Tools/API connectors with readiness cards, plan cards, setup actions, and live-billing warning.

### Management Dashboard and Founder Logon

- Consolidated staff, manager, moderator, and founder workflows into the Management dashboard.
- Added a dedicated `/management` route with manager/founder/admin sign-in copy and Management-first routing.
- `/management` now derives the active shell tab as `staff` immediately, so authenticated founder/manager/admin sessions render the Management dashboard instead of a previously stored member tab.
- Founder manager sign-in uses Firebase Auth in live mode, lands on Management first, and shows an enriched founder owner/operator scope surface.
- Founder has Firebase custom claims for `platformOperator`, `owner`, `founder`, role `owner`, and full owner scopes.
- Founder operator access self-upgrades to owner/full scopes if an older narrower staff record already exists.
- Firestore rules include a founder UID fallback so the owner account can initialize its own user profile/subtree and operator access even before the first Firestore profile document exists.
- Firebase repository profile canonicalization forces `founder@foxhubapp.com` to stay onboarded, priority access, founder role, and out of the waitlist/monthly review queue.
- Founder invite creation has a repeatable smoke check that creates a founder-owned invite and immediately retires the smoke invite.
- Detailed record: `docs/MANAGEMENT_DASHBOARD_FOUNDER_LOGON_2026-05-31.md`
- Current hardening record: `docs/FOUNDER_MANAGEMENT_AUTH_HARDENING_2026-06-02.md`

### Applicant Manager Review Emails

- No-invite signups now stay in manager review for approval, priority approval, hold, or denial.
- Manager decisions update the applicant access state and create applicant email notice records for approval, denial, or follow-up.
- Detailed record: `docs/APPLICANT_MANAGER_REVIEW_EMAILS_2026-05-31.md`

## Verification

Completed before latest deploy:

- `npm run release:check` (pass)
  - `npm test` (pass)
  - `npm run smoke:public` (pass)
  - `npm run build` (pass)
- local built `/signin` HTTP 200 from Vite preview
- live `/signin` HTTP 200 after deploy
- live `/management` HTTP 200 after deploy
- `npm run smoke:founder:invite` did not run to completion because `FOXHUB_AUTH_SMOKE_EMAIL` was not set in the shell

Previously completed auth/founder checks:

- `npm run smoke:auth` (pass; unknown-user rejection)
- `FOXHUB_AUTH_SMOKE_EMAIL=... FOXHUB_AUTH_SMOKE_PASSWORD=... npm run smoke:auth` (pass; founder registered account and owner claims)
- `FOXHUB_AUTH_SMOKE_EMAIL=... FOXHUB_AUTH_SMOKE_PASSWORD=... node scripts/founder-repository-smoke.mjs` (pass; founder Firebase repository sign-in and post-login Firestore writes)
- Founder invite smoke now supports comma-separated multi-account verification through `FOXHUB_AUTH_SMOKE_EMAILS`; latest record: `docs/INVITE_PERMISSION_STREAMLINE_2026-06-18.md`.

Latest deployment:

- `npm run deploy:hosting` (pass)
- Live `/` HTTP 200
- Live campaign URL with `utm_source`, `utm_medium`, and `utm_campaign` HTTP 200
- Live `/signin` HTTP 200
- Live `/feedback` HTTP 200
- Live `/management` HTTP 200
- Live `assets/FoxHubShell-QmS3-Bjo.js` HTTP 200
- Live `/foxhub-social-preview.png` HTTP 200
- Live desktop and mobile campaign screenshots rendered after deploy
- Live `Last-Modified`: `Thu, 11 Jun 2026 12:24:51 GMT`

Live bundle markers verified:

- canonical public URL metadata
- Open Graph title, description, and image metadata
- Twitter large-card metadata
- `Staff control center for access, trust, risk, and operations.`
- `Staff and management accounts now stay in operator mode.`
- `Staff Tools`
- `Control Library`
- `Merchant risk controls`
- `Settlement controls`
- `Compliance controls`
- `Operator copilot insights`
- `Account controls`
- `Member self-service`
- `Manage your profile, security, connections, and support.`
- `Support operations`
- `Support, disputes, fraud, and security stay in staff view.`
- `Fraud hold queue`
- `Security concerns`
- `Device and account recovery review`
- `Stripe Billing`
- `Prepare Stripe billing`
- `Live billing guard`
- `Verified user badge`
- `Merchant tools`
- `Mini-app billing`
- `stripe-billing-section`
- `stripe-readiness-card`
- `stripe-plan-card`
- `stripe-billing-warning`
- `Come back to your people, posts, and local signal`
- `Single sign-on rule`
- `The current user who invited you must approve or deny`
- `No invite yet? Send the application to FoxHub Management`
- `Sign up`
- `founder@foxhubapp.com`
- `Invalid manager credentials`
- `Founder profile`
- `Primary operator`
- `Applicant email notices`
- `A FoxHub manager will approve or deny the application`
- `No registered FoxHub account was found for that email`
- `Use the email and password created during sign-up`
- `There is no alternate sign-in path`
- `Forgot password?`
- `Password recovery`
- `Create a new FoxHub password`
- `FoxHub Management`
- `Management sign-in`
- `One combined dashboard`

## Production Guards

Do not treat Stripe Billing as live payment processing until all of the following are configured and tested:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Stripe Product and Price IDs for each billing plan
- hosted Checkout Session creation
- Billing Portal Session creation
- success and cancel URLs
- legal billing/subscription copy
- refund, cancellation, dispute, tax, and receipt handling
- server-authoritative entitlement updates
- live webhook signature verification in the deployed backend path

Photo attachments currently persist as optimized data URL attachments for static/local mode. Chat uploads accept JPG, JPEG, PNG, GIF, and sanitized SVG vector images; raster uploads compress client-side when useful, GIFs are preserved, and repository sanitization only keeps supported `data:image` URLs. For production, move media to object storage with signed URLs, server-side validation, moderation hooks, and content/security scanning.

Applicant decision email notices are recorded in the current app state in static local mode. In Firebase mode, decisions also queue `transactionalEmailEvents`; production delivery still needs the transactional email sender configuration and template review.

Staff setup notes: Management includes a populated `Add new FoxHub Staff Member` card, a 12-role staff template library, a visible staff setup queue, and loaded staff controls for access review, permission audit, trust/safety, fraud, disputes, compliance, merchant risk, settlements, and device recovery. In static/local mode it stages records in `pendingStaffMembers` and `operatorAccessRecords`, then writes staff audit and notification events. Production staff invitation still needs the backend invite sender and custom-claim assignment path before it should be treated as live account provisioning.

Complaint-zero notes: Member Account controls now include the eight complaint-prevention categories, and Management includes a matching `Complaint-zero dashboard` plus staff controls. The taxonomy is Feed Control, Commercial Boundaries, Safety and Moderation, Trust and Anti-Spam, Privacy and Account Control, Attention and Notification Health, Support and Dispute Resolution, and Product Guardrails.

Footer notes: Footer boilerplates now include quick-access links for Privacy Policy, Complaint Prevention, Staff Controls, Safety Center, System Status, and Contact Support. The footer page copy has been refreshed around complaint-zero controls, member controls, staff controls, privacy/account visibility, trust standards, support paths, status, release notes, and staff control updates.

Staff improvement roadmap notes: Eight parallel agent workstreams produced 120 staff-side improvement records under `src/staffImprovementPacks/`. Management now includes a normalized `Staff improvement roadmap` panel covering Core Ops, Workflow Intel, Risk Quality, Resilience Governance, Case Support Expansion, Fraud Commerce Expansion, Trust Privacy Expansion, and Platform Governance Expansion.

Photo upload and performance notes: `src/mediaUploads.js` centralizes supported image types, SVG sanitization, raster compression, upload limits, and accepted data URL checks. Chat attachment UI supports click upload and drag/drop, and the shell uses lazy/async image decoding plus CSS `content-visibility` for heavier repeated surfaces.

Captcha robot guard notes: Member signup surfaces now include a first-party `Robot check` backed by `src/captchaGuard.js`. The local and Firebase repository signup paths reject missing, wrong, stale, or honeypot-filled captcha proofs, so direct scripted signup payloads cannot bypass the UI check.

Android APK notes: The Android debug APK was refreshed on 2026-06-11 with `npm run package:android:debug`. Current output is `release/FoxHub-Android-Debug-0.1.0.apk`, size `6,347,588` bytes, containing `index-DKpyfyTK.js`, `index-CFbtPTaO.css`, `FoxHubShell-CibUg65P.js`, `mediaUploads-CJMXZ47N.js`, `repository-local-BPuhNiuR.js`, and `repository-firebase-CiF86nps.js`. iOS was intentionally not refreshed.

Signup workflow notes: The `/signin` sign-up path no longer gets forced back to sign-in on route mount. Member signup surfaces now show `Signup readiness` before submit, require a strong password in every backend mode, include the 18+ DOB field in the onboarding auth path, and keep submit disabled until credentials, access path, profile basics, DOB, and robot check are complete.

Launch support notes: The landing page now shows `Launch support is open`, and the public sign-up help page captures campaign, URL, referrer, viewport, time zone, and user-agent context in local feedback records and the support email draft. Feedback categories now include captcha, signup readiness, and ad-link issues.

The founder manager email `founder@foxhubapp.com` is provisioned in Firebase Auth for the live Firebase-backed runtime. Password verification was confirmed through Firebase Identity Toolkit on 2026-06-01.

## Durable Docs

Use these in order:

1. `docs/CURRENT_HANDOFF_2026-05-31.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/DOCS_INDEX.md`
4. `docs/AUTH_WORKFLOW_CONSOLIDATION_2026-06-03.md`
5. `docs/FOUNDER_MANAGEMENT_AUTH_HARDENING_2026-06-02.md`
6. `docs/ARCHITECTURE.md`
7. `docs/FIREBASE_SETUP.md`
8. `docs/PRODUCTION_BACKEND_READINESS.md`

Older dated docs are implementation records. They should not be treated as fresher than this handoff unless a later `Last updated` date says otherwise.

## Common Commands

```bash
npm run smoke:auth
npm run smoke:public
npm test
npm run deploy:hosting
```

Package paths still exist for Android, iOS, and Windows, but the latest live verification in this handoff is for Firebase Hosting only.
