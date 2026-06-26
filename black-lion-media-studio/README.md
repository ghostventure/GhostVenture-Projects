# Black Lion Studios

Next.js client portal, service storefront, and merch storefront for Black Lion Studios.

## Start here next time

- Fast handoff: [QUICK_REFERENCE.md](/home/sniper-lion-main/Documents/Black%20Lion%20Studios/QUICK_REFERENCE.md)
- Full progress history: [PROJECT_PROGRESS.md](/home/sniper-lion-main/Documents/Black%20Lion%20Studios/PROJECT_PROGRESS.md)
- Deploy and recovery notes: [DEPLOY_PREP.md](/home/sniper-lion-main/Documents/Black%20Lion%20Studios/DEPLOY_PREP.md)

## Current status

- live production URL: `https://black-lion-media-studio.web.app`
- framework-hosted on Firebase
- backend persistence now uses Firestore through Firebase Admin
- current Next.js version: `16.0.11`
- current fast static/client-shell deploy path: `npm run deploy:static-fast`
- public site includes day/night theme support
- theme handling is centralized with early page-load detection, system-theme support, saved preference sync, and theme-aware browser chrome colors
- tamper-resistance hardening is applied through consistent app and hosting security headers
- public-facing copy now emphasizes service purpose, account value, and sign-up incentive more directly
- global typography is Arial/Helvetica except the explicit `Black Lion Studios` brand mark
- custom `daggerdancertitle.ttf` is isolated to `.brand-signature` usage only

## Core features

- splash landing page aligned to the service-company model
- splash landing page copy now pushes a clearer account-creation incentive for faster booking and saved project history
- expanded FAQ section with a dedicated full FAQ route
- splash landing page restructured to reduce repetitive layout rhythm
- user profile creation
- login/logout with dashboard redirect
- post-login access to the service catalog
- editable profile, billing, and contact information
- expanded user records for account, merch, shipping, lifecycle, and billing data
- versioned, normalized, dynamic user profile records with bounded custom profile fields
- authenticated messaging
- consultation booking
- authenticated service request submissions
- merch storefront for `Plugz UNTD` and `Plugz RNGD`
- upgraded client portal presentation
- landing page and portal redesigned around a brighter editorial product-site style
- landing page and portal rebuilt with a new editorial layout instead of the old dashboard-era public-page skeleton
- landing page and portal rebuilt again with a more open product-style composition and reduced card repetition
- portal and dashboard now share a consolidated reusable UI layer
- site-wide shared UI layer now includes a broader 50+ component UX/UI kit for public, portal, dashboard, manager, profile, store, and messaging surfaces
- client dashboard now includes a consolidated 60-module dexterity suite for request control, status, profile readiness, communication, delivery, scheduling, assets, billing, approvals, support, and future-project planning
- client dashboard now includes a 40-module Black Lion Media Studio operations suite for intake, creative production, technical support, billing, delivery, compliance, support, growth, account, and manager handoff workflows
- messaging system now includes a consolidated 10-module dexterity suite for subject clarity, request references, scheduling, scope, billing, delivery, and support recovery
- landing page, portal, and dashboard now share a calmer editorial art direction with Arial body typography and isolated custom brand-name treatment
- booking manager dashboard for reviewing all client requests
- Firebase-backed user and request storage
- 20-minute inactivity sign-out
- site-wide auth-state sync after sign-in and sign-out
- reduced auth-sync churn and lighter public/portal route behavior
- protected purchase flow for unauthenticated users
- global day/night theme toggle with persistent preference
- broader sitewide component consolidation across landing, portal, dashboard, manager, profile, messages, and store
- 20 landing-specific shared components are available and the homepage now uses a consolidated subset for a tighter conversion path
- landing page tune-up now adds clearer client-fit cards, service timing, account-shortcut messaging, and trust handoff details
- `/portal` sign-in page is consolidated into a shorter flow with 8 focused preparation prompts
- stronger request-origin, session, and response-header hardening
- custom local brand font applied only to explicit `Black Lion Studios` brand marks
- universal footer boilerplate with services, client routes, studio routes, contact, legal, privacy, support, and availability notices
- dedicated legal pages for overview, Privacy Policy, Terms of Use, copyright claims, and FAQ
- Square-backed manager billing can create and email invoices from service requests using the listed service prices
- Square Appointments booking is linked from the homepage and `/book`, and booking webhooks can sync appointment events into the shared studio calendar
- profile is consolidated into focused contact, service, billing, shipping, links, and readiness sections
- static/client-shell page updates can deploy without rebuilding the pinned SSR function by using `firebase.static.json`
- responsive page wrapping is improved across public, portal, profile, dashboard, messaging, manager, legal, and footer layouts
- inactivity logout now includes a visible warning, countdown, stay-signed-in action, idle return message, and cross-tab activity sync
- single-session sign-on now redirects already-signed-in users from `/portal` into the correct workspace
- new client messages can trigger a server-side email alert to `blacklionmediastudio@gmail.com` when SMTP runtime settings are configured
- SMTP settings for client message alerts were loaded into the Firebase SSR function during the latest full deploy; no local `.env` is retained

## 2026-05-22 landing page tune-up

- `app/page.js` now leads with a clearer request-first headline and explains that the account keeps follow-up, invoices, and messages in one place.
- Added homepage sections for who the service helps, account shortcut value, service timing, and trust/handoff expectations.
- Reused existing landing UI components from `components/shared-ui.js` instead of adding a new page-local component pattern.
- `npm run deploy:static-fast` released the homepage but did not preserve dynamic rewrites on the current Firebase project, so `npm run deploy:full` was used immediately afterward to restore `/portal`, `/dashboard`, and `/api/**`.
- Verified live homepage content, live `/portal` HTTP 200, signed-out `/dashboard` redirect, and `/api/events` smoke response.
- Restore archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_landing_tuneup_20260522-160354.tar.gz`

## 2026-05-19 client dashboard expansion

- `components/dashboard-app.js` now keeps the client dashboard focused on the request form, onboarding, activity, messages, and a short workflow panel.
- Added 30 more dashboard components, increasing the client dashboard suite from 30 to 60 modules.
- New component groups cover scheduling, asset readiness, billing, approvals, support, and growth planning.
- Cleaned repeated wording in the original dashboard modules so the suite reads as one client workflow instead of overlapping reminders.
- Verified with `node --check components/dashboard-app.js`, `npm run build`, Firebase deploy, live `/dashboard`, and the live dashboard JS chunk.
- Restore archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_dashboard_60_component_backup_20260519-183353.tar.gz`

## 2026-05-27 Black Lion Media Studio component suite

- Added `components/black-lion-media-suite.js` with 40 named reusable modules for intake, creative production, technical support, billing, delivery, compliance, analytics, security, client account management, manager queue work, and follow-up.
- Wired `BlackLionMediaComponentSuite` into the authenticated client dashboard after the workflow panel.
- Added responsive dashboard CSS for `.black-lion-suite`, `.black-lion-module-grid`, `.black-lion-module-card`, and shared `.ui-status-chip` rows.
- Verified with `node --check components/black-lion-media-suite.js`, `node --check components/dashboard-app.js`, `npm run build`, `npm run deploy:full`, live signed-out `/dashboard` redirect, live `/portal` HTTP 200, and live `/api/events` `{"ok":true}`.

## 2026-05-19 theme-awareness optimization

- `app/layout.js` now runs an early theme bootstrap script before the page paints.
- `components/theme-provider.js` now centralizes theme validation, system preference resolution, saved preference syncing, OS theme changes, and cross-tab storage updates.
- `components/theme-toggle.js` now exposes an `Auto` system-aware state and toggles cleanly between system and explicit light/dark choices.
- Added proper `viewport` theme-color and `color-scheme` metadata for browser chrome awareness.
- Verified with syntax checks, `npm run build`, Firebase deploy, and live HTML inspection.
- Restore archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_theme_awareness_final_20260519-185120.tar.gz`

## 2026-05-19 tamper-resistance hardening

- `next.config.mjs` now sends shared security headers across app responses.
- `firebase.json` now pins the same security headers at the Hosting layer so static and prerendered pages match protected app routes.
- Enforced protections include CSP, frame blocking, object/embed blocking, same-origin base/form limits, MIME sniff protection, strict referrer handling, browser permission restrictions, DNS prefetch off, and same-origin opener policy.
- Theme choice remains client-controllable by design, but theme input is validated to `light`, `dark`, or `system` and is not trusted as an auth or security boundary.
- Verified production headers on `/` and `/dashboard`.
- Restore archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_tamper_resistance_final_20260519-215400.tar.gz`

## 2026-05-19 Square billing and invoices

- `lib/services.js` now stores invoice amounts for the listed service prices.
- `lib/square-billing.js` creates a Square customer, Square order, draft invoice, and published invoice using Square's Orders and Invoices APIs.
- `app/api/manager/requests/[requestId]/invoice/route.js` lets booking managers send a Square invoice for a request.
- `components/booking-manager-app.js` now includes a Square billing panel with send/open invoice actions.
- `components/dashboard-app.js` now shows invoice status and a pay link when a Square invoice exists.
- Required runtime env: `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`; optional env: `SQUARE_ENVIRONMENT=sandbox|production`, `SQUARE_API_VERSION`.
- Square reference used: `https://developer.squareup.com/docs/invoices-api/create-publish-invoices`
- Restore archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_square_billing_final_20260519-220900.tar.gz`

## 2026-06-19 Square Appointments calendar sync

- The homepage and `/book` now send appointment-ready visitors to the Square Appointments booking link.
- Added `app/api/square/bookings/webhook/route.js` for Square `booking.created` and `booking.updated` notifications.
- Square appointment webhooks upsert deterministic records into `service_requests`, so the existing dashboard and booking-manager calendar components can show Square bookings through the same integrated calendar.
- The calendar builder now includes synced external booking dates even when they are outside the website's default consultation availability window.
- The homepage splash includes a compact, theme-aware booking calendar card linked to the Square Appointments booking page.
- The manager booking workspace now shows the integrated consultation calendar and treats Square imports as appointment-only records, not invoiceable service requests.
- Required production runtime env: `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_WEBHOOK_SIGNATURE_KEY`.
- Optional runtime env: `SQUARE_ENVIRONMENT`, `SQUARE_API_VERSION`, `SQUARE_BOOKINGS_WEBHOOK_URL`, `SQUARE_APPOINTMENTS_TIMEZONE`, `NEXT_PUBLIC_SQUARE_APPOINTMENTS_URL`, `SITE_BASE_URL`.
- Configure the Square Developer Console webhook URL as `https://black-lion-media-studio.web.app/api/square/bookings/webhook` and subscribe to `booking.created` and `booking.updated`.
- Use `npm run deploy:full` for Square appointment webhook, API, Firestore schema, or runtime env changes.
- Square reference used: `https://developer.squareup.com/docs/bookings-api/use-webhooks`

## 2026-05-20 profile consolidation and faster deploy path

- `components/profile-app.js` now consolidates profile management into a clearer account workspace: profile snapshot, readiness checklist, contact/account details, service follow-up, billing/invoice details, shipping/delivery details, links, and custom fields.
- Profile readiness now summarizes contact, billing, delivery, requests, messages, and overall completion before the client edits the form.
- `package.json` now includes deploy shortcuts: `deploy:full`, `deploy:static-fast`, `deploy:framework-hosting`, and `deploy:rules`.
- `scripts/prepare-static-hosting.mjs` prepares a static Hosting bundle from the Next build output for static/client-shell routes.
- `firebase.static.json` provides the faster Hosting-only release path and keeps `/api/**`, `/portal`, `/dashboard`, `/profile`, `/messages`, and `/booking-manager` routed to the existing `ssrblacklionmediastudio` function.
- Important deploy finding: Firebase framework Hosting still deploys the pinned SSR function when running plain `--only hosting`; use `deploy:static-fast` for static/client-shell updates and `deploy:full` when server/API/runtime behavior changes.
- Verification completed with `node --check components/profile-app.js`, `npm run build`, full Firebase deploy, `npm run deploy:static-fast`, live `/`, `/profile`, `/portal`, and invoice API checks.
- Restore archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_profile_static_fast_final_20260520-052626.tar.gz`

## 2026-05-20 responsive layout wrapping

- `app/globals.css` now has a stronger responsive foundation with shared shell gutters, flexible grid minimums, text overflow protection, and safer `min-width: 0` handling inside panels/forms/cards.
- Major two-column and multi-column sections now use `auto-fit` wrapping instead of holding fixed columns too long.
- Added tighter breakpoints at 1080px, 900px, 680px, and 520px so hero, portal, dashboard, profile, footer, legal, and suite layouts reflow as the browser is resized.
- Removed viewport-based heading font scaling for the main site headings and replaced it with stable responsive sizes and breakpoint adjustments.
- Deployed with `npm run deploy:static-fast`.
- Live verification confirmed `/`, `/profile`, `/portal`, the invoice API route, and the deployed CSS bundle.
- Restore archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_responsive_layout_final_20260520-054000.tar.gz`

## 2026-05-20 inactivity logout and single-session sign-on

- `components/client-nav.js` now shows a sticky idle warning before automatic logout, with a countdown plus `Stay signed in` and `Log out now` actions.
- Idle logout clears the client token, clears the server session, broadcasts the signed-out state, and returns the user to `/portal?auth=required&reason=idle`.
- `lib/auth-events.js` centralizes auth activity event names, idle timeout constants, and cross-tab activity broadcasts.
- Activity events are throttled so mouse movement does not spam localStorage or BroadcastChannel messages.
- `components/auth-sync.js` now treats `/portal` as an auth-aware route; already-signed-in clients are sent to `/dashboard`, while managers are sent to `/booking-manager`.
- `/portal` now shows a clear message when a user returns after idle logout.
- Verification completed with `node --check` on auth files, `npm run build`, full Firebase deploy, live `/portal`, live `/portal?auth=required&reason=idle`, live `/dashboard`, and invoice API checks.
- Restore archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_auth_idle_sso_final_20260520-055300.tar.gz`

## 2026-05-20 client message email alerts

- Added `nodemailer` as a server dependency.
- Added `lib/email-notifications.js` for SMTP-backed client message alerts.
- Updated `app/api/messages/route.js` so every saved client message attempts to email `blacklionmediastudio@gmail.com`.
- Manager-origin messages are skipped, and email failures do not block the message from saving.
- Runtime settings loaded during deploy: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `CLIENT_MESSAGE_ALERT_TO`, and `SITE_BASE_URL`.
- Optional runtime settings: `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`, `CLIENT_MESSAGE_ALERT_TO`, and `SITE_BASE_URL`.
- Default recipient is `blacklionmediastudio@gmail.com`.
- Added `.gitignore` so `.env`, build output, Firebase staging output, dependency folders, and backup archives are not treated as source.
- The temporary local `.env` and Firebase staging `.env` used for deployment were removed after Firebase loaded the values.
- Verification completed with `node --check`, `npm run build`, full Firebase deploy, live `/api/messages` unauthenticated check, live `/portal`, and deployed function bundle/package checks.
- Restore archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_message_email_alerts_final_20260520-061000.tar.gz`

## 2026-05-20 daily change summary

- Consolidated and enriched `/profile`.
- Added static-fast deployment support and documented when to use it.
- Improved responsive browser-size wrapping across the site.
- Enriched inactivity logout and single-session sign-on behavior.
- Added client message email alerts to the studio Gmail inbox.
- Loaded SMTP runtime settings into the deployed Firebase SSR function.
- Added `.gitignore` for secrets, build output, Firebase staging files, dependency folders, and archives.

## Routes

- `/` landing page
- `/faq` expanded questions and answers
- `/legal` legal and compliance overview
- `/privacy` Privacy Policy
- `/terms` Terms of Use
- `/dmca` copyright claim review and response posture
- `/portal` sign-up and sign-in
- `/dashboard` client dashboard
- `/profile` account and billing profile
- `/messages` client messaging center
- `/store` merch storefront
- `/booking-manager` protected manager request dashboard

## Run

```bash
cd "/home/sniper-lion-main/Documents/Black Lion Studios"
npm run dev
```

Open `http://127.0.0.1:3000`.

## Production

```bash
npm run build
npm start
```

## Data layer

- local development can run through the current Firebase-backed application code
- production uses Firestore-backed persistence
- user records are normalized through the versioned schema in `lib/db.js`
- dynamic custom profile data is stored in bounded `profile_fields` key/value pairs
- account status and client tier are managed fields and are not changed by client profile updates

## Manager access

- manager access can be granted through [booking-managers.json](/home/sniper-lion-main/Documents/Black%20Lion%20Studios/config/booking-managers.json) or the `BOOKING_MANAGER_EMAILS` environment variable
- current default manager username: `manager@blacklionstudios.com`
- current default manager password: `BLSManager!2026`
- protected manager API: `/api/manager/requests`

## Brand assets

- extracted runtime font: [daggerdancertitle.ttf](/home/sniper-lion-main/Documents/Black%20Lion%20Studios/app/fonts/daggerdancertitle.ttf)
- project-stored source archive: [dagger_dancer.zip](/home/sniper-lion-main/Documents/Black%20Lion%20Studios/assets/fonts/dagger_dancer.zip)
- current usage: explicit `Black Lion Studios` brand marks on the splash page and footer only

## Recent UX consolidation

- portal and dashboard now reuse shared info-grid, checklist, and timeline patterns
- dashboard includes a portal map and workspace checklist to reduce navigation friction
- portal now includes clearer access standards and a stronger post-sign-in expectations panel
- dashboard now uses a denser 12-column panel layout to reduce empty space in the signed-in workspace
- landing page and portal now use a warmer, lighter, more editorial UX direction
- landing page, portal, and dashboard now use a stronger art-directed studio aesthetic rather than a generic app-style interface
- shared landing and portal content now lives in `lib/site-content.js` to reduce repeated copy structures
- public-page composition now uses a more open single-flow editorial layout with fewer repeated card grids
- landing and portal now lean on larger text fields, staged visual panels, and less symmetric public-page structure
- landing, portal, and messages now reuse a broader library of shared pills, strips, action tiles, callouts, split headings, and empty states
- Arial/Helvetica is the default site typography; the custom brand font is only for `.brand-signature`
- recent optimization pass replaced repeated page-local cards, notices, rails, and form wrappers with shared UI components and tighter page scaffolding
- landing page and portal copy now frame sign-up as the fastest path into real service handling rather than optional account creation
- messaging and dashboard request forms now retain the submitted form before async API calls so successful submissions can reset without hitting a null `currentTarget`
- `/portal` uses `PortalSigninComponentSuite` to render 8 focused prompts from grouped data instead of repeated page-level sections

## 2026-05-18 sign-in deployment and backup

- changed files: `app/portal/page.js`, `components/shared-ui.js`, `app/globals.css`
- shared component added: `PortalSigninComponentSuite`
- live section heading: `Everything the account should make easier.`
- status: superseded by the 2026-05-19 sign-in consolidation; current `/portal` uses 8 focused prompts
- local verification: `npm run build`
- deploy command used: `npx firebase-tools deploy --project black-lion-studios`
- deploy result: Firebase reported `Deploy complete!` for `https://black-lion-studios.web.app`
- live verification: `/portal` and `/portal?auth=required` both served the new sign-in component suite
- restore backup archive: `/home/sniper-lion-main/Documents/Black_Lion_Studios_backup_20260518-184344.tar.gz`

If a future deploy fails, keep the last working live site in place, restore from the backup archive into a clean folder, run `npm install` if dependencies are missing, run `npm run build`, and redeploy with the pinned project command above.

## 2026-05-18 FAQ and legal policy expansion

- changed files: `app/page.js`, `components/site-footer.js`, `app/globals.css`
- new content file: `lib/legal-content.js`
- new pages: `/faq`, `/legal`, `/privacy`, `/terms`, `/dmca`
- footer now links directly to FAQ, legal overview, Privacy Policy, Terms of Use, and copyright-claim review
- policy content covers consumer protection, privacy and data security, state privacy rights, children's privacy, CAN-SPAM-style email handling, TCPA-style text/call consent, accessibility, payments, and a firm copyright-claim posture
- local verification: `node --check` for new pages/content and `npm run build`
- restore backup archive: `/home/sniper-lion-main/Documents/Black_Lion_Studios_policy_backup_20260518-185434.tar.gz`

## 2026-05-18 dashboard and messaging dexterity expansion

- changed files: `components/dashboard-app.js`, `components/messages-app.js`, `components/shared-ui.js`, `app/globals.css`
- shared dashboard/messaging helper grids were later removed after the pages were consolidated into leaner task-focused layouts
- dashboard addition: 30 consolidated client-dashboard modules grouped by request control, status, profile, communication, operations, and dexterity
- messaging addition: 10 consolidated message-system modules for routing, review, and recovery
- local verification: `node --check` on changed JS files and `npm run build`
- deploy command used: `npx firebase-tools deploy --project black-lion-studios`
- deploy result: Firebase reported `Deploy complete!` for `https://black-lion-studios.web.app`
- protected-route verification: live `/dashboard` and `/messages` served the updated build and client bundles; local production chunks contain the new suite markers
- restore backup archive: `/home/sniper-lion-main/Documents/Black_Lion_Studios_dashboard_messages_backup_20260518-192549.tar.gz`

## 2026-05-18 service-focused copy cleanup

- changed files: `app/page.js`, `app/portal/page.js`, `app/store/page.js`, `app/privacy/page.js`, `components/profile-app.js`, `components/booking-manager-app.js`, `lib/legal-content.js`, `lib/site-content.js`, `lib/services.js`
- public copy now focuses on what clients can book: photography, video, audio, DJ work, beat sessions, membership sites, PC support, merch, scheduling, billing, delivery, and project messages
- reduced technical/documentation-style wording across landing, sign-in, store, FAQ, privacy, profile, and manager-facing text
- local verification: `node --check` on edited JS files and `npm run build`
- deploy command used: `npx firebase-tools deploy --project black-lion-studios`
- deploy result: Firebase reported `Deploy complete!` for `https://black-lion-studios.web.app`
- live verification: `/`, `/portal`, `/store`, `/privacy`, and `/faq` served the updated service-focused wording
- restore backup archive: `/home/sniper-lion-main/Documents/Black_Lion_Studios_service_copy_backup_20260518-194327.tar.gz`

## 2026-05-19 sign-in consolidation

- changed file: `app/portal/page.js`
- removed redundant sign-in-page sections for profile fit, signup timeline, security/data panels, profile/request/message previews, support band, entry steps, and repeated value stack
- reduced the sign-in guidance suite from 20 cards to 8 focused prompts
- live `/portal` now follows a shorter flow: hero and form, service choices, preparation prompts, quick paths, and final request CTA
- local verification: `node --check app/portal/page.js` and `npm run build`
- deploy command used: `npx firebase-tools deploy --project black-lion-studios`
- live verification: `/portal` and `/portal?auth=required` served the consolidated sign-in page

## 2026-05-20 Next component structure cleanup

- clarified the component model: this is already a Next.js App Router site, and Next components still run on React internally
- kept server components as the default structure and reserved `"use client"` files for actual browser behavior such as forms, theme, session sync, dashboard state, messaging, and profile editing
- moved the `/portal` sign-in surface into dedicated Next component modules under `components/portal/`
- kept `app/portal/page.js` focused on route/search-param handling and rendering `PortalContent`
- local verification: `node --check` for the new portal modules and `npm run build`
- deploy command used: `npm run deploy:full`
- live verification: `/portal` returned HTTP 200 and served the same sign-in copy from the new component structure
- restore backup archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_next_component_structure_20260520-163000.tar.gz`

## 2026-05-20 Next server-route conversion

- converted `/dashboard`, `/messages`, `/profile`, and `/booking-manager` from client-loaded shells into server-authenticated Next App Router pages
- those routes now call `requireWorkspaceUser` on the server and pass initial data into smaller interactive client islands
- removed unnecessary `"use client"` from `components/dashboard-widgets.js`
- remaining client components are browser-only islands for forms, local session sync, theme controls, inactivity logout, and live workspace updates
- local verification: `node --check` for changed pages/components and `npm run build`
- deploy command used: `npm run deploy:full`
- live verification: unauthenticated `/dashboard` and `/messages` return server-side `307` redirects to `/portal?auth=required`
- restore backup archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_next_server_routes_20260520-163500.tar.gz`

## 2026-05-20 analytics and onboarding install

- added first-party event tracking with no third-party analytics script
- new event API: `/api/events`
- event records are stored in Firestore `analytics_events` with event name, path, source, limited metadata, user role, optional user id, hashed user-agent/referrer, and timestamps
- tracked events include page views, marked CTA clicks, signup/login success, request submitted, message sent, profile updated, onboarding step clicks, invoice link clicks, and logout
- added `AnalyticsTracker` to the app layout for page views and marked-click tracking
- added a guided client onboarding panel to `/dashboard` with profile, first request, first message, and billing-readiness steps
- onboarding progress is server-computed from profile/request/message data and passed into the dashboard initial state
- local verification: `node --check` on new analytics/onboarding files and changed components, plus `npm run build`
- deploy command used: `npm run deploy:full`
- live verification: `/api/events` returned `405` for GET, accepted a POST smoke event with `{"ok":true}`, and `/dashboard` still redirects unauthenticated users to `/portal?auth=required`
- restore backup archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_analytics_onboarding_20260520-164500.tar.gz`

## 2026-05-20 auth redirect loop fix

- fixed a dashboard/sign-in refresh loop caused by `AuthSync` trusting a stale localStorage bearer token while server-rendered dashboard routes required the secure session cookie
- `AuthSync` now checks `/api/me` with the browser cookie session only before redirecting from `/portal` into a workspace
- stale client-side session tokens are cleared when the cookie-backed session is not authenticated
- local verification: `node --check components/auth-sync.js` and `npm run build`
- deploy command used: `npm run deploy:full`
- live verification: `/portal` returns HTTP 200 and signed-out `/dashboard` returns a single server-side `307` to `/portal?auth=required`
- restore backup archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_auth_loop_fix_20260520-165500.tar.gz`

## 2026-05-20 sign-in cookie handoff fix

- fixed the follow-up issue where sign-in could succeed but the browser returned to `/portal` because `/dashboard` did not see the secure cookie session yet
- client auth fetches now explicitly include same-origin credentials
- `AuthFormCard` waits for `/api/me` to confirm the cookie-backed session before navigating to `/dashboard`
- if the browser does not finish setting the secure session, the form now shows a session message instead of bouncing between pages
- local verification: `node --check` for auth/session files and `npm run build`
- deploy command used: `npm run deploy:full`
- live verification: `/portal` returns HTTP 200 and signed-out `/dashboard` returns one server-side `307` to `/portal?auth=required`
- restore backup archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_signin_cookie_handoff_20260520-170400.tar.gz`

## 2026-05-20 Firebase session cookie fix

- fixed the actual Firebase Hosting session-forwarding issue by changing the server auth cookie from `bls_session` to Firebase's forwarded `__session` cookie
- kept legacy `bls_session` reading temporarily for compatibility, but login/logout now clear the old cookie name
- this allows server-rendered routes like `/dashboard`, `/messages`, `/profile`, and `/booking-manager` to see the authenticated session through Firebase Hosting
- local verification: `node --check lib/auth.js` and `npm run build`
- deploy command used: `npm run deploy:full`
- live verification: `/portal` returns HTTP 200 and signed-out `/dashboard` returns one server-side `307` to `/portal?auth=required`
- restore backup archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_firebase_session_cookie_20260520-171800.tar.gz`

## 2026-05-20 Firebase migration checkpoint

- requested target project/account: `black-lion-media-studio`
- current Firebase CLI account can access `black-lion-studios` but received `403` on `black-lion-media-studio`
- no production retarget was applied because doing so before access is confirmed would break current deploys
- migration handoff: `FIREBASE_MIGRATION_HANDOFF_2026-05-20.md`

## 2026-05-20 Firebase migration completed

- added Firebase CLI account `blacklionmediastudio@gmail.com`
- retargeted default Firebase project to `black-lion-media-studio`
- retargeted Hosting site to `black-lion-media-studio`
- updated deploy scripts to use `--project black-lion-media-studio --account blacklionmediastudio@gmail.com`
- deployed Firestore rules/indexes, Hosting, and the Next SSR function to the new project
- enabled first-time project APIs and created the default Firestore database during deploy
- fixed Cloud Run public invocation on `ssrblacklionmediastudio` by adding `roles/run.invoker` for `allUsers`
- new live URL: `https://black-lion-media-studio.web.app`
- live verification: `/portal` returned HTTP 200, signed-out `/dashboard` returned one 307 to `/portal?auth=required`, and `/api/events` returned `{"ok":true}` for a POST smoke event
- restore backup archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_firebase_migration_final_20260520-214004.tar.gz`
- data note: the new Firebase project has a fresh Firestore database; old project data does not move automatically without export/import or a separate migration plan

## 2026-05-20 old Firebase production undeployed

- disabled Firebase Hosting for old project/site `black-lion-studios`
- deleted old framework SSR function `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`
- left old Firestore data alone; no database deletion was performed
- verification: `https://black-lion-studios.web.app/` returned HTTP 404 after Hosting disable, old functions list returned empty, and new `https://black-lion-media-studio.web.app/portal` still returned HTTP 200
- restore backup archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_old_origin_undeployed_20260520-214312.tar.gz`

## 2026-05-20 manager account restored on new Firebase project

- created the default manager account in the new `black-lion-media-studio` Firestore-backed user store because the new project started with a fresh database
- verified the documented manager credential returns HTTP 200 from `/api/login`
- verified the signed manager session opens `/booking-manager` with HTTP 200
- restore backup archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_manager_account_restored_20260520-223756.tar.gz`

## 2026-05-21 messaging GUI cleanup

- rebuilt the client message page into a cleaner studio inbox layout with a compact hero, compose panel, support context, account card, quick links, and readable message history
- removed the bulky message-help grid that made the page feel like documentation
- updated responsive styles so the message page wraps cleanly on narrow browser sizes
- deployed to `https://black-lion-media-studio.web.app`
- verification: `npm run build` passed, Firebase deploy completed, signed-out `/messages` redirects to `/portal?auth=required`, and authenticated `/messages` returned HTTP 200 with the new `messages-workspace` UI
- restore backup archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_messages_gui_cleanup_20260521-035536.tar.gz`

## 2026-05-21 dashboard efficiency cleanup

- removed the 60-card dashboard reminder suite and replaced it with a short request-to-delivery workflow panel
- removed unused dashboard/messaging dexterity shared components and CSS after the dashboard and messages pages were consolidated
- reduced the generated CSS chunk from about 37.9 KB to about 36.3 KB in the production build
- deployed to `https://black-lion-media-studio.web.app`
- verification: `npm run build` passed, Firebase deploy completed, signed-out `/dashboard` redirects to `/portal?auth=required`, manager `/dashboard` returns HTTP 200, `/booking-manager` remains manager-only, and authenticated client `/dashboard` returned HTTP 200 with `dashboard-workflow-panel` and without the old dexterity suite
- restore backup archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_dashboard_efficiency_cleanup_20260521-142530.tar.gz`

## 2026-05-21 legal compliance and FAQ update

- expanded `/legal` with a dedicated Government compliance checklist covering FTC-style advertising/consumer protection, privacy/security, CAN-SPAM/SMS marketing, ADA accessibility, copyright/DMCA, payments, records, children, prohibited use, and compliance maintenance
- updated government reference links for FTC advertising, privacy/security, cybersecurity, CAN-SPAM, COPPA, U.S. Copyright Office DMCA resources, DOJ ADA web guidance, and California privacy guidance
- updated footer Legal links and compliance wording to point users to `Legal & compliance`
- expanded `/faq` with added questions on ongoing support, billing/shipping fields, standalone messages, deposits/invoices/payments, cancellation/scope changes, privacy rights, selling personal information, children, accessibility, marketing messages, compliance notes, DMCA limits, and false copyright claims
- updated `lastUpdated` legal content date to May 21, 2026
- verification: `npm run build` passed, Firebase deploy completed, live `/legal` includes `Government compliance` and government reference links, live `/faq` includes the expanded compliance/payment/privacy/DMCA questions, and the live footer includes `Legal & compliance`
- restore backup archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_legal_faq_compliance_20260521-163657.tar.gz`

## 2026-05-19 typography cleanup

- changed files: `app/layout.js`, `app/globals.css`
- reverted the custom local brand font for the `Black Lion Studios` brand mark only
- kept descriptions, body copy, legal text, buttons, headings, and ordinary text mentions on Arial/Helvetica
- reduced the landing hero headline scale so `Book the work, save your place, and move your project forward.` is not oversized
- local verification: `node --check app/layout.js` and `npm run build`
- deploy command used: `npx firebase-tools deploy --project black-lion-studios`
- live/build verification: production build includes `daggerdancertitle` only through the brand font variable and `.brand-signature`

## Deployment notes

- Firebase Hosting target: `black-lion-studios`
- primary region: `us-central1`
- security hardening includes secure production cookies, strict response headers, origin checks, and tighter signed sessions
- latest local verification: `npm run build` passed after the messaging reset fix
- fastest resume guide: [QUICK_REFERENCE.md](/home/sniper-lion-main/Documents/Black%20Lion%20Studios/QUICK_REFERENCE.md)
- detailed rollout notes: [PROJECT_PROGRESS.md](/home/sniper-lion-main/Documents/Black%20Lion%20Studios/PROJECT_PROGRESS.md)
- deployment summary: [DEPLOY_PREP.md](/home/sniper-lion-main/Documents/Black%20Lion%20Studios/DEPLOY_PREP.md)
