# EstateHat Docs

This folder holds project setup and handoff notes so the repo root stays focused on runtime and build files.

Use `PROJECT_STATUS.md` first for the current live state and latest recovery/deploy notes.

The current feature map and modernization evidence are in:

- `IMPLEMENTED_FEATURE_INVENTORY_2026-10-16.md`
- `MODERNIZATION_HANDOFF_2026-10-16.md`

## Current Web Runtime

- The web app is now Next-only.
- Canonical public routes: `/`, `/signin`, `/about`, `/help`, `/faq`, `/invest`, `/press`, `/terms`, `/privacy`, `/accessibility`, `/dmca`.
- Canonical authenticated route: `/home`.
- Compatibility routes kept for existing links:
  - `/start` redirects to `/`
  - `/login` and `/auth` resolve to `/signin`
  - `/public?page=...` resolves to the matching direct page
- Production web artifact: `out/`
- Production deploy command: `npm run deploy:hosting`
- Backend deploy commands:
  - `npm run deploy:functions`
  - `npm run deploy:backend`

## Core Docs

- `PROJECT_STATUS.md`
- `OPERATIONS.md`
- `PLATFORM_DOCUMENTATION.md`
- `HANDOFF_SUMMARY.md`
- `HANDOFF_2026-04-17.md`
- `INVESTOR_BRIEF.md`
- `INVESTOR_ONE_PAGER.md`
- `KPI_DASHBOARD_TEMPLATE.md`
- `DATA_ROOM_CHECKLIST.csv`
- `PROFILE_SECURITY_NOTES.md`
- `UX_UI_LAB_INSTALL_2026-04-17.md`
- `NEXT_FOUNDATION_2026-04-22.md`
- `NEXT_RIGHT_RAIL_ASSISTANT_2026-04-23.md`
- `NEXT_UX_ENRICHMENT_INSTALL_2026-04-23.md`
- `MATCH_SERVICES_UPGRADE_2026-04-23.md`
- `PROFILE_VAULT_MATCH_BRAND_REFRESH_2026-04-23.md`
- `MYINFO_LAYOUT_LANDING_POSITIONING_2026-04-23.md`
- `ABOUT_GOVERNMENT_ASSISTANT_2026-04-23.md`
- `LEGAL_ASSISTANT_NATIVE_REFRESH_2026-04-23.md`
- `SELLER_FEE_CONTROLS_2026-04-23.md`
- `STRIPE_BILLING_CONNECT_PREP_2026-04-23.md`
- `BACKEND_API_ENRICHMENT_2026-04-28.md`
- `BROWSE_PROPERTIES_UX_UPGRADE_2026-04-29.md`
- `MY_INFO_UX_REFRESH_2026-04-29.md`
- `ASSISTANT_NATIVE_REFRESH_2026-04-29.md`
- `ASSISTANT_OPERATOR_UPGRADE_2026-05-02.md`
- `INVEST_PAGE_RELEASE_2026-05-05.md`
- `ESTATEHAT_READINESS_LANDING_ENHANCEMENT_2026-07-11.md`
- `MY_ACTIVE_HATS_UPGRADE_2026-04-30.md`
- `LISTING_SUBMISSIONS_MATRIX_THEMES_2026-05-01.md`
- `FEATURED_PLACEMENTS_SECURITY_SMOKE_2026-05-02.md`
- `BACKEND_DEPLOY_RECOVERY_2026-05-02.md`
- `RELEASE_AUDIT_2026-04-29.md`
- `ANDROID_APK_REFRESH_2026-04-22.md`
- `IOS_SETUP.md`
- `WINDOWS_SETUP.md`
- `WINDOWS_PUBLIC_DOWNLOAD_2026-07-11.md`
- `OVERHEAD_STYLE_OPERATIONS_COMPONENTS_2026-08-28.md`

## Failsafe

- `failsafe/RECOVERY_GUIDE.md`
- `failsafe/ROLLBACK_NOTES.md`
- `failsafe/FILE_MAP.md`
- `failsafe/DEPLOYMENT_CHECKLIST.md`

## Native Project Locations

- iOS: `ios/App/App.xcodeproj`
- Windows desktop shell: `electron/main.cjs`
