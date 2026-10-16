# Plugz Identity Handoff - 2026-07-29

## Purpose

This note documents the Plugz side of the CLTCH.NTWRK bridge. The main implementation record is `PLUGZ_CLTCH_BRIDGE_2026-07-29.md`; this file is the shorter operating handoff for what Plugz must provide and what CLTCH will accept.

## Plugz Project

- Firebase account used for discovery/deploy work: `blacklionmediastudio@gmail.com`
- Plugz Firebase project ID: `plugz-untd-gear`
- Plugz project display name: `Plugz-UNTD-gear`
- Plugz web app name: `Plugz Storefront`
- Plugz hosting URL: `https://plugz-untd-gear.web.app`
- CLTCH target Firebase project ID: `cltch-ntwrk-social`
- CLTCH live URL: `https://cltch-ntwrk-social.web.app`

## User Auth Rule

The bridge is sign-in gated. CLTCH does not grant a membership because someone clicked a Plugz button.

Required sequence:

1. The user starts from CLTCH.
2. The user accepts the CLTCH Plugz bridge terms shown in-product.
3. The user completes Plugz Firebase sign-in.
4. The browser receives a Plugz Firebase ID token after successful Plugz auth.
5. CLTCH sends that token to the deployed `plugzBridge` function.
6. The server verifies the token against Plugz project `plugz-untd-gear`.
7. Only after server verification does CLTCH create/reuse the CLTCH account, import the approved Plugz profile fields, save membership records, and return a CLTCH custom token.

Rejected states:

- No Plugz token.
- Anonymous Plugz sign-in.
- Plugz email is not verified.
- Terms were not accepted.
- Terms version does not match `plugz-cltch-bridge-2026-07-29`.
- The Plugz UID is already claimed by a different CLTCH UID.

## Plugz Data Accepted By CLTCH

CLTCH imports only the account identity fields needed to activate and identify the bridge membership:

- Plugz UID.
- Plugz email.
- Plugz email verification state.
- Plugz display name, if available.
- Plugz photo URL, if available.
- Plugz Firebase sign-in provider.
- Plugz token issue/auth timestamps available from the verified token.

The server stores a snapshot of this imported identity data under the CLTCH user and membership records. The client does not write the bridge audit or claim records directly.

## CLTCH Records Created Or Updated

Server-managed records:

- `memberships/{cltchUid}`
  - Free six-month CLTCH membership grant.
  - `provider: "plugz"`.
  - `source: "plugz-untd-gear"`.
  - Terms acceptance version and timestamp.
  - Imported Plugz profile snapshot.

- `users/{cltchUid}`
  - CLTCH user summary.
  - Plugz membership summary fields.
  - Imported Plugz email/display/photo fields.

- `plugzBridgeClaims/{plugzUid}`
  - One Plugz UID to one CLTCH UID claim map.
  - Prevents a single Plugz account from being used to claim multiple CLTCH memberships.

- `plugzBridgeEvents/{eventId}`
  - Audit event for each successful bridge activation.

## Profile Page Behavior

The Plugz bridge is available from CLTCH profile pages as a feature:

- `musician-profile.html` shows `Plugz Member Access`.
- `host-profile.html` shows `Plugz Member Access`.
- A currently signed-in CLTCH user can connect Plugz from the profile page.
- In this path, the server verifies both the current CLTCH ID token and the Plugz ID token before saving the Plugz membership to the existing CLTCH UID.

## Auth Page Behavior

The Plugz bridge is available from CLTCH auth:

- `auth.html` sign-in includes `Continue with Plugz`.
- `auth.html` sign-up includes `Continue with Plugz and Get 6 Months`.
- After successful Plugz verification, CLTCH creates or reuses the matching CLTCH Auth user by email.
- CLTCH signs the user in with a CLTCH custom token returned by `plugzBridge`.

## Terms Surface

Terms link:

- `https://cltch-ntwrk-social.web.app/terms.html#plugz-membership`

Terms version:

- `plugz-cltch-bridge-2026-07-29`

The in-product checkbox requires the user to authorize CLTCH to verify the Plugz account, import and auto-save the needed Plugz account information, create or update CLTCH records, and activate the free six-month membership.

## Live Endpoint

Client endpoint:

```text
https://us-central1-cltch-ntwrk-social.cloudfunctions.net/plugzBridge
```

Firebase-reported Cloud Run URL:

```text
https://plugzbridge-smijrao2ia-uc.a.run.app
```

The client uses the `cloudfunctions.net` URL.

## Live Verification Results

Verified on 2026-07-29:

- CLTCH Hosting is deployed at `https://cltch-ntwrk-social.web.app`.
- `auth.html` contains the Plugz sign-in and sign-up buttons.
- `musician-profile.html` contains the profile-page Plugz feature.
- `host-profile.html` contains the profile-page Plugz feature.
- `terms.html#plugz-membership` contains the Plugz bridge terms.
- `plugzBridge` CORS preflight from CLTCH returns `HTTP/2 204`.
- `plugzBridge` POST with no Plugz token returns `HTTP/2 400` and `{"error":"Missing Plugz auth token."}`.

The unauthenticated POST failure is expected and confirms the important safety behavior: the function is reachable by the browser, but it refuses to proceed until a real Plugz sign-in has produced a Plugz ID token.

## Real User Test Checklist

Use this checklist with an actual Plugz Firebase user:

1. Open `https://cltch-ntwrk-social.web.app/auth.html`.
2. Accept the Plugz membership terms checkbox.
3. Click `Continue with Plugz`.
4. Complete Plugz Google sign-in.
5. Confirm CLTCH signs the user in.
6. Confirm a CLTCH `memberships/{uid}` record exists with `plan: "cltch-free-6-months"`.
7. Confirm `users/{uid}` contains Plugz imported summary fields.
8. Confirm `plugzBridgeClaims/{plugzUid}` maps that Plugz UID to the same CLTCH UID.
9. Confirm a second CLTCH account cannot claim the same Plugz UID.
10. Confirm the profile page displays active Plugz member access and the expiration date.

## Maintenance Notes

- If Plugz changes Firebase project ID, update both the secondary Admin app in `functions/index.js` and the browser Plugz config in `app/plugz-bridge.js`.
- If Plugz changes auth provider, update `app/plugz-bridge.js` and make sure the provider is enabled in the Plugz Firebase Console.
- If terms copy changes materially, create a new terms version string and require that new version in both the client and `plugzBridge`.
- Keep `plugzBridgeClaims` and `plugzBridgeEvents` server-managed. Clients should not read or write those collections directly.
