# EstateHat Goodies Install (2026-04-17)

## Request

Find and install as many relevant EstateHat experience helpers and components as practical.

## Result

Completed as a new lazy-loaded `Goodies` workspace.

- Added `src/EstateHatUxSuite.jsx`.
- Added a primary `Goodies` navigation item.
- Added a command-palette entry for `Goodies`.
- Added a lazy route for `ux-suite` so the new lab does not load on the first app render.
- Added local persistence for activation/run state under `estatehat-ux-ui-suite-v1`.

## Installed Goodies

The workspace includes 94 EstateHat-specific goodies across seven groups.

### Navigation And Shell

- Universal Command Center
- Global Create Menu
- Role-Aware Home Layout
- Context-Aware Right Rail
- Breadcrumb Trail Plus
- Recent Workspace Switcher
- Pinned Workspaces Bar
- Mobile Thumb Navigation
- Desktop Split Pane Layout
- Keyboard Shortcut Coach
- Back-To-Deal Return Path
- Session Resume Banner

### Property Discovery

- Map/List Toggle
- Draw-To-Search Boundary
- Commute Time Filter
- School Zone Snapshot
- Neighborhood Fit Score
- Property Match Score
- Saved Search Alerts
- Recently Viewed Rail
- Listing Confidence Badges
- Photo Completeness Meter
- Open-House Planner
- Side-By-Side Compare Tray
- Price Drop Watch
- Property Note Pins

### Transaction Workflow

- Offer Flow Stepper
- Closing Timeline
- Contingency Checklist
- Earnest Money Tracker
- Inspection Resolution Board
- Appraisal Gap Meter
- Title Review Status
- Closing Cost Breakdown
- Net Proceeds Preview
- Signer Responsibility Matrix
- Deal Health Score
- Blocker Triage Queue
- Milestone Dependency Map
- Final Walkthrough Checklist

### Documents And Compliance

- Document Vault Inbox
- Missing Document Radar
- E-Sign Status Tracker
- Disclosure Packet Builder
- Jurisdiction Rule Drawer
- Document Version Timeline
- Sensitive Data Shield
- Upload Dropzone Review
- County Recording Checklist
- Compliance Evidence Bundle
- Attorney Review Panel
- Audit Trail Viewer
- Policy Acknowledgement Center
- Retention Status Meter

### Trust, Safety, And Money

- Profile Completeness Meter
- Trust Badge System
- Role Conflict Warning
- Verified Billing Checklist
- Wire Safety Confirmation
- Payout Readiness Meter
- Fraud Signal Inbox
- Device Trust Panel
- MFA Setup Prompt
- Login Alert Preferences
- Escrow Status Card
- Receipt Drawer
- Refund/Credit Tracker
- Risk Review Console

### Communication And Support

- Notification Inbox Upgrade
- Message Priority Modes
- Template Reply Picker
- Participant Presence Chips
- Deal Comment Threads
- Support Ticket Drawer
- Help Article Overlay
- Guided Onboarding Map
- Smart Empty States
- Undo Recent Action Toasts
- Offline/Sync Banners
- Assistant Suggested Actions
- FAQ Inline Answers
- Feedback/Bug Report Modal

### Admin And Operations

- Admin Review Console
- Verification Queue Kanban
- Listing Quality Review
- Photo Review Workbench
- Document Review Split View
- SLA Timer Badges
- Bulk Assignment Bar
- Exception Case Drawer
- Government Oversight View
- County Priority Dashboard
- Vendor Compliance Tracker
- Release Readiness Checklist

## Functional Behavior

Each feature supports:

- `Activate`
  - marks the feature active in local persisted state
  - records an activation run event
- `Run`
  - marks the feature active
  - creates a feature-specific output record
  - updates the latest-output preview
- `Activate All`
  - activates every goodie
- `Run Visible`
  - runs the current filtered group or search result set

## Verification

- `npm test` passed.
- `npm run build` passed.

## Build Note

The new Goodies workspace is code-split into its own chunk:

- `EstateHatUxSuite-*.js`: about 15 kB minified

The existing main EstateHat app chunk remains slightly above Vite's default 500 kB warning threshold, but the new lab does not materially add to first-load weight.

## 2026-04-17 Rename And Forms Copy Pass

- Renamed user-facing `UX/UI` buttons and command labels to `Goodies`.
- Renamed the component-suite command/page language to `Hat Data`.
- Updated Assistant, Help Center, FAQ & Scope, Terms, Privacy, footer links, and Forms copy so Goodies, Hat Data, and Forms use consistent naming.
- Clarified that Hat Data and Goodies are product-interface labels, not legal, brokerage, title, escrow, lending, tax, appraisal, underwriting, investment, fiduciary, or advisory services.
