# FoxHub Home Dashboard Layout Guard

Date: 2026-04-30

## Scope

Hardened the FoxHub `Home` dashboard layout in the Vite-hosted shell so large card groups do not overlap when the dashboard is rendered inside the app shell's content canvas.

Primary files:

- `src/FoxHubShell.jsx`
- `src/styles.css`

## Root cause

The Home dashboard was being laid out as if it owned full viewport width, but it actually lives inside the shell's main content column next to the left rail.

That created two related issues:

- a three-column dashboard could be activated before the real content canvas was wide enough
- the Home route still shared horizontal space with the tactical panel, shrinking the dashboard further

## Hardening changes

- Added a dedicated `hub-layout` shell mode so the Home route uses the full main content canvas.
- Stacked the tactical panel below the Home board instead of beside it on the hub route.
- Added a shared `fox-home-board` wrapper for the three top Home modules:
  - `Start Here`
  - `Today`
  - active Home room surface
- Added explicit layout guardrails in CSS:
  - default stacked layout on smaller screens
  - `2-column` intermediate board at `1220px+`
  - `3-column` board only at `1520px+`
- Removed the old forced `min-height` on the Home room surface.
- Added `min-width: 0` protection on direct board children to reduce overflow risk inside nested grids.

## Rule to preserve

Do not enable a `3-column` Home dashboard based only on viewport intuition.

FoxHub Home is rendered inside the shell content canvas, so breakpoint choices must account for:

- app shell max width
- rail width
- shell gap
- any sibling panel sharing the row
- nested grids inside dashboard cards

If the Home route gains another side-by-side sibling in the future, re-check these breakpoints before widening the board again.

## Verification

- `npm run vite:build` (pass)
- `npm run deploy:hosting` (pass)

## Deploy

Live Hosting URL:

- `https://foxhub-superapp.web.app`
