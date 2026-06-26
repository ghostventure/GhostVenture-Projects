# Black Lion Studios Quick Reference

Use this first when resuming work. The longer history remains in `PROJECT_PROGRESS.md` and `DEPLOY_PREP.md`.

## Current Live State

- Live URL: `https://black-lion-media-studio.web.app`
- Firebase project: `black-lion-media-studio`
- Hosting site: `black-lion-media-studio`
- SSR function: `firebase-frameworks-black-lion-media-studio:ssrblacklionmediastudio(us-central1)`
- Framework: Next.js `16.0.11` through Firebase Hosting framework support
- Persistence: Firestore through Firebase Admin, with user normalization in `lib/db.js`

## Fast Commands

```bash
cd "/home/sniper-lion-main/Documents/Black Lion Studios"
node --check app/layout.js
node --check app/page.js
node --check app/portal/page.js
node --check components/theme-provider.js
node --check components/theme-toggle.js
node --check components/auth-sync.js
node --check components/auth-form-card.js
node --check components/client-nav.js
node --check components/dashboard-app.js
node --check components/profile-app.js
node --check components/booking-manager-app.js
node --check lib/email-notifications.js
node --check lib/square-billing.js
node --check lib/square-appointments.js
node --check lib/consultation-calendar.js
node --check app/api/messages/route.js
node --check app/api/square/bookings/webhook/route.js
node --check 'app/api/manager/requests/[requestId]/invoice/route.js'
node --check next.config.mjs
node -e "JSON.parse(require('fs').readFileSync('firebase.json','utf8')); console.log('firebase.json ok')"
npm run build
npm run deploy:full
npm run deploy:static-fast
npm run deploy:rules
```

Use `--project black-lion-media-studio --account blacklionmediastudio@gmail.com` for deploys. A previous deploy selected the wrong project when the project was not pinned.

Use `npm run deploy:full` when the public update must preserve `/portal`, protected routes, and `/api/**` routing. The 2026-05-22 landing tune-up showed that `deploy:static-fast` can release the homepage but break dynamic rewrites on the current `black-lion-media-studio` project.

## Live Checks

```bash
curl -s https://black-lion-media-studio.web.app/ | grep -E "Who this helps|The account is the shortcut|Trust and handoff|brand-signature" -n
curl -s https://black-lion-media-studio.web.app/portal | grep -E "The short version|Ready to send the request" -n
curl -s "https://black-lion-media-studio.web.app/portal?auth=required" | grep -E "Sign in or create an account|The short version" -n
curl -sI https://black-lion-media-studio.web.app/portal | grep -Ei "HTTP/2 200|server: Google Frontend" -n
curl -sI https://black-lion-media-studio.web.app/dashboard | grep -Ei "HTTP/2 307|location: /portal\\?auth=required" -n
curl -s -X POST https://black-lion-media-studio.web.app/api/events -H 'Content-Type: application/json' --data '{"eventName":"page_view","path":"/smoke","source":"quick-reference"}'
curl -s -X POST https://black-lion-media-studio.web.app/api/messages -H 'Content-Type: application/json' -d '{"subject":"Test","body":"Test"}'
curl -sI https://black-lion-media-studio.web.app/ | grep -Ei "content-security-policy|x-frame-options|x-content-type-options|permissions-policy|referrer-policy|strict-transport-security" -n
```

When checking framework-hosted pages, Firebase/CDN caching can briefly show the previous HTML. If in doubt, also inspect `.next/server/app/index.html` after build and retry the live URL after a short wait.

## Current UX Decisions

- Site typography is Arial/Helvetica by default.
- The custom `daggerdancertitle.ttf` font is only for the explicit `Black Lion Studios` brand mark wrapped with `brand-signature`.
- Do not apply the custom font to body descriptions, legal copy, FAQ answers, buttons, dashboard text, or ordinary text that mentions Black Lion Studios.
- Theme behavior is centralized in `app/layout.js`, `components/theme-provider.js`, and `components/theme-toggle.js`.
- The default theme choice is `system`; the toggle displays `Auto` for system mode and then moves to an explicit light/dark choice.
- Keep the head-level theme bootstrap in place so saved or system theme is applied before the page paints.
- Security headers are defined in both `next.config.mjs` and `firebase.json`; keep them aligned so static/prerendered pages and app routes stay consistent.
- The site is hardened against common browser tampering vectors, but client-side preferences like theme are intentionally user-controllable and must not be treated as proof of identity or permission.
- Square billing lives in `lib/square-billing.js`, `app/api/manager/requests/[requestId]/invoice/route.js`, `components/booking-manager-app.js`, and `components/dashboard-app.js`.
- Square Appointments sync lives in `lib/square-appointments.js`, `app/api/square/bookings/webhook/route.js`, `lib/db.js`, `lib/consultation-calendar.js`, `app/page.js`, and `app/book/page.js`.
- Square production runtime requires `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, and `SQUARE_WEBHOOK_SIGNATURE_KEY`; `SQUARE_ENVIRONMENT`, `SQUARE_API_VERSION`, `SQUARE_BOOKINGS_WEBHOOK_URL`, `SQUARE_APPOINTMENTS_TIMEZONE`, `NEXT_PUBLIC_SQUARE_APPOINTMENTS_URL`, and `SITE_BASE_URL` are optional.
- Use `npm run deploy:full` for Square billing, Square Appointments webhook, API, Firestore schema, or environment changes.
- Service invoice amounts are stored with the visible service prices in `lib/services.js`.
- The landing hero headline is intentionally smaller than the earlier poster-sized treatment.
- The `/portal` sign-in page is consolidated: hero/form, service choices, 8 preparation prompts, quick paths, and one final CTA.
- The 20-card sign-in guidance showcase was reduced to 8 focused prompts.
- The `/dashboard` helper suite was consolidated again on 2026-05-21: the old 60-card reminder wall was removed and replaced with a short `dashboard-workflow-panel`.
- The 2026-05-27 dashboard update adds `components/black-lion-media-suite.js`, a 40-module Black Lion Media Studio operations suite rendered after the workflow panel.
- The `/profile` page is consolidated into snapshot, readiness, contact/account, service/follow-up, billing/invoices, shipping/delivery, links, custom fields, and shortcuts.
- Browser-size wrapping is handled mainly in `app/globals.css` through shell gutters, flexible grid minimums, `auto-fit` grid wrapping, `overflow-wrap:anywhere`, and 1080/900/680/520px breakpoints.
- Inactivity logout lives in `components/client-nav.js` with shared constants/events in `lib/auth-events.js`.
- Single-session sign-on behavior lives in `components/auth-sync.js`; `/portal` redirects authenticated users to `/dashboard` after `/api/me` confirms the secure cookie session.
- If a user reports looping between `/dashboard` and `/portal`, check `components/auth-sync.js` first for stale localStorage-vs-cookie session drift.
- If sign-in succeeds but returns to `/portal`, check `components/auth-form-card.js` and `lib/client-session.js`; workspace navigation should wait for `/api/me` cookie-session confirmation and all auth fetches should include same-origin credentials.
- Server-rendered auth depends on Firebase Hosting forwarding the reserved `__session` cookie. Do not rename it back to `bls_session`.
- Auth/session shell changes require `npm run deploy:full`, not `deploy:static-fast`, because `/portal` and the auth shell rely on the SSR function.
- Firebase migration to `black-lion-media-studio` is complete. New CLI deploys use `blacklionmediastudio@gmail.com`.
- Client message email alerts live in `lib/email-notifications.js` and `app/api/messages/route.js`.
- Message alert delivery requires SMTP runtime settings: `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS`; optional `CLIENT_MESSAGE_ALERT_TO` defaults to `blacklionmediastudio@gmail.com`.
- SMTP settings were loaded into the latest deployed SSR function; local and Firebase staging `.env` files were removed after deploy.
- `.gitignore` excludes local env files, build output, Firebase staging files, dependency folders, and backup archives.
- Public copy should stay service-focused and plain: photography, video, audio, DJ, beat sessions, membership sites, PC support, merch, scheduling, billing, delivery, and project messages.
- The 2026-05-22 homepage tune-up keeps the landing page focused on client fit, request start, account shortcut value, service timing, and trust handoff details.
- The site is already a Next.js App Router app. Next still uses React under the hood; the working rule here is server components by default and `"use client"` only for browser-only behavior.
- `/portal` sign-in UI is now split into dedicated Next component modules under `components/portal/`, with route handling kept in `app/portal/page.js`.
- `/dashboard`, `/messages`, `/profile`, and `/booking-manager` are dynamic server-rendered Next routes that authenticate and load initial data before rendering client islands.
- Current intentional client islands: `booking-manager-app.js`, `dashboard-app.js`, `messages-app.js`, `profile-app.js`, `auth-form-card.js`, `client-nav.js`, `auth-sync.js`, `theme-provider.js`, and `theme-toggle.js`.
- `/models` is the public `Model Sign-up` route. It creates a separate model account/profile, not a client profile.
- Model accounts use `roles: ["model"]`, `user_type: "Model"`, `client_tier: "Model"`, and service interest `Model Sign-up`.
- Model Sign-up requires a new email, unique username, password, explicit 18+ acknowledgment, server-side DOB age check, project types, modeling interests, availability, production-readiness answers, contract readiness, 90-day reapply acknowledgment, no-show priority acknowledgment, Terms/Privacy acceptance, and contact consent.
- Model Sign-up requires a 1099/W-2 disclosure acknowledgment: model opportunities are project-based 1099 independent-contractor opportunities, not full-time W-2 employment, unless a separate written agreement says otherwise.
- Existing account emails are intentionally blocked from public model signup to prevent account takeover by password replacement.
- Model applications are retained in Firestore `model_applications` and the model profile is retained in `users.profile_fields`; custom profile fields allow up to 80 keys and 2000 chars per value for comprehensive model details.
- Model applicants can apply once every 3 months per email; application records store `next_eligible_application_at`, `attendance_status`, `no_show_count`, and `queue_status`.
- Model Sign-up uses Firestore email/username reservation locks for duplicate/tamper resistance. The client form detects another open tab and displays `another instance of this is open`; after 20 minutes of no activity on `/models`, it attempts to close the tab and quietly falls back to `/` if blocked.
- Model Sign-up draft fields autosave in browser storage and restore on return; the password is intentionally excluded from local retention. On successful submit, the draft is cleared and the entered data is retained in both `model_applications` and the model `users.profile_fields` record.
- Model Sign-up styling is theme-aware through existing CSS variables in `app/globals.css`.
- Latest Model Sign-up deployment used `npm run deploy:full` and live smoke confirmed `/models`, 1099 disclosure copy, homepage CTA, empty-payload API rejection, missing-1099-disclosure rejection, under-18 rejection, and a full valid production write. The live valid-write smoke created model application `BA9lxwvDTJQQm4QocCkf` and model user `wSozquJowaA9VYUMhTqZ` with email `smoke.model+1782006295214@example.com`; those smoke-test records plus the matching email lock and username reservation were cleaned up afterward with targeted Firebase CLI deletes.
- `/profile` adapts for model users and exposes model-specific PII/profile fields directly.
- `/booking-manager` includes a model-only search/review panel powered by `modelProfiles` from `buildManagerDashboardData()`.
- Homepage hero includes visible `Are you a model?` CTA to `/models`.
- Model Sign-up implementation details: `MODEL_SIGN_UP_2026-06-21.md`.
- Dashboard access fix details: `DASHBOARD_ACCESS_FIX_2026-06-12.md`
- First-party analytics lives in `components/analytics-tracker.js`, `lib/client-analytics.js`, `lib/analytics.js`, and `app/api/events/route.js`.
- Guided onboarding lives in `lib/onboarding.js` and the `/dashboard` onboarding panel inside `components/dashboard-app.js`.
- Event records are written to Firestore collection `analytics_events`; do not add third-party tracking scripts unless the privacy/legal copy is updated.

## Main Files

- `app/page.js`: public landing page
- `app/models/page.js`: public Model Sign-up page, FAQ, and 100+ component inventory render
- `app/portal/page.js`: sign-up/sign-in page
- `components/portal/`: server-first sign-in page sections and portal copy data
- `components/analytics-tracker.js`: page-view and marked-click tracker
- `app/layout.js`: global shell and brand font variable
- `app/globals.css`: theme, typography, layout, portal/dashboard/legal styling
- `components/shared-ui.js`: reusable UI kit and suite renderers
- `components/black-lion-media-suite.js`: 40-module Black Lion Media Studio dashboard operations suite
- `components/auth-form-card.js`: sign-up/sign-in form
- `components/dashboard-app.js`: client dashboard
- `components/messages-app.js`: messaging center
- `components/profile-app.js`: profile/account settings
- `components/booking-manager-app.js`: manager request review
- `components/model-application-form.js`: Model Sign-up form and account handoff
- `components/model-application-component-library.js`: renderer for Model Sign-up component inventory
- `components/site-footer.js`: global footer
- `lib/db.js`: Firestore schema normalization
- `lib/email-notifications.js`: SMTP client-message email alerts
- `lib/analytics.js`: server-side analytics event recording
- `lib/onboarding.js`: client onboarding progress model
- `lib/legal-content.js`: FAQ/legal/privacy/terms/copyright content
- `lib/services.js`: service catalog and visible service names
- `lib/model-application-components.js`: Model Sign-up 100+ unit inventory
- `firebase.static.json`: faster static/client-shell Hosting deploy config
- `scripts/prepare-static-hosting.mjs`: prepares the static-fast Hosting bundle

## Docs Map

- `QUICK_REFERENCE.md`: current state and fast resume commands
- `README.md`: project overview and major release summaries
- `PROJECT_PROGRESS.md`: chronological implementation history
- `DEPLOY_PREP.md`: deploy history, verification notes, and recovery steps
- `FIREBASE_MIGRATION_HANDOFF_2026-05-20.md`: completed migration handoff for `black-lion-media-studio`

## Backup Archives

- `/home/sniper-lion-main/Documents/Black_Lion_Studios_backup_20260518-184344.tar.gz`
- `/home/sniper-lion-main/Documents/Black_Lion_Studios_policy_backup_20260518-185434.tar.gz`
- `/home/sniper-lion-main/Documents/Black_Lion_Studios_dashboard_messages_backup_20260518-192549.tar.gz`
- `/home/sniper-lion-main/Documents/Black_Lion_Studios_service_copy_backup_20260518-194327.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_dashboard_60_component_backup_20260519-183353.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_theme_awareness_final_20260519-185120.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_tamper_resistance_final_20260519-215400.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_square_billing_final_20260519-220900.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_profile_static_fast_final_20260520-052626.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_responsive_layout_final_20260520-054000.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_auth_idle_sso_final_20260520-055300.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_message_email_alerts_final_20260520-061000.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_daily_final_20260520-061500.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_next_component_structure_20260520-163000.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_next_server_routes_20260520-163500.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_analytics_onboarding_20260520-164500.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_auth_loop_fix_20260520-165500.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_signin_cookie_handoff_20260520-170400.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_firebase_session_cookie_20260520-171800.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_firebase_migration_final_20260520-214004.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_old_origin_undeployed_20260520-214312.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_manager_account_restored_20260520-223756.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_messages_gui_cleanup_20260521-035536.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_dashboard_efficiency_cleanup_20260521-142530.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_legal_faq_compliance_20260521-163657.tar.gz`
- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_landing_tuneup_20260522-160354.tar.gz`

## Legal And FAQ Compliance Status

- `/legal` contains the Government compliance checklist and official government reference links.
- `/faq` includes practical questions on billing, cancellation, privacy rights, accessibility, marketing messages, DMCA limits, and false copyright claims.
- `/models` includes a dedicated Model FAQ for applicant concerns around 18+, separate model profiles, Instagram/portfolio, privacy, reapply limits, no-shows, contracts, compensation, usage rights, copyright materials, and sponsored-content disclosures.
- Footer Legal column and compliance block point to `Legal & compliance`.
- Main policy content lives in `lib/legal-content.js`.

## Dashboard Efficiency Status

- `/dashboard` now uses a short workflow panel instead of the old 60-card dexterity suite.
- `ClientDexteritySuite` and `MessagingDexteritySuite` were removed from `components/shared-ui.js`.
- Related `.dexterity-*` and `.messaging-dexterity-*` CSS was removed from `app/globals.css`.
- Signed-out `/dashboard` should redirect to `/portal?auth=required`.
- Manager `/dashboard` should open the client dashboard; `/booking-manager` remains the separate manager-only workspace.
- Authenticated client `/dashboard` should render `dashboard-workflow-panel`.

## Messaging Page Status

- `/messages` now uses the cleaned-up studio inbox UI in `components/messages-app.js`.
- Message-specific responsive styles live in `app/globals.css` under `.messages-*`.
- Signed-out `/messages` should redirect to `/portal?auth=required`.
- Authenticated `/messages` should render `messages-workspace`, `Studio inbox`, `New message`, and `Message history`.

## Manager Account Status

- Default manager username: `manager@blacklionstudios.com`
- Password is documented in `README.md`.
- The manager account has been created in the new `black-lion-media-studio` Firestore-backed user store.
- Verified manager login and `/booking-manager` access on the new live site.

## Old Origin Status

- Old Firebase project/site `black-lion-studios` has been undeployed.
- Old Hosting URL `https://black-lion-studios.web.app/` returned HTTP 404 after disable.
- Old SSR function `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)` was deleted.
- Old Firestore/database data was not deleted.

## 2026-05-20 Resume Point

- Final live state includes profile consolidation, faster deploy scripts, responsive wrapping, enriched idle logout, portal single-session redirect, client message email alerts, the server-first `/portal` component split under `components/portal/`, and server-authenticated workspace routes.
- Use `npm run deploy:full` for auth, API, SMTP, Square, Firestore, middleware, or environment changes.
- Use `npm run deploy:static-fast` for static/client-shell copy, CSS, and page layout changes.
- Do not keep `.env` in the repo after using it for a framework deploy.

## Recovery Notes

1. Do not deploy blindly from a broken workspace.
2. Check the current live page first.
3. If production is still good, fix local files before redeploying.
4. If local files are damaged, restore a backup archive into a clean folder.
5. Run `npm install` only if dependencies are missing or stale.
6. Run `npm run build`.
7. Deploy with `npm run deploy:full` for server/runtime changes or `npm run deploy:static-fast` for static/client-shell changes.
8. Verify live HTML, protected shell routes, and an API route, not only local source.
