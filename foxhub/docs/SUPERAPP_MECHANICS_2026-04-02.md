# FoxHub Super-App Mechanics

Last updated: 2026-04-02

This file records the higher-value super-app mechanics that were added to FoxHub so the product direction can be recovered later without rebuilding context from code inspection alone.

## Current mechanics in place

### Chat-first default

- FoxHub now defaults into the `chat` tab instead of opening on a generic home/dashboard state.
- Service actions, QR flows, and payment actions are biased back toward conversation context.

Primary files:

- `src/App.jsx`
- `src/FoxHubShell.jsx`

### QR as infrastructure

QR actions are no longer just decorative shortcuts. They now create useful state:

- `qr-contact`
  - opens a direct thread
  - writes a saved context record
- `qr-circle`
  - moves the user into circle context
  - writes a saved context record
- `qr-pay`
  - records a payment-side event
  - appends a thread-context trace
- `qr-miniapp`
  - launches the active mini-app
  - appends a thread-context trace

QR history is now retained in app state and surfaced in the services workspace.

Primary files:

- `src/App.jsx`
- `src/useFoxHubStore.js`
- `src/data.js`
- `src/FoxHubShell.jsx`

### Message-embedded transactions

Wallet and merchant actions now leave conversation-linked traces instead of behaving like detached utility actions.

Current behavior:

- wallet actions add a wallet event
- wallet actions add a thread-context message
- wallet actions create a saved item entry for later reference

Primary files:

- `src/App.jsx`
- `src/useFoxHubStore.js`

### Official accounts as service channels

Official accounts are no longer only side data. They now map into seeded service-channel threads.

Current seeded service channels:

- `FoxHub Newsroom`
- `Wallet Watch`
- `ATL Culture Wire`

The shell also supports follow/unfollow state for official accounts through `officialAccountSubscriptions`.

Primary files:

- `src/data.js`
- `src/FoxHubShell.jsx`
- `src/useFoxHubStore.js`

### Mini-app context continuity

Mini-apps now preserve more context than a bare launch.

Current behavior:

- launch writes a recent-app record
- launch writes a mini-app permission record
- launch writes a conversation trace
- launch writes a saved item entry
- launch also writes a `serviceContinuity` record so the app can show where the service came from and where the user should return

Primary files:

- `src/App.jsx`
- `src/useFoxHubStore.js`
- `src/data.js`
- `src/FoxHubShell.jsx`

### Contact-graph strengthening

The contact graph is still lightweight, but it now has more operational behavior:

- opening or re-opening a direct thread boosts `relationshipScore`
- suggested contacts can be ranked from relationship signals
- service and QR flows now contribute more context for future graph growth

Primary files:

- `src/useFoxHubStore.js`
- `src/FoxHubShell.jsx`
- `src/data.js`

### Discovery ranking

The services surface is no longer a flat static order only.

Current ranking factors:

- service continuity history
- recent launches
- current thread type
- active circle context

Primary files:

- `src/FoxHubShell.jsx`

## State added for these mechanics

The following state shapes were added or made more important:

- `officialAccountSubscriptions`
- `qrHistory`
- `serviceContinuity`
- stronger use of `savedItems`
- stronger use of `miniAppPermissions`

Seed/state files:

- `src/data.js`
- `src/repository-local.js`
- `src/repository-firebase.js`
- `src/useFoxHubStore.js`

## Boilerplate layer

FoxHub does not currently use a separate `boilerplates/` directory. The reusable boilerplate layer for this project is the starter stack below, and the mechanics were installed there directly:

- `src/data.js`
  - seed threads, official accounts, QR actions, continuity, and graph data
- `src/useFoxHubStore.js`
  - mechanics controller for subscriptions, QR history, continuity, and graph updates
- `src/repository-local.js`
  - local-mode seed and persistence shape
- `src/repository-firebase.js`
  - Firebase-mode seed shape
- `src/App.jsx`
  - top-level chat-first and context-writing behavior
- `src/FoxHubShell.jsx`
  - shell-level wiring for service channels, subscriptions, QR history, continuity, and ranked services

So if by “boiler plates” you mean the reusable FoxHub starter foundation, the mechanics are already installed in that layer.

## Important boundary

These mechanics are implemented in the current product shell and survive local-mode state. Firebase mode still does not persist every new surface as deeply as a production backend should. The product behavior exists, but some of the newest state is still client-managed rather than fully modeled as durable Firestore collections.

## Recovery checklist

1. confirm `src/App.jsx` still defaults to the `chat` tab
2. confirm wallet and QR actions still write thread-context traces
3. confirm official accounts still map into service-channel threads
4. confirm `officialAccountSubscriptions`, `qrHistory`, and `serviceContinuity` still exist in seed state
5. confirm the services workspace still ranks mini-apps from continuity and recency, not only static list order
