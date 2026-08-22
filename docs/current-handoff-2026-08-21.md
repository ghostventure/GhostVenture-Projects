# OverHead current handoff — 2026-08-21

This document records the deployed product, website, licensing, policy, and release work completed through desktop version `0.3.5` and the Windows Server/IoT Cylinder version `0.3.4`. It is written for the next Codex or operator taking over in PowerShell.

## Live production surface

- Website: `https://overhead-office.web.app`
- Current manual Windows ZIP: `https://overhead-office.web.app/downloads/OverHead-Desktop-0.3.5-win-x64.zip`
- Current Cylinder ZIP (Windows Server/IoT only): `https://overhead-office.web.app/downloads/OverHead-Cylinder-0.3.4-win-x64.zip`
- Current desktop update feed: `https://overhead-office.web.app/updates/latest.yml`
- Current Cylinder update feed: `https://overhead-office.web.app/updates/cylinder/latest.yml`
- Customer brochure: `https://overhead-office.web.app/downloads/OverHead-Business-Office-Guide.pdf`
- Investor brochure: `https://overhead-office.web.app/downloads/OverHead-Investor-Brochure.pdf`

The desktop `0.3.5` ZIP, Cylinder `0.3.4` ZIP, both updater channels, both brochures, support materials, legal center, investor page, FAQ, and current website copy have been deployed and verified with HTTP 200 responses. The standard desktop ZIP now has a matching entry in `downloads/SHA256SUMS.txt`; the Cylinder installer has its own entry in `downloads/CYLINDER-SHA256SUMS.txt`.

## Product and public-site work completed

1. **Business standard.** Added a shared mission, scope, product boundary, and six operating principles: clarity, owner control, minimum necessary information, progressive adoption, evidence/recovery, and straight dealing. See `docs/business-principles.md`.
2. **Legal alignment.** Updated public legal material around scope, terms, privacy/data minimization, access/security/recovery, AI and automation, payment-provider boundaries, support evidence, fair use, and launch/change management. These remain legal-review drafts, not legal advice.
3. **Desktop GUI.** The `0.3.5` desktop release adds separate Customer Access and OverHead Team lanes, role-aware work controls, operational appointments/quotes/invoices, PDF generation, customer invitations, shared support-ticket records, and a customer document vault. Uploaded files are validated, copied to the local OverHead data directory, attached to the customer record, and logged; they are not a cloud document-storage service. Internal OverHead Team employee licenses reject non-official email domains and retain the authorizing administrator record.
4. **Cylinder deployment.** The `0.3.4` Cylinder installer is a distinct Windows Server/Windows IoT deployment. It has a separate application ID, local data directory, update feed, and Cylinder tier; its launcher refuses standard Windows editions. It grants one 30-day, no-card evaluation per server workspace. The evaluation neither creates a charge nor renews automatically, and an existing entitlement is not overwritten. See `docs/cylinder-deployment.md`.
5. **Workflow and support.** Workflows now call out required context, responsible role, review points, and recovery records. Support, tools, and settings state what can be safely shared and what must remain private.
6. **Customer communication.** Main public copy was shortened and shifted from product jargon toward office language: customers, tasks, staff, records, approvals, and payment follow-up.
7. **Brochures.** Added an investor brochure and a customer-facing Business Office Guide. The customer guide uses large, high-contrast, print-friendly layout and plain language.
8. **Trial disclosure.** Website, FAQ, brochure, and desktop plan view state the intended one-per-workspace, no-card, 30-day Gold-equivalent trial. Cylinder separately states its one-per-server-workspace, no-card 30-day evaluation. Cylinder continued use requires a separate deployment order or contract, billing confirmation, and issued entitlement; it is not sold through the standard desktop checkout.
9. **Updater disclosure.** Packaged desktop and Cylinder releases check their separate secure updater feeds before opening, download an available update, and install it after the application closes. New installations still begin with the manual ZIP download. Source-mode launches do not use the packaged updater.
10. **Next.js workspace priority.** The browser workspace is the primary home for shared tasks, customer records, approval requests, team access, account settings, support, and product information. Its shared records are protected by Firestore rules. Browser customer records are workspace-shared and do not yet synchronize into the Electron local customer database; do not represent the two stores as automatically merged. Electron remains responsible for Windows installation and updates, local/offline records, local files, and operating-system integrations.

## Shared licensing model

The intended source of truth is Firestore, not a browser-local record:

- Workspace entitlement: `workspaces/{workspaceId}/billing/current`
- Per-member license: `workspaces/{workspaceId}/licenses/{userUid}`
- Identity/role reference: `profiles/{userUid}`

Each active workspace member receives one internal license record. The license is linked to the workspace and authenticated user; it is not transferable and users do not need to manage the number. The workspace entitlement supplies the tier/status, while the user role controls permissions.

The stable identifier format is shared between the Functions code and Desktop source:

- License: `OH-LIC-<stable hash>`
- Subscription: `OH-SUB-<stable hash>`

Website behavior:

- A member can read only their own license document.
- An administrator can list the workspace license register.
- The account page clearly distinguishes `Pending entitlement`, `Trial`, `Active`, and `Suspended` states.
- The dashboard shows license-register count to administrators and links to the member account/license view.
- The `/account/` page also contains the browser subscription panel. It reads the same entitlement in real time; administrators can manage a test subscription there, while managers and staff remain view-only.

The installed EXE and browser do not copy a subscription between themselves. They each resolve the central Firestore entitlement and per-member license, which prevents separate browser and desktop plan states.

The associated Firestore rules have been compiled and deployed.

## Function deployment status

The Firebase project has cleared the Spark/Blaze and API prerequisites. Functions discovery also succeeds when using:

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'
```

The remaining deployment prerequisite is setting the two Firebase Secret Manager values. Do **not** place their values in source control, a text file, or chat.

Required secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

From a normal PowerShell window in this repository, set them through Firebase CLI. The Firebase CLI must receive the key name as the positional argument:

```powershell
cd C:\Users\solid\Documents\Codex\OverHead
npx --yes firebase-tools@latest -- functions:secrets:set STRIPE_SECRET_KEY --project overhead-office
npx --yes firebase-tools@latest -- functions:secrets:set STRIPE_WEBHOOK_SECRET --project overhead-office
```

After both secrets are created, deploy Functions:

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'
node C:\Users\solid\AppData\Local\npm-cache\_npx\7750544ccf494d8b\node_modules\firebase-tools\lib\bin\firebase.js deploy --config firebase.overhead.json --only functions --project overhead-office --non-interactive
```

Functions will then issue/update licenses on trial start, paid entitlement changes, cancellation, payment failure, and trial expiry. Confirm `billingApi` and `expireTrials` are deployed before describing live billing or automatic license issuance as active.

`billingApi` is configured for browser requests from `https://overhead-office.web.app` and `https://overhead-office.firebaseapp.com` only. This CORS allow-list is necessary for the signed-in `/account/` billing panel and must stay narrow.

## Verification after Functions deployment

Use Stripe test mode first. Follow the full checklist in `docs/production-readiness.md`, including:

1. One no-card 30-day Gold trial.
2. Active entitlement and one license per active member.
3. Refusal of a second trial.
4. Paid test checkout and Stripe webhook entitlement update.
5. Duplicate-checkout prevention.
6. Cancellation/refund and suspended licenses.
7. Trial-expiry suspension through `expireTrials`.
8. Sign in with the same administrator account in the EXE and at `https://overhead-office.web.app/account/`; confirm both show the same entitlement and member license.
9. Start a test action from the browser and confirm the EXE reflects it after an entitlement refresh.

Do not turn on public live billing until these tests pass.

Cylinder is outside this standard Stripe checklist. Do not collect Cylinder payments through the standard checkout. Before activating any paid Cylinder deployment, issue the final deployment order or contract and invoice with the price, billing interval, renewal, cancellation, refund, support, and entitlement terms; have those terms reviewed by qualified counsel.

## Normal build and deploy commands

Desktop package:

```powershell
cd C:\Users\solid\Documents\Codex\OverHead
npm run dist:win
```

Cylinder package:

```powershell
cd C:\Users\solid\Documents\Codex\OverHead
npm run dist:cylinder
```

For Cylinder, publish the installer, `.blockmap`, generated ZIP, `CYLINDER-SHA256SUMS.txt` entry, and `updates/cylinder/latest.yml` together. Bump the package version for every published Cylinder update; a changed installer using an old updater version will not be detected by existing installs.

Website:

```powershell
cd C:\Users\solid\Documents\Codex\OverHead\website-next
npm run build
```

Copy `website-next\out` into `website-deploy`, then deploy hosting from repository root:

```powershell
cd C:\Users\solid\Documents\Codex\OverHead
node C:\Users\solid\AppData\Local\npm-cache\_npx\7750544ccf494d8b\node_modules\firebase-tools\lib\bin\firebase.js deploy --config firebase.overhead.json --only hosting --project overhead-office --non-interactive
```

Use `firebase.overhead.json` as the deployment configuration; the repository does not use a root `firebase.json`.

Deploy Functions before Hosting when publishing the browser subscription panel. Hosting can be deployed independently for normal website changes, but the panel cannot complete trial, checkout, portal, or cancellation actions until `billingApi` is deployed with the Stripe configuration.
