# CLTCH.NTWRK Project Status

Last updated: 2026-05-22

This file records the current implemented state of the CLTCH.NTWRK website and native app work in this repository.

Primary doc index: `docs/DOCS_INDEX.md`
Consolidated live baseline: `docs/SYSTEM_BASELINE_2026-04-01.md`
Latest rollout record: `docs/CLTCH_EXPERIENCE_PLATFORM_ROLLOUT_2026-04-12.md`
Latest GUI redesign record: `docs/GUI_CONTEMPORARY_THEME_REDESIGN_2026-04-12.md`
Latest component-library record: `docs/COMPONENT_LIBRARY_INSTALL_2026-04-12.md`
Latest Loaded Kit record: `docs/LOADED_KIT_45_INSTALL_2026-04-18.md`
Latest on-demand dispatch record: `docs/ON_DEMAND_DISPATCH_REFRAME_2026-04-18.md`
Latest tile/widget wrap record: `docs/TILE_WIDGET_WRAP_2026-04-18.md`
Latest legal table-grid record: `docs/LEGAL_TABLE_GRID_2026-04-18.md`
Latest OneID record: `docs/ONEID_ROLLOUT_2026-04-18.md`
Latest performer profile record: `docs/MUSICIAN_PROFILE_OVERHAUL_2026-04-18.md`
Latest Android APK build record: `docs/ANDROID_APK_BUILD_2026-04-18.md`
Latest Next foundation record: `docs/NEXT_FOUNDATION_2026-04-22.md`
Latest backend enrichment record: `docs/BACKEND_API_ENRICHMENT_2026-04-28.md`
Latest workspace UI enrichment record: `docs/WORKSPACE_UI_ENRICHMENT_2026-05-01.md`
Latest homepage service clarity record: `docs/HOMEPAGE_SERVICE_CLARITY_ROLLOUT_2026-05-21.md`
Latest sticky tile/card table cleanup record: `docs/STICKY_TILE_CARD_TABLE_CLEANUP_2026-05-22.md`
Latest handoff record: `docs/HANDOFF_2026-04-17.md`

## Live Website

- Live Hosting URL: `https://cltch-ntwrk.web.app`
- Firebase project: `cltch-ntwrk`
- Hosting serves the repo root, but native/dev folders are excluded through `firebase.json` so only website assets deploy.
- Hosting-side backend bridge changes were deployed on 2026-04-28.
- Full Functions deployment is currently blocked until the Firebase project is upgraded to Blaze.

## Next.js Foundation

- CLTCH now has a Next.js runtime foundation for local web work.
- `app/[[...path]]/route.js` serves the existing static HTML pages and static assets through Next.
- Current Next commands:
  - `npm run dev`
  - `npm run build`
  - `npm run start`
- The existing Firebase Hosting deploy path remains static for now: `npm run deploy:hosting`.
- The existing mobile wrapper path remains unchanged: `npm run build:mobile`, `npm run sync:android`, and `npm run sync:ios`.
- Detailed record: `docs/NEXT_FOUNDATION_2026-04-22.md`

## Native Package Outputs

- Latest Android debug package installer: `release/CLTCH-NTWRK-Android-Debug-1.0.0.apk`
- Gradle source APK output: `android/app/build/outputs/apk/debug/app-debug.apk`
- iOS project is synced through Capacitor, but `.ipa` export requires macOS/Xcode signing and provisioning.

## Website State

### Product center

- CLTCH.NTWRK is centered as an on-demand gig dispatch app.
- The homepage now explains practical service lanes for musicians/DJs, photo/video, models/hosts, and creative event help before pushing users to sign up.
- The homepage now includes booking-room operations copy so users understand that request details, contact status, arrival timing, payment setup, completion notes, and review handoff stay organized after a match.
- The intended core flow is:
  - host requests talent
  - nearby available performers see the request
  - performer accepts
  - booking moves through live status
  - event closes with payout and review
- Shared wording now follows the dispatch sequence:
  - Request
  - Match
  - Accept
  - Arrive
  - Complete
  - Pay + Review
- The shared component library is now presented as the `CLTCH Dispatch Kit`.
- Detailed record: `docs/ON_DEMAND_DISPATCH_REFRAME_2026-04-18.md`
- The Dispatch Kit, shared quick action tiles, gig radar cards, and host profile fields now wrap into responsive columns on wider screens instead of forcing long single-column scrolling.
- The quick action dock now lives in the page flow instead of sticking to the viewport; the guided assistant remains the only persistent helper.
- Repeated static card groups now share a centralized, denser card-fit table rule so service lanes, role cards, FAQ cards, ops cards, and dashboard grids wrap cleanly without wasting vertical space.
- `musician-matched-gigs.html` now uses the accepted true three-column dense desktop grid with matched, upcoming, radar, review, stats, and control card tables held to three cards per row. This replaced the earlier 12-column shell because it made the page appear over-packed instead of balanced.
- Terms and Privacy now use a document-style table grid instead of card-style policy blocks.
- Detailed record: `docs/TILE_WIDGET_WRAP_2026-04-18.md`
- CLTCH.NTWRK now presents accounts as OneID: one sign-in for hosting, performing, bookings, radar, support, and payments.
- User summaries include a generated `oneId`, and Firestore rules allow that field.
- Detailed record: `docs/ONEID_ROLLOUT_2026-04-18.md`
- `host-profile.html` and `musician-profile.html` now use matched-gigs-style responsive wrapping for grouped fields and profile tiles.
- `musician-profile.html` now has a cleaner performer setup hero, responsive dashboard grid, responsive form layout, and a fixed completion counter.
- Detailed record: `docs/MUSICIAN_PROFILE_OVERHAUL_2026-04-18.md`

### Security and backend

- Shared Firebase client is centralized in `app/firebase-client.js`.
- Shared backend endpoint resolution now lives in `app/backend-api.js`.
- Canonical user summaries are maintained in `users/{uid}` through `app/user-db.js`.
- Role records are maintained in `userRoles/{uid}`.
- Host profiles are stored in `hosts/{uid}`.
- Performer profiles are stored in `musicians/{uid}`.
- Booking pipeline data is stored in `gigs/{gigId}`.
- Firestore rules protect the website collections and validate allowed document shapes.
- Performer `bookedDates` is now treated as a bounded calendar cache rather than an unbounded booking history field, so profile documents stay lighter as usage grows.
- Shared Firestore query builders now live in `app/gig-queries.js`, keeping host and performer reads aligned.
- Open gig feeds are now constrained to upcoming gigs and capped to a fixed live-query window.
- Accepted gig reads are now date-ordered and bounded instead of loading the full accepted history into dashboard views.
- Host gig queue reads are now ordered and capped, so heavy host accounts do not become unbounded live payloads.
- Shared live Firestore listeners now pause while browser tabs are hidden through `app/visible-snapshot.js`, reducing background work and pointless rerenders.
- Firebase Functions now include:
  - `apiHealth`
  - `apiSessionBootstrap`
  - `stripeConfig`
  - `stripeCreateConnectedAccount`
  - `stripeCreateOnboardingLink`
  - `stripeCreateHostCheckoutIntent`
  - `plaidCreateLinkToken`
  - `plaidExchangePublicToken`
- Firebase Hosting now rewrites the CLTCH `/api/...` paths to the matching Functions endpoints.
- Stripe frontend calls now fall back to direct Cloud Functions URLs when same-origin `/api` is unavailable, which is especially important for static Hosting edge cases and native wrapper contexts.
- Attempting to deploy the new Functions on 2026-04-28 failed because Firebase could not enable required APIs without upgrading the project billing plan to Blaze.

### Auth stability and recovery

- Root `auth.html` was realigned to the stronger role-aware auth flow used by the newer CLTCH builds.
- Password users now must verify their email before protected app access.
- Protected pages reload the Firebase user before enforcing verification so sign-out/sign-in does not rely on stale `emailVerified` state.
- Protected pages now auto-sign-out after 5 minutes of inactivity.
- Idle logout now preserves the last protected page and safely resumes that page after the next valid sign-in for the same role.
- The auth/dashboard hard-refresh issue was traced to stale client-side cached code, not Firebase credentials.
- Active production service-worker caching for the website auth flow has been disabled for now.
- See `docs/AUTH_RECOVERY_2026-04-01.md`.

### Role toggle fix

- The Host versus Musician/DJ switch now persists the selected active role before redirecting.
- The toggle fix is implemented in:
  - `app/user-db.js`
  - `host.html`
  - `host-profile.html`
  - `musician-profile.html`
  - `musician-dashboard.html`
  - `musician-matched-gigs.html`
  - `gig-radar.html`
- This prevents the UI from falling back to a previously cached role after page load or auth restore.

### Footer and utility pages

- The main footer now includes:
  - `About`
  - `FAQ`
  - `Contact`
  - `Press`
  - `Accessibility`
  - `DMCA`
  - `Terms`
  - `Privacy`
- New footer-linked pages added:
  - `press.html`
  - `accessibility.html`
  - `dmca.html`

### GUI and workflow improvements

- Phone and desktop responsive optimization is installed in `cltch-boilerplate.css`:
  - phone layouts use safer spacing, single-column fallbacks, horizontal nav scrolling, fixed quick-dock spacing, and larger touch targets
  - desktop layouts use wider page shells, stronger two-column proportions, and larger component-library workspace sizing
  - dense cards, forms, status rows, overlays, and long content have overflow guards
  - the mobile-web mirror is synced through `npm run build:mobile`
- A 100-component CLTCH library is now installed in the shared runtime:
  - reachable from the floating `Components` quick-dock action
  - grouped by Host / Venue, Performer, Matching / Discovery, Booking / Communication, Payments / Business, and Trust / Safety / Compliance
  - every component supports `Enable`, `Run`, and `Open`
  - enabled state and recent activity persist in local storage
  - component routes point to existing CLTCH pages and anchors
  - synced into `mobile-web` for child app/web wrapper use
- The shared component library now has a 45-item Loaded Kit on top of the original 100 entries:
  - 15 brand-new components
  - 15 brand-new mechanics
  - 15 brand-new UI/UX features
  - categories:
    - `Loaded Kit / Components`
    - `Loaded Kit / Mechanics`
    - `Loaded Kit / UX/UI Features`
  - each item inherits the existing `Enable`, `Run`, and `Open` behavior
  - enabled state and activity still persist in local storage
  - synced into `mobile-web`
  - detailed record: `docs/LOADED_KIT_45_INSTALL_2026-04-18.md`
- The shared CLTCH GUI has been redesigned with a contemporary Day/Night visual system:
  - `Instrument Sans` for general UI text
  - `Newsreader` for major editorial headlines
  - lighter Day theme with cream, white, denim, and rust-gold accents
  - deeper Night theme with neutral slate surfaces, warm gold actions, and blue secondary accents
  - cleaner shared header, cards, forms, buttons, chips, overlays, modals, quick dock, and assistant styling
  - stronger page-width constraints and desktop wrapping while preserving mobile behavior
  - implemented in `cltch-boilerplate.css` and synced into `mobile-web`
- A follow-up Booking OS visual architecture pass now makes the site feel more like a product shell:
  - sticky rounded app header
  - left-edge status rail
  - split high-contrast hero rooms
  - feature hub as a command-room block
  - centered floating command dock
  - segmented workspace tabs
  - accent rails on operational cards
  - stronger dashboard stat/instrument styling
- A shared dexterity layer now improves site-wide interaction speed through:
  - sticky header behavior
  - larger touch targets on nav and workspace controls
  - stronger keyboard focus visibility
  - a skip-to-content link
  - a floating quick dock for top actions
  - a lightweight quick-jump palette
  - keyboard shortcuts: `Alt+1/2/3` for quick navigation, `/` to focus search or open jump palette, `Ctrl/Cmd+K` to open jump palette, `Esc` to leave active fields or close the palette
- The shared dexterity layer was expanded again on 2026-04-24:
  - the quick-jump overlay now supports inline filtering, active-item highlighting, keyboard travel, and an explicit close control
  - workspace tabs and mode toggles now support left/right arrow navigation and keep the active control centered in overflow layouts
  - shared command-search inputs now show live match counts, expose a clear action, and visually mark matching cards
  - larger shared forms now surface a completion guide with progress feedback and better invalid-field recovery on submit
- The shared queue surfaces were refined again on 2026-04-25 so the higher-traffic card areas feel more intentional instead of placeholder-heavy:
  - `gigList`, `upcomingList`, `matchedQueueList`, and `myReviewsList` now mount into a reusable card-table shell
  - each card table now has a titled toolbar, short purpose copy, a card-type chip, and a live item count
  - users can switch between `Board`, `Compact`, and `List` layouts, with the selected density persisted locally
  - the board/list treatments now read more like a product workspace instead of loose stacks of cards
- The shared workspace shell was enriched again on 2026-05-01:
  - host and performer workspaces now open with stronger branded mastheads
  - a reusable shared workspace header and quick-link system now frames the main booking surfaces
  - host operations support blocks were regrouped into a cleaner grid instead of loose stacked panels
  - the performer queue/notices/reputation stack now lives in a dedicated right rail
  - the visual shell now feels more like a dispatch operating console and less like disconnected dark cards
- Detailed record: `docs/WORKSPACE_UI_ENRICHMENT_2026-05-01.md`
- The shared site shell now includes a persistent light/dark theme toggle, and both modes are driven by the same shared color tokens in `cltch-boilerplate.css`.
- A lightweight guided assistant now lives in the shared site shell and surfaces page-specific "what do I do next?" help for auth, host, performer, and booking pages.
- The assistant now includes:
  - page-specific next-step checklists
  - direct action chips
  - tappable quick-question topics with remembered state per page
  - booking, Gig Radar, Business Class, and auth recovery guidance where relevant
- Noncritical shell UI like the quick dock and assistant now initializes after the critical page boot path instead of blocking first paint.
- Shared dashboard and form surfaces now use lighter paint costs and `content-visibility` on repeated sections to reduce scrolling and layout overhead on longer pages.
- The host posting screen now includes:
  - quick posting presets
  - local draft recovery
  - live host ops stats
  - searchable and filterable active gig management
  - queue shortcuts for open, booked, review, and cancelled views
  - duplicate-to-form controls for reposting a previous gig quickly
  - whole-gig cancel and reopen controls directly from the host queue
  - canceled or reopened gigs clear any prior accepted performer so reopened work always returns to a clean first-come, first-served pool
- The musician dashboard now includes:
  - queue controls for search and live request filtering
  - a top-level reputation snapshot so ratings are visible without scrolling to the bottom
  - a fixed performer tier ladder derived from host reviews: `Junior`, `Senior`, `Rising Star`, `Sensei`, `GOAT`, `Masterclass`
  - clearer operational links back to profile, upcoming gigs, and reviews
- Business Class is now a gated performer trust marker:
  - only `Senior` tier and above can request it
  - it is priced as a `$10/month` subscription in the UI
  - hosts only see the Business Class verified icon when `businessClassActive` is actually true
  - performer self-service can only request Business Class, not self-activate it
- The performer system now supports five live categories through the same booking and review flow:
  - Musician
  - DJ
  - Photographer
  - Cinematographer
  - Model
- Hosts still post into one shared `gigs` pipeline, and performers still use one shared `musicians/{uid}` profile model. The extra categories are handled through `performerType` and broadened style/genre matching rather than separate collections.
- Host and performer profile pages now include local draft recovery, visible completion guidance, and lightweight auth-activity visibility.
- Host post and profile forms now warn before leaving with unsaved changes.
- A lightweight support diagnostics page is available at `support.html` for inspecting the signed-in account's verification, role, profile, and runtime state.
- Host and performer dashboards now include lightweight in-app notices and less-placeholder empty states.
- Host and performer dashboards now include visible next-step checklists so first-time users have clear onboarding actions.
- Host and performer dashboards now include a simple first-booking guide so new users can understand the `post/accept/review` flow immediately.
- Accepted booking cards now show a simple progress timeline instead of reading like a static placeholder card.
- Open request cards now include clearer match-reason chips, and a dedicated `booking.html` page exists for fuller booking inspection.
- `booking.html` now also carries a private event-tied message thread between the host and assigned performer, plus performer check-in support in the pre-event window.
- `gig-radar.html` now includes:
  - saved gigs
  - sort modes for best match, soonest, and highest pay
  - a radar summary strip for best match, urgent gigs, saved gigs, and actionable-now gigs
  - stronger fit insight copy on each opportunity card
  - tighter match-purity filtering so already-booked or blocked dates do not leak into the performer feed
- The performer dashboard now includes a separate matched-gigs queue for upcoming matches, and accepted upcoming gigs can be canceled directly from the performer list.
- The performer workspace now uses explicit pages for:
  - `musician-matched-gigs.html`
  - `gig-radar.html`
  - `musician-profile.html`
- `musician-dashboard.html` still exists as a legacy compatibility route and should not be treated as the preferred performer tab target.
- The performer profile page is now grouped into clearer sections for identity, craft, availability, and payout setup instead of one long undifferentiated form.
- Performer tier thresholds are centralized in `app/performer-tier.js` so the dashboard, matched-gigs page, profile page, and public performer view use the same rating math.

### Payment priority

- Apple Pay is now the preferred default payment and payout path for new unsaved profile sessions.
- Google Pay is positioned as the second preferred option.
- The priority messaging is now reflected in both:
  - `host-profile.html`
  - `musician-profile.html`
- A prepared but inactive Stripe Connect scaffold now exists in `functions/index.js` and `docs/STRIPE_CONNECT_SETUP.md`.
- Intended payment architecture for later activation:
  - Stripe Connect
  - Express connected accounts for performers
  - destination charges
  - `application_fee_amount` retention for CLTCH.NTWRK's 2% platform fee
- Front-end prep now also exists in:
  - `app/stripe-connect.js`
  - `musician-profile.html` for performer onboarding readiness
  - `host-profile.html` for automated host checkout readiness
- The live website is still not auto-collecting the surcharge yet.

### Splash and loading behavior

- A shared fail-safe splash controller now lives in `site-init.js`.
- The global loading overlay is styled in `cltch-boilerplate.css`.
- The main gated pages now explicitly dismiss the splash once they are ready:
  - `host.html`
  - `host-profile.html`
  - `musician-profile.html`
  - `musician-dashboard.html`
  - `performer-view.html`
- The global splash also has a timeout fallback so the screen cannot hang indefinitely if a page bootstrap stalls.

### Cache invalidation maintenance completed on 2026-04-01

- The website hard-refresh issue was traced to stale cached client code.
- Website HTML and auth-critical scripts are now served `no-store`.
- Root `site-init.js` now unregisters service workers instead of registering one for the website flow.
- Root `sw.js` is now only a self-cleanup worker for stale clients.
- The updated website was redeployed to `https://cltch-ntwrk.web.app`.
- The shared dexterity refresh in `site-init.js` and `cltch-boilerplate.css` was deployed again to `https://cltch-ntwrk.web.app` on 2026-04-24 after local smoke checks.

## Mobile Wrapper State

- Capacitor wrappers exist for both iOS and Android.
- Main wrapper config files:
  - `package.json`
  - `capacitor.config.json`
  - `scripts/sync-mobile-web.mjs`
- Generated/native wrapper folders:
  - `ios/`
  - `android/`
- Generated sync output:
  - `mobile-web/`
- The mobile bundle script now mirrors root-site `.html`, `.css`, `.js`, and `.webmanifest` files automatically so Capacitor wrappers do not drift behind the live website.

### Wrapper commands

- `npm run build:mobile`
- `npm run sync:ios`
- `npm run sync:android`
- `npm run sync:mobile`
- `npm run open:ios`
- `npm run open:android`

## Full Native Alternate Apps

### iOS SwiftUI alternate

- Folder: `native-ios-swift/`
- Type: standalone SwiftUI iOS alternate
- Includes:
  - app entry
  - app state
  - auth shell
  - role-aware dashboard metrics
  - native host queue or performer radar tab
  - booking list plus booking-detail timeline sheet
  - profile facts tab
  - support diagnostics tab
  - database contract placeholder
- Current backend status:
  - still uses structured mock data through `PreviewSessionService`
  - not yet wired to Firebase Auth or Firestore
- Project generation is documented in `native-ios-swift/README.md`

### Android Kotlin alternate

- Folder: `native-android-kotlin/`
- Type: standalone Kotlin + Jetpack Compose Android alternate
- Includes:
  - Gradle project files
  - app entry
  - role-aware view model
  - auth shell
  - dashboard metrics and next-action cards
  - native host queue or performer radar tab
  - booking list plus detail/timeline state
  - profile facts screen
  - support diagnostics screen
  - database contract placeholder
- Current backend status:
  - still uses structured mock data through `SessionRepository`
  - not yet wired to Firebase Auth or Firestore
- Project setup is documented in `native-android-kotlin/README.md`

## Database Alignment

- Native scaffolds are intentionally not yet equipped with Firebase SDKs.
- They are aligned to the same website database contract so future hookup can target:
  - `users`
  - `userRoles`
  - `hosts`
  - `musicians`
  - `gigs`
- See `docs/NATIVE_DATABASE_SYNC.md`.

## Remaining Known Limits

- Firebase Storage is still optional and not required for the current core flows.
- Plaid function routes remain in Hosting config, but Cloud Functions are not fully deployable on the current project plan.
- Full native release binaries for the SwiftUI and Kotlin alternates still need to be generated from Xcode and Android Studio on your machines.

## 2026-06-25 GitHub Upload Note

- Uploaded CLTCH.NTWRK to GitHub repository `https://github.com/PlugzTech/AdventureCode-Projects`.
- Repository subfolder: `cltch-ntwrk/`.
- Upload commit: `65920a4 Add FoxHub CLTCH EstateHat and ExcelBolt projects`.
- The GitHub copy is source-focused. It intentionally excludes local dependencies, build output, Firebase cache, release APKs, environment files, local databases, generated webview bundles, and generated native build artifacts.
- The GitHub repository is currently public, so do not commit credentials, private user data, payment/provider secrets, or unpublished operational secrets.
