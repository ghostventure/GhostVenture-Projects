# Match Services Upgrade - 2026-04-23

## Summary

Match Services was upgraded from a simple filter screen into a matching intake and coordination workspace.

## Installed

- Match readiness score based on market, property type, timeline, selected services, priority, budget, and financing status.
- Expanded intake fields for match priority, budget preference, financing status, and notes.
- Role-specific matching plan for agent, inspector, and lender introduction sequencing.
- Saved match request queue persisted in local browser state.
- Seller-side manual professional invite and sale attachment controls.
- Clear empty state for the currently unconnected provider directory, avoiding placeholder professionals.

## Primary File

- `src/estatehat-platform-alpha.jsx`

## Verification

Passed:

- `npm run build`
- `npm test`
- `npm run deploy:hosting`
- Signed-in Chromium section smoke test

## Deployment

Deploy command:

```sh
npm run deploy:hosting
```

Production URL:

- `https://estatehat.web.app`

Deploy result:

- Firebase project: `estatehat`
- Hosting URL: `https://estatehat.web.app`
- Signed-in Match Services smoke test passed on production
- Smoke assertions confirmed `Match Services`, `Match Readiness`, `Matching Plan`, and `Saved match requests`
- Runtime error check returned false
