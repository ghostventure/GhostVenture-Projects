# EstateHat Audit And Deployment Record

Date: 2026-04-16  
Project: EstateHat  
Production URL: https://estatehat.web.app  
Firebase project: `estatehat`

## Scope

This record documents the current EstateHat platform state after Hat Data, the color-scheme correction, and reputation grading system were installed and audited.

The audit covered:

- Build integrity
- Compliance test coverage
- Route and navigation wiring
- Profile schema alignment
- Firestore rules alignment
- Reputation grading data flow
- Public/auth runtime smoke test
- Hosting deployment status
- Android and iOS sync status

## Installed Platform Work

### Hat Data

EstateHat now includes a dedicated 50-component workflow suite exposed through:

- Navigation item: `Hat Data`
- Command search item: `Hat Data`
- Route: `components`
- Source file: `src/AdditionalComponents.jsx`
- Platform import/rendering: `src/estatehat-platform-alpha.jsx`

Component groups installed:

- Foundation
- Property
- Transaction
- Docs and Legal
- Trust and Money
- Messaging and Support

The suite includes interactive local-state Hat Data items for drawers, modals, tables, bulk actions, filters, saved folders, checklists, calculators, upload queue, signature flows, identity/security status, billing, payouts, help, feedback, and notification preferences.

### Theme And Font Color Scheme

The authenticated EstateHat shell now uses active theme variables for foreground/background contrast:

- Light mode uses dark text against light surfaces.
- Dark mode uses light text against dark surfaces.
- Inputs, selects, textareas, and placeholders inherit the active theme.
- Restricted-access copy and fallback error copy no longer use hard-coded light-mode text.

Primary source:

- `src/estatehat-platform-alpha.jsx`

### Reputation Grading System

EstateHat now includes a profile reputation system with:

- Grade model: `AA`, `A`, `B`, `C`, `D`, `F`
- Numeric score range: `0-100`
- Review count
- Testimonial count
- Visibility toggle
- Optional feedback/testimonial entries
- Published, hidden, and flagged feedback states
- Grade badges on profile headers
- Grade badges on seller detail cards
- Grade badges on Match Services provider cards

Primary files:

- `src/backend.js`
- `src/estatehat-platform-alpha.jsx`
- `firestore.rules`
- `tests/compliance-mechanics.test.mjs`

The profile schema version is now:

```text
USER_PROFILE_SCHEMA_VERSION = 14
```

Firestore rules also require:

```text
request.resource.data.schemaVersion == 14
```

## Connection Audit

### Routes

The route audit confirmed that every navigation and command route has a rendered view.

Connected routes include:

- `dashboard`
- `search`
- `browse`
- `compare`
- `tours`
- `watchlist`
- `detail`
- `list`
- `profile`
- `transaction`
- `milestones`
- `documents`
- `offer`
- `notifications`
- `messages`
- `components`
- `admin`
- `admin-workbench`
- `boilerplates`
- `calculator`
- `matching`
- `help`
- `faq`
- legal/info pages

The `components` route is intentionally ungated so the installed Hat Data suite can be reviewed by signed-in users.

### Profile Persistence

The backend profile sanitizer now creates and preserves a `reputation` object on every profile.

The reputation object is normalized in `buildReputationState()` and includes:

- `grade`
- `score`
- `reviewCount`
- `testimonialCount`
- `visibility`
- `lastReviewedAt`
- `summary`
- `feedback`

### Firestore Rules

Firestore rules now include `validReputationShape()` and allow the `reputation` profile field.

The rules compile successfully and were deployed to Cloud Firestore.

## Verification Commands

The following checks passed:

```bash
npm run build
npm run test
```

The route wiring audit also passed with no missing rendered views for nav or command routes.

Local production smoke test:

```bash
python3 -m http.server 4175 -d dist
/usr/bin/chromium --headless --no-sandbox --disable-gpu --virtual-time-budget=8000 --dump-dom http://127.0.0.1:4175
```

Result:

- Built site rendered the EstateHat auth screen.
- No startup crash was observed.

Live deployment check:

```bash
curl -L --silent https://estatehat.web.app
```

Result:

- Production responded successfully.
- Production was serving current bundle: `index-Dyv_qUdy.js`

## Deployment Commands

Hosting deployment:

```bash
npm run deploy:hosting
```

Firestore rules deployment:

```bash
npx firebase-tools deploy --only firestore:rules --project estatehat
```

Mobile sync:

```bash
npm run sync:android
npm run sync:ios
```

## Known Warning

Vite reports a bundle-size warning:

```text
Some chunks are larger than 500 kB after minification.
```

Current main authenticated bundle is slightly above the default warning threshold. This is not a deployment blocker, but later optimization should split the authenticated app into lazy-loaded route chunks.

Recommended later improvement:

- Code-split `estatehat-platform-alpha.jsx`
- Lazy-load heavy route views
- Separate admin/workbench/component-suite views into their own chunks

## Current Status

EstateHat is deployed and operational at:

```text
https://estatehat.web.app
```

The latest audited state includes:

- 50-component workflow suite
- Corrected day/night text contrast
- Profile reputation grading system
- Updated backend profile schema
- Updated Firestore profile rules
- Passing build and compliance tests
- Passing local public runtime smoke test
- Android and iOS web assets synced
