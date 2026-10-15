# FoxHub Docs Index

Latest implementation handoff: [October 15 workspace UX and loading performance](WORKSPACE_UX_AND_LAZY_LOADING_2026-10-15.md).

Last updated: 2026-10-15

This file is the starting point for FoxHub repo documentation.

- `NETWORK_AND_STRIPE_WEBHOOK_STABILITY_2026-10-15.md`
  - accessible offline/reconnect feedback, lazy-chunk recovery, focused workspace feeds, Stripe webhook validation, and validation/deployment limits
- `WORKSPACE_UX_AND_LAZY_LOADING_2026-10-15.md`
  - accessible clear-search control and lazy-loaded workspace chunks, with build evidence and source-only deployment status

## Foundation docs

- `CURRENT_HANDOFF_2026-05-31.md`
  - primary current-state handoff, latest live Hosting verification, production guards, and consolidated doc order
- `ARCHITECTURE.md`
  - current high-level product and repository architecture
- `PROJECT_STATUS.md`
  - concise chronological changelog; avoids repeating current deploy details from the handoff
- `AUTH_WORKFLOW_CONSOLIDATION_2026-06-03.md`
  - consolidated member `/signin` route, sign-in/sign-up switch, streamlined sign-up workflow, invite/sponsor approval copy, verification, and deploy record
- `AD_TRAFFIC_PREP_2026-06-10.md`
  - pre-ad public metadata pass, canonical/social preview tags, UTM ad links, launch guardrails, and release-smoke coverage
- `STAFF_MANAGEMENT_CONSOLE_2026-06-11.md`
  - staff-only workspace navigation, member-tab removal for management accounts, operator controls, risk/compliance/settlement panels, and verification
- `ADD_STAFF_MEMBER_CONTROL_2026-06-11.md`
  - populated Management card for staging new FoxHub staff, operator access, audit, notification, and setup queue records
- `COMPLAINT_ZERO_CONTROLS_2026-06-11.md`
  - member and staff controls for Feed Control, Commercial Boundaries, Safety and Moderation, Trust and Anti-Spam, Privacy and Account Control, Attention and Notification Health, Support and Dispute Resolution, and Product Guardrails
- `STAFF_IMPROVEMENT_ROADMAP_2026-06-11.md`
  - eight-agent, 120-control staff-side roadmap covering core ops, workflow intel, risk quality, resilience governance, case support, fraud commerce, trust privacy, and platform governance workstreams
- `PHOTO_UPLOAD_PERFORMANCE_OPTIMIZATION_2026-06-11.md`
  - JPG/JPEG/PNG/GIF/SVG upload handling, client-side image optimization, SVG sanitization, lazy image decoding, and workspace rendering performance guards
- `CAPTCHA_ROBOT_GUARD_2026-06-11.md`
  - first-party robot check for member signup, hidden honeypot field, repository-side captcha proof enforcement, and regression tests
- `SIGNUP_WORKFLOW_GUI_HARDENING_2026-06-11.md`
  - signup route-mode fix, readiness checklist, DOB guard, strong-password consistency, and GUI hardening
- `LAUNCH_SUPPORT_FEEDBACK_CONTEXT_2026-06-11.md`
  - landing launch-support note, signup feedback context capture, ad/campaign diagnostics, and support email enrichment
- `LOCAL_PEOPLE_AND_MERCHANT_APPLICATION_2026-06-11.md`
  - ZIP-based `People local to you`, profile ZIP persistence, and simple member merchant application intake into staff review
- `WINDOWS_BROWSER_MANAGEMENT_GATE_2026-06-12.md`
  - Windows-browser-only Management credential pop-up for staff dashboard access and Android/iOS browser blocking
- `PROFILE_PHOTO_UPLOAD_2026-06-12.md`
  - member profile photo upload, accepted image formats, OneID preview/public-profile rendering, persistence fields, and verification
- `RUNTIME_RELIABILITY_HARDENING_2026-06-12.md`
  - runtime error boundaries, lazy chunk retry/reload behavior, live smoke script, deploy evidence, and remaining production reliability notes
- `INVITE_PERMISSION_STREAMLINE_2026-06-18.md`
  - live invite creation permission repair, account-neutral Firestore invite-create rule, server-owned invite replacement timestamps, and multi-account founder invite smoke
- `FOXHUB_C984B_PROJECT_COPY_2026-06-12.md`
  - copied FoxHub Hosting deploy to `foxhub-c984b`, target Firebase Web App setup, target URL metadata, live smoke, and follow-up notes
- `FOXHUB_SUPERAPP_UNDEPLOY_2026-06-12.md`
  - disabled prior `foxhub-superapp` Hosting and verified `foxhub-c984b` remains live
- `FOXHUB_SUPERAPP_REDIRECT_2026-06-12.md`
  - redirect-only deploy from prior `foxhub-superapp` Hosting to active `foxhub-c984b`
- `ANDROID_APK_REFRESH_2026-06-11.md`
  - Android debug APK refreshed from the current web bundle after staff controls, upload optimization, performance pass, and captcha guard
- `FOOTER_BOILERPLATE_OPTIMIZATION_2026-06-11.md`
  - latest footer boilerplate routes and quick-access links for privacy, complaint prevention, staff controls, safety, status, and support
- `MEMBER_STAFF_CONTROLS_EXPANSION_2026-06-11.md`
  - member self-service account/security/connection/support controls plus expanded staff support, dispute, fraud, security, and recovery operations controls
- `MEMBER_STAFF_DATABASE_SPLIT_2026-06-04.md`
  - separate member profile database, staff profile database, permissions database, local fallback mirror, GUI mode labels, and verification record
- `LOCAL_AUTH_REGISTRATION_GUARD_2026-06-01.md`
  - local/static sign-in registration guard, password-hash checks, and regression coverage
- `HANDOFF_2026-04-17.md`
  - recovery notes for the latest landing page, mobile/desktop optimization, UX/UI features, production components, deploy target, and smoke tests
- `SMOKE_DEPLOY_2026-04-22.md`
  - current smoke-test and Firebase Hosting deployment record for the Next foundation plus static hosted bundle
- `HOME_TAB_UX_ENRICHMENT_2026-04-28.md`
  - Home tab enrichment record for the today compass, momentum panel, circle anchors, official signals, wallet shortcuts, verification, and deploy
- `HOME_DASHBOARD_LAYOUT_GUARD_2026-04-30.md`
  - Home dashboard shell-width guard, overlap root cause, hardened breakpoints, and deploy record
- `ORGANIZER_120_COMPONENT_EXPANSION_2026-05-27.md`
  - 120 additional Organizer components, priority model, balanced 220-component registry count, validation notes, and deploy record
- `FOOTER_BOILERPLATE_UPGRADE_2026-05-27.md`
  - global footer boilerplate expansion from 3 groups to 8 groups, footer summary metadata, styling, verification, and deploy account notes
- `ANDROID_WINDOWS_REFRESH_2026-05-27.md`
  - Android APK and Windows portable package refresh after the splash footer fix, including commands, output paths, and verification
- `APK_HOSTING_ATTEMPT_2026-06-04.md`
  - fresh APK build, Firebase Hosting Spark-plan executable-file blocker, cleanup, and next hosting options
- `HOME_FEED_REWORK_2026-06-04.md`
  - Home feed rework with Facebook-like stream behavior, Reddit-style sorting/voting, feed scopes, and verification
- `MEMBER_EMAIL_PROFILE_RULES_2026-06-04.md`
  - member email vs username/public display name rules, FoxHub-domain staff reservation, seed email cleanup, and regression coverage
- `RAPPORT_SECTION_REWORK_2026-06-04.md`
  - Rapport command center, trust/relationship workspace cleanup, removed duplicate feed/market/media surfaces, verification, and deploy target
- `GLOBAL_SECTION_FEEDS_2026-06-04.md`
  - Home-style feed surfaces added across non-Home workspaces, sorting/scoping behavior, section card model, verification notes
- `PUBLIC_PROFILE_VIEWER_2026-06-04.md`
  - public profile modal, safe public fields, Home/Rapport/Market entry points, smoke markers, and verification notes
- `SELF_PROFILE_EDITOR_UPGRADE_2026-06-05.md`
  - upgraded self-profile editor, live public preview, grouped profile/account/invite sections, sticky save bar, smoke markers
- `THEME_EXPANSION_2026-06-05.md`
  - 20 selectable color themes, shared theme registry, direct header picker, expanded persistence, smoke markers
- `PREMIUM_THEME_LOCKS_2026-06-06.md`
  - Premium Silver, Premium Gold, and Dark Marble paid theme gating, member entitlement rules, staff bypass, verification, deploy, and archive record
- `SIGNUP_FEEDBACK_PAGE_2026-06-06.md`
  - public `/feedback` sign-up difficulty page, sign-up help links, local feedback capture, support email draft, Green Composite default theme, verification, deploy, and archive record
- `FOUNDER_PROFILE_RETENTION_FIX_2026-06-06.md`
  - founder profile identity retention fix for `@founder` resets, immediate profile save persistence, stale snapshot guard, verification, deploy, and archive record
- `PROFILE_INSERT_PLACEHOLDERS_2026-06-06.md`
  - neutral Insert-style placeholders for new account/profile fields, blank default bio seed, verification, deploy, and archive record
- `PUBLIC_DISPLAY_NAME_RETENTION_2026-06-06.md`
  - Public Display name persistence across current accounts, future signups, local/Firebase profile storage, and stale display-name repair
- `MANAGEMENT_LOGIN_GUARD_2026-06-06.md`
  - management route member-login block, exact `Not Permitted.` error, verification, and deploy record
- `STAFF_MEMBER_LOGIN_SEPARATION_2026-06-06.md`
  - two-way staff/member sign-in separation, staff blocked from member route, members blocked from management route, exact `Not Permitted.` error, verification, and deploy record
- `HOME_MYSPACE_SOCIAL_COMPONENTS_2026-06-05.md`
  - Home page friend activity feed, bulletin board posts, blog/journal posts, visitor preview, smoke markers
- `SIGNUP_AGE_VERIFICATION_2026-06-05.md`
  - 18+ member signup gate, repository-level enforcement, age-verification marker, and DOB privacy note
- `INVITE_CODE_ROTATION_2026-06-05.md`
  - one-at-a-time invite code rotation, older active/sponsor-pending code expiration, and regression coverage
- `INVITE_APPROVAL_CONNECTION_2026-06-05.md`
  - automatic Rapport contact creation between sponsor/inviter and approved invited member
- `SOLIDART_OWNER_PRIVILEGE_REPAIR_2026-06-05.md`
  - solidart owner email/UID privilege repair, Management routing, Firestore owner bootstrap, and related rules drift fixes
- `FOOTER_PUBLIC_ROUTES_2026-05-27.md`
  - public footer destination routes for legal, support, trust, business, developer, product, company, and status boilerplates
- `RELEASE_CHECKLIST.md`
  - required account, web/package verification, smoke routes, package outputs, and release-note requirements
- `VERSIONING_AND_PACKAGING.md`
  - version bump rules, installed release scripts, package output paths, and signing status
- `PRODUCTION_BACKEND_READINESS.md`
  - current static/Next backend state, server-authority requirements, and production backend gaps
- `ADVERTISING_READINESS_2026-05-28.md`
  - advertising prep, UTM capture, stronger footer page copy, suggested ad links, ad angles, guardrails, and verification
- `SIGNIN_AND_MOMENTS_ENRICHMENT_2026-05-31.md`
  - enriched sign-in page, expanded Moments reactions, Moment photo posting, repository attachment support, deployment, and live verification
- `MANAGEMENT_DASHBOARD_FOUNDER_LOGON_2026-05-31.md`
  - founder manager logon path, Management-first routing, consolidated staff/manager/moderator dashboard, profile enrichment, verification, and production auth note
- `FOUNDER_MANAGEMENT_AUTH_HARDENING_2026-06-02.md`
  - dedicated `/management` route, founder Firebase Auth/Firestore hardening, waitlist lockout fix, password recovery, applicant review permissions, founder invite verification, and repeatable smoke checks
- `APPLICANT_MANAGER_REVIEW_EMAILS_2026-05-31.md`
  - no-invite applicant manager review flow, approval/denial access updates, applicant email notice records, and Firebase transactional email event queueing
- `UNIVERSAL_BILL_PAY_2026-04-23.md`
  - Universal Bill Pay install record, state fields, wallet UI behavior, verification, deploy command, and production readiness notes
- `NEXT_FIREBASE_FUNCTIONS_ADAPTER_2026-04-22.md`
  - Next.js Firebase Functions adapter build record, deploy command, and current Blaze billing blocker
- `ANDROID_APK_REFRESH_2026-04-22.md`
  - latest Android debug APK refresh after the Next adapter and current UI/social changes
- `MATRIX_THEME_INSTALL_2026-04-22.md`
  - Day/Night/Matrix theme cycle and Matrix GUI styling record
- `CUSTOM_DOMAIN_PREP_2026-04-22.md`
  - preferred `FoxHub.com` public URL setting and Firebase Hosting custom-domain notes
- `FIREBASE_SETUP.md`
  - Firebase runtime mode, env vars, and Firestore shape

## Platform wrappers and hardening

- `IOS_WRAPPER_SETUP_2026-04-02.md`
  - exact record of the iOS wrapper work that was created in this repo
- `ANDROID_WRAPPER_SETUP_2026-04-02.md`
  - exact record of the Android wrapper work, including what succeeded and what blocked full sync in this environment
- `MOBILE_TAMPER_RESISTANCE_2026-04-02.md`
  - native hardening notes for iOS and Android, including locked backend mode and manifest/plist safeguards

## Product mechanics and shell evolution

- `SUPERAPP_MECHANICS_2026-04-02.md`
  - current FoxHub super-app mechanics, including chat-first behavior, QR infrastructure, service channels, continuity, and discovery ranking
- `MECHANICS_RULEBOOK_2026-04-02.md`
  - ordered if/then rules for the current FoxHub mechanics baseline
- `FRONTEND_AUDIT_AND_ACCESS_2026-04-02.md`
  - frontend UX pass, invite/monthly verification model, day/night theme system, and GUI audit baseline
- `PLATFORM_EXPANSION_AND_SECURITY_2026-04-03.md`
  - consolidated record of the invite flow, tutorial assistant, security hardening, connector expansion, FAQ/footer updates, premium UI pass, mobile sync, and Windows desktop setup
- `OPS_TRUST_AND_EVIDENCE_2026-04-03.md`
  - operator-driven trust, moderation, evidence, device-session, notification, and audit expansion across the latest FoxHub state
- `AUTH_PRESENCE_AND_OPERATOR_ACCESS_2026-04-03.md`
  - Google auth, email-link initiation, durable presence/read state, browser notification registration, self user-record syncing, and server-owned operator-access records
- `GUI_FEATURE_WIRING_2026-04-03.md`
  - shell-level GUI wiring pass that surfaced read state, member records, notification subscriptions, operator access, and reorganized where those features live
- `PLATFORM_COMPONENTS_AND_OPTIMIZATION_2026-04-10.md`
  - full install pass for 12 platform components plus optimization and validation notes
- `COMPONENTS_FEATURES_INSTALL_2026-04-12.md`
  - full install pass for the 50-item expansion set (root + functions dependency additions)
- `GUI_CATERING_EXPANSION_2026-04-12.md`
  - Fox Board GUI pass that exposes expansion lanes and installed toolkit cards in the shell
- `BLUEPRINT_FUNCTIONALIZATION_2026-04-12.md`
  - 100-component Blueprint room functionalization, category action mapping, dexterity optimization, validation, and deploy record
- `MOBILE_WRAPPER_SYNC_2026-04-12.md`
  - Android and iOS Capacitor sync record after the Blueprint functionalization pass
- `PRODUCTION_COMPONENTS_INSTALL_2026-04-17.md`
  - production-readiness component install covering backend authority, push, storage, identity, RBAC, payments, search, mini-app sandboxing, maps/local commerce, moderation, analytics, smoke tests, and Functions endpoints
- `UX_UI_FEATURES_INSTALL_2026-04-17.md`
  - ordered install of the 20 UX/UI features, including the new UX/UI workspace, command actions, context rail, dashboard, stepper, review console, create menu, and persistence notes
- `GROWTH_OS_17_INSTALL_2026-04-17.md`
  - all 17 enrichment categories installed as Growth OS, including relevance grouping, activation/run mechanics, money-path friction guard, persistence, and recovery notes
- `HANDOFF_2026-04-17.md`
  - latest practical handoff for returning to the current FoxHub landing, responsive, Goodies/Hat Data naming, production component, and deploy state

## Runtime incidents and recovery

- `RUNTIME_BLANK_SCREEN_2026-04-03.md`
  - exact record of the blank-page Hosting incident, the real root cause, and the recovery path
- `HOME_WIDGET_RUNTIME_FIX_2026-04-03.md`
  - exact record of the Home-tab-only runtime failure, the missing shell prop chain, and the verification path

## Fast lookup

For the least redundant path, read `CURRENT_HANDOFF_2026-05-31.md` first. The other dated docs are retained as chronological implementation records.

### Current web app

- web/backend stack: Next.js app routes for local web and API work
- hosted bundle stack: React + Vite static build served from Firebase Hosting `dist`
- preferred public URL: `https://foxhub.com`
- direct Firebase hosted URL: `https://foxhub-superapp.web.app`
- sign-up help route: `https://foxhub-superapp.web.app/feedback`
- app entry: `src/main.jsx`
- Next app entry: `app/page.jsx`
- landing route: `app/landing/page.jsx`
- sign-in route: `app/signin/page.jsx`
- controller shell: `src/App.jsx`
- authenticated shell: `src/FoxHubShell.jsx`
- centralized UI/state rules: `src/rules.js`
- starter boilerplate layer: `src/data.js`, `src/useFoxHubStore.js`, `src/repository-local.js`, `src/repository-firebase.js`
- runtime repository selector: `src/repository.js`
- local repository: `src/repository-local.js`
- firebase repository: `src/repository-firebase.js`
- mechanics/state controller: `src/useFoxHubStore.js`
- shared styling: `src/styles.css`

### Current mobile app

- Expo app: `mobile/`
- mobile entry: `mobile/App.js`
- mobile auth/profile rules: `mobile/src/foxhubMobileCore.js`
- mobile smoke: `mobile/scripts/mobile-smoke.mjs`
- migration note: `docs/EXPO_REACT_NATIVE_MIGRATION_2026-06-13.md`

### Commands

- `npm run build`
- `npm run deploy:hosting`
- `npm run mobile`
- `npm run mobile:ios`
- `npm run mobile:android`
- `npm run mobile:web`
- `npm run mobile:smoke`

## Recovery order

1. `docs/DOCS_INDEX.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/ARCHITECTURE.md`
4. `docs/FIREBASE_SETUP.md`
5. `docs/IOS_WRAPPER_SETUP_2026-04-02.md`
6. `docs/ANDROID_WRAPPER_SETUP_2026-04-02.md`
7. `docs/MOBILE_TAMPER_RESISTANCE_2026-04-02.md`
8. `docs/SUPERAPP_MECHANICS_2026-04-02.md`
9. `docs/MECHANICS_RULEBOOK_2026-04-02.md`
10. `docs/FRONTEND_AUDIT_AND_ACCESS_2026-04-02.md`
11. `docs/RUNTIME_BLANK_SCREEN_2026-04-03.md`
12. `docs/HOME_WIDGET_RUNTIME_FIX_2026-04-03.md`
13. `docs/PLATFORM_EXPANSION_AND_SECURITY_2026-04-03.md`
14. `docs/OPS_TRUST_AND_EVIDENCE_2026-04-03.md`
15. `docs/AUTH_PRESENCE_AND_OPERATOR_ACCESS_2026-04-03.md`
16. `docs/GUI_FEATURE_WIRING_2026-04-03.md`
17. `docs/PLATFORM_COMPONENTS_AND_OPTIMIZATION_2026-04-10.md`
18. `docs/COMPONENTS_FEATURES_INSTALL_2026-04-12.md`
19. `docs/GUI_CATERING_EXPANSION_2026-04-12.md`
20. `docs/BLUEPRINT_FUNCTIONALIZATION_2026-04-12.md`
21. `docs/MOBILE_WRAPPER_SYNC_2026-04-12.md`
22. `docs/PRODUCTION_COMPONENTS_INSTALL_2026-04-17.md`
23. `docs/UX_UI_FEATURES_INSTALL_2026-04-17.md`
24. `docs/GROWTH_OS_17_INSTALL_2026-04-17.md`
25. `docs/HANDOFF_2026-04-17.md`
26. `docs/SMOKE_DEPLOY_2026-04-22.md`
27. `docs/HOME_TAB_UX_ENRICHMENT_2026-04-28.md`
28. `docs/UNIVERSAL_BILL_PAY_2026-04-23.md`
29. `docs/NEXT_FIREBASE_FUNCTIONS_ADAPTER_2026-04-22.md`
30. `docs/ANDROID_APK_REFRESH_2026-04-22.md`
31. `docs/MATRIX_THEME_INSTALL_2026-04-22.md`
32. `README.md`
