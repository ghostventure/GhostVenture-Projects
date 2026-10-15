# Windows Browser Management Gate - 2026-06-12

## Summary

Added a browser-side Management credential gate for staff accounts. When a staff member clicks `Management`, FoxHub opens an in-app gate that requires Windows browser detection and then invokes Windows Hello / platform security-key verification before rendering the staff dashboard.

## What Changed

- Management navigation now routes through the shared workspace-tab gate.
- The Management workspace does not render until the staff member passes the Management credential pop-up.
- The pop-up appears only for browser sessions that identify as Windows.
- Android and iOS browser sessions are blocked from opening the Management dashboard.
- The prompt asks for the signed-in staff email, then calls the WebAuthn platform-authenticator flow so the actual verification prompt is handled by OS/browser chrome outside the React page.
- The client now requests a backend challenge from `POST /api/management/webauthn/challenge` before opening Windows Hello.
- The client sends the WebAuthn response to `POST /api/management/webauthn/verify` before unlocking the Management workspace.
- The backend verifies the Firebase ID token, confirms staff/management access, rejects non-Windows browser user agents, validates the WebAuthn challenge, records the credential response, and creates a short Management access session record.
- Static Hosting falls back to the local Windows Hello gate only when the backend challenge route is unavailable, so staff are not locked out before the Firebase project can deploy the Next API routes on Blaze.
- Bottom navigation, desktop navigation, header Management entry, and quick menu navigation all share the same gate.
- Release smoke now verifies the Management credential modal and Windows-only copy.

## Security Note

This is now backed by server-issued Management challenges when the Next API backend is deployed. It improves the GUI workflow, moves the sensitive verification prompt outside the page, records Management access events server-side, and blocks normal Android/iOS browser access. Production-grade hardening should still add full WebAuthn attestation/assertion verification and device posture because browser user-agent data can be spoofed by a sufficiently privileged attacker.

## Deployment Note

The normal `npm run deploy:hosting` command publishes the static Vite bundle. The `/api/management/webauthn/*` backend routes require the Next Functions adapter deployment path: `npm run deploy:next`. If Firebase Functions deployment is blocked by billing and the backend challenge route is unavailable on static Hosting, the client uses the local Windows Hello gate as a temporary compatibility fallback. If the backend route exists and rejects the challenge or verify request, the client fails closed.

On 2026-06-12, `npm run deploy:next` rebuilt successfully and reached Firebase deployment, but Firebase rejected the Functions deploy because `foxhub-superapp` is not on the Blaze pay-as-you-go plan. The profile-photo deploy can safely use static Hosting because the Management client now has the static-hosting fallback above.

## Verification

- `npm run release:check`
- `npm run build:next:functions`
- `npm run deploy:next` reached Firebase deployment and was blocked by the Blaze-plan requirement for `cloudbuild.googleapis.com` and Artifact Registry.
