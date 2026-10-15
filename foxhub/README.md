# FoxHub

FoxHub is a U.S.-built super-app foundation aimed at the WeChat model: private messaging, communities, payments, and mini-app distribution in one product.

Preferred public domain:

- `https://foxhub.com` (`FoxHub.com`)

Current Firebase Hosting fallback:

- `https://foxhub-superapp.web.app`

Firebase deploy account:

- Use `solidartentertainment@gmail.com` for `foxhub-superapp` deploys.
- See `docs/FIREBASE_SETUP.md` before publishing; the wrong CLI account can build locally but fail with a Firebase Hosting `403`.

## Current state

This repo currently contains an interactive alpha shell with a working data layer split:

- Next.js App Router shell and API route foundation
- super-app navigation
- chat, circles, wallet, discover, channels, and moments surfaces
- enriched sign-in page with account context, status cues, and app preview
- Moments photo posting with compressed image attachments and expanded reactions
- invite-backed account access and invite creation
- tutorial assistant for first-run users
- FAQ surface and richer footer boilerplates
- expanded connector registry including mainstream finance and platform APIs
- premium visual shell pass
- operator queue, notification center, and audit trail
- device-session tracking, document vault, and operator action log
- Google sign-in, email-link sign-in initiation, and stronger persisted presence state
- browser notification registration, durable thread read-state, and server-owned operator access records
- shell wiring for read state, member records, access and alerts, and operator access
- local onboarding and persistent alpha identity state
- repository layer with local fallback and Firebase config seam
- lazy-loaded authenticated shell
- lazy-loaded Firebase backend path

## Documentation

Start here:

- `docs/CURRENT_HANDOFF_2026-05-31.md`
- `docs/DOCS_INDEX.md`
- `docs/PROJECT_STATUS.md`

Current major notes:

- `docs/HOME_TAB_UX_ENRICHMENT_2026-04-28.md`
- `docs/HOME_DASHBOARD_LAYOUT_GUARD_2026-04-30.md`
- `docs/ORGANIZER_120_COMPONENT_EXPANSION_2026-05-27.md`
- `docs/FOOTER_BOILERPLATE_UPGRADE_2026-05-27.md`
- `docs/ANDROID_WINDOWS_REFRESH_2026-05-27.md`
- `docs/FOOTER_PUBLIC_ROUTES_2026-05-27.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/VERSIONING_AND_PACKAGING.md`
- `docs/PRODUCTION_BACKEND_READINESS.md`
- `docs/ADVERTISING_READINESS_2026-05-28.md`
- `docs/SIGNIN_AND_MOMENTS_ENRICHMENT_2026-05-31.md`
- `docs/PLATFORM_EXPANSION_AND_SECURITY_2026-04-03.md`
- `docs/OPS_TRUST_AND_EVIDENCE_2026-04-03.md`
- `docs/AUTH_PRESENCE_AND_OPERATOR_ACCESS_2026-04-03.md`
- `docs/GUI_FEATURE_WIRING_2026-04-03.md`
- `docs/PLATFORM_COMPONENTS_AND_OPTIMIZATION_2026-04-10.md`
- `docs/RUNTIME_BLANK_SCREEN_2026-04-03.md`
- `docs/HOME_WIDGET_RUNTIME_FIX_2026-04-03.md`

For a streamlined read, use `docs/CURRENT_HANDOFF_2026-05-31.md` as the single current-state source. The dated docs remain as history.

## Recommended stack

- Web app: Next.js App Router with React client components
- Mobile app: Expo + React Native in `mobile/`
- Desktop wrapper build: retained Vite output for Electron
- Server backend: Next.js API routes first, with Firebase Functions retained during migration
- Realtime backend: Firebase or Supabase for early speed
- Messaging/event layer: Firestore listeners first, then dedicated realtime services when scale demands it
- Payments: Stripe Treasury/Issuing or sponsor-bank-aligned wallet architecture
- Mini-apps: signed embeds with a permission manifest and event bridge

## Build order

1. Auth and identity graph
2. Direct messages and group chat
3. Contacts, profiles, and circles
4. Wallet ledger and P2P transfers
5. Discover feed and local services
6. Mini-app runtime, billing, and moderation

## Run locally

```bash
npm install
npm run dev
```

`npm run dev` starts the Next.js app and backend routes. The retained Vite shell is still available with:

```bash
npm run vite:dev
```

## Build commands

```bash
npm run build       # Next.js web/backend build
npm run vite:build  # retained Vite build for Electron and static Firebase Hosting
npm run clean       # remove generated build/cache outputs
```

## Mobile app

FoxHub's mobile app now lives in `mobile/` as an Expo/React Native target. Capacitor iOS/Android wrappers were removed from the active build path.

Start the Expo app:

```bash
npm install
npm run mobile
```

Run the mobile smoke check:

```bash
npm run mobile:smoke
```

Platform launch commands:

```bash
npm run mobile:ios      # macOS or Expo Go/dev-client workflow
npm run mobile:android
npm run mobile:web
```

The Expo app uses:

- app name: `FoxHub`
- iOS bundle identifier: `com.foxhub.app`
- Android package: `com.foxhub.app`

Detailed migration notes live in:

- `docs/EXPO_REACT_NATIVE_MIGRATION_2026-06-13.md`

Detailed Android recovery notes live in:

- `docs/DOCS_INDEX.md`
- `docs/ANDROID_WRAPPER_SETUP_2026-04-02.md`
- `docs/MOBILE_TAMPER_RESISTANCE_2026-04-02.md`

## Windows desktop wrapper

FoxHub now also has a Windows desktop wrapper path using Electron.

Current desktop files:

- `electron/main.cjs`
- `electron/preload.cjs`

Desktop commands:

```bash
npm run desktop
npm run dist:win
```

Windows output is generated into `release/` by `npm run dist:win`. That folder is treated as generated output and is not kept in the clean workspace.

## Backend modes

FoxHub currently supports three runtime modes:

- `local`: browser-only fallback for desktop web iteration
- `firebase`: enabled when the public Firebase environment variables are present
- `locked`: automatic native mobile safeguard when iOS or Android builds do not have Firebase configured

Copy `.env.example` to `.env` and fill in the Firebase values to move toward the hosted mode. Native iOS and Android builds no longer allow the writable local repository fallback.

## Firebase shape

The current Firebase path uses email/password auth plus Firestore collections under `users/{uid}`:

- `contacts`
- `circles`
- `channels`
- `walletEvents`
- `moments`
- `threads`
- `threads/{threadId}/messages`

This is a speed-first structure meant to get the product live quickly before a deeper production refactor.

FoxHub also uses a global invite collection for invite-backed access:

- `invites`

## Firebase repo files

- Firebase rules: `firestore.rules`
- Firebase config mapping: `firebase.json`
- Firebase setup notes: `docs/FIREBASE_SETUP.md`
- latest ops/trust/evidence note: `docs/OPS_TRUST_AND_EVIDENCE_2026-04-03.md`
- latest auth/presence/operator-access note: `docs/AUTH_PRESENCE_AND_OPERATOR_ACCESS_2026-04-03.md`
- latest GUI wiring note: `docs/GUI_FEATURE_WIRING_2026-04-03.md`

## Current code map

- Next app entry: `app/page.jsx`
- Next backend routes: `app/api`
- retained Vite entry: `src/main.jsx`
- top-level controller: `src/App.jsx`
- lazy-loaded authenticated shell: `src/FoxHubShell.jsx`
- seed product data: `src/data.js`
- app store hook: `src/useFoxHubStore.js`
- runtime backend selector: `src/repository.js`
- local backend: `src/repository-local.js`
- Firebase backend: `src/repository-firebase.js`
- Firebase bootstrap: `src/firebase.js`
- shared styles: `src/styles.css`

## Current performance note

The main bundle has already been reduced by splitting the app shell and Firebase backend path.

Current build shape:

- entry chunk: about `155 kB` minified
- authenticated shell chunk: about `11 kB` minified
- Firebase backend chunk: about `465 kB` minified

That is a major improvement over the earlier single-chunk build, but there is still more room to split by feature surface later.

## Recent runtime fix

One significant runtime bug was fixed on 2026-04-02:

- `src/App.jsx` previously returned early before some hooks ran
- that caused a React hook-order mismatch between loading and ready states
- the fix moved derived `useMemo` calls above the early loading return so hook order remains stable

If the app ever appears to build successfully but fail at runtime again, check hook ordering in `src/App.jsx` first.

## Blank page incident

Another runtime issue was fixed on 2026-04-03:

- the live Hosting page rendered blank even though builds were passing
- the real cause was a top-level `ReferenceError` in `src/App.jsx`
- `resolveLocalListing`, `updateCreatorOrder`, and `logDemandSignal` were passed into `FoxHubShell` without being pulled from `useFoxHubStore()`

Detailed notes live in:

- `docs/RUNTIME_BLANK_SCREEN_2026-04-03.md`

## Latest expansion notes

The most recent consolidated implementation notes live in:

- `docs/PLATFORM_EXPANSION_AND_SECURITY_2026-04-03.md`
- `docs/OPS_TRUST_AND_EVIDENCE_2026-04-03.md`
- `docs/AUTH_PRESENCE_AND_OPERATOR_ACCESS_2026-04-03.md`
- `docs/GUI_FEATURE_WIRING_2026-04-03.md`
