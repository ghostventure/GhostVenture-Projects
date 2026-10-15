# FoxHub Home Tab UX Enrichment

Date: 2026-04-28

## Scope

Enriched the FoxHub `Home` tab in the Vite-hosted app shell without changing the underlying navigation model or data model.

Primary files:

- `src/FoxHubShell.jsx`
- `src/styles.css`

## What changed

- Added a `Today compass` layer to the Home workspace.
  - Gives four explicit next-step cards:
    - social start
    - trust next
    - service-ready
    - money and follow-up
- Added a `Momentum` panel.
  - Surfaces the current thread, local city focus, subscribed signal count, and active mini-app context in one scan block.
- Added richer Home support modules:
  - `Circle anchors`
  - `Official signals`
  - `Wallet shortcuts`
- Kept the relationship order intact:
  - social
  - rapport
  - communal
  - services / merchant

## UX intent

The Home tab was already data-rich but still felt like an operator board. This pass shifts the first screen toward a clearer daily HQ:

- less hunting for the next action
- more immediate local and social context
- stronger trust-to-service transition
- better scan rhythm across desktop and mobile card layouts

## Verification

- `npm run vite:build` (pass)
- `npm run deploy:hosting` (pass)

## Deploy

Live Hosting URL:

- `https://foxhub-superapp.web.app`
