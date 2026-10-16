# EstateHat Release Audit

Date: 2026-04-29

## Scope

This audit pass covered the current Next web release, core route smoke tests, security review of obvious client-side risk surfaces, dexterity/accessibility checks, native wrapper sync status, and Windows desktop packaging status.

## Smoke test summary

Verified against a local static server using the exported `out/` artifact:

- `/`
- `/signin`
- `/help`
- `/home`

Observed results:

- Landing page rendered the expected EstateHat public shell.
- Sign-in rendered the expected auth shell.
- Help rendered the expected FAQ/help shell.
- `/home` rendered the signed-out gate correctly when no authenticated session was present.

## Security review summary

Reviewed current config and common client-side injection/opening patterns:

- `firebase.json`
- `next.config.js`
- `src/firebase.js`
- `app/layout.jsx`
- `src/estatehat-platform-alpha.jsx`

Findings:

- `target="_blank"` usage is already paired with `rel="noopener noreferrer"`.
- `dangerouslySetInnerHTML` is present in `app/layout.jsx`, but it is limited to the Google Tag Manager bootstrap and a local theme bootstrap script.
- CSP is present in Hosting headers, but it still relies on `'unsafe-inline'` for current inline script/style behavior.

## Dexterity summary

- Browse Properties is denser and more guided, with quicker filters and less dead space around results.
- My Info card layout is tighter on desktop and wastes less width between cards.
- The assistant/mobile shell uses tighter spacing and a better bounded panel for smaller screens.
- Android and iOS wrappers were resynced to the same current web shell.

## Build and test results

- `npm run build` passed.
- Browser smoke checks against the exported static artifact passed.
- `npm test` did not complete because the local Node 22.22.2 runtime is missing an internal test-runner dependency:
  - `TypeError: Missing internal module 'internal/deps/brace-expansion'`

## Windows packaging status

- Windows desktop packaging still produces a current unpacked app at:
  - `release/win-unpacked`
- The existing Windows installer remains:
  - `release/EstateHat-Setup-1.0.0.exe`
- Fresh installer regeneration is still blocked on this Linux host during the Electron Builder packaging path, even when using the dedicated 32-bit Wine prefix.

## Production status

- Hosting deploys continue to succeed for the static Next export.
- Live URL remains:
  - `https://estatehat.web.app`
- Hosting still warns that these rewrite targets are unresolved until Functions are deployed on Blaze:
  - `apiHealth`
  - `apiSessionBootstrap`
  - `stripeApi`

## Residual risks

- Full automated tests are not currently trustworthy on this machine until the local Node test-runner issue is corrected.
- Function-backed `/api/*` routes are staged but not active on the current Firebase plan.
- Fresh Windows installer generation should be finalized on a Windows host or a cleaner Linux packaging environment if a new installer artifact is required immediately.

