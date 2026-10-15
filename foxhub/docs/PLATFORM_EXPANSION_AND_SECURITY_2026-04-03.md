# FoxHub Platform Expansion And Security

Last updated: 2026-04-03

## Scope

This note records the combined FoxHub work completed after the blank-screen recovery and before shutdown of the current work session.

It covers:

- shell simplification and GUI wiring
- deploy and native sync state
- invite creation and invite-backed access
- profile/onboarding tutorial assistant
- FAQ and footer boilerplate updates
- security hardening
- expanded API connector registry
- premium visual pass
- Windows desktop packaging setup

## GUI and shell wiring

The shell was simplified around clear categories instead of scattered feature panels:

- `Chats`
  - active threads
  - service channels
  - call sessions
  - call history
- `Network`
  - contacts and circles
  - local/community panels
  - creator media tools
  - professional graph tools
  - profiles and resume entries
- `Market`
  - listings and saved searches
  - auction lots and bid events
  - carts
  - shop profiles and reviews
  - fulfillment orders
- `Services`
  - route plans
  - mini-program manifests
  - runtime sessions
  - FAQ surface

The home shell was also flattened so the app reads as one operating layer instead of a demo catalog.

Primary file:

- `src/FoxHubShell.jsx`

## Invite-backed access

FoxHub now supports invite creation from the profile modal and invite-backed immediate access during sign-up.

Implemented behavior:

- signed-in users can create invite codes from the profile panel
- new users can enter an invite code during sign-up
- valid invite codes immediately unlock the priority-access path
- used invite codes are marked redeemed

Primary files:

- `src/App.jsx`
- `src/useFoxHubStore.js`
- `src/repository.js`
- `src/repository-local.js`
- `src/repository-firebase.js`
- `src/repository-locked.js`
- `src/data.js`

## Tutorial assistant

A lightweight tutorial assistant now exists for new users.

Behavior:

- appears during onboarding
- appears in the authenticated shell until dismissed
- guides users through:
  - finishing the profile card
  - starting in chats
  - opening one service surface
- dismissal is persisted on the user profile via `tutorialCompleted`

Primary files:

- `src/App.jsx`
- `src/FoxHubShell.jsx`
- `src/data.js`
- `src/rules.js`
- `src/repository-local.js`
- `src/repository-firebase.js`

## FAQ and footer boilerplates

The footer boilerplate content was updated to feel like real product/company/legal support material instead of placeholder tags.

Changes:

- footer now explicitly includes FAQ-oriented support content
- Services now contains a small FAQ page surface for onboarding, invites, profile management, and FoxHub basics
- company/product/legal boilerplate copy was updated to be more user-facing

Primary file:

- `src/FoxHubShell.jsx`

## Security hardening

Security changes in this pass were practical and code-level, not only UI text.

Client/runtime hardening:

- Firebase auth persistence changed from local persistence to session persistence
- signup now requires a stronger password policy in Firebase mode
- repeated auth failures are throttled in the client
- password fields now use explicit autocomplete attributes
- the utility calculator no longer uses `Function(...)`
- user-entered listing search text is escaped before regex construction

Backend/rules hardening:

- Firestore rules were upgraded for the newer profile shape
- profile access-control fields are now locked on update
- invite create/redeem behavior is constrained in rules
- Firebase invite validation was tightened so invalid invite signups are removed immediately

Primary files:

- `src/firebase.js`
- `src/App.jsx`
- `src/FoxHubShell.jsx`
- `src/rules.js`
- `src/repository-firebase.js`
- `firestore.rules`

## API connector expansion

The connector registry was expanded beyond the earlier baseline.

Mainstream additions include:

- WhatsApp Business Platform
- Instagram Graph
- Google Identity
- Shopify Admin
- Slack Platform
- HubSpot
- Salesforce
- DocuSign
- OpenAI
- Discord
- GitHub

Financial-stack additions include:

- Adyen
- Braintree
- Authorize.net
- Checkout.com
- Wise Platform
- Dwolla
- Marqeta
- Unit
- Synctera
- QuickBooks
- Xero
- Avalara

Primary file:

- `src/data.js`

## Premium visual pass

The visual system received a refinement pass without changing the simplified information architecture.

Changes:

- deeper background atmosphere
- less flat card/surface treatment
- stronger hover and button polish
- cleaner glass/material effects
- better contrast hierarchy for hero, cards, footer, and message areas

Primary file:

- `src/styles.css`

## Windows desktop setup

FoxHub now has a desktop wrapper path for Windows using Electron.

What was added:

- Electron main process wrapper
- preload bridge
- desktop scripts in `package.json`
- `electron-builder` configuration

Current desktop status:

- Windows unpacked app output was successfully generated
- portable/installer packaging is partially environment-dependent on this Linux host
- current verified desktop output:
  - `release/win-unpacked/FoxHub.exe`

Primary files:

- `electron/main.cjs`
- `electron/preload.cjs`
- `package.json`

## Deployment state

Verified and published during this pass:

- Hosting deploy to `https://foxhub-superapp.web.app`
- Firestore security rules deploy
- Android sync
- iOS sync

Commands used successfully in this phase:

- `npm run build`
- `npm run deploy:hosting`
- `npx firebase-tools deploy --only hosting,firestore --project foxhub-superapp`
- `npm run sync:android`
- `npm run sync:ios`

## Recovery pointers

If a future session needs to reconstruct this phase quickly, start with:

1. `docs/PLATFORM_EXPANSION_AND_SECURITY_2026-04-03.md`
2. `docs/RUNTIME_BLANK_SCREEN_2026-04-03.md`
3. `docs/PROJECT_STATUS.md`
4. `docs/DOCS_INDEX.md`
5. `README.md`
