# Deploy Status

Fast resume guide: [QUICK_REFERENCE.md](/home/sniper-lion-main/Documents/Black%20Lion%20Studios/QUICK_REFERENCE.md)

Current production target:

- Firebase project: `black-lion-media-studio`
- Hosting site: `black-lion-media-studio`
- Region: `us-central1`
- Live URL: `https://black-lion-media-studio.web.app`

## 2026-06-12 ad traffic deployment

- `npm run build` passed.
- `npm run deploy:framework-hosting` passed.
- `npm run smoke:live` passed.
- Live ad routes verified: `/`, `/about`, `/services`, `/contact`, `/work`, `/portfolio`, `/portal`, `/store`, `/faq`, `/privacy`, `/terms`, `/legal`, `/dmca`, `/book`, `/quote`, `/support`, `/ad-expansion`, `/photography`, `/videography`, `/dj-services`, `/beat-sessions`, `/pc-tech-support`, `/membership-sites`.
- Live metadata verified: canonical, Open Graph title/description/image, Twitter card.
- Live discovery files verified: `/robots.txt`, `/sitemap.xml`.
- `/ad-expansion` verified 200 additional components across 10 workstreams.
- Homepage GUI verified for the `Choose the fastest way in.` shortcut panel and `200-component board` link.
- Detailed record: `AD_TRAFFIC_READINESS_2026-06-12.md`

## 2026-06-12 dashboard request-form fix

- Fixed the client dashboard request form so it includes the backend-required `consultationTime` field.
- Marked dashboard request `consultationDate`, `budget`, and `timeline` inputs as required to match the API contract.
- `npm run build` passed.
- `npm run deploy:framework-hosting` passed.
- `npm run smoke:live` passed.
- Focused authenticated dashboard smoke passed:
  - disposable signup returned `201`
  - live `/dashboard` returned `200`
  - dashboard page contained `Client dashboard`, `Consultation time`, `Start a new service request`, and `Forty installed modules`
  - live `/api/requests` accepted a service request with `consultationTime`
- live `/api/dashboard` returned `200` and reflected `totalOrders: 1`

## 2026-06-12 manager dashboard redirect fix

- Removed the server-side redirect that forced manager/staff accounts from `/dashboard` to `/booking-manager`.
- Updated portal/login client routing so staff accounts land on `/dashboard` by default after sign-in.
- `/booking-manager` remains manager-only and reachable from dashboard navigation.
- `npm run build` passed.
- `npm run deploy:framework-hosting` passed.
- Manager smoke passed:
  - manager login returned `200`
  - authenticated manager `/dashboard` returned `200` with no `/booking-manager` redirect
  - authenticated manager `/booking-manager` returned `200`
- `npm run smoke:live` passed.
- Detailed record: `DASHBOARD_ACCESS_FIX_2026-06-12.md`

## 2026-06-19 Square Appointments calendar sync

Local changes:

- Homepage and `/book` route visitors to the Square Appointments booking link.
- Homepage splash includes a compact, theme-aware appointment calendar card.
- `app/api/square/bookings/webhook/route.js` receives Square `booking.created` and `booking.updated` events.
- `lib/square-appointments.js` validates Square webhook signatures, parses Square booking payloads, and maps appointments into the studio timezone.
- `lib/db.js` upserts Square appointments into deterministic `service_requests` documents and ignores stale lower-version webhook writes.
- `lib/consultation-calendar.js` includes active external Square appointment dates and filters cancelled/closed requests from calendar load counts.
- `components/booking-manager-app.js` shows the integrated consultation calendar and treats Square imports as appointment-only records.
- `firebase.static.json` and `scripts/prepare-static-hosting.mjs` preserve SSR/API/protected-route rewrites during static-fast releases.

Runtime env:

- Required in production: `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_WEBHOOK_SIGNATURE_KEY`.
- Optional: `SQUARE_ENVIRONMENT`, `SQUARE_API_VERSION`, `SQUARE_BOOKINGS_WEBHOOK_URL`, `SQUARE_APPOINTMENTS_TIMEZONE`, `NEXT_PUBLIC_SQUARE_APPOINTMENTS_URL`, `SITE_BASE_URL`.

Deploy guidance:

- Use `npm run deploy:full` for this release and any future Square webhook/API/runtime env change.
- Configure Square Developer Console webhook URL as `https://black-lion-media-studio.web.app/api/square/bookings/webhook`.
- Subscribe the Square webhook to `booking.created` and `booking.updated`.

## Current state

- Firebase Hosting deploy is working
- The Next.js server runtime is deployed through Firebase framework hosting
- The public site is live
- Public API routes are reachable
- Auth and signup endpoints are returning JSON correctly
- client-only purchase routes are protected before rendering
- production auth cookies are marked secure
- route-level security headers are applied through `proxy.js`
- global theme toggle is part of the production shell
- merch storefront is part of the live site
- footer boilerplate now reflects service, merch, client, legal, faq, and contact scope
- local brand-font assets are stored inside the project for easier access
- portal and dashboard now ship with a shared reusable UI layer plus richer guidance panels
- booking manager route and manager-only request API are part of the current release set
- landing page and portal now use the newer bright editorial redesign
- auth-sync and portal-route consolidation are part of the current release set
- landing and portal composition were rebuilt again to remove the previous repeated public-page skeleton
- landing and portal now use the more aggressive product-style public composition with staged hero panels and row-based service presentation
- shared UI primitives now include a broader 20-component site kit used across public, portal, and messaging pages
- landing, portal, and dashboard now ship with the newer art-directed editorial shell and upgraded typography system
- shared UI/component kit now exceeds 50 reusable pieces and is wired across landing, portal, dashboard, manager, profile, messages, and store
- public landing and portal copy now push account creation more clearly as part of the booking flow
- messaging form reset crash is fixed and deployed
- dashboard request form now uses the same safer async form-reset pattern
- user database schema is now versioned, normalized, and expanded for broader dynamic profile capture
- landing page now includes 20 additional landing-specific shared components
- sign-in portal now includes 20 additional portal-specific shared components
- landing page is consolidated back into a tighter conversion path instead of a long component showcase
- universal footer boilerplate now covers services, client routes, studio routes, contact, legal, privacy, support, and availability notices
- 2026-05-18 sign-in portal update is live with the consolidated 20-module `PortalSigninComponentSuite`
- expanded FAQ, legal overview, Privacy Policy, Terms of Use, and copyright-claim pages are live
- client dashboard and messaging dexterity suites are live in the latest deployed client bundles
- `/portal` is consolidated into the shorter sign-in flow with 8 preparation prompts
- site typography is Arial/Helvetica except explicit `Black Lion Studios` brand marks using `.brand-signature`
- profile consolidation is live on `/profile`
- static/client-shell deploys can use `npm run deploy:static-fast` when server behavior is unchanged
- responsive layout wrapping is live through the latest static-fast Hosting release
- inactivity logout and single-session sign-on updates are live through the latest full framework deploy
- client message email alert code is live; SMTP runtime settings are required before alerts can actually send
- SMTP runtime settings were loaded into the latest full framework deploy, and the temporary local `.env` was removed afterward

## Infrastructure fixes completed

- attached Google Cloud billing to the project path needed for framework hosting
- enabled required Google APIs for Firebase framework deploys
- created the default Firestore database
- migrated backend persistence away from local SQLite to Firestore-backed storage
- fixed Cloud Build service-account logging permissions
- fixed source bucket access for function builds
- granted Artifact Registry write access to the deployed compute service account
- configured Artifact Registry cleanup policy so Firebase Hosting releases can finalize
- granted public invoke access to the deployed Cloud Run-backed function
- granted Firestore and Firebase admin-related permissions to the deployed runtime service account
- revised public splash and client-access wording to match the site’s service-company purpose
- reworked landing-page layout to reduce repetitive section structure
- expanded the Firestore-backed user model to cover shipping, merch, account tier, and lifecycle data
- added global day/night theming with persistent client preference
- hardened write endpoints with origin checks and tightened signed-session validation
- integrated a local custom font for explicit `Black Lion Studios` brand-mark styling only
- consolidated repeated portal/dashboard markup into shared UI primitives and expanded both pages with portal-map and checklist guidance
- added a protected booking-manager experience, manager email config, and an all-request oversight API
- redesigned the public landing page and portal into a warmer, lighter, more editorial product-site layout
- expanded that redesign into a fuller art-direction pass across landing, portal, and dashboard surfaces
- reduced client auth-check churn, consolidated landing/portal content, and restored `/portal` as a static page shell
- replaced the old public two-column/card-stack composition with a more open editorial layout system
- consolidated repeated page-local rails, notices, value cards, spotlight panels, and form wrappers into the shared UI kit to reduce maintenance drag
- revised public messaging so the site explains what sign-up unlocks: faster requests, saved project context, and cleaner follow-through

## Notes

- The app is deployed with `Next 16.0.11`
- Firebase Hosting framework support was sensitive to version and infrastructure configuration during rollout
- Firebase framework Hosting pins `ssrblacklionmediastudio`; plain `--only hosting` can still rebuild/update that function
- `firebase.static.json` is the faster Hosting-only config for static/client-shell page releases
- Local preview and production now use different persistence approaches than the original SQLite version
- Current production URL remains `https://black-lion-studios.web.app`
- Font archive source is stored at `assets/fonts/dagger_dancer.zip`
- manager allowlist file is `config/booking-managers.json`
- default manager username is `manager@blacklionstudios.com`
- latest deploy propagation note: production login is live for the manager account, while the new `/booking-manager` route may briefly lag during Firebase SSR rollout completion

## Deploy commands

```bash
npm run deploy:full
npm run deploy:static-fast
npm run deploy:framework-hosting
npm run deploy:rules
```

- `deploy:full`: safest full framework deploy. Use for API routes, auth/session changes, Square billing, Square Appointments webhook sync, Firestore schema/rules/indexes, middleware/proxy, environment, Next config, or SSR behavior.
- `deploy:static-fast`: faster static/client-shell Hosting release. Use for static pages, client components, copy, CSS, and public assets after `npm run build` passes.
- `deploy:framework-hosting`: framework Hosting deploy. It may still update `ssrblacklionmediastudio` because the function is pinned to the site.
- `deploy:rules`: Firestore rules/index-only deploy.

After `deploy:static-fast`, verify `/`, `/profile`, `/portal`, `/dashboard`, `/booking-manager`, and at least one `/api/**` request. If routing breaks, recover with `npm run deploy:full`.

## 2026-05-22 landing page tune-up deploy note

Local changes:

- `app/page.js` now uses a more direct request-first hero.
- Added `Who this helps`, account-shortcut, service timing, and trust/handoff sections to the homepage.
- Reused existing shared landing components from `components/shared-ui.js`.
- Updated `README.md`, `PROJECT_PROGRESS.md`, `DEPLOY_PREP.md`, and `QUICK_REFERENCE.md`.

Verification before deploy:

- `node --check app/page.js`
- `npm run build`

Deploy commands:

```bash
npm run deploy:static-fast
npm run deploy:full
```

Deploy status:

- `npm run deploy:static-fast` released the updated homepage, but `/portal`, `/dashboard`, and `/api/events` returned 404 because the static Hosting config did not preserve valid SSR/API rewrites on the current `black-lion-media-studio` project.
- Recovery was completed immediately with `npm run deploy:full`.
- Full deploy updated `firebase-frameworks-black-lion-media-studio:ssrblacklionmediastudio(us-central1)` and released Hosting successfully.
- Firebase staging `.env` was removed after deploy cleanup.

Verification after deploy:

- Live `/` includes `Who this helps`, `The account is the shortcut`, `Know what kind of schedule`, and `Trust and handoff`.
- Live `/portal` returned HTTP 200.
- Live signed-out `/dashboard` redirected to `/portal?auth=required`.
- Live `/api/events` returned `{"ok":true}` for the smoke event.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_landing_tuneup_20260522-160354.tar.gz`

## 2026-05-20 profile consolidation and static-fast deploy note

Local changes deployed:

- `components/profile-app.js` was consolidated into snapshot, readiness, contact/account, service/follow-up, billing/invoices, shipping/delivery, links, custom fields, and shortcut sections.
- `scripts/prepare-static-hosting.mjs` prepares a static Hosting bundle from Next build output.
- `firebase.static.json` deploys that bundle while preserving `/api/**`, `/portal`, `/dashboard`, `/profile`, `/messages`, and `/booking-manager` rewrites to `ssrblacklionmediastudio`.
- `package.json` now exposes full, static-fast, framework-hosting, and rules deploy scripts.

Verification:

- `node --check components/profile-app.js` passed.
- `npm run build` passed.
- Full Firebase deploy completed successfully.
- `npm run deploy:static-fast` completed successfully as a Hosting-only release.
- Live `/` returned `HTTP/2 200`.
- Live `/profile` returned `HTTP/2 200` and referenced the updated profile chunk.
- Live `/portal` returned `HTTP/2 200` through the server function rewrite.
- Live invoice API check returned `{"error":"Please sign in first."}`.

Recovery:

- If static-fast routing fails, run `npm run deploy:full` to restore Firebase framework-managed Hosting and function wiring.
- Backup archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_profile_static_fast_final_20260520-052626.tar.gz`

## 2026-05-20 responsive layout deploy note

Local changes deployed:

- `app/globals.css` now uses responsive shell gutters, flexible grid minimums, broader `auto-fit` wrapping, text overflow protection, and small-screen button/row stacking rules.
- The change applies across public pages, portal, dashboard, profile, messages, manager, legal pages, shared suites, and footer layouts.

Verification:

- `npm run build` passed.
- `npm run deploy:static-fast` completed successfully.
- Live `/`, `/profile`, and `/portal` returned `HTTP/2 200`.
- Live `/api/manager/requests/test/invoice` returned `{"error":"Please sign in first."}`.
- Live CSS includes the responsive wrapping markers.

Recovery:

- If a responsive layout regression is found, restore from `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_responsive_layout_final_20260520-054000.tar.gz` or revert only the latest `app/globals.css` responsive block changes.

## 2026-05-20 auth idle and single-session deploy note

Local changes deployed:

- `components/client-nav.js`: idle warning, countdown, stay-signed-in action, manual logout action, cross-tab activity handling, and throttled activity broadcasts.
- `lib/auth-events.js`: shared auth state, activity event, idle timeout, and warning constants.
- `components/auth-sync.js`: `/portal` now redirects authenticated users to `/dashboard` or `/booking-manager`.
- `app/portal/page.js` and `components/auth-form-card.js`: idle logout reason support.
- `app/globals.css`: responsive styling for the idle warning.

Deploy:

- Used `npm run deploy:full` because `/portal` and the auth shell are rendered through the pinned SSR function.
- Firebase updated `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)` and released Hosting.

Verification:

- `node --check` passed for changed auth files.
- `npm run build` passed.
- Live `/portal?auth=required&reason=idle` renders the idle logout notice.
- Live `/portal` and `/dashboard` return `HTTP/2 200`.
- Live invoice API route still returns `{"error":"Please sign in first."}` for unauthenticated access.

Recovery:

- Restore archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_auth_idle_sso_final_20260520-055300.tar.gz`
- If routing is affected, run `npm run deploy:full` after restore because this change depends on the SSR function.

## 2026-05-20 client message email alert deploy note

Local changes deployed:

- `lib/email-notifications.js`: SMTP-backed email notifier for client messages.
- `app/api/messages/route.js`: sends an alert after saving a client message.
- `package.json` and `package-lock.json`: added `nodemailer`.

Runtime settings:

- Loaded in the latest full deploy: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `CLIENT_MESSAGE_ALERT_TO`, `SITE_BASE_URL`.
- Optional: `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`, `CLIENT_MESSAGE_ALERT_TO`, `SITE_BASE_URL`.
- Default recipient: `blacklionmediastudio@gmail.com`.
- If Gmail blocks SMTP auth, replace the deployed credential with a Gmail app password.
- Local and Firebase staging `.env` files were removed after deploy, and `.gitignore` now excludes `.env` files.

Deploy:

- Used `npm run deploy:full` because `/api/messages` is served by the SSR function.
- Firebase updated `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)` and released Hosting.

Verification:

- `node --check lib/email-notifications.js` passed.
- `node --check app/api/messages/route.js` passed.
- `npm run build` passed.
- Live `/api/messages` without auth returned `{"error":"Please sign in first."}`.
- Live `/portal` returned `HTTP/2 200`.
- Deployed function package includes `nodemailer`.
- Follow-up full deploy confirmed Firebase loaded environment variables from `.env`.
- Live `/api/messages` and the invoice API still return the expected unauthenticated JSON errors.

Recovery:

- Restore archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_message_email_alerts_final_20260520-061000.tar.gz`

## 2026-05-20 daily deploy and recovery summary

Today changed and deployed:

- `/profile` consolidation and enrichment.
- Static-fast Hosting deploy path for static/client-shell changes.
- Responsive wrapping behavior for browser resizing.
- Inactivity logout warning/countdown and cross-tab session activity sync.
- Single-session sign-on redirect behavior for `/portal`.
- Client message email alerting to the studio Gmail inbox.
- `.gitignore` protection for local runtime secrets and generated output.

Deployment paths used:

- `npm run deploy:static-fast` for static/client-shell layout work.
- `npm run deploy:full` for profile/auth/API/SMTP runtime changes.

Latest recovery position:

- Use `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_daily_final_20260520-061500.tar.gz` after the final archive is created.
- If a server/API/runtime issue appears, restore and run `npm run deploy:full`.
- If only static/client-shell output needs refreshing, run `npm run deploy:static-fast`.

## 2026-05-17 deploy note

Fix deployed:

- `components/messages-app.js` now captures the submitted form before awaiting `/api/messages`, then calls `form.reset()` after the API succeeds.
- `components/dashboard-app.js` now captures the submitted form before awaiting request submission/dashboard refresh, then calls `form.reset()` after the request flow succeeds.

Verification before deploy:

- `npm run build` completed successfully.

Deploy attempts:

- `npx firebase-tools deploy --only hosting` failed before release because the CLI selected project `estatehat`, where Hosting site `black-lion-studios` does not exist.
- `npx firebase-tools deploy --only hosting --project black-lion-studios` was retried with the correct project. In the sandboxed run it stalled during Firebase framework tooling's nested `npx which esbuild` check and was stopped.
- A pinned deploy then ran outside the sandbox with `npx firebase-tools deploy --only hosting --project black-lion-studios`.

Live verification completed:

- Firebase printed `Deploy complete!` and released Hosting URL `https://black-lion-studios.web.app`.
- `https://black-lion-studios.web.app/messages` serves the new build ID and references the deployed Messages app chunk.
- The deployed Messages app chunk contains the safe captured-form reset flow: `let s=e.currentTarget`, `new FormData(s)`, then `s.reset()` after the message API succeeds.

## 2026-05-17 user database hardening note

Local changes ready for deploy:

- `lib/db.js` now normalizes users through a centralized versioned schema with defaults for legacy and new records.
- User records now include richer dynamic fields: account type, roles, lifecycle stage, lead source, preferred language, pronouns, web/social links, project goals, referral source, accessibility notes, and bounded custom `profile_fields`.
- Client profile updates no longer mutate managed account status or tier fields.
- `/api/signup`, `/api/profile`, `/portal`, and `/profile` now support the broader profile contract.
- Manager request context now surfaces client type and lifecycle stage.

Verification before deploy:

- `node --check` passed for changed backend and component files.
- `npm run build` completed successfully.

Deploy status:

- Deployed with `npx firebase-tools deploy --only hosting --project black-lion-studios`.
- Firebase reported `Deploy complete!` and released Hosting URL `https://black-lion-studios.web.app`.
- Live `/` verification confirmed the consolidated homepage, `#services`, `#faq`, and conversion footer are served.
- Live `/portal` verification confirmed the portal-specific access, fit, profile, request, message, manager handoff, quick path, and conversion sections are served.
- Live `/profile` verification confirmed the universal footer is still present on signed-in shell routes.
- Live `/portal` serves the expanded signup fields, including account type, preferred contact, website, and referral source.
- Live `/profile` serves the new Profile app chunk with expanded identity, preferences, links, billing, shipping, accessibility, and custom profile fields.

## 2026-05-17 landing component expansion note

Local changes ready for deploy:

- Added 20 reusable landing-page components in `components/shared-ui.js`.
- Wired all 20 into `app/page.js` across proof, audience, outcomes, booking flow, trust, offer map, FAQ, portal preview, and conversion sections.
- Added responsive styling for the new landing sections in `app/globals.css`.

Verification before deploy:

- `node --check components/shared-ui.js` passed.
- `node --check app/page.js` passed.
- `npm run build` completed successfully.

Deploy status:

- Deployed with `npx firebase-tools deploy --only hosting --project black-lion-studios`.
- Firebase reported `Deploy complete!` and released Hosting URL `https://black-lion-studios.web.app`.
- Live homepage verification confirmed the new landing sections are served from `/`.

## 2026-05-17 universal footer boilerplate note

Local changes ready for deploy:

- Replaced the small global footer with a complete boilerplate footer in `components/site-footer.js`.
- Added service, client, studio, contact, legal, privacy, support, copyright, and service-availability footer content.
- Added `#services` and `#faq` anchors to the homepage for footer navigation.
- Added responsive footer styling in `app/globals.css`.

Verification before deploy:

- `node --check components/site-footer.js` passed.
- `node --check app/page.js` passed.
- `npm run build` completed successfully.

Deploy status:

- Deployed with `npx firebase-tools deploy --only hosting --project black-lion-studios`.
- Firebase reported `Deploy complete!` and released Hosting URL `https://black-lion-studios.web.app`.
- Live homepage and `/profile` verification confirmed the universal footer is served in production.
- A follow-up release corrected the homepage footer anchors so `#services` and `#faq` point to the consolidated sections.

## 2026-05-17 portal component expansion and landing consolidation note

Local changes ready for deploy:

- Added 20 reusable sign-in portal components in `components/shared-ui.js`.
- Wired all 20 into `app/portal/page.js` across access framing, account modes, credential guidance, account type context, signup timeline, return-user path, manager handoff, security note, data-use explanation, quick links, service preview, profile preview, message preview, request preview, support band, entry steps, value stack, trust panel, form sidecar, and conversion strip.
- Consolidated `app/page.js` into a shorter homepage flow while retaining the `#services` and `#faq` footer anchors.
- Updated `components/site-footer.js` to use ASCII copyright wording.
- Added responsive styling for the new portal sections in `app/globals.css`.

Verification before deploy:

- `node --check components/shared-ui.js` passed.
- `node --check app/portal/page.js` passed.
- `node --check app/page.js` passed.
- `node --check components/site-footer.js` passed.
- `npm run build` completed successfully.

Deploy status:

- Deployed with `npx firebase-tools deploy --only hosting --project black-lion-studios`.
- Firebase reported `Deploy complete!` and released Hosting URL `https://black-lion-studios.web.app`.

## 2026-05-18 sign-in suite deploy and recovery note

Local changes included:

- `app/portal/page.js`: added grouped data for 20 sign-in guidance modules and rendered the consolidated suite on `/portal`.
- `components/shared-ui.js`: added `PortalSigninComponentSuite` to keep the 20 modules behind one reusable renderer.
- `app/globals.css`: added layout and responsive styling for the suite.
- `README.md`, `PROJECT_PROGRESS.md`, and `DEPLOY_PREP.md`: documented the release and backup path.

Verification before deploy:

- `npm run build` completed successfully.

Deploy command:

```bash
npx firebase-tools deploy --project black-lion-studios
```

Deploy result:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Hosting finalized and released site `black-lion-studios`.
- Live URL remains `https://black-lion-studios.web.app`.

Live verification:

- `https://black-lion-studios.web.app/portal` serves `Everything the account should make easier.`
- `https://black-lion-studios.web.app/portal?auth=required` serves the same new sign-in suite and the auth-required notice.
- Historical note: this 20-module sign-in suite was superseded by the 2026-05-19 8-prompt sign-in consolidation.

Backup archive:

- `/home/sniper-lion-main/Documents/Black_Lion_Studios_backup_20260518-184344.tar.gz`

Recovery steps if something fails:

1. Do not run a blind deploy from a broken workspace.
2. Check the current production page first: `curl -s https://black-lion-studios.web.app/portal`.
3. If production is still good, leave it alone while fixing local files.
4. Restore the backup into a clean directory if the local project state is damaged.
5. Run `npm install` only if `node_modules` is missing or stale.
6. Run `npm run build`.
7. Deploy with the pinned project command: `npx firebase-tools deploy --project black-lion-studios`.
8. Verify both `/portal` and `/portal?auth=required` on the live Hosting URL.

## 2026-05-18 FAQ and legal policy deploy note

Local changes deployed:

- `lib/legal-content.js` centralizes expanded FAQ, legal references, compliance summaries, privacy sections, terms sections, and copyright-claim sections.
- `/faq`, `/legal`, `/privacy`, `/terms`, and `/dmca` are dedicated static policy routes.
- `app/page.js` uses the expanded FAQ content for the homepage preview.
- `components/site-footer.js` links the footer to the FAQ and all policy pages.
- `app/globals.css` adds responsive policy and FAQ page styling.

Verification before deploy:

- `node --check` passed for the new content file and new route files.
- `npm run build` completed successfully and generated 23 app routes.

Backup archive:

- `/home/sniper-lion-main/Documents/Black_Lion_Studios_policy_backup_20260518-185434.tar.gz`

Deploy command:

```bash
npx firebase-tools deploy --project black-lion-studios
```

Post-deploy verification targets:

- `https://black-lion-studios.web.app/faq`
- `https://black-lion-studios.web.app/legal`
- `https://black-lion-studios.web.app/privacy`
- `https://black-lion-studios.web.app/terms`
- `https://black-lion-studios.web.app/dmca`
- footer links on `https://black-lion-studios.web.app/`

Deploy status:

- `npx firebase-tools deploy --project black-lion-studios` completed successfully.
- Firebase updated `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Firebase finalized and released Hosting site `black-lion-studios`.
- Live verification confirmed `/faq`, `/legal`, `/privacy`, `/terms`, and `/dmca` serve the new content.

Copyright-claim stance update:

- `/dmca` now functions as a copyright-claim review page, not an overbroad automatic takedown posture.
- Claims are treated as allegations, not proof.
- The page states that similarity is not automatically infringement and that ideas, business concepts, functional elements, common layouts, generic style, and industry patterns are not treated the same as copied protected expression.
- The page reserves Black Lion Studios' right to preserve original-creation evidence and reject false, unsupported, abusive, or bad-faith claims.

## 2026-05-18 dashboard and messaging dexterity deploy note

Local changes deployed:

- `components/shared-ui.js`: added dashboard/messaging dexterity suites during the earlier expansion pass; those unused helper suites were later removed during the dashboard efficiency cleanup.
- `components/dashboard-app.js`: added 30 dashboard modules grouped into six dashboard dexterity groups.
- `components/messages-app.js`: added 10 messaging modules in one consolidated messaging suite.
- `app/globals.css`: added responsive shared styling for both suites.
- `README.md`, `PROJECT_PROGRESS.md`, and `DEPLOY_PREP.md`: documented the release and backup path.

Verification before deploy:

- `node --check components/shared-ui.js`
- `node --check components/dashboard-app.js`
- `node --check components/messages-app.js`
- `npm run build`

Deploy command:

```bash
npx firebase-tools deploy --project black-lion-studios
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Hosting finalized and released site `black-lion-studios`.
- Live URL remains `https://black-lion-studios.web.app`.

Verification after deploy:

- `https://black-lion-studios.web.app/dashboard` serves the updated client dashboard shell and bundle references.
- `https://black-lion-studios.web.app/messages` serves the updated messaging shell and bundle references.
- Production chunks include `Dashboard dexterity` and `Messaging dexterity`.

Backup archive:

- `/home/sniper-lion-main/Documents/Black_Lion_Studios_dashboard_messages_backup_20260518-192549.tar.gz`

## 2026-05-19 client dashboard 60-component deploy note

Local changes deployed:

- `components/dashboard-app.js`: expanded the existing consolidated dashboard suite from 30 to 60 modules.
- Added scheduling, assets, billing, approvals, support, and growth groups.
- Tightened repeated copy in the original request, status, communication, delivery, and future-project groups.
- `README.md`, `PROJECT_PROGRESS.md`, `DEPLOY_PREP.md`, and `QUICK_REFERENCE.md`: updated for the new deployed state.

Verification before deploy:

- `node --check components/dashboard-app.js`
- dashboard label audit confirmed items `01` through `60`
- `npm run build`
- local production chunks include `Preferred windows`, `Date hold`, and `Rebook path`

Deploy command:

```bash
npx firebase-tools deploy --project black-lion-studios
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Hosting finalized and released site `black-lion-studios`.
- Live URL remains `https://black-lion-studios.web.app`.

Verification after deploy:

- `https://black-lion-studios.web.app/dashboard` serves build `6-k9quZsxvoqw8RU4-elW`.
- The dashboard page references live chunk `/_next/static/chunks/3f2bc0c89a1805d4.js`.
- The live dashboard chunk contains the new 60-module suite through `Rebook path`.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_dashboard_60_component_backup_20260519-183353.tar.gz`

## 2026-05-19 theme-awareness deploy note

Local changes deployed:

- `app/layout.js`: added early theme bootstrap script and moved theme metadata into `viewport`.
- `components/theme-provider.js`: centralized theme validation, system preference resolution, OS-change handling, cross-tab sync, and theme-color updates.
- `components/theme-toggle.js`: added system-aware `Auto` state and clearer accessibility labels.
- `README.md`, `PROJECT_PROGRESS.md`, `DEPLOY_PREP.md`, and `QUICK_REFERENCE.md`: updated for the new theme behavior.

Verification before deploy:

- `node --check app/layout.js`
- `node --check components/theme-provider.js`
- `node --check components/theme-toggle.js`
- `npm run build`

Deploy command:

```bash
npx firebase-tools deploy --project black-lion-studios
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Hosting finalized and released site `black-lion-studios`.
- Live URL remains `https://black-lion-studios.web.app`.

Verification after deploy:

- `https://black-lion-studios.web.app/` serves build `X7hAnlrq10agFkYjSi65W`.
- Live HTML contains the early `bls-theme` bootstrap script.
- Live HTML contains `theme-color`, `color-scheme`, `data-theme-choice`, and the `Auto` theme toggle state.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_theme_awareness_final_20260519-185120.tar.gz`

## 2026-05-19 tamper-resistance hardening deploy note

Local changes deployed:

- `next.config.mjs`: added shared security headers for app responses.
- `firebase.json`: added matching Hosting headers so static and prerendered pages receive the same policy.
- `README.md`, `PROJECT_PROGRESS.md`, `DEPLOY_PREP.md`, and `QUICK_REFERENCE.md`: updated with the current hardening state.

Verification before deploy:

- `node --check next.config.mjs`
- `node -e "JSON.parse(require('fs').readFileSync('firebase.json','utf8')); console.log('firebase.json ok')"`
- `npm run build`

Deploy command:

```bash
npx firebase-tools deploy --project black-lion-studios
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Hosting finalized and released site `black-lion-studios`.
- Live URL remains `https://black-lion-studios.web.app`.

Verification after deploy:

- `curl -sI https://black-lion-studios.web.app/` returns the hardened CSP and security headers.
- `curl -sI https://black-lion-studios.web.app/dashboard` returns the same hardened CSP and security headers.
- Both checked routes include `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `object-src 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy`, and HSTS.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_tamper_resistance_final_20260519-215400.tar.gz`

## 2026-05-19 Square billing and invoice deploy note

Local changes deployed:

- `lib/services.js`: added invoice amounts for all listed services.
- `lib/square-billing.js`: added Square customer, order, invoice, and publish flow.
- `app/api/manager/requests/[requestId]/invoice/route.js`: added manager-only invoice creation endpoint.
- `lib/db.js`: added Square invoice fields to request normalization and invoice persistence.
- `components/booking-manager-app.js`: added manager Square billing panel.
- `components/dashboard-app.js`: added client invoice status/pay link and fixed service request details field.
- `app/globals.css`: added invoice summary styling.
- `README.md`, `PROJECT_PROGRESS.md`, `DEPLOY_PREP.md`, and `QUICK_REFERENCE.md`: documented the billing flow.

Runtime env:

- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`
- optional `SQUARE_ENVIRONMENT`
- optional `SQUARE_API_VERSION`

Verification before deploy:

- `node --check lib/services.js`
- `node --check lib/db.js`
- `node --check lib/square-billing.js`
- `node --check app/api/manager/requests/[requestId]/invoice/route.js`
- `node --check components/booking-manager-app.js`
- `node --check components/dashboard-app.js`
- `npm run build`

Deploy command:

```bash
npx firebase-tools deploy --project black-lion-studios
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Hosting finalized and released site `black-lion-studios`.
- Live URL remains `https://black-lion-studios.web.app`.

Verification after deploy:

- Live build: `4MiLCXf9CGj7UtZ4hGZ1f`.
- Live unauthenticated `POST /api/manager/requests/test/invoice` returns `{"error":"Please sign in first."}`.
- Live `/booking-manager` references the manager billing bundle.
- Live `/dashboard` references the dashboard billing bundle.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_square_billing_final_20260519-220900.tar.gz`

## 2026-05-18 service-focused copy deploy note

Local changes deployed:

- `app/page.js`: landing copy now leads with bookable services, account purpose, booking flow, service list, and direct request follow-up.
- `app/portal/page.js`: sign-in copy now focuses on account creation, service requests, project details, messages, scheduling, billing, and delivery.
- `app/store/page.js`: merch copy now focuses on browsing, availability questions, payment, pickup, and shipping.
- `components/profile-app.js`: profile copy now focuses on contact, billing, shipping, service preferences, and project notes.
- `components/booking-manager-app.js`: manager copy now uses clearer request, payment, and delivery wording.
- `lib/legal-content.js`, `lib/site-content.js`, `lib/services.js`, and `app/privacy/page.js`: FAQ, service, privacy, and policy wording was simplified while keeping required meaning.

Verification before deploy:

- `node --check app/page.js`
- `node --check app/portal/page.js`
- `node --check app/store/page.js`
- `node --check app/privacy/page.js`
- `node --check components/profile-app.js`
- `node --check components/booking-manager-app.js`
- `node --check lib/legal-content.js`
- `node --check lib/site-content.js`
- `node --check lib/services.js`
- `npm run build`

Deploy command:

```bash
npx firebase-tools deploy --project black-lion-studios
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Hosting finalized and released site `black-lion-studios`.
- Live URL remains `https://black-lion-studios.web.app`.

Verification after deploy:

- `https://black-lion-studios.web.app/` serves the revised landing copy and visible `Membership Sites & Support` service name.
- `https://black-lion-studios.web.app/portal` serves the revised sign-in and account-purpose copy.
- `https://black-lion-studios.web.app/store` serves the revised merch and account follow-up copy.
- `https://black-lion-studios.web.app/privacy` serves the simplified privacy wording.
- `https://black-lion-studios.web.app/faq` serves the simplified FAQ wording.

Backup archive:

- `/home/sniper-lion-main/Documents/Black_Lion_Studios_service_copy_backup_20260518-194327.tar.gz`

## 2026-05-19 sign-in consolidation deploy note

Local changes deployed:

- `app/portal/page.js` now removes redundant sign-in-page sections and keeps a shorter path through hero/form, service preview, preparation prompts, quick paths, and final CTA.
- The preparation suite now uses 8 focused prompts instead of the previous 20-card guidance set.

Verification before deploy:

- `node --check app/portal/page.js`
- `npm run build`

Deploy command:

```bash
npx firebase-tools deploy --project black-lion-studios
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Hosting finalized and released site `black-lion-studios`.

Verification after deploy:

- `https://black-lion-studios.web.app/portal` serves `The short version.` and `Ready to send the request?`.
- `https://black-lion-studios.web.app/portal?auth=required` still serves the required-auth notice and consolidated sign-in page.

## 2026-05-19 typography and docs consolidation deploy note

Local changes deployed:

- `app/layout.js`: restored the local `daggerdancertitle.ttf` font variable for brand-only use.
- `app/globals.css`: kept Arial/Helvetica as the default font and scoped the custom font only to `.brand-signature`.
- `QUICK_REFERENCE.md`: added a fast handoff document with current state, commands, live checks, UX decisions, file map, backup paths, and recovery notes.
- `README.md`, `PROJECT_PROGRESS.md`, and `DEPLOY_PREP.md`: now point to the quick reference first and remove stale typography/sign-in guidance where needed.

Verification before deploy:

- `node --check app/layout.js`
- `npm run build`

Deploy command:

```bash
npx firebase-tools deploy --project black-lion-studios
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Hosting finalized and released site `black-lion-studios`.

Verification after deploy:

- Build output includes `daggerdancertitle-s.p.1af08992.ttf` and a body class for the brand font variable.
- `.brand-signature` is the only CSS selector using `var(--font-brand-display)`.
- Body descriptions and ordinary text mentions of `Black Lion Studios` remain normal Arial text.

## 2026-05-20 Next component structure deploy note

Local changes:

- `app/portal/page.js` is now a thin App Router route wrapper.
- `components/portal/portal-content.js` owns the assembled sign-in page layout.
- `components/portal/portal-data.js` owns the sign-in page copy arrays.
- `components/portal/portal-hero-panel.js`, `portal-access-panel.js`, `portal-services-panel.js`, and `portal-quick-path-panel.js` own the visible section components.
- Interactive components remain client components only where needed; Next.js still uses React internally.

Verification before deploy:

- `node --check app/portal/page.js`
- `node --check components/portal/portal-content.js`
- `node --check components/portal/portal-access-panel.js`
- `node --check components/portal/portal-hero-panel.js`
- `npm run build`

Deploy command:

```bash
npm run deploy:full
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Hosting finalized and released site `black-lion-studios`.

Verification after deploy:

- `https://black-lion-studios.web.app/portal` returned HTTP 200.
- Live `/portal` served `Create your account and turn interest into a real request.`, `The short version.`, and `Ready to send the request?`.
- Local and Firebase staging `.env` files were absent after cleanup.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_next_component_structure_20260520-163000.tar.gz`

## 2026-05-20 Next server-route conversion deploy note

Local changes:

- `app/dashboard/page.js` now requires the workspace user server-side and passes `buildDashboardData(...)` into `DashboardApp`.
- `app/messages/page.js` now requires the workspace user server-side and passes sanitized user/message data into `MessagesApp`.
- `app/profile/page.js` now requires the workspace user server-side and passes sanitized user, request, and message-count data into `ProfileApp`.
- `app/booking-manager/page.js` now requires a manager server-side and passes manager dashboard data into `BookingManagerApp`.
- `components/dashboard-widgets.js` no longer declares `"use client"`.
- Interactive workspace components still use `"use client"` where browser state, form submission, session sync, or theme updates require it.

Verification before deploy:

- `node --check` for the changed route/component files
- `npm run build`

Deploy command:

```bash
npm run deploy:full
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Hosting finalized and released site `black-lion-studios`.

Verification after deploy:

- `https://black-lion-studios.web.app/dashboard` returned `307` to `/portal?auth=required` without a client fetch.
- `https://black-lion-studios.web.app/messages` returned `307` to `/portal?auth=required` without a client fetch.
- Local and Firebase staging `.env` files were absent after cleanup.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_next_server_routes_20260520-163500.tar.gz`

## 2026-05-20 analytics and onboarding deploy note

Local changes:

- `app/api/events/route.js`: new first-party event ingestion endpoint.
- `lib/analytics.js`: validates allowed events and records limited event data into Firestore.
- `lib/client-analytics.js`: browser helper using `sendBeacon` with fetch fallback.
- `components/analytics-tracker.js`: app-wide page-view and marked-click tracker.
- `lib/onboarding.js`: server-side onboarding progress model.
- `components/dashboard-app.js`: new onboarding panel and request-submit event tracking.
- `components/auth-form-card.js`, `messages-app.js`, `profile-app.js`, and `client-nav.js`: event tracking for signup/login/message/profile/logout actions.
- `app/layout.js`: includes the tracker inside the global shell.

Verification before deploy:

- `node --check` for new analytics/onboarding files and changed app/components
- `npm run build`

Deploy command:

```bash
npm run deploy:full
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Hosting finalized and released site `black-lion-studios`.

Verification after deploy:

- `https://black-lion-studios.web.app/api/events` returned `405` for GET, confirming the route exists and only accepts POST.
- A POST smoke event to `/api/events` returned `{"ok":true}`.
- `https://black-lion-studios.web.app/dashboard` still returned `307` to `/portal?auth=required` when signed out.
- Local and Firebase staging `.env` files were absent after cleanup.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_analytics_onboarding_20260520-164500.tar.gz`

## 2026-05-20 auth redirect loop fix deploy note

Local change:

- `components/auth-sync.js` now checks `/api/me` through the cookie-backed browser session before redirecting from `/portal` into `/dashboard` or `/booking-manager`.
- Stale localStorage bearer tokens are cleared when the cookie-backed session is not authenticated.

Verification before deploy:

- `node --check components/auth-sync.js`
- `npm run build`

Deploy command:

```bash
npm run deploy:full
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Hosting finalized and released site `black-lion-studios`.

Verification after deploy:

- `https://black-lion-studios.web.app/portal` returned HTTP 200.
- `https://black-lion-studios.web.app/dashboard` returned one server-side `307` to `/portal?auth=required` when signed out.
- Local and Firebase staging `.env` files were absent after cleanup.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_firebase_session_cookie_20260520-171800.tar.gz`

## 2026-05-20 Firebase migration completed

Target:

- Firebase project: `black-lion-media-studio`
- Hosting site: `black-lion-media-studio`
- Firebase CLI deploy account: `blacklionmediastudio@gmail.com`
- Live URL: `https://black-lion-media-studio.web.app`
- SSR function: `firebase-frameworks-black-lion-media-studio:ssrblacklionmediastudio(us-central1)`

Completed work:

- Added the target Firebase CLI account through OAuth.
- Retargeted `.firebaserc`, `firebase.json`, `firebase.static.json`, and deploy scripts to the new project/site.
- Deployed Firestore rules/indexes, Hosting, and the Next SSR function.
- Enabled first-time Firebase/Google Cloud APIs required by the new project.
- Created the default Firestore database during deployment.
- Fixed Hosting 403s by granting Cloud Run `roles/run.invoker` to `allUsers` on `ssrblacklionmediastudio`.

Verification:

- `https://black-lion-media-studio.web.app/portal` returned HTTP 200.
- `https://black-lion-media-studio.web.app/dashboard` returned HTTP 307 to `/portal?auth=required` while signed out.
- `POST https://black-lion-media-studio.web.app/api/events` returned `{"ok":true}`.
- Local and Firebase staging `.env` files were absent after cleanup.

Important data note:

- The new Firebase project has a fresh Firestore database. Existing user, request, message, analytics, and manager data from the old project does not automatically move without a Firestore export/import or explicit migration plan.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_firebase_migration_final_20260520-214004.tar.gz`

## 2026-05-20 old Firebase production undeployed

Old origin:

- Firebase project: `black-lion-studios`
- Hosting site: `black-lion-studios`
- Old live URL: `https://black-lion-studios.web.app`
- Old SSR function: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`

Completed work:

- Disabled Firebase Hosting for `black-lion-studios`.
- Deleted old SSR function `ssrblacklionstudios` in `us-central1`.
- Left old Firestore/database data untouched.

Verification:

- `https://black-lion-studios.web.app/` returned HTTP 404 after Hosting disable.
- `npx firebase-tools functions:list --project black-lion-studios --json` returned an empty result list.
- New production URL `https://black-lion-media-studio.web.app/portal` still returned HTTP 200.
- Signed-out new dashboard still returned HTTP 307 to `/portal?auth=required`.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_old_origin_undeployed_20260520-214312.tar.gz`

## 2026-05-20 manager account restored on new Firebase project

Reason:

- The new Firebase project has a fresh Firestore user store, so the documented manager credential existed in docs but the live manager account had not been created there yet.

Completed work:

- Created `manager@blacklionstudios.com` through the live `/api/signup` path using the documented manager credential.
- The manager email is allowed by `config/booking-managers.json`, so the account is recognized as a booking manager after creation.

Verification:

- `POST https://black-lion-media-studio.web.app/api/login` returned HTTP 200 for the manager account.
- Login response identified the user as a booking manager.
- Login set a session cookie.
- Authenticated `GET https://black-lion-media-studio.web.app/booking-manager` returned HTTP 200.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_manager_account_restored_20260520-223756.tar.gz`

## 2026-05-21 messaging GUI cleanup

Local changes:

- `components/messages-app.js`: replaced the old two-panel plus message-help-grid layout with a focused studio inbox UI.
- `app/globals.css`: added responsive `.messages-*` styling for the hero summary, compose form, support context, account card, quick links, empty state, and thread history.

Verification before deploy:

- `node --check components/messages-app.js`
- `npm run build`

Deploy command:

```bash
npm run deploy:full
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-media-studio:ssrblacklionmediastudio(us-central1)`.
- Hosting released `https://black-lion-media-studio.web.app`.

Verification after deploy:

- Signed-out `https://black-lion-media-studio.web.app/messages` returned HTTP 307 to `/portal?auth=required`.
- Authenticated `https://black-lion-media-studio.web.app/messages` returned HTTP 200.
- Live authenticated HTML included `messages-workspace`, `Studio inbox`, `New message`, and `Message history`.
- Firebase staging `.env` was removed after deploy cleanup.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_messages_gui_cleanup_20260521-035536.tar.gz`

## 2026-05-21 dashboard efficiency cleanup

Local changes:

- `components/dashboard-app.js`: removed the 60-card dashboard reminder suite and replaced it with a short workflow panel.
- `components/shared-ui.js`: removed unused `ClientDexteritySuite` and `MessagingDexteritySuite`.
- `app/globals.css`: removed unused `.dexterity-*`, `.messaging-dexterity-*`, and `messages-wide-panel` CSS and added `dashboard-workflow-panel` responsive layout.

Efficiency result:

- Production CSS chunk dropped from about 37.9 KB to about 36.3 KB.
- Dashboard copy is shorter and focuses on request, track, message, invoice, and finish.

Verification before deploy:

- `node --check components/dashboard-app.js`
- `node --check components/shared-ui.js`
- `npm run build`

Deploy command:

```bash
npm run deploy:full
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-media-studio:ssrblacklionmediastudio(us-central1)`.
- Hosting released `https://black-lion-media-studio.web.app`.

Verification after deploy:

- Signed-out `https://black-lion-media-studio.web.app/dashboard` returned HTTP 307 to `/portal?auth=required`.
- Manager `https://black-lion-media-studio.web.app/dashboard` returned HTTP 307 to `/booking-manager`.
- Authenticated client `https://black-lion-media-studio.web.app/dashboard` returned HTTP 200 with `dashboard-workflow-panel`.
- Authenticated client dashboard did not include the old `client-dexterity-suite` or `More ways to keep projects moving`.
- Temporary client smoke-test user was deleted after verification.
- Firebase staging `.env` was removed after deploy cleanup.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_dashboard_efficiency_cleanup_20260521-142530.tar.gz`

## 2026-05-21 legal compliance and FAQ update

Local changes:

- `lib/legal-content.js`: updated `lastUpdated`, added `governmentComplianceSections`, expanded FAQ, expanded privacy/terms/DMCA policy details, and updated official government reference links.
- `app/legal/page.js`: added the Government compliance checklist to the Legal page.
- `app/globals.css`: added `legal-compliance-list` and `legal-compliance-row` styles.
- `components/site-footer.js`: changed footer wording to `Legal & compliance`.

Verification before deploy:

- `node --check lib/legal-content.js`
- `node --check app/legal/page.js`
- `node --check components/site-footer.js`
- `node --check app/faq/page.js`
- `npm run build`

Deploy commands:

```bash
npm run deploy:full
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-media-studio:ssrblacklionmediastudio(us-central1)`.
- Hosting released `https://black-lion-media-studio.web.app`.

Verification after deploy:

- Live `/legal` included `Government compliance`, federal advertising, privacy/security, CAN-SPAM/SMS, accessibility, DMCA, payments, and government reference links.
- Live `/faq` included the expanded compliance/payment/privacy/accessibility/marketing/DMCA questions.
- Live footer included `Legal & compliance` and compliance wording.
- Firebase staging `.env` was removed after deploy cleanup.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_legal_faq_compliance_20260521-163657.tar.gz`

## 2026-05-20 Firebase session cookie fix deploy note

Local change:

- `lib/auth.js` now uses Firebase Hosting's forwarded `__session` cookie for the signed server session.
- `lib/auth.js` still reads old `bls_session` cookies as a migration fallback but clears that old cookie name on login/logout.

Verification before deploy:

- `node --check lib/auth.js`
- `npm run build`

Deploy command:

```bash
npm run deploy:full
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Hosting finalized and released site `black-lion-studios`.

Verification after deploy:

- `https://black-lion-studios.web.app/portal` returned HTTP 200.
- `https://black-lion-studios.web.app/dashboard` returned one server-side `307` to `/portal?auth=required` when signed out.
- Local and Firebase staging `.env` files were absent after cleanup.

Backup archive:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_auth_loop_fix_20260520-165500.tar.gz`

## 2026-05-20 sign-in cookie handoff fix deploy note

Local changes:

- `lib/client-session.js` now sends client auth requests with `credentials: "same-origin"`.
- `components/auth-sync.js` keeps the same cookie-session check on `/api/me`.
- `components/auth-form-card.js` waits for `/api/me` to confirm the secure cookie session before redirecting to the workspace.
- `lib/client-analytics.js` also sends same-origin credentials for event calls.

Verification before deploy:

- `node --check lib/client-session.js`
- `node --check components/auth-form-card.js`
- `node --check components/auth-sync.js`
- `node --check lib/client-analytics.js`
- `npm run build`

Deploy command:

```bash
npm run deploy:full
```

Deploy status:

- Firebase reported `Deploy complete!`.
- Function updated: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Hosting finalized and released site `black-lion-studios`.

Verification after deploy:

- `https://black-lion-studios.web.app/portal` returned HTTP 200.
- `https://black-lion-studios.web.app/dashboard` returned one server-side `307` to `/portal?auth=required` when signed out.
- Local and Firebase staging `.env` files were absent after cleanup.

## 2026-05-27 Black Lion Media Studio component suite deploy note

Local changes:

- `components/black-lion-media-suite.js` adds 40 dashboard operations modules.
- `components/dashboard-app.js` renders `BlackLionMediaComponentSuite` after the workflow panel.
- `app/globals.css` adds responsive suite and status-chip styling.

Verification before deploy:

- `node --check components/black-lion-media-suite.js`
- `node --check components/dashboard-app.js`
- `npm run build`

Deploy note:

- This suite is rendered in `/dashboard`, which is a dynamic authenticated route.
- Use `npm run deploy:full` for publishing this change; do not use `npm run deploy:static-fast` for the dashboard runtime.

Deploy status:

- `npm run deploy:full` completed successfully.
- Function updated: `firebase-frameworks-black-lion-media-studio:ssrblacklionmediastudio(us-central1)`.
- Hosting finalized and released site `black-lion-media-studio`.

Verification after deploy:

- `https://black-lion-media-studio.web.app/dashboard` returned HTTP 307 to `/portal?auth=required` when signed out.
- `https://black-lion-media-studio.web.app/portal` returned HTTP 200.
- `https://black-lion-media-studio.web.app/api/events` accepted a standard `page_view` smoke payload with `{"ok":true}`.
