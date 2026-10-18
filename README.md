# OverHead

Current packaged release: **0.3.10** for standard desktop and **0.3.10** for the Windows Server/Windows IoT-only Cylinder deployment. See `docs/current-handoff-2026-08-21.md`, `docs/cylinder-deployment.md`, and `docs/production-readiness.md` for shared browser/desktop billing, deployment, evaluation, and release requirements.

For the current website/Desktop account process, email verification gate, password recovery, and operator acceptance checklist, see `docs/authentication-workflow.md`.

For the owner-only VS Code / Code - OSS hot-fix handoff, see `docs/developer-editor-workflow.md`.

For the verified customer feedback channel and review location, see `docs/feedback-workflow.md`.

OverHead is a desktop-first admin cleanup framework for small businesses. It focuses on admin-overload pain points that happen after the customer reaches the business:

- appointment scheduling
- repeated customer answers
- quotes and estimates
- invoicing and payment reminders
- customer follow-up
- owner task visibility

The current Windows build includes a local desktop sign-in/onboarding surface, legal center, support center, customer database contract, and a marketability feature catalog with more than 20 product features.

## Current releases

- **OverHead Desktop 0.3.10:** standard Windows desktop release with customer/staff access lanes, role controls, live operational records, locally stored customer documents, and Firebase-hosted downloads/updates.
- **OverHead Cylinder 0.3.10:** separate deployment for Windows Server and Windows IoT only. It uses its own application identity, local data directory, updater channel, and Cylinder tier. It will exit on standard Windows editions. Each server workspace gets one 30-day, no-card evaluation; continued paid use requires a separate commercial activation rather than the standard desktop checkout.

See `docs/cylinder-deployment.md` for server/IoT deployment, updates, and compatibility details.

## Shared browser and desktop access

The signed-in website and OverHead Desktop use the same Firebase account, workspace role, subscription entitlement, and member license. The website account page reflects the shared plan and, for administrators, provides the same Stripe billing service used by the EXE. Stripe secrets remain in Firebase Secret Manager and are never included in the Windows package or website files.

New and invited users must verify their email before protected workspace data opens. The website can persist a session only when the user opts in on a private device; the Desktop checks the same Firebase verification state before starting its local operating session.

## 2026 Desktop GUI Direction

Research direction used for this prototype:

- Windows 11 / Fluent-style structure: left navigation, command bar, panels, accessible focus states, and restrained motion.
- Dense business surfaces: dashboards, queues, and tables before marketing-style pages.
- AI inside workflows: draft, summarize, route, and remind where the owner already works.
- Local-first reliability: usable without network, retry queues for failed jobs, backups before state changes, and clear health checks.
- Accessibility baseline: keyboard focus, readable contrast, stable dimensions, and no text squeezed into unstable controls.

Primary references:

- Microsoft Windows app design: https://learn.microsoft.com/en-us/windows/apps/design/
- Microsoft Fluent 2: https://fluent2.microsoft.design/
- Fluent accessibility: https://fluent2.microsoft.design/accessibility
- Microsoft Windows app best practices: https://learn.microsoft.com/en-us/windows/apps/get-started/best-practices

## Modules

1. Scheduling
   - booking rules
   - calendar holds
   - deposits
   - reminders
   - cancellation and reschedule rules

2. Customer Answers
   - approved answer library
   - AI draft replies
   - FAQ routing
   - owner approval queue

3. Quotes
   - intake-to-estimate flow
   - pricing rules
   - add-ons
   - proposal templates
   - quote follow-up

4. Invoices
   - invoice queue
   - due dates
   - payment reminders
   - escalation rules
   - payment status
   - full subscription receipt PDF on request (plan, payment references, and assigned licenses)

5. Follow-up
   - quote nudges
   - post-service review requests
   - retention reminders
   - owner daily summary

## Tailored Customer Database

The first schema lives in `src/customerDatabase.js`.

Planned tables:

- `customers`
- `user_profiles`
- `sessions`
- `workflow_preferences`
- `admin_state`
- `compliance_profile`
- `legal_documents`
- `support_tickets`
- `feature_entitlements`
- `audit_events`

This database is tailored for owner/operator admin work, not generic CRM bloat. It stores the customer profile, workflow rules, approval requirements, follow-up state, legal acknowledgements, and tamper-checkable audit events.

## Marketable Feature Layer

The product feature catalog lives in `src/productBlueprint.js`.

Included surfaces:

- sign-in workflow
- owner/business profile setup
- terms acceptance
- privacy notice
- acceptable use policy
- AI use disclosure
- data retention policy
- support policy
- support contact card
- emergency support bundle placeholder
- role profiles
- customer database
- workflow builder
- scheduling rules
- answer library
- quote builder
- invoice queue
- payment reminders
- customer follow-up
- owner daily view
- smart inbox triage
- task board
- template vault
- audit trail
- tamper checks
- session lock
- privacy mode masking
- screenshot deterrence through Electron content protection
- inactivity lock after app focus loss
- protected evidence schema
- runtime integrity manifest
- tamper event ledger
- offline queue
- backup manager
- restore workflow
- health monitor
- search and filters
- bulk actions
- import/export
- GeneBox bridge
- provider adapter boundaries
- notification rules
- settings guardrails
- launch checklist

## GeneBox Integration

GeneBox now has an OverHead bridge/plugin scaffold at:

- `C:\Users\solid\Desktop\GeneBox\LocalBusinessAutomationSuite\genebox_overhead_plugin.py`

GeneBox integration actions added to the Integrations tab:

- Connect OverHead
- Seed OverHead Records

The bridge exports:

- active GeneBox client profile
- OverHead module definitions
- bridge schema
- supported tables and capabilities
- sealed `overhead_%` app metadata

The seed command creates GeneBox records for:

- OverHead scheduling review
- OverHead answer library review
- OverHead quote workflow review
- OverHead invoice reminder review
- OverHead customer follow-up review
- OverHead setup payment draft

## Security And Resilience Plan

OverHead now includes the first installed-app backend layer:

- compiler-free local JSON data store with atomic temp-file replacement
- per-user profiles and roles with hashed local desktop passwords
- session lock and recovery phrase
- append-only audit log with checksums
- checksummed settings snapshots
- manual local backups
- support bundle ZIP exports
- local customer records
- durable workflow task queue
- backend health status
- Electron log file support
- updater status plumbing
- strict renderer CSP
- trusted IPC sender checks
- HTTPS allowlist for external links

Release prerequisite still outside the product source:

- trusted Windows code-signing certificate and signing service

Implemented local reliability controls include encrypted profile storage where the OS secure store is available, workflow retry with dead-letter recovery, legal acknowledgements, export and controlled deletion workflows, backup-and-restore, and hosted updater feeds. Restore and deletion both create a safety backup before changing local records.

The practical goal is not magic uptime. The goal is that normal app failure should degrade into recoverable local state, queued work, and visible owner action items.

Sensitive customer data and audit evidence should be masked by default until an authorized local session is open and privacy mode is disabled. The Electron desktop shell uses single-instance enforcement and content protection where Windows/Electron supports it, but screenshot prevention is best treated as deterrence rather than a complete guarantee against someone photographing the screen with another device.

Tamper resistance should be layered: runtime watched-file hashes, tamper-event records, single-instance enforcement, installer hash verification, future code signing, OS disk encryption, and least-privilege user accounts. No local desktop app can guarantee safety against a fully compromised administrator account, so the design goal is to make tampering harder, visible, logged, and recoverable.

## Next Functional Components

Later build steps:

- background worker for reminders
- notification tray service
- import/export from GeneBox manifest
- calendar provider adapters
- email provider adapters
- QuickBooks/Square/Stripe adapter boundaries
- support ticket/contact form
- terms/privacy/legal pages
- signed release package

## Commands

```powershell
cd C:\Users\solid\Documents\Codex\OverHead
cmd /c npm install
cmd /c npm run dev
cmd /c npm run build
cmd /c npm run dist:win
cmd /c npm run dist:cylinder
```
