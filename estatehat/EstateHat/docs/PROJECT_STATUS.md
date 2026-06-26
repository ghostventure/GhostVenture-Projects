# EstateHat Project Status

Last updated: 2026-05-05

## Current state

EstateHat is live as a Firebase-hosted Next.js static export with shared Next routes across landing, sign-in, public/legal pages, and the authenticated home shell.

Live URL:

- `https://estatehat.web.app`

Firebase project:

- `estatehat`

## Current production baseline

- Auth-required entry (demo/guest mode removed).
- Seller listing submission now persists into Firestore `listingSubmissions` review records instead of only local UI state.
- Matrix theme modes are installed in the shell:
  - `light`
  - `dark`
  - `matrix-green`
  - `matrix-blue`
- Header theme switching now uses a compact dropdown selector instead of multiple dedicated theme buttons.
- User and customer database records are enriched with transaction intent, stage owner, target market, budget band, timeline band, and last-contact tracking.
- Paid featured placements are installed in the UI for property sellers and service providers.
- Featured-placement browse and services UX is enriched with live status, active-window visibility, and clearer eligibility messaging.
- Backend listing-operations mechanics are installed in repo for submission lookup, privileged review queue access, approval/rejection actions, and submission-to-listing publication.
- Featured-placement backend mechanics are installed in repo for Stripe checkout, webhook activation, and marketplace surfacing.
- Hat Board is the default post-login landing page.
- Live listing sync status banners are active.
- Verified Profile badge system is active in UI with readiness gating.
- Verified User referral incentive is active in UI with one free month per verified referral, capped at 12.
- User and customer database controls are active in profile.
- Required legal steps are installed per profile.
- Government account profile roles are installed:
  - municipality, township, county, borough, parish, state, territory, federal
- Company identity language is updated to LLC.
- FAQ & Scope page is installed and linked from Help, footer, and command palette.
- Legal pages are updated to current scope language and route back to Hat Board.
- Payout framework and verified billing frameworks are modeled and persisted.
- Verified billing now includes referral incentive credits, earned/free/applied month counters, and a member referral code.
- Shared backend API bridge is installed for same-origin `/api/...` calls with direct Cloud Functions fallback attempts.
- Backend utility endpoints are staged in repo for:
  - `/api/health`
  - `/api/session/bootstrap`
- Browse Properties is upgraded with a stronger property-discovery header, live inventory pulse, quick filter chips, guided empty state, and dedicated saved-search rail.
- My Active Hats is upgraded with a transaction command center, attention queue, search/filter controls, restored role queues, and stronger readiness messaging.
- My Info is refreshed with a cleaner account overview hero, calmer status hierarchy, improved record summary, and less repetitive profile-state presentation.
- The assistant is upgraded with stronger intent routing, role/workspace context signals, workspace playbooks, role-driven route shortcuts, recent guided route recall, and a wider desktop operator panel.
- Android and iOS wrappers were resynced to the current Next export on 2026-04-29.
- US-51 strict compliance baseline and outlier flagging is now modeled and persisted.
- Support packet snapshot generation is available in Compliance Controls.
- Marketing consent is now audited with consent metadata and legal attestation gating.
- Auth/sign-in experience now includes stronger early-member incentive messaging for new account conversion.
- Post-login route access is centrally enforced for role-restricted views (navigation + command + route gating).
- First-pass GUI surfaces are installed for search, notifications, document vault, offer drafting, tour scheduling, property comparison, transaction timeline, and admin workbench.
- Goodies is installed as a lazy-loaded workspace with 94 EstateHat-specific helper features across navigation, property discovery, transaction workflow, documents/compliance, trust/money, communication/support, and admin operations.
- Phone and desktop responsive optimization is installed across the shell, including safer phone spacing, wider desktop page sizing, larger touch targets, mobile command-palette placement, and overflow guards for dense inline layouts.
- Final responsive OS layout pass is installed: EstateHat detects OS class, marks desktop vs mobile layout mode, guards desktop grids from overlap, and stacks major workspaces as tiles on mobile.
- Canonical public landing page now lives at `/`.
- Canonical account access now lives at `/signin`.
- Canonical signed-in app shell lives at `/home`.
- Canonical public/legal routes now live at:
  - `/about`
  - `/help`
  - `/faq`
  - `/invest`
  - `/press`
  - `/terms`
  - `/privacy`
  - `/accessibility`
  - `/dmca`
- Compatibility links remain installed:
  - `/start` redirects to `/`
  - `/login` and `/auth` resolve to `/signin`
  - `/public?page=...` resolves to the matching direct public route
- Public footer plates are installed on both the landing page and the sign-in/create-account page, matching the signed-in app footer content for Product, Company, Legal, Contact, platform badges, trust badges, and EstateHat LLC disclaimers.
- Simple image bands are installed across public auth, main page headers, Hat Data, Move Kit, and Goodies so the app has more visual context without changing workflows.
- Hat Board housing trends are installed using public FRED CSV feeds for mortgage rates, median new-home price, national home price index, and housing starts.
- GUI mechanics were cleaned so new surfaces use live listings, user-created local state, or empty connected states rather than mock production rows.
- Hardcoded transaction/admin/professional-match data sources are emptied as compatibility placeholders.
- Compliance mechanics tests and CI workflow are installed and passing.
- Cross-platform refresh commands are installed and verified:
  - `npm run sync:android`
  - `npm run sync:ios`
  - `npm run build:windows`
- Next.js web routes are now the production route surface for Hosting, Capacitor, and Electron packaging.
- Legacy HTML entry files and Vite web entry scripts were removed from the active repo path.
- Post-sign-in 404 handling is fixed:
  - sign-in now navigates to `/home` with Next router replacement instead of hard browser replacement
  - Firebase Hosting now serves exported routes with clean URLs enabled
  - direct requests to `/home` no longer depend on back-navigation recovery
- Next/Vite shared shell now uses a desktop right-side navigation rail, with the EstateHat Assistant anchored at bottom-center.
- Latest right-rail/assistant record: `docs/NEXT_RIGHT_RAIL_ASSISTANT_2026-04-23.md`
- Next/Vite shared UX enrichment is installed with role-aware Hat Board widgets, Action Inbox, Deal Health, compact bottom navigation, and Document Vault timeline.
- Latest UX enrichment record: `docs/NEXT_UX_ENRICHMENT_INSTALL_2026-04-23.md`
- Match Services is upgraded with match readiness scoring, expanded intake, role-specific introduction sequencing, saved requests, and seller-side professional invite/attach controls.
- Latest Match Services record: `docs/MATCH_SERVICES_UPGRADE_2026-04-23.md`
- My Info, Document Vault, Match Services `Relevant Bodies`, and the shared brand icon were refreshed together.
- Latest profile/vault/match/brand record: `docs/PROFILE_VAULT_MATCH_BRAND_REFRESH_2026-04-23.md`
- My Info card layout was widened and rearranged, and the landing page now includes stronger platform-positioning copy.
- Latest My Info/landing record: `docs/MYINFO_LAYOUT_LANDING_POSITIONING_2026-04-23.md`
- About was refreshed with US Citizen wording, stronger platform framing, government boundary language, bottom-center assistant placement, and consolidated government-body handling.
- Latest About/government/assistant record: `docs/ABOUT_GOVERNMENT_ASSISTANT_2026-04-23.md`
- Legal/help/assistant fee disclosures were aligned to the buyer-paid-by-default fee model, and Android/iOS/Windows wrapper management paths were refreshed.
- Latest legal/assistant/native record: `docs/LEGAL_ASSISTANT_NATIVE_REFRESH_2026-04-23.md`
- Seller-controlled fee lines are installed in `List Property` with amount/percentage entry and review visibility.
- Latest seller-fee record: `docs/SELLER_FEE_CONTROLS_2026-04-23.md`

## Data model status

- Firestore `users` profile schema version: `14`
- One EstateHat account marker is installed as `oneEstateHatId`.
- Latest One EstateHat record: `docs/ONE_ESTATEHAT_ROLLOUT_2026-04-18.md`
- Signed-in shells now enforce a 30-minute inactivity auto-logout and show the marker as `OneID / One EstateHat`.
- Latest inactivity/OneID record: `docs/INACTIVITY_LOGOUT_ONEID_2026-04-22.md`
- Day/night theme font shading and signed-in header button colors were resynced.
- Latest theme record: `docs/THEME_RESYNC_2026-04-22.md`
- AdRoll tracking via Google Tag Manager container `GTM-TWW3MG8S` was installed across Vite and Next entry points.
- Latest GTM record: `docs/GTM_INSTALL_2026-04-22.md`
- Move Kit is installed with 50 new buyer, seller, document, closing, and trust helpers.
- Latest Move Kit record: `docs/MOVE_KIT_50_INSTALL_2026-04-18.md`
- Managed persisted profile sections:
  - `security`
  - `verification`
  - `trust`
  - `legal`
  - `compliance`
  - `userDatabase`
  - `payoutFramework`
  - `verifiedBilling`

## Deployment status

- Most recent Hosting-backed frontend improvements are live, including listing submissions, Matrix themes, user-database enrichment, featured-placement UX/UI, and the dedicated `/invest` public page.
- Most recent Hosting deploy also includes the expanded 2026-05-05 investor page release, refreshed investor PDFs, and the 2026-05-02 assistant operator upgrade.
- Blaze activation, Cloud Build enablement, Artifact Registry enablement, Secret Manager enablement, and Stripe secret setup were all recovered on 2026-05-02 during backend deploy troubleshooting.
- Latest full backend deploy attempt on 2026-05-02 progressed through Functions analysis and secret validation, then stopped on a missing `SQUARE_ACCESS_TOKEN` Functions secret.
- Hosting URL remains: `https://estatehat.web.app`
- Deployment note: until Functions publish succeeds, Hosting-only deploys may still report unresolved function rewrite targets for `apiHealth`, `apiSessionBootstrap`, `apiListingOps`, and `stripeApi`.
- Important backend gap: the 2026-05-02 featured-placement security/privacy hardening is staged in repo but not live because it still requires a successful Functions deploy.
- Current next backend step: set `SQUARE_ACCESS_TOKEN`, then rerun `npm run deploy:backend`.

## Web foundation

- Web workflow now uses Next only:
  - `npm run dev`
  - `npm run build`
  - `npm run start`
- Shared production/export artifact:
  - `out/`
- Shared deploy command:
  - `npm run deploy:hosting`
- Backend deploy commands:
  - `npm run deploy:functions`
  - `npm run deploy:backend`
- Detailed records:
  - `docs/NEXT_FOUNDATION_2026-04-22.md`
  - `docs/NEXT_ONLY_ROUTE_CONSOLIDATION_2026-04-25.md`
  - `docs/BACKEND_API_ENRICHMENT_2026-04-28.md`
  - `docs/BROWSE_PROPERTIES_UX_UPGRADE_2026-04-29.md`
  - `docs/MY_ACTIVE_HATS_UPGRADE_2026-04-30.md`
  - `docs/MY_INFO_UX_REFRESH_2026-04-29.md`
  - `docs/ASSISTANT_NATIVE_REFRESH_2026-04-29.md`
  - `docs/ASSISTANT_OPERATOR_UPGRADE_2026-05-02.md`
  - `docs/RELEASE_AUDIT_2026-04-29.md`

## Operations note

- See `docs/OPERATIONS.md` for run/build/deploy commands.
- See `docs/PLATFORM_DOCUMENTATION.md` for full feature/legal/scope documentation.
- See `docs/US51_AGGREGATION_2026-04-11.md` for nationwide aggregated baseline.
- See `docs/ASSISTANT_COMPLIANCE_INDEX.md` for support-assistant compliance index.
- See `docs/GUI_MECHANICS_RELEASE_2026-04-13.md` for the GUI/mechanics cleanup and deployment record.
- See `docs/UX_UI_LAB_INSTALL_2026-04-17.md` for the Goodies install, rename, Forms copy update, and verification record.
- See `docs/MOVE_KIT_50_INSTALL_2026-04-18.md` for the Move Kit 50-item install, deploy, and smoke-test record.
- See `docs/RESPONSIVE_OS_LAYOUT_2026-04-18.md` for the OS detector, desktop overlap guards, mobile tile layout, and verification record.
- See `docs/PUBLIC_FOOTER_PLATES_2026-04-18.md` for the shared landing/sign-in footer plate record.
- See `docs/SIMPLE_IMAGERY_PASS_2026-04-18.md` for the simple image-band install record.
- See `docs/SIGNIN_HOME_SPLIT_2026-04-19.md` for the separate sign-in and home/app entry split.
- See `docs/NEXT_FOUNDATION_2026-04-22.md` for the initial Next foundation record.
- See `docs/NEXT_ONLY_ROUTE_CONSOLIDATION_2026-04-25.md` for the Next-only route consolidation, legacy entry-point removal, deploy result, and Stripe function warning.
- See `docs/BACKEND_API_ENRICHMENT_2026-04-28.md` for the backend client install, new function routes, verification, deploy result, and Blaze blocker.
- See `docs/BROWSE_PROPERTIES_UX_UPGRADE_2026-04-29.md` for the Browse Properties header, filter, saved-search, sync-state, and empty-state refresh.
- See `docs/MY_ACTIVE_HATS_UPGRADE_2026-04-30.md` for the transaction dashboard refresh, role-queue restore, attention queue, and verification record.
- See `docs/LISTING_SUBMISSIONS_MATRIX_THEMES_2026-05-01.md` for the seller submission queue install, Matrix theme install, verification, and deploy record.
- See `docs/FEATURED_PLACEMENTS_SECURITY_SMOKE_2026-05-02.md` for the featured-placement security smoke test, privacy finding, fix, and blocked backend deploy status.
- See `docs/BACKEND_DEPLOY_RECOVERY_2026-05-02.md` for the full Blaze/API/secret recovery log, current blocker, and exact retry steps.
- See `docs/ASSISTANT_OPERATOR_UPGRADE_2026-05-02.md` for the role-aware assistant upgrade, workspace playbooks, and deploy status.
- See `docs/MY_INFO_UX_REFRESH_2026-04-29.md` for the My Info hierarchy cleanup, account overview redesign, and customer-record presentation refresh.
- See `docs/ASSISTANT_NATIVE_REFRESH_2026-04-29.md` for the assistant quick-topic refresh, tighter mobile shell spacing, and Android/iOS wrapper resync note.
- See `docs/RELEASE_AUDIT_2026-04-29.md` for the smoke-test, security review, dexterity check, Windows packaging status, and release risk summary.
- See `docs/NEXT_RIGHT_RAIL_ASSISTANT_2026-04-23.md` for the right-side navigation rail, left-side assistant placement, verification, and deploy record.
- See `docs/NEXT_UX_ENRICHMENT_INSTALL_2026-04-23.md` for the Action Inbox, Deal Health, role-aware widgets, mobile bottom nav, document timeline, verification, and deploy record.
- See `docs/MATCH_SERVICES_UPGRADE_2026-04-23.md` for the Match Services intake, readiness, saved request, and seller attach controls.
- See `docs/PROFILE_VAULT_MATCH_BRAND_REFRESH_2026-04-23.md` for the My Info upgrade, Document Vault refresh, Relevant Bodies rename/enrichment, and brand icon fix.
- See `docs/MYINFO_LAYOUT_LANDING_POSITIONING_2026-04-23.md` for the My Info card-layout pass, local smoke-test note, and landing-page positioning copy update.
- See `docs/ABOUT_GOVERNMENT_ASSISTANT_2026-04-23.md` for the About refresh, government profile boundary controls, assistant relocation, and deployment record.
- See `docs/LEGAL_ASSISTANT_NATIVE_REFRESH_2026-04-23.md` for the fee-model legal/help alignment, assistant update, native wrapper refresh, and deployment record.
- See `docs/SELLER_FEE_CONTROLS_2026-04-23.md` for the seller fee amount/percentage controls and deployment record.
- See `docs/HANDOFF_2026-04-17.md` for the latest landing page, mobile/desktop, Hat Data, Goodies, Forms, deploy, and recovery notes.

## Rollback note

- If a fast rollback is needed, use `docs/failsafe/ROLLBACK_NOTES.md`.

## Known limitations

- Windows installer generation is working through the 32-bit Wine prefix at `/home/sniper-lion-main/.wine32-estatehat`.
- Latest Windows installer: `release/EstateHat-Setup-1.0.0.exe`.
- Latest fresh Windows app bundle is newer than the installer and lives at `release/win-unpacked/`.
- Fresh Windows installer regeneration is still blocked on this Linux host during Electron Builder packaging.
- Latest Android debug package installer: `release/EstateHat-Android-Debug-1.0.0.apk`.
- Latest Android refresh record: `docs/ANDROID_APK_REFRESH_2026-04-22.md`.
- Android wrapper was resynced successfully again on 2026-05-05 against the latest Next export.
- Windows desktop shell was rebuilt successfully again on 2026-05-05 via `npm run build:windows`.
- Android and iOS wrapper sync both completed successfully on 2026-04-29.
- iOS project is synced at `ios/App/App.xcodeproj`; `.ipa` export requires macOS/Xcode signing and provisioning.
- iOS signing/provisioning requires Apple-side tooling and credentials.
- Transaction, admin queue, professional matching, compliance flag, and document-review feeds now intentionally show empty states until connected to real backend data.
- Function-backed `/api/health`, `/api/session/bootstrap`, `/api/listings/*`, and `/api/stripe/*` routes are configured in repo and Hosting rewrites, but they are not live until Functions publish succeeds.
- Current backend publish blocker is missing secret `SQUARE_ACCESS_TOKEN`.
- Featured-placement server-side privacy hardening is implemented locally but not yet live because the Functions deploy has not completed.
- Functions runtime is still on deprecated Node `20`, and `firebase-functions` should be upgraded in a planned follow-up.

## 2026-06-25 GitHub Upload Note

- Uploaded EstateHat to GitHub repository `https://github.com/PlugzTech/AdventureCode-Projects`.
- Repository subfolder: `estatehat/`.
- Upload commit: `65920a4 Add FoxHub CLTCH EstateHat and ExcelBolt projects`.
- The GitHub copy is source-focused. It intentionally excludes local dependencies, build output, Firebase cache, release installers/APKs, environment files, local databases, generated wrapper public bundles, temporary recording files, and archived zip packages.
- Public landing media and investor PDFs already present in the source tree were retained.
- The GitHub repository is currently public, so do not commit credentials, private transaction data, investor-only drafts, payment/provider secrets, or unpublished operational secrets.
