# Plugz to CLTCH Sign-In Bridge - 2026-07-29

## Purpose

This adds a secure bridge between the Plugz Firebase project and CLTCH.NTWRK:

- Existing Plugz account holders can continue into CLTCH through the CLTCH sign-in page.
- The bridge only runs after the person has successfully signed into Plugz and CLTCH receives a valid Plugz Firebase ID token.
- CLTCH verifies the Plugz Firebase ID token server-side.
- CLTCH creates or reuses the matching CLTCH Firebase Auth user.
- CLTCH requires explicit acceptance of the Plugz membership bridge terms before the bridge runs.
- CLTCH imports and auto-saves the Plugz account information needed for the feature.
- CLTCH grants a free six-month membership automatically.
- CLTCH signs the user in with a CLTCH custom token and routes them into the normal host/performer setup flow.

## Auth Workflow

The security rule for the feature is: clicking the Plugz button is not enough. A user must complete Plugz authentication first, then accept the CLTCH Plugz bridge terms before CLTCH grants access or saves anything.

1. CLTCH displays a Plugz sign-in or profile-activation control.
2. The user checks the CLTCH Plugz membership bridge terms acceptance box.
3. The browser starts Plugz Firebase Google sign-in through the secondary Plugz Firebase web app.
4. After Plugz sign-in succeeds, the browser requests the Plugz Firebase ID token.
5. The browser sends the Plugz ID token, requested CLTCH role, accepted terms flag, and terms version to `plugzBridge`.
6. `plugzBridge` verifies the Plugz token against project `plugz-untd-gear`.
7. `plugzBridge` rejects missing tokens, anonymous Plugz accounts, unverified Plugz email accounts, invalid terms acceptance, and a Plugz UID already claimed by another CLTCH UID.
8. For auth-page use, CLTCH creates or reuses a CLTCH Auth user by Plugz email and returns a CLTCH custom token.
9. For profile-page use, CLTCH verifies the current CLTCH ID token and attaches the Plugz membership to the already signed-in CLTCH account.
10. CLTCH imports the allowed Plugz account snapshot, auto-saves the CLTCH membership/user summary records, and grants the free six-month membership.
11. The browser signs into CLTCH with the returned custom token when the flow started from the auth page, then continues through existing CLTCH role/profile routing.

## Firebase Projects

Plugz source project:

- Firebase account: `blacklionmediastudio@gmail.com`
- Project display name: `Plugz-UNTD-gear`
- Project ID: `plugz-untd-gear`
- Web app: `Plugz Storefront`
- Web app ID: `1:329345923912:web:a9b7b5a474bcab3fb2d17d`
- Hosting URL: `https://plugz-untd-gear.web.app`

CLTCH target project:

- Firebase account: `blacklionmediastudio@gmail.com`
- Project ID: `cltch-ntwrk-social`
- Hosting site: `cltch-ntwrk-social`

## Files Changed

- `functions/index.js`
  - Added `plugzBridge` HTTPS Function.
  - Verifies Plugz ID tokens against Firebase project `plugz-untd-gear`.
  - Requires `acceptedTerms: true` and terms version `plugz-cltch-bridge-2026-07-29`.
  - Rejects unverified Plugz emails.
  - Creates/reuses a CLTCH Auth user by email.
  - Mints a CLTCH custom token.
  - Writes `memberships/{uid}`, `plugzBridgeClaims/{plugzUid}`, `plugzBridgeEvents/{eventId}`, imported Plugz profile fields, and summary membership metadata.

- `app/plugz-bridge.js`
  - Initializes a secondary Plugz Firebase client app.
  - Starts Plugz Google sign-in.
  - Exchanges the Plugz ID token for a CLTCH custom token through `plugzBridge`.
  - Handles popup-blocked redirect return state.

- `auth.html`
  - Adds `Continue with Plugz` to Sign In.
  - Adds `Continue with Plugz and Get 6 Months` to Sign Up.
  - Requires the user to accept the CLTCH Plugz membership terms before continuing.
  - Signs into CLTCH with the returned custom token.
  - Routes through existing CLTCH role/profile logic.

- `musician-profile.html`
  - Adds a `Plugz Member Access` feature card to the performer profile dashboard.
  - Requires terms acceptance before connecting Plugz.
  - Activates the free six-month membership on the currently signed-in CLTCH performer account.

- `host-profile.html`
  - Adds a `Plugz Member Access` feature panel to the host profile page.
  - Requires terms acceptance before connecting Plugz.
  - Activates the free six-month membership on the currently signed-in CLTCH host account.

- `firestore.rules`
  - Allows owner reads of server-managed `memberships/{uid}`.
  - Allows membership metadata to remain on `users/{uid}` during later client merges.
  - Blocks direct client read/write access to `plugzBridgeClaims` and `plugzBridgeEvents`.

- `terms.html`
  - Adds `#plugz-membership`, the terms surface linked from the bridge acceptance checkbox.

- `mobile-web/`
  - Regenerated with `npm run build:mobile` so the mobile wrapper has the same bridge code.

## Data Contract

The server writes:

- `memberships/{uid}`
  - `uid`
  - `email`
  - `provider: "plugz"`
  - `source: "plugz-untd-gear"`
  - `projectId: "plugz-untd-gear"`
  - `plan: "cltch-free-6-months"`
  - `status: "active"`
  - `trialMonths: 6`
  - `startedAt`
  - `expiresAt`
  - `updatedAt`
  - `plugzUid`
  - `plugzEmailVerified`
  - `termsAccepted`
  - `termsVersion`
  - `termsAcceptedAt`
  - `termsAcceptedFrom`
  - `importedProfile`

- `users/{uid}`
  - Existing CLTCH user summary fields.
  - `membershipPlan: "cltch-free-6-months"`
  - `membershipSource: "plugz"`
  - `membershipStatus: "active"`
  - `membershipExpiresAt`
  - `plugzUid`
  - `plugzTermsAccepted`
  - `plugzTermsVersion`
  - `plugzTermsAcceptedAt`
  - `plugzImportedAt`
  - `plugzImportedEmail`
  - `plugzImportedDisplayName`
  - `plugzImportedPhotoURL`
  - `plugzImportedProvider`

- `plugzBridgeClaims/{plugzUid}`
  - `plugzUid`
  - `cltchUid`
  - `email`
  - `status: "claimed"`
  - `source: "plugz-untd-gear"`
  - `firstClaimedAt`
  - `lastClaimedAt`

- `plugzBridgeEvents/{eventId}`
  - Audit entry for each membership grant.
  - Includes CLTCH UID, Plugz UID, role, plan, expiration, terms acceptance version, and imported profile snapshot.

The server keeps the later of the existing membership expiration or a fresh six-month expiration, so repeated Plugz bridge sign-ins do not shorten a still-active grant. `plugzBridgeClaims/{plugzUid}` regulates one Plugz account to one CLTCH account; if a different CLTCH account tries to claim the same Plugz UID, the server returns a conflict.

## Deploy Requirements

Deploy requires both Functions and Firestore rules, not just Hosting:

```bash
cd "/home/sniper-lion-main/Documents/Firebase Websites/CLTCH.NTWRK"
npx firebase-tools deploy --only functions:plugzBridge,firestore:rules,hosting --project cltch-ntwrk-social --account blacklionmediastudio@gmail.com
```

If Firebase reports `Authentication Error: Your credentials are no longer valid`, reauthenticate first:

```bash
npx firebase-tools login --reauth
```

## Firebase Console Prerequisites

Before live use:

1. In the Plugz Firebase project `plugz-untd-gear`, enable the sign-in provider expected for Plugz users. The current bridge UI uses Google sign-in.
2. In Plugz Authentication authorized domains, allow the CLTCH domains that will launch the Plugz sign-in popup:
   - `cltch-ntwrk-social.web.app`
   - any production CLTCH custom domain in use
   - localhost only for local development if needed
3. Confirm the CLTCH service account can mint custom tokens in the CLTCH project. Firebase Admin normally supports this from Cloud Functions.
4. Deploy the new `plugzBridge` function before expecting the buttons to work.

## Verification Run

Local verification completed:

```bash
node --check functions/index.js
node --check app/plugz-bridge.js
npm run smoke:plugz
npm run build:mobile
npm run build
```

Results:

- Function syntax passed.
- Browser bridge module syntax passed.
- Regulated workflow smoke passed.
- `mobile-web/` was regenerated.
- Next.js production build passed.

## Deployment Record

Deployed on 2026-07-29 to Firebase project `cltch-ntwrk-social` with account `blacklionmediastudio@gmail.com`.

Final successful deploy commands:

```bash
npx firebase-tools deploy --only hosting,firestore:rules --project cltch-ntwrk-social --account blacklionmediastudio@gmail.com
npx firebase-tools deploy --only functions:plugzBridge --project cltch-ntwrk-social --account blacklionmediastudio@gmail.com --force
```

The first deploy finalized Hosting and released Firestore rules. The second deploy updated `plugzBridge`, made the HTTP function publicly invokable for browser calls, and configured the Functions artifact cleanup policy for `us-central1`.

Live URLs:

- CLTCH Hosting: `https://cltch-ntwrk-social.web.app`
- Sign-in page: `https://cltch-ntwrk-social.web.app/auth.html`
- Musician profile feature: `https://cltch-ntwrk-social.web.app/musician-profile.html`
- Host profile feature: `https://cltch-ntwrk-social.web.app/host-profile.html`
- Terms section: `https://cltch-ntwrk-social.web.app/terms.html#plugz-membership`
- Function URL reported by Firebase: `https://plugzbridge-smijrao2ia-uc.a.run.app`
- Browser endpoint used by the client: `https://us-central1-cltch-ntwrk-social.cloudfunctions.net/plugzBridge`

Live smoke verification completed after deploy:

```bash
curl -s https://cltch-ntwrk-social.web.app/auth.html | grep -n -E "Continue with Plugz|plugzTermsSignin|plugz-bridge"
curl -s https://cltch-ntwrk-social.web.app/musician-profile.html | grep -n -E "Plugz Member Access|plugzProfileTerms|plugz-bridge"
curl -s https://cltch-ntwrk-social.web.app/host-profile.html | grep -n -E "Plugz Member Access|plugzProfileTerms|plugz-bridge"
curl -s https://cltch-ntwrk-social.web.app/terms.html | grep -n -E "plugz-membership|Plugz Membership Bridge|six-month"
curl -s -X OPTIONS -H 'Origin: https://cltch-ntwrk-social.web.app' -H 'Access-Control-Request-Method: POST' -i https://us-central1-cltch-ntwrk-social.cloudfunctions.net/plugzBridge
curl -s -X POST -H 'Origin: https://cltch-ntwrk-social.web.app' -H 'Content-Type: application/json' -d '{}' -i https://us-central1-cltch-ntwrk-social.cloudfunctions.net/plugzBridge
```

Observed live results:

- `auth.html` contains `Continue with Plugz`, `Continue with Plugz and Get 6 Months`, and imports `app/plugz-bridge.js`.
- `musician-profile.html` contains `Plugz Member Access` and imports `app/plugz-bridge.js`.
- `host-profile.html` contains `Plugz Member Access` and imports `app/plugz-bridge.js`.
- `terms.html` contains the `#plugz-membership` terms section.
- CORS preflight from `https://cltch-ntwrk-social.web.app` returns `HTTP/2 204`.
- POST without a Plugz token returns `HTTP/2 400` with `{"error":"Missing Plugz auth token."}`, proving the live function is reachable and still refuses unauthenticated bridge attempts.

Full real-user validation still requires signing in with an actual Plugz Firebase user in the browser. The expected behavior is that no CLTCH membership grant occurs until the Plugz sign-in succeeds, a verified Plugz ID token is passed to `plugzBridge`, and the user has accepted the terms version `plugz-cltch-bridge-2026-07-29`.
