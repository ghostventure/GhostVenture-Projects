# FoxHub Components, Features, and Mechanics Install (2026-04-12)

## Request

Install all package-backed items from the 50-item feature/component/mechanics set if missing.

## Result

Completed.

- Root app dependencies were expanded for messaging UX, moderation, wallet/billing, discovery/search, offline/runtime, observability, and experimentation tooling.
- Functions dependencies were expanded for payments, comms, identity/document, and policy template integrations.

## Root packages added

- Chat/UX and navigation: `cmdk`, `react-hotkeys-hook`, `react-virtuoso`, `framer-motion`, `react-resizable-panels`
- Collaboration/realtime: `socket.io-client`, `yjs`, `y-webrtc`, `y-indexeddb`
- Rules/workflow: `json-rules-engine`, `rrule`
- Search/discovery: `fuse.js`, `minisearch`
- Wallet/billing rails: `@stripe/stripe-js`, `@stripe/react-stripe-js`, `react-plaid-link`
- Feature flags/experiments: `@openfeature/web-sdk`, `launchdarkly-react-client-sdk`
- Observability/perf: `@sentry/react`, `web-vitals`
- Content/security: `dompurify`, `react-markdown`, `remark-gfm`
- IDs and validation: `nanoid`, `uuid`, `zod`
- Data/runtime: `@tanstack/react-query`, `@tanstack/react-table`, `dexie`, `idb-keyval`, `localforage`, `comlink`
- Media and files: `wavesurfer.js`, `react-dropzone`, `browser-image-compression`, `file-saver`, `papaparse`, `jszip`, `qrcode`, `react-qr-code`
- Builder/editor primitives: `@dnd-kit/core`, `@dnd-kit/sortable`, `@tiptap/react`, `@tiptap/starter-kit`
- Date/time helpers: `date-fns`, `dayjs`

## Root dev packages added

- Testing/quality: `vitest`, `@playwright/test`, `@testing-library/react`, `@testing-library/jest-dom`, `msw`
- Accessibility checks: `axe-core`, `@axe-core/playwright`

## Functions packages added

- `stripe`
- `@sendgrid/mail`
- `twilio`
- `docusign-esign`
- `hellosign-sdk`
- `lob`
- `plaid`
- `jsonwebtoken`
- `handlebars`

## Mechanics note

Some requested items are product mechanics (not npm packages), such as:

- escrow hold/release policy flows
- moderation SLA operations
- trust scoring and risk models
- discovery/feed ranking policy
- remote rollout governance

These now have package prerequisites installed and are ready for implementation wiring in app code and cloud functions.

## Install health

- Root audit after install: `2 moderate` vulnerabilities reported.
- Functions audit after install: `9 low` vulnerabilities reported.
