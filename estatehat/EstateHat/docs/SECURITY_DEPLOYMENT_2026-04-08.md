# Security + Deployment Record (2026-04-08)

## Scope completed
- Hardened Firestore profile rules to enforce schema `v8` shape validation.
- Added role transition enforcement:
  - `buyer <-> seller` only
  - `corp_buyer <-> corp_seller` only
  - locked professional/admin/government roles remain fixed once assigned
- Added create-time self-service role restriction to consumer/corporate lanes unless privileged account.
- Added chat write hardening:
  - sender UID required on message writes
  - max attachment list size enforced in rules
- Added client-side message attachment safety controls:
  - max 5 files
  - max 4MB per file
  - allowed MIME types only (`jpeg/png/webp/pdf/plain`)
- Tightened hosting security headers:
  - `COOP`, `CORP`, `Origin-Agent-Cluster`, `X-Permitted-Cross-Domain-Policies`
  - CSP mixed-content protections (`upgrade-insecure-requests`, `block-all-mixed-content`)
  - no-store cache policy for `index.html` and `sw.js`

## Files changed
- `firestore.rules`
- `firebase.json`
- `src/backend.js`
- `src/estatehat-platform-alpha.jsx`
- `src/AuthScreen.jsx`

## Validation performed
- `npm run build` passed.
- Firestore rules compiled and deployed successfully.
- Hosting deployed successfully.

## Deployment results
- Project: `estatehat`
- Hosting URL: `https://estatehat.web.app`
- Hosting deployment: success
- Firestore rules deployment: success
- Storage rules deployment: blocked because Firebase Storage is not initialized in project `estatehat`.

## Follow-up required
1. Initialize Firebase Storage in project console if Storage is required.
2. After initialization, run:
   - `npx firebase-tools deploy --only storage --project estatehat`

