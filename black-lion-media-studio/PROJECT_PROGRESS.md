# Project Progress

Fast resume guide: [QUICK_REFERENCE.md](/home/sniper-lion-main/Documents/Black%20Lion%20Studios/QUICK_REFERENCE.md)

## Overview

This project evolved from a simple local service-request site into a deployed Firebase-hosted Next.js client portal for Black Lion Studios.

Live production URL:

- `https://black-lion-studios.web.app`
- Current Firebase Hosting URL: `https://black-lion-media-studio.web.app`

## 2026-06-12 ad traffic readiness

- Added sitewide canonical, robots, Open Graph, and Twitter card metadata.
- Added `/robots.txt` and `/sitemap.xml`.
- Added ad-safe pages for `/about`, `/services`, `/contact`, `/work`, and `/portfolio`.
- Added `/book`, `/quote`, `/support`, and six service-specific ad pages.
- Added ad-source diagnostics for UTM/referrer/path/device capture.
- Added `/ad-expansion` with 200 additional ad-readiness components across 10 workstreams.
- Added visible homepage, services-page, and footer GUI access to `/book`, `/quote`, `/support`, `/ad-expansion`, and the six service-specific ad pages.
- Added route error, global error, not-found, and loading recovery pages to avoid blank/dead-end failures.
- Added `npm run smoke:live` for deployed ad-route, metadata, robots, and sitemap verification.
- Deployed to Firebase Hosting/framework hosting and verified live smoke passed.
- Detailed record: `AD_TRAFFIC_READINESS_2026-06-12.md`

## 2026-06-12 dashboard request-form fix

- Fixed the dashboard service-request workflow by adding the missing `consultationTime` selector required by `/api/requests`.
- Added required UI validation for consultation date, budget, and timeline fields.
- Deployed and verified authenticated dashboard render, request submission, and `/api/dashboard` refresh with a disposable smoke account.

## 2026-06-21 Model Sign-up workflow

- Added public `/models` page titled `Model Sign-up`.
- Added visible homepage hero CTA: `Are you a model?`
- Added server-backed `/api/model-applications` route with same-origin mutation protection, rate limiting, Zod validation, Firestore persistence, email alert hook, signed session creation, and profile redirect after successful signup.
- Model accounts are separate from client profiles: `roles: ["model"]`, `user_type: "Model"`, `client_tier: "Model"`, and service interest `Model Sign-up`.
- Existing account emails are blocked from unauthenticated model signup to avoid password takeover; usernames are normalized and uniqueness-checked across signup, model signup, and profile update.
- Model applicants must be 18+: the form requires an 18+ acknowledgment and server validation verifies date of birth is at least 18 years old.
- Applications are limited to once every 3 months per email, with next-eligible date storage.
- No-show/late workflow added: model applications store attendance status, no-show count, and queue status; missed confirmed calls/bookings/check-ins can lower future priority.
- Tamper-resistance added: model signup uses Firestore email/username reservation locks for duplicate protection, detects another open Model Sign-up instance in another tab with `another instance of this is open`, and closes/exits after 20 minutes of no activity on the Model Sign-up page.
- Draft retention added: model form details autosave locally and restore if the applicant comes back; passwords are not stored locally. Successful signup clears the draft and writes entered details to the model application plus the separate model profile. Legal/contract/reapply/no-show/contact acknowledgments are retained in the saved records.
- Full 1099/W-2 disclosure added: model applicants must acknowledge that model projects are project-based 1099 independent-contractor opportunities, not full-time W-2 employment, and that no payroll withholding, employee benefits, guaranteed hours, or employee status are promised unless a separate written agreement says otherwise.
- Added comprehensive model profile fields for legal/stage name, username/password, DOB, contact, Instagram, portfolio/social links, measurements/styling notes, project types, modeling interests, availability, travel, compensation, usage comfort, wardrobe/styling comfort, production pace, quality standards, reliability examples, preparation process, and notes.
- Added dedicated modeling interests such as Fashion, Portrait, Lifestyle, Commercial, Product/Merch, Editorial, Fitness, Music Video, Event Promo, Beauty/Grooming, Streetwear, and Brand Campaign.
- Profile editor now renders model-specific PII and production-readiness fields as first-class inputs instead of forcing model details into raw custom field text.
- Manager `/booking-manager` now includes model-only search and review by name, username, email, phone, Instagram, city, project types, modeling interests, availability, travel, speed, quality, reliability, prep process, queue status, and no-show count.
- Installed a 100+ unit data-driven model page component inventory in `lib/model-application-components.js` and renderer in `components/model-application-component-library.js`.
- Added Model Sign-up FAQ covering 18+, separate profiles, privacy/PII, Instagram, reapply timing, no-show priority, contracts, compensation, usage rights, copyright materials, and endorsement disclosures.
- Updated legal/privacy/terms/DMCA/FAQ content for model applicant PII, adult-only signup, non-employment/no-guarantee terms, portfolio/social links, retention, copyright materials, FTC endorsement disclosure expectations, and privacy request handling.
- Verification: edited JS files passed `node --check`; `npm run build` passed; local API smokes rejected malformed JSON, empty payloads, and under-18 payloads with 400 responses. IRS and U.S. Department of Labor independent-contractor guidance was checked before adding the 1099/W-2 disclosure. New model CSS was checked for theme-variable use. Deployed with `npm run deploy:full`. Live `/models` returned HTTP 200, live content checks found Model Sign-up/FAQ/interests/legal acceptance/1099 disclosure/component inventory, live homepage contained `Are you a model?`, live `/api/model-applications` rejected an empty payload with HTTP 400, rejected an otherwise-valid payload missing the 1099 disclosure with HTTP 400, and rejected an under-18 payload with the disclosure with HTTP 400. After owner approval, a full valid live smoke submission returned HTTP 201 and created model application `BA9lxwvDTJQQm4QocCkf` plus separate model user `wSozquJowaA9VYUMhTqZ`; those smoke-test records and their duplicate-prevention lock/reservation documents were then removed with targeted Firebase CLI deletes.
- Detailed record: `MODEL_SIGN_UP_2026-06-21.md`

## 2026-06-12 manager dashboard access fix

- Staff/manager accounts can now open `/dashboard` directly instead of being forced to `/booking-manager`.
- Portal/login routing now sends staff to `/dashboard` by default, with Manager still available as a protected staff tool.
- Deployed and verified the manager account can access both `/dashboard` and `/booking-manager`.
- Detailed record: `DASHBOARD_ACCESS_FIX_2026-06-12.md`

## 2026-06-12 ad readiness expansion smoke support

- Updated `scripts/live-smoke.mjs` to include the expected `/book`, `/quote`, `/support`, and service-specific ad routes.
- Added the concise 80-component expansion note in `AD_READINESS_80_COMPONENT_EXPANSION_2026-06-12.md`.
- No deployment was performed for this bounded scripts/docs slice.

## Product scope completed

- splash landing page with sign-up incentive
- public-facing copy pass aligned to the online services company model
- public-facing copy revised again to make the service purpose and account-creation incentive more explicit
- separate client access page for sign-up and sign-in
- upgraded portal page with stronger conversion framing and denser account-entry UI
- landing page and portal redesigned into a brighter editorial product-site presentation
- landing page and portal rebuilt again to remove the old two-column/card-stack public-page structure
- portal and dashboard consolidated around a shared reusable UI layer
- authenticated client dashboard
- protected booking manager dashboard for reviewing all request activity
- separate user profile/account center
- messaging system for client communication
- service catalog presented like an online service storefront
- merch storefront for `Plugz UNTD` and `Plugz RNGD`
- authenticated ordering flow so users must be signed in before purchase-related actions
- consultation booking support with date and time selection
- shared footer boilerplate across pages
- contemporary UI refresh with stronger visual hierarchy and card-based presentation
- splash landing page rearranged to reduce repetitive section rhythm
- global day/night theme support added across public and signed-in views
- custom local brand font integrated only for explicit `Black Lion Studios` brand marks
- expanded shared UI/component kit now exceeds 50 reusable primitives and page scaffolds
- consolidated profile workspace with snapshot, readiness, contact, service, billing, shipping, links, and custom profile fields
- faster static/client-shell deployment path for page updates that do not need SSR function rebuilds
- improved responsive browser-size wrapping across shared layout, cards, forms, footer, public pages, and signed-in client surfaces
- enriched inactivity logout and single-session sign-on behavior across signed-in workspaces and the portal
- client messages can trigger SMTP email alerts to `blacklionmediastudio@gmail.com`
- SMTP settings for message alerts were loaded into the deployed Firebase SSR function and the temporary local `.env` was removed
- dashboard now includes a 40-module Black Lion Media Studio operations suite for intake, creative service production, technical support, billing, delivery, policy, growth, account, support, and manager handoff workflows
- model signup now has a separate model-account workflow, model-only profile fields, manager model search, 100+ installed page units, FAQ/legal coverage, 18+ validation, 90-day reapply limits, and no-show priority handling

## Services currently in the product

- Photography
- Videography
- Membership Sites & Support
- DJ Services
- PC Tech Services
- Beat Creation Session

## UX and behavior completed

- landing page routes users into `/portal`
- sign-in sends users into `/dashboard`
- dashboard and profile are split into separate pages
- users can update identity, billing, contact, and account-preference data
- users can now maintain expanded account, shipping, merch-interest, and lifecycle-related profile fields
- service selection populates descriptive service details
- users can submit authenticated requests tied to their account
- users can send authenticated messages to Black Lion Studios
- inactivity signs users out after 20 minutes without activity
- sign-in and sign-out changes propagate across the site and session-aware pages
- unauthenticated users are blocked from protected purchase and client-only routes before client UI loads
- theme preference persists locally and updates the whole site shell
- portal and dashboard now share reusable info-grid, checklist, and timeline patterns instead of repeated one-off markup
- dashboard includes a portal map and workspace checklist for clearer next-step guidance
- dashboard panel layout was rebalanced into a denser 12-column structure to remove wasted space
- manager-authorized accounts can access `/booking-manager` to review all requests across clients
- landing and portal now use a calmer warm-neutral visual system with softer cards and less repetitive grid rhythm
- auth-state syncing now avoids unnecessary public-page checks and redundant refresh behavior
- `/portal` was consolidated back into a static route shell with client-side query handling
- public pages now use a more asymmetrical editorial composition instead of the earlier dashboard-derived layout rhythm
- public landing and portal composition now rely on larger staged panels, open spacing, and row-based service presentation instead of stacked card grids
- a larger shared UI kit now powers public-page, portal, and messages surfaces to reduce repeated one-off markup
- landing page, portal, and dashboard now carry a fuller art-direction pass with editorial typography, warmer layered backgrounds, and more refined premium styling
- sitewide component consolidation now covers landing, portal, dashboard, manager, profile, messages, and store with shared rails, form sections, support notices, value cards, spotlight surfaces, and shortcut patterns
- landing page and portal now more directly sell account creation as the path to faster booking, saved project history, and cleaner follow-through
- landing page tune-up now adds clearer client-fit cards, account-shortcut messaging, service timing, and trust handoff details

## Architecture changes completed

Initial local architecture:

- Next.js app
- local SQLite persistence

Current architecture:

- Next.js app on Firebase Hosting framework deployment
- server runtime deployed through Firebase Functions/Cloud Run
- Firestore-backed persistence through Firebase Admin

## Backend and deployment milestones

1. Built the Next.js application structure and user flows.
2. Expanded services, dashboard, profile, consultation, and messaging functionality.
3. Migrated backend persistence from SQLite to Firestore-backed storage for production compatibility.
4. Added Firebase project configuration and deploy files.
5. Enabled required Google Cloud and Firebase APIs.
6. Created the default Firestore database.
7. Resolved multiple IAM and build pipeline blockers for Cloud Build, Artifact Registry, Cloud Run, and function source access.
8. Deployed a temporary static holding page while framework deployment issues were being resolved.
9. Completed full production deployment of the real Next.js app.
10. Fixed public invoke and runtime permission issues so live API routes work correctly.
11. Added a Firestore-backed dashboard aggregation layer and richer dashboard UI system.
12. Added a merch storefront and integrated it into public and signed-in navigation.
13. Expanded the user data model for richer account, billing, shipping, and merch-aware records.
14. Added persistent day/night theming.
15. Added additional tamper-resistant hardening through headers, same-origin checks, and tighter session handling.
16. Integrated a local custom title font, increased the visible company-name treatment size, and stored the source archive inside the project.
17. Consolidated portal and dashboard UI patterns into shared components and expanded both pages with clearer guidance panels.
18. Added a protected booking-manager dashboard, all-request aggregation API, and default manager account path.
19. Reworked the landing page and portal UX/UI into a brighter editorial layout with warmer surfaces and quieter visual hierarchy.
20. Reduced session-sync overhead, consolidated landing/portal content, and restored `/portal` to a static route path.
21. Rebuilt landing and portal composition again with a stronger editorial structure closer to the intended reference layout.
22. Reworked the public pages again into a more aggressive product-style layout with a staged hero, row-based service catalog, and cleaner portal split.
23. Added a broader 20-component shared UX/UI layer and wired it into landing, portal, and messaging surfaces.
24. Reworked landing, portal, and dashboard again toward a stronger editorial art direction with upgraded typography and calmer premium composition.
25. Expanded the shared UI layer past 50 components and replaced repeated page-local scaffolding across the rest of the site for faster maintenance and a tighter GUI system.
26. Tightened the landing and portal copy so the public-facing purpose and sign-up incentive are clearer and more conversion-oriented.
27. Fixed an async form-reset crash in the messaging system by retaining the submitted form element before awaiting the API request, then resetting that stable form reference after a successful send.
28. Applied the same async reset hardening to the dashboard request form because it had the identical `event.currentTarget.reset()` pattern.
29. Hardened the user database into a versioned, dynamic profile contract with normalized defaults, broader user metadata, custom key/value profile fields, safer email lookup, and server-controlled status/tier handling.
30. Added 20 landing-page-specific shared UI components and wired them into the live homepage for proof, audience, outcomes, service ribbons, booking flow, trust, FAQ, portal preview, manager handoff, and conversion sections.
31. Replaced the small global footer with a universal boilerplate footer covering services, client routes, studio routes, contact, legal, privacy, support, copyright, and service-availability notices.
32. Added 20 sign-in portal-specific shared UI components and wired them into `/portal` for access framing, account type selection context, credential guidance, data-use explanation, profile previews, messaging previews, request previews, quick paths, and conversion guidance.
33. Consolidated the landing page from the expanded component demo into a tighter public flow with hero, signup incentive, proof/outcomes, services, booking flow, portal record, offer map, FAQ, and conversion footer sections.
34. Added a new consolidated 20-module sign-in guidance suite to `/portal`, grouped by access, intake, booking, fulfillment, and trust, and deployed it to Firebase Hosting.
35. Expanded the FAQ and added dedicated legal, privacy, terms, and copyright-claim routes, with footer links and compliance-oriented policy summaries.
36. Added 30 consolidated client-dashboard dexterity modules and 10 consolidated messaging-system dexterity modules, then deployed the update.
37. Consolidated `/portal` back down to an 8-prompt sign-in flow to reduce repetition.
38. Restored the custom local font only for explicit `Black Lion Studios` brand marks while leaving descriptions and body copy on Arial/Helvetica.
39. Enriched and consolidated `/profile` into a clearer client account workspace with profile snapshot, readiness scoring, and grouped contact, service, billing, shipping, links, and custom-field sections.
40. Added a static-fast Hosting deployment path so static/client-shell changes can release without rebuilding the pinned Firebase SSR function.
41. Improved responsive layout wrapping so pages reflow more cleanly as the browser is resized.
42. Enriched inactivity logout with warning, countdown, stay-signed-in action, cross-tab activity handling, and portal-aware single-session redirects.
43. Added server-side client message email alerts through Nodemailer and SMTP runtime settings.
44. Loaded SMTP runtime settings into Firebase through a full framework deploy and added `.gitignore` so local `.env` files are not kept as source.
45. Added 40 Black Lion Media Studio dashboard modules covering creative operations, technical support, billing, compliance, client account state, store/merch, support escalation, growth, and delivery handoff.

## 2026-05-27 Black Lion Media Studio 40-component suite

Work completed:

- Added `components/black-lion-media-suite.js`.
- Installed `BlackLionMediaComponentSuite` into `components/dashboard-app.js`.
- Added 40 named reusable module exports covering intake, creative production,
  technical support, billing, delivery, compliance, analytics, security, client
  account management, manager queue work, and follow-up.
- Added responsive suite and status-chip CSS in `app/globals.css`.

Verification:

- `node --check components/black-lion-media-suite.js` passed.
- `node --check components/dashboard-app.js` passed.
- `npm run build` passed.
- `npm run deploy:full` completed and released `https://black-lion-media-studio.web.app`.
- Live signed-out `/dashboard` returned HTTP 307 to `/portal?auth=required`.
- Live `/portal` returned HTTP 200.
- Live `/api/events` accepted a standard `page_view` smoke payload with `{"ok":true}`.

## 2026-05-20 profile and deploy-speed update

Work completed:

- `components/profile-app.js` now uses shared UI primitives for the profile snapshot, readiness checklist, grouped form sections, support notice, and shortcut rail.
- The profile form is consolidated by real workflow use: contact/account, service/follow-up, billing/invoices, shipping/delivery, and links/extra details.
- Profile readiness now gives a quick operational read on contact, billing, delivery, requests, messages, and completion.
- `package.json` now includes `deploy:full`, `deploy:static-fast`, `deploy:framework-hosting`, and `deploy:rules`.
- `scripts/prepare-static-hosting.mjs` builds `.firebase/static-fast/hosting` from static Next route output and public assets.
- `firebase.static.json` publishes the static/client-shell bundle while preserving function rewrites for `/api/**` and `/portal`.

Deployment-speed finding:

- Plain Firebase framework `--only hosting` is not a true fast path here because Firebase reports the pinned `ssrblacklionstudios` function and rebuilds/updates it.
- `npm run deploy:static-fast` completed as a Hosting-only release and skipped the Cloud Function rebuild.
- Use `npm run deploy:full` for API routes, auth/session changes, Square billing, Firestore/rules/schema changes, middleware/proxy changes, environment changes, Next config changes, or anything requiring SSR function behavior.
- Use `npm run deploy:static-fast` for static route shells, client page/component copy, CSS, public assets, and other changes that do not require updating the server runtime.

Verification:

- `node --check components/profile-app.js` passed.
- `npm run build` passed.
- Full Firebase deploy completed before introducing the static-fast release path.
- `npm run deploy:static-fast` completed and released `https://black-lion-studios.web.app`.
- Live `/` returned a static `200`.
- Live `/profile` returned a static `200` and referenced the updated profile chunk.
- Live profile chunk contained `Profile snapshot`, `Account checklist`, and `Billing and invoices`.
- Live `/portal` returned `200` through the SSR function rewrite.
- Live invoice API check returned `{"error":"Please sign in first."}`, confirming `/api/**` still routes to the server function.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_profile_static_fast_final_20260520-052626.tar.gz`

## 2026-05-20 responsive browser-size wrapping

Work completed:

- `app/globals.css` now defines shared responsive shell and grid sizing variables.
- Page shells use flexible gutters instead of a hard fixed width.
- Text, links, buttons, labels, and headings now use overflow wrapping to prevent container blowouts.
- Shared grids now use `repeat(auto-fit, minmax(min(100%, ...), 1fr))` patterns where appropriate.
- Profile, dashboard, manager, portal, legal, landing, footer, value-card, shortcut, and dexterity-suite layouts now wrap earlier and more consistently.
- Small-width breakpoints make buttons full-width, stack icon/text rows, reduce panel padding, and prevent oversized headings from forcing horizontal scroll.

Verification:

- `npm run build` passed.
- `npm run static:prepare` passed.
- `npm run deploy:static-fast` completed and released `https://black-lion-studios.web.app`.
- Live `/`, `/profile`, and `/portal` returned `HTTP/2 200`.
- Live invoice API route still returned `{"error":"Please sign in first."}`, confirming `/api/**` routing remained intact.
- Live CSS bundle includes `--shell-gutter`, `overflow-wrap:anywhere`, and the new `auto-fit` wrapping rules.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_responsive_layout_final_20260520-054000.tar.gz`

## 2026-05-20 inactivity logout and single-session sign-on

Work completed:

- `lib/auth-events.js` now exports idle timeout constants and cross-tab activity event utilities.
- `components/client-nav.js` now schedules a warning one minute before the 20-minute idle logout.
- The warning includes countdown text, a stay-signed-in button, and a manual logout button.
- Activity resets are shared across tabs through localStorage and BroadcastChannel, with throttling to avoid excessive writes during mouse movement.
- Idle logout now routes to `/portal?auth=required&reason=idle` so the user sees why they were sent back to sign-in.
- `components/auth-sync.js` now makes `/portal` single-session aware. If an authenticated user opens the sign-in page, the app sends them to the correct workspace.
- `components/auth-form-card.js` displays a specific idle logout notice when the portal receives `reason=idle`.

Verification:

- `node --check components/client-nav.js` passed.
- `node --check components/auth-sync.js` passed.
- `node --check components/auth-form-card.js` passed.
- `node --check lib/auth-events.js` passed.
- `npm run build` passed.
- `npm run deploy:full` completed and updated `ssrblacklionstudios`.
- Live `/portal` returned `HTTP/2 200`.
- Live `/portal?auth=required&reason=idle` rendered the idle logout notice.
- Live `/dashboard` returned `HTTP/2 200`.
- Live invoice API route returned `{"error":"Please sign in first."}`.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_auth_idle_sso_final_20260520-055300.tar.gz`

## 2026-05-20 client message email alerts

Work completed:

- Installed `nodemailer`.
- Added `lib/email-notifications.js`.
- Updated `app/api/messages/route.js` to notify the studio after a client message is saved.
- The default alert recipient is `blacklionmediastudio@gmail.com`.
- The notifier uses `replyTo` with the client account email when available.
- Email failures are caught and logged so the client message flow remains usable.
- Manager accounts are skipped by the notifier.

Runtime setup required:

- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASS`

Optional runtime setup:

- `SMTP_PORT`, default `465`
- `SMTP_SECURE`, default `true` when port is `465`
- `SMTP_FROM`, default `SMTP_USER`
- `CLIENT_MESSAGE_ALERT_TO`, default `blacklionmediastudio@gmail.com`
- `SITE_BASE_URL`, default `https://black-lion-studios.web.app`

Verification:

- `node --check lib/email-notifications.js` passed.
- `node --check app/api/messages/route.js` passed.
- `npm run build` passed.
- `npm run deploy:full` completed and updated `ssrblacklionstudios`.
- Live `/api/messages` without auth returned `{"error":"Please sign in first."}`.
- Live `/portal` returned `HTTP/2 200`.
- Deployed function package includes `nodemailer`.
- Final follow-up deploy loaded the SMTP settings into `ssrblacklionstudios`.
- The temporary local `.env` and Firebase staging `.env` were removed after deploy.
- `.gitignore` now excludes `.env`, build output, Firebase staging files, dependency folders, and backup archives.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_message_email_alerts_final_20260520-061000.tar.gz`

## 2026-05-20 daily change summary

Completed today:

- Profile consolidation and enrichment.
- Faster static/client-shell deployment path with `deploy:static-fast`.
- Responsive browser-size wrapping across major public and signed-in layouts.
- Inactivity logout warning, countdown, stay-signed-in action, idle redirect, and cross-tab activity sync.
- Single-session sign-on redirect from `/portal` into the correct workspace.
- Client-message email alert code and SMTP runtime deployment.
- Documentation refresh across `README.md`, `PROJECT_PROGRESS.md`, `DEPLOY_PREP.md`, and `QUICK_REFERENCE.md`.
- Recovery archives for each major checkpoint.

Final verification:

- `node --check` passed for touched route/component/server files.
- `npm run build` passed.
- `npm run deploy:static-fast` was used for static/client-shell work.
- `npm run deploy:full` was used for auth, portal, API, and SMTP runtime work.
- Live `/portal` returned `HTTP/2 200`.
- Live `/api/messages` without auth returned `{"error":"Please sign in first."}`.
- Live invoice API without auth returned `{"error":"Please sign in first."}`.

## 2026-05-17 messaging reset fix

Problem reported:

- The messaging system threw `Cannot read properties of null (reading 'reset')` after submitting a message.

Cause:

- `components/messages-app.js` called `event.currentTarget.reset()` after awaiting `/api/messages`.
- In React event handling, `event.currentTarget` is not a safe value to rely on after an async boundary.

Fix completed:

- `components/messages-app.js` now stores `const form = event.currentTarget` before the async work.
- The payload is built from that captured form.
- The form is reset with `form.reset()` only after the message API succeeds.
- `components/dashboard-app.js` was updated the same way for the authenticated request form.

Verification:

- `npm run build` passed locally after the fix.
- First deploy attempt without an explicit project failed before release because the Firebase CLI targeted `estatehat` and could not find Hosting site `black-lion-studios`.
- Second deploy attempt pinned the project with `--project black-lion-studios`; that attempt stalled in the sandbox during Firebase's nested `npx which esbuild` check and was stopped.
- Final deploy attempt ran outside the sandbox with `npx firebase-tools deploy --only hosting --project black-lion-studios` so Firebase framework tooling could complete its nested build checks.
- Firebase reported `Deploy complete!` and released `https://black-lion-studios.web.app`.
- Live `/messages` HTML served the new build ID and the deployed Messages app chunk contains the captured-form reset pattern.

## Production issues resolved

- `site not found` on the Firebase URL
- failed framework deploy due to missing billing-backed services
- failed function builds due to IAM and storage access issues
- blocked live release due to missing Artifact Registry cleanup policy
- live API responses returning HTML `403` instead of JSON
- live runtime Firestore permission failures causing `500` errors
- stuck framework deploy cycles that failed to release frontend changes cleanly
- messaging form submission crash caused by async access to `event.currentTarget.reset()`

## 2026-05-17 user database hardening

Problem addressed:

- The user record needed to be more robust and dynamic so Black Lion Studios can capture a wider range of client, business, creator, billing, shipping, accessibility, and operational context without adding a new database migration for every small field.

Backend changes:

- `lib/db.js` now has a versioned user schema (`USER_SCHEMA_VERSION = 2`) and a centralized default user contract.
- Existing Firestore user documents are normalized through the same mapping path as new users, so older records receive safe defaults at read time.
- User records now support account type, roles, lifecycle stage, lead source, preferred language, pronouns, social/web links, project goals, referral source, accessibility notes, and dynamic `profile_fields`.
- Dynamic `profile_fields` are bounded to 25 stringified key/value pairs with key/value length limits.
- Email lookup now normalizes the incoming email before querying `email_lower`.
- Password verification now fails safely if a stored hash is missing or malformed.
- Manager detection feeds the normalized roles list so manager users can be represented dynamically without losing the existing allowlist behavior.
- Client profile updates no longer accept client-posted `accountStatus` or `clientTier`; those remain managed account fields.

API and UI changes:

- `/api/signup` accepts account type, lead source, preferred language, preferred contact method, website, and referral source during account creation.
- `/api/profile` accepts the expanded dynamic profile payload and stores it through the centralized schema path.
- `/profile` now exposes identity, contact preferences, social links, billing, shipping, project goals, accessibility notes, and custom key/value profile fields.
- `/portal` signup collects account type, preferred contact method, website, and referral source up front.
- Dashboard readiness scoring now considers the broader profile shape.
- Manager request context now includes client type and lifecycle stage.

Verification:

- `node --check` passed for the changed backend and component files.
- `npm run build` passed after the user database changes.
- A direct Node ESM schema smoke test was attempted, but this repo uses extensionless imports that Next resolves and plain Node does not; the Next production build is the practical validation path here.

## 2026-05-17 landing component expansion

Work completed:

- Added 20 landing-page-focused exports to `components/shared-ui.js`.
- Wired all 20 components into `app/page.js` so they render on the homepage rather than existing as unused library code.
- Added responsive CSS for the new landing sections in `app/globals.css`.

New landing components:

- `LandingSignalBar`
- `LandingProofStrip`
- `LandingAudienceGrid`
- `LandingServiceRibbon`
- `LandingOutcomeList`
- `LandingBookingFlow`
- `LandingIncentiveBanner`
- `LandingMediaPair`
- `LandingTrustChecklist`
- `LandingFeaturedQuote`
- `LandingOfferMatrix`
- `LandingAvailabilityPanel`
- `LandingProjectBriefPanel`
- `LandingFAQPreview`
- `LandingConversionFooter`
- `LandingFeatureMarquee`
- `LandingClientTypeCards`
- `LandingServiceTimeline`
- `LandingManagerHandoff`
- `LandingPortalPreview`

Verification:

- `node --check` passed for `components/shared-ui.js` and `app/page.js`.
- `npm run build` completed successfully.

## 2026-05-17 universal footer boilerplate

Work completed:

- `components/site-footer.js` now provides a full sitewide footer rather than only a brand mark and three links.
- Footer boilerplate includes service navigation, client navigation, studio/store/manager links, contact email, legal notice, privacy notice, support guidance, copyright, and project-scope disclaimer.
- `app/page.js` now exposes `#services` and `#faq` anchors used by the footer.
- `app/globals.css` includes responsive layout styles for the expanded footer.

Verification:

- `node --check components/site-footer.js` passed.
- `node --check app/page.js` passed.
- `npm run build` completed successfully.

## 2026-05-17 portal component expansion and landing consolidation

Work completed:

- Added 20 portal-page-focused exports to `components/shared-ui.js`.
- Wired the portal components into `/portal` across access framing, account modes, credential checklist, account type cards, signup timeline, return-user path, security note, data-use panel, form sidecar, quick links, service preview, profile preview, message preview, request preview, support band, entry steps, value stack, manager notice, trust panel, and conversion strip.
- Consolidated `app/page.js` so the homepage no longer renders every landing component as a long demo page.
- Kept the footer anchors stable with `#services` and `#faq` on the consolidated homepage.
- Replaced the footer copyright glyph with ASCII text for a cleaner source file.

Verification:

- `node --check components/shared-ui.js` passed.
- `node --check app/portal/page.js` passed.
- `node --check app/page.js` passed.
- `node --check components/site-footer.js` passed.
- `npm run build` completed successfully.
- Deployed with `npx firebase-tools deploy --only hosting --project black-lion-studios`.

## 2026-05-18 consolidated sign-in suite and deploy

Request:

- Add 20 more relevant components to the Black Lion Studios sign-in page and consolidate the implementation.
- Deploy the result.
- Document the work and keep a backup path in case a future change fails.

Implementation:

- `components/shared-ui.js` now exports `PortalSigninComponentSuite`.
- The suite renders grouped sign-in modules from data instead of requiring 20 separate page-level JSX blocks.
- `app/portal/page.js` now defines five groups with four modules each:
  - Access: readiness check, account value receipt, returning client shortcut, manager route marker.
  - Intake: service lane guide, project brief prompt, asset prep note, contact preference cue.
  - Booking: timeline capture, budget fit signal, preparation checklist, scheduling handoff.
  - Fulfillment: request status language, delivery preference note, revision trail, message continuity.
  - Trust: privacy promise, support path, notification routing, future project memory.
- `app/globals.css` now styles the suite header, group rows, four-column module grid, cards, and responsive mobile collapse.

Verification:

- `npm run build` passed locally before deploy.
- `npx firebase-tools deploy --project black-lion-studios` completed successfully.
- Firebase updated the SSR Cloud Function `ssrblacklionstudios` in `us-central1`.
- Firebase finalized and released Hosting site `black-lion-studios`.
- Live `/portal` serves the new heading `Everything the account should make easier.`
- Live `/portal?auth=required` serves the same updated sign-in page plus the required-auth notice.
- Historical note: this 20-module sign-in suite was superseded by the 2026-05-19 8-prompt sign-in consolidation.

Backup and recovery:

- Backup archive created: `/home/sniper-lion-main/Documents/Black_Lion_Studios_backup_20260518-184344.tar.gz`
- The archive is intended as a source restore point for the current deployed state.
- If a future deploy fails before release, production should remain on the last released Firebase Hosting version.
- If local files are damaged, restore the archive into a clean directory, install dependencies if needed, run `npm run build`, and redeploy with `npx firebase-tools deploy --project black-lion-studios`.

## 2026-05-18 FAQ, legal, privacy, terms, and copyright-claim expansion

Request:

- Upgrade the FAQ section.
- Add more relevant Q&A.
- Add a stronger legal section in the footer.
- Include compliance details for relevant government rules, Privacy Policy, Terms of Use, copyright-claim review, and related policy surfaces.
- Create separate pages where applicable.

Implementation:

- Added `lib/legal-content.js` as the shared content source for FAQ, legal references, compliance summaries, Privacy Policy sections, Terms of Use sections, and copyright-claim posture.
- Added `/faq` with the expanded Q&A set.
- Added `/legal` with a compliance overview and government reference links.
- Added `/privacy` with policy sections for collected data, usage, sharing, client choices, security, and retention.
- Added `/terms` with site use, bookings, quotes, fulfillment, content rights, disclaimers, governing-law, and update language.
- Added `/dmca` as a copyright-claim review page that treats claims as allegations, preserves original-creation evidence, and reserves the right to reject false, unsupported, abusive, or bad-faith claims.
- Updated the homepage FAQ preview to use the expanded shared FAQ list.
- Updated the footer to include direct links to FAQ, legal overview, Privacy Policy, Terms of Use, and DMCA.
- Added responsive CSS for legal hero sections, policy cards, FAQ rows, and reference links.

Verification:

- `node --check` passed for `lib/legal-content.js`, `app/page.js`, `components/site-footer.js`, and all new route pages.
- `npm run build` passed and generated `/faq`, `/legal`, `/privacy`, `/terms`, and `/dmca`.
- `npx firebase-tools deploy --project black-lion-studios` completed successfully.
- Live verification confirmed `/faq`, `/legal`, `/privacy`, `/terms`, and `/dmca` serve the new content.

Backup:

- Backup archive created before deploy: `/home/sniper-lion-main/Documents/Black_Lion_Studios_policy_backup_20260518-185434.tar.gz`

Important compliance note:

- The policy pages document a practical compliance posture and user-facing procedures. They do not replace attorney review, and ordinary similarity, independent creation, common ideas, functional layouts, and generic industry patterns should not be treated as automatic infringement.

## 2026-05-18 dashboard and messaging dexterity expansion

Request:

- Add 30 relevant components to the client dashboard.
- Add 10 relevant components to the messaging system.
- Consolidate both surfaces.
- Increase the dashboard/message workflow dexterity.
- Deploy and document the work.

Implementation:

- Added dashboard and messaging dexterity suites to `components/shared-ui.js` during the earlier expansion pass.
- `components/dashboard-app.js` now renders 30 dashboard modules from grouped data:
  - Request control: brief readiness, service comparison, budget context, timeline signal, consultation path.
  - Status: request status lane, activity snapshot, next action marker, open item count, completion memory.
  - Profile: contact completeness, billing readiness, shipping readiness, accessibility notes, custom profile fields.
  - Communication: recent thread preview, subject discipline, manager response context, question routing, communication history.
  - Operations: asset reminder, deliverable expectation, revision context, payment checkpoint, fulfillment notes.
  - Dexterity: quick path memory, service reuse, account confidence, manager handoff clarity, future project setup.
- `components/messages-app.js` now renders 10 messaging modules from one consolidated suite:
  - Subject clarity, request reference, scheduling question, scope clarification, billing follow-up, delivery support, manager context, response memory, profile cue, support recovery.
- `app/globals.css` now includes shared responsive layouts for dashboard and messaging dexterity cards, including the full-width messaging suite in the two-column messages layout.

Verification:

- `node --check` passed for `components/shared-ui.js`, `components/dashboard-app.js`, and `components/messages-app.js`.
- `npm run build` passed.
- `npx firebase-tools deploy --project black-lion-studios` completed successfully.
- Firebase updated `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)` and released Hosting site `black-lion-studios`.
- Live `/dashboard` and `/messages` returned the updated build shell and client chunks.
- Local production chunks include `Dashboard dexterity` and `Messaging dexterity`, confirming the deployed client code contains the new suites.

Backup:

- `/home/sniper-lion-main/Documents/Black_Lion_Studios_dashboard_messages_backup_20260518-192549.tar.gz`

## 2026-05-19 client dashboard 60-component consolidation

Request:

- Add 30 more relevant components to the client dashboard.
- Consolidate the dashboard and clean up redundant content if found.

Implementation:

- `components/dashboard-app.js` originally kept the dashboard help content in the shared `ClientDexteritySuite`; that bulky helper suite was later removed during the 2026-05-21 efficiency cleanup.
- The client dashboard suite now contains 60 total modules.
- Added six new five-item groups:
  - Scheduling: preferred windows, date hold, location needs, prep time, reschedule note.
  - Assets: reference links, logo files, copy notes, media inventory, usage details.
  - Billing: quote questions, deposit reminder, invoice contact, receipt trail, change approval.
  - Approvals: decision owner, review window, must-have notes, revision focus, final approval.
  - Support: issue summary, device details, urgency level, access notes, resolution record.
  - Growth: add-on fit, recurring need, launch follow-up, feedback note, rebook path.
- Consolidated wording in the original 30 modules so status, communication, delivery, and future-project prompts do not repeat the same purpose.

Verification:

- `node --check components/dashboard-app.js` passed.
- Label audit confirmed dashboard module labels `01` through `60`.
- `npm run build` passed.
- Local production chunks contain new dashboard markers including `Preferred windows`, `Date hold`, and `Rebook path`.
- `npx firebase-tools deploy --project black-lion-studios` completed successfully.
- Live `/dashboard` serves build `6-k9quZsxvoqw8RU4-elW`.
- Live dashboard chunk `/_next/static/chunks/3f2bc0c89a1805d4.js` contains the new 60-module suite.

Backup:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_dashboard_60_component_backup_20260519-183353.tar.gz`

## 2026-05-19 theme-awareness optimization

Request:

- Optimize the site's theme-awareness.

Implementation:

- `app/layout.js` now includes a head-level theme bootstrap script that reads `bls-theme`, validates it, resolves system light/dark preference, sets `html[data-theme]`, sets `html[data-theme-choice]`, and updates browser color scheme before the page paints.
- `app/layout.js` now exports `viewport` theme-color and color-scheme metadata instead of placing that data in `metadata`.
- `components/theme-provider.js` now centralizes:
  - valid theme choices: `light`, `dark`, and `system`.
  - saved preference fallback to `system`.
  - system preference resolution through `(prefers-color-scheme: light)`.
  - live OS theme-change handling while in system mode.
  - cross-tab `localStorage` sync.
  - theme-color meta updates after user changes.
- `components/theme-toggle.js` now shows `Auto` for system mode and uses clearer labels/titles for the current and next theme state.

Verification:

- `node --check app/layout.js` passed.
- `node --check components/theme-provider.js` passed.
- `node --check components/theme-toggle.js` passed.
- `npm run build` passed without the earlier Next metadata warnings after moving theme data to `viewport`.
- `npx firebase-tools deploy --project black-lion-studios` completed successfully.
- Live `/` serves build `X7hAnlrq10agFkYjSi65W`.
- Live HTML includes `bls-theme`, `data-theme-choice`, `theme-color`, `color-scheme`, and the system-aware `Auto` toggle output.

Backup:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_theme_awareness_final_20260519-185120.tar.gz`

## 2026-05-19 tamper-resistance check and hardening

Request:

- Check that the site is tamper resistant.

Findings:

- Session cookies were already hardened with `HttpOnly`, `SameSite=Strict`, production `Secure`, path scoping, and seven-day expiry.
- Write APIs already use trusted-origin checks for mutation requests.
- Firestore client access remains closed in `firestore.rules`; server code uses Firebase Admin.
- The theme preference is client-controllable and should stay that way. It is validated to known choices and is not used for authorization, identity, billing, or permissions.
- The main gap was inconsistent response-level security headers between static/prerendered pages and app routes.

Implementation:

- `next.config.mjs` now defines a shared security-header policy for app responses.
- `firebase.json` now pins the same policy at the Hosting layer so static/prerendered pages and dashboard routes receive the same hardening.
- Added/enforced:
  - Content Security Policy with same-origin defaults, off-site script blocking, no object embeds, no framing, same-origin base/form limits, and insecure-request upgrades.
  - `X-Frame-Options: DENY`.
  - `X-Content-Type-Options: nosniff`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Cross-Origin-Opener-Policy: same-origin`.
  - `Permissions-Policy` disabling camera, microphone, geolocation, payment, USB, serial, bluetooth, and interest-cohort.
  - `X-DNS-Prefetch-Control: off`.

Verification:

- `node --check next.config.mjs` passed.
- `firebase.json` parsed successfully.
- `npm run build` passed.
- `npx firebase-tools deploy --project black-lion-studios` completed successfully.
- Live `https://black-lion-studios.web.app/` returns the hardened CSP, frame blocking, permission, referrer, MIME, HSTS, and opener-policy headers.
- Live `https://black-lion-studios.web.app/dashboard` returns the same hardened policy.

Backup:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_tamper_resistance_final_20260519-215400.tar.gz`

## 2026-05-19 Square billing and invoice system

Request:

- Square is already set up.
- Install a billing/invoice system based on the listed service prices.

Implementation:

- Added listed invoice amounts to `lib/services.js`:
  - Photography: $250.
  - Videography: $500.
  - Membership Sites & Support: $250/month.
  - DJ Services: $300.
  - PC Tech Services: $125.
  - Beat Creation Session: $200.
- Added `lib/square-billing.js`.
  - Uses Square REST calls directly so no new dependency is required.
  - Creates/uses a Square customer profile from the request billing or account email.
  - Creates a Square order with the listed service price as one line item.
  - Creates a Square invoice for that order.
  - Publishes the invoice so Square can email it and host the payment page.
  - Uses idempotency keys for customer, order, invoice, and publish calls.
- Added manager-only API route:
  - `POST /api/manager/requests/[requestId]/invoice`
  - Requires booking-manager access.
  - Uses trusted-origin and write-rate-limit protections.
  - Writes Square IDs, invoice amount, invoice number, public URL, due date, invoice status, and payment status back to the service request.
- Updated `lib/db.js` request normalization and invoice attachment persistence.
- Updated `components/booking-manager-app.js`.
  - Manager request detail now has a Square billing panel.
  - Managers can send the invoice or open an existing Square invoice.
- Updated `components/dashboard-app.js`.
  - Fixed the request form field from `brief` to `details`.
  - Client request history now shows invoice status and a pay link when present.
- Updated `app/globals.css` with a compact invoice summary style.

Runtime configuration:

- Required: `SQUARE_ACCESS_TOKEN`.
- Required: `SQUARE_LOCATION_ID`.
- Optional: `SQUARE_ENVIRONMENT`, defaults to `production`; set `sandbox` for Square sandbox.
- Optional: `SQUARE_API_VERSION`, defaults to `2026-01-22`.

Verification:

- `node --check` passed for `lib/services.js`, `lib/db.js`, `lib/square-billing.js`, the invoice route, `components/booking-manager-app.js`, and `components/dashboard-app.js`.
- `npm run build` passed and included `ƒ /api/manager/requests/[requestId]/invoice`.
- `npx firebase-tools deploy --project black-lion-studios` completed successfully.
- Live unauthenticated `POST /api/manager/requests/test/invoice` returns `{"error":"Please sign in first."}`.
- Live `/booking-manager` and `/dashboard` serve the new build `4MiLCXf9CGj7UtZ4hGZ1f`.

Square references:

- Square Invoices API creates a draft invoice for an order and requires publishing before Square processes/sends it: `https://developer.squareup.com/docs/invoices-api/create-publish-invoices`
- Square Orders API creates the order that the invoice is attached to: `https://developer.squareup.com/docs/orders-api/create-orders`

Backup:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_square_billing_final_20260519-220900.tar.gz`

## 2026-05-18 service-focused copy cleanup

Request:

- Make the site's text focus on the purpose of the services.
- Remove unnecessary technical wording that made the site feel like computer documentation.
- Keep the copy relevant to what Black Lion Studios actually offers.

Implementation:

- Rewrote the landing page hero, signup reason, service cards, booking flow, account preview, offer map, FAQ preview, and conversion footer to focus on services and next steps.
- Reworked the `/portal` sign-in content so it talks about creating an account, sending requests, project details, messages, scheduling, billing, delivery, and saved details.
- Reworked `/store` copy around browsing merch, asking about availability, payment, pickup, and shipping.
- Reworked profile copy around contact, billing, shipping, service preferences, project notes, and studio-controlled internal settings.
- Reworked FAQ, privacy, legal-content, service catalog, and manager-facing copy to avoid documentation-heavy wording while preserving important policy meaning.
- Updated service naming from `Platform Membership Site Building & Maintenance` to `Membership Sites & Support` on visible service surfaces.

Verification:

- `node --check` passed for `app/page.js`, `app/portal/page.js`, `app/store/page.js`, `app/privacy/page.js`, `components/profile-app.js`, `components/booking-manager-app.js`, `lib/legal-content.js`, `lib/site-content.js`, and `lib/services.js`.
- `npm run build` passed and generated all 23 app routes.
- `npx firebase-tools deploy --project black-lion-studios` completed successfully.
- Firebase updated `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)` and released Hosting site `black-lion-studios`.
- Live verification confirmed `/`, `/portal`, `/store`, `/privacy`, and `/faq` serve the new service-focused copy.

Backup:

- `/home/sniper-lion-main/Documents/Black_Lion_Studios_service_copy_backup_20260518-194327.tar.gz`

## 2026-05-19 sign-in consolidation

Request:

- Consolidate the sign-in page.
- Reduce redundancies.

Implementation:

- Simplified `app/portal/page.js` so the sign-in page no longer repeats the same account benefits across separate fit, timeline, security, profile, request, message, entry, and support sections.
- Kept the primary split hero, sign-up/sign-in card, service preview, quick paths, and final CTA.
- Reduced the sign-in guidance suite from 20 cards to 8 prompts grouped around start, request, follow-up, and next-time benefits.
- Removed unused imports and page-local data arrays tied to the removed redundant sections.

Verification:

- `node --check app/portal/page.js` passed.
- `npm run build` passed and generated all 23 app routes.
- `npx firebase-tools deploy --project black-lion-studios` completed successfully.
- Live `/portal` serves the consolidated sign-in flow with `The short version.` and `Ready to send the request?`.
- Live `/portal?auth=required` still serves the required-auth notice and the consolidated sign-in page.

## 2026-05-19 typography cleanup and documentation consolidation

Request:

- Keep `Black Lion Studios` in the previous custom font, but separate it from the rest of the text.
- Leave description/body copy alone.
- Consolidate documentation so the next session can find the current state faster.

Implementation:

- Restored `next/font/local` in `app/layout.js` only to provide the `--font-brand-display` variable.
- Kept global typography on Arial/Helvetica in `app/globals.css`.
- Scoped the custom font to `.brand-signature`, which currently wraps the homepage hero brand mark and footer brand mark.
- Left ordinary descriptions and sentences that mention `Black Lion Studios` in normal Arial body text.
- Reduced the landing hero headline scale on desktop and mobile.
- Added `QUICK_REFERENCE.md` as the fast-start handoff file with current live state, commands, live checks, current UX decisions, file map, docs map, backup paths, and recovery notes.
- Updated `README.md`, `PROJECT_PROGRESS.md`, and `DEPLOY_PREP.md` so the quick reference is the first place to resume.

Verification:

- `node --check app/layout.js` passed.
- `npm run build` passed and generated all 23 app routes.
- `npx firebase-tools deploy --project black-lion-studios` completed successfully.
- Local production build output includes the `daggerdancertitle` font preload and body font variable class.
- `app/globals.css` now has the custom font only on `.brand-signature`; all other explicit font stacks are Arial/Helvetica.

## Important implementation notes

- The app now uses Firestore-backed persistence rather than the original `data.sqlite` approach.
- The app is already on Next.js App Router. Next components are React components under the hood, so the current convention is server components by default and client components only where browser state, forms, storage, session sync, or live dashboard behavior require it.
- The `/portal` sign-in page was split into dedicated component modules in `components/portal/`: `portal-content.js`, `portal-data.js`, `portal-hero-panel.js`, `portal-access-panel.js`, `portal-services-panel.js`, and `portal-quick-path-panel.js`.
- The 2026-05-20 Next component structure deploy completed with `npm run deploy:full`; live `/portal` returned HTTP 200 and served the same sign-in flow from the new module structure.
- Backup archive for that checkpoint: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_next_component_structure_20260520-163000.tar.gz`.
- `/dashboard`, `/messages`, `/profile`, and `/booking-manager` now load auth and first-screen data through Next server routes before hydrating their interactive client islands.
- `components/dashboard-widgets.js` is now server-compatible and no longer declares `"use client"`.
- Remaining `"use client"` files are intentional browser islands: booking manager updates, dashboard request submission, messages, profile editing, auth form tabs/submits, theme controls, auth sync, and inactivity logout.
- Backup archive for the server-route conversion: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_next_server_routes_20260520-163500.tar.gz`.
- First-party analytics and guided onboarding were installed on 2026-05-20: `/api/events`, `lib/analytics.js`, `lib/client-analytics.js`, `components/analytics-tracker.js`, and `lib/onboarding.js`.
- The dashboard now includes a client onboarding panel that calculates profile/request/message/billing readiness from server-loaded data.
- Analytics intentionally avoids third-party scripts and stores only limited metadata plus hashed user-agent/referrer values.
- Backup archive for analytics/onboarding: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_analytics_onboarding_20260520-164500.tar.gz`.
- Fixed the post-server-route dashboard/sign-in refresh loop by making `AuthSync` validate the cookie-backed `/api/me` session before portal-to-dashboard redirects and clearing stale localStorage tokens when the cookie session is absent.
- Backup archive for the redirect loop fix: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_auth_loop_fix_20260520-165500.tar.gz`.
- Fixed the remaining sign-in handoff issue by forcing same-origin credentials on client auth fetches and making the sign-in form wait for `/api/me` cookie-session confirmation before workspace navigation.
- Backup archive for the sign-in cookie handoff fix: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_signin_cookie_handoff_20260520-170400.tar.gz`.
- Fixed the Firebase Hosting cookie forwarding root cause by moving server auth to the reserved `__session` cookie while clearing the old `bls_session` cookie name.
- Backup archive for the Firebase session cookie fix: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_firebase_session_cookie_20260520-171800.tar.gz`.
- Completed the Firebase migration to project/site `black-lion-media-studio` using Firebase CLI account `blacklionmediastudio@gmail.com`.
- Deployed Firestore rules/indexes, Hosting, and SSR function `firebase-frameworks-black-lion-media-studio:ssrblacklionmediastudio(us-central1)`.
- Fixed the new Hosting 403 by granting Cloud Run `roles/run.invoker` to `allUsers` for `ssrblacklionmediastudio`.
- Verified the new live URL `https://black-lion-media-studio.web.app`: `/portal` returned HTTP 200, signed-out `/dashboard` returned HTTP 307 to `/portal?auth=required`, and `/api/events` returned `{"ok":true}`.
- Backup archive for the Firebase migration: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_firebase_migration_final_20260520-214004.tar.gz`.
- The new Firebase project has a fresh Firestore database; old project data does not automatically move without export/import or a separate migration plan.
- Undeployed the old origin project by disabling Hosting for `black-lion-studios` and deleting old SSR function `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Verified the old URL `https://black-lion-studios.web.app/` returned HTTP 404 after disable, old functions list returned empty, and the new project still served `/portal` with HTTP 200.
- Backup archive for the old-origin undeploy checkpoint: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_old_origin_undeployed_20260520-214312.tar.gz`.
- Restored the default manager account in the new project by creating `manager@blacklionstudios.com` through the live signup path with the documented credential.
- Verified manager login returned HTTP 200, was recognized as a booking manager, set a session cookie, and loaded `/booking-manager` with HTTP 200.
- Backup archive for the manager account restore checkpoint: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_manager_account_restored_20260520-223756.tar.gz`.
- Reworked `components/messages-app.js` into a cleaner studio inbox instead of generic panels and a documentation-style helper grid.
- Added dedicated `.messages-*` layout and responsive CSS in `app/globals.css` for the message hero, compose panel, side context, quick links, empty state, and thread cards.
- Deployed the messaging GUI cleanup to `black-lion-media-studio`.
- Verified `npm run build`, live signed-out `/messages` redirect to `/portal?auth=required`, and authenticated `/messages` HTTP 200 with the new `messages-workspace` markup.
- Backup archive for the messaging GUI cleanup: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_messages_gui_cleanup_20260521-035536.tar.gz`.
- Removed the 60-card dashboard reminder suite and replaced it with a three-step `dashboard-workflow-panel`.
- Removed unused `ClientDexteritySuite`, `MessagingDexteritySuite`, and their `.dexterity-*` / `.messaging-dexterity-*` CSS after consolidation.
- Production CSS chunk dropped from about 37.9 KB to about 36.3 KB after the cleanup.
- Deployed the dashboard efficiency cleanup to `black-lion-media-studio`.
- Verified signed-out `/dashboard` redirects to `/portal?auth=required`, manager `/dashboard` redirects to `/booking-manager`, and authenticated client `/dashboard` returns HTTP 200 with the new workflow panel and no old dexterity suite.
- Backup archive for the dashboard efficiency cleanup: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_dashboard_efficiency_cleanup_20260521-142530.tar.gz`.
- Expanded `/legal` with a dedicated Government compliance checklist for advertising/consumer protection, privacy/security, email/SMS marketing, accessibility, copyright/DMCA, payments/records, children/prohibited use, and compliance maintenance.
- Added official government reference links for FTC, U.S. Copyright Office, DOJ ADA, and California privacy guidance.
- Expanded `/faq` with practical compliance and operations questions covering deposits, invoices, cancellations, privacy choices, accessibility requests, marketing messages, DMCA limits, and false copyright claims.
- Updated footer compliance copy to link users to `Legal & compliance`.
- Verified `npm run build`, Firebase deploy, live `/legal` compliance content, live `/faq` expanded questions, and footer `Legal & compliance` text.
- Backup archive for the legal/FAQ compliance update: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_legal_faq_compliance_20260521-163657.tar.gz`.
- Tuned the landing page on 2026-05-22 with a clearer request-first hero, `Who this helps`, account-shortcut, service timing, and trust/handoff sections.
- Reused existing shared landing components instead of adding another one-off homepage pattern.
- Verification for the 2026-05-22 landing tune-up: `node --check app/page.js`, `npm run build`, `npm run deploy:static-fast`, `npm run deploy:full`, and live checks for homepage content, `/portal` HTTP 200, signed-out `/dashboard` redirect, and `/api/events` `{"ok":true}`.
- Static-fast released the homepage but caused dynamic routes to return 404 on the current Firebase project, so the full framework deploy was used immediately to restore the SSR/API route wiring.
- Backup archive for the landing tune-up: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_landing_tuneup_20260522-160354.tar.gz`.
- The deployed runtime service account required explicit access adjustments during rollout.
- Firebase framework hosting for this app required a patched `Next 16.0.x` release. The project is currently on `16.0.11`.
- The public language was revised to match the real business purpose: online service booking with authenticated client access, not a generic portal.
- Shared UI primitives now live in `components/shared-ui.js` and are reused across portal and dashboard surfaces.
- `components/shared-ui.js` now acts as the main GUI kit for the whole product, not just portal/dashboard pages.
- Shared landing and portal copy structures now live in `lib/site-content.js`.
- Default typography is Arial/Helvetica; custom local display typography is isolated to `.brand-signature` brand marks.
- Manager authorization can be driven by `config/booking-managers.json` or `BOOKING_MANAGER_EMAILS`.
- The current default manager account is `manager@blacklionstudios.com`.
- Route protection now relies on server-side auth plus `proxy.js` security headers and cache controls, not brittle redirect loops.
- Session handling is signed and hardened against basic client-side tampering patterns and cross-origin write attempts.
- The extracted runtime font lives in `app/fonts/` and the original archive now lives in `assets/fonts/dagger_dancer.zip`.

## Recommended next documentation update points

- document exact admin workflows if the booking manager surface expands into a fuller admin suite
- document Firestore schema if the data model expands
- document environment-variable expectations if more external services are integrated

## 2026-06-25 GitHub Upload Note

- Uploaded Black Lion Media Studio to GitHub repository `https://github.com/PlugzTech/AdventureCode-Projects`.
- Repository subfolder: `black-lion-media-studio/`.
- Upload commit: `c1f6a5f Add Black Lion Media Studio project`.
- The GitHub copy is source-focused. It intentionally excludes local dependencies, build output, Firebase cache, environment files, local SQLite runtime data, backup archives, and workspace-only agent metadata.
- The GitHub repository is currently public, so do not commit credentials, private customer data, local database files, or unpublished operational secrets.
