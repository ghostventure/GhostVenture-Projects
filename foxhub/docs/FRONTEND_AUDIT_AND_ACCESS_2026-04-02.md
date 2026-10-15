# Frontend Audit And Access 2026-04-02

Last updated: 2026-04-02

## Scope

This document records the FoxHub work completed in the last pass:

- frontend UX additions
- WeChat-inspired GUI improvements
- invite and monthly verification entry flow
- day/night theme toggle
- front-end audit baseline

This is the recovery note to start from if the shell, entry flow, or theme system drifts.

## GUI and UX additions completed

### Shared shell

Files:

- `src/FoxHubShell.jsx`
- `src/styles.css`

Installed and verified:

- desktop rail + phone-native bottom nav split
- shared toolbar with visible-item context
- quick-action context rail below the toolbar
- comfortable / compact density controls
- filtered empty-state blocks per major section
- footer-level boilerplate footnotes instead of primary cards
- centralized UI/state rule layer in `src/rules.js`

### Chat UX

Files:

- `src/FoxHubShell.jsx`
- `src/styles.css`

Installed and verified:

- `All / Unread / Pinned` chat filters
- pinned-thread strip
- conversation utility bar
- service-channel side surface

### Home and Services UX

Files:

- `src/FoxHubShell.jsx`
- `src/styles.css`

Installed and verified:

- official hub cards on Home
- stronger official-account presentation
- recent mini-program strip in Services
- supporting boilerplate footnotes for legal, company, and product

## Invite and verification access model

Files:

- `src/App.jsx`
- `src/data.js`
- `src/repository-local.js`
- `src/repository-firebase.js`

Current model:

- invite code or sponsor handle:
  - `accessState: priority`
  - `accessNote: Priority access`
- no invite:
  - `accessState: waitlist`
  - `accessNote: Monthly verification review`
  - `waitlistEndsAt` is set to `30 days` from signup time

Current entry behavior:

- signup remains open
- invite-backed accounts move through with priority access
- non-invited accounts enter a monthly verification cycle
- onboarding remains locked while the account is in waitlist state
- profile UI reflects the same access status
- sign-in is locked to the painted login surface and not tempted back into the invite/onboarding path; signup now owns the invite/access controls so the login UI cannot drift silent.

- The sign-in flow now stops building the access model (and the profile requirements) for returning users: email/password completes the login and the dashboard appears immediately, so the live experience no longer forces name/handle/city during sign-in.

Important wording now in the live app:

- without an invite, the account enters a monthly review cycle
- submitted identity details are verified before full access opens

## Day/Night theme system

Files:

- `src/App.jsx`
- `src/FoxHubShell.jsx`
- `src/styles.css`

Installed and verified:

- shared day/night toggle in the header
- theme preference persisted in `localStorage` under `foxhub-theme`
- active theme applied to `document.documentElement`
- shared CSS token system for both modes

Current behavior:

- default uses saved preference first
- falls back to system preference
- toggle label switches between `Day mode` and `Night mode`

## Audit result

Frontend audit completed on the current live shell.

Confirmed present and wired:

- theme state from `src/App.jsx` into `src/FoxHubShell.jsx`
- light and dark token sets in `src/styles.css`
- shared if/then rule helpers in `src/rules.js`
- context rail
- official hub cards
- recent mini-program strip
- chat filters and pinned threads
- boilerplate footnotes
- filtered empty states
- invite/monthly verification entry flow

Additional dexterity hardening:

- quick jump palette is now wired into `src/FoxHubShell.jsx`, opens via header button or `Ctrl+K`, and keeps nav/context actions a tap away.
- heavy sections such as `glance-strip`, `content-stack`, and the various thread/moment grids use `content-visibility:auto` for smoother paint performance and faster scroll.
- the signup page helper chips and inline loader keep the form responsive even on slower connections.

One minor non-blocking drift found:

- `occupation` and `demographic` are normalized in `src/App.jsx`, but they are not currently surfaced in the GUI

This does not break the app. It is only extra state not currently used by the visible interface.

## Centralized if/then rules now in place

File:

- `src/rules.js`

Current shared rules include:

- access-path decision rules
- waitlist / onboarding gating rules
- access copy and gate-message rules
- auth submit-label rules
- theme-toggle label rules
- visible-count rules by section
- quick-action context-map rules
- pinned-thread and filtered-thread rules
- shared profile normalization helpers

Intent:

- stop repeating product conditions across `src/App.jsx` and `src/FoxHubShell.jsx`
- make UI/state rules easier to audit and adjust later
- reduce silent drift between entry flow and authenticated shell

## Verification performed

Verified during this pass:

- `npm run build`
- `npm run deploy:hosting`

Live target:

- `https://foxhub-superapp.web.app`

Firebase project:

- `foxhub-superapp`

## Do not lose these invariants

- boilerplates are footnotes, not primary content blocks
- invite path is faster, but signup is not hard invite-only
- no-invite path is a monthly verification cycle, not a short queue
- onboarding stays locked while `accessState === "waitlist"`
- theme toggle is global and token-driven, not page-specific
- phone and desktop shells remain distinct presentations of the same product
