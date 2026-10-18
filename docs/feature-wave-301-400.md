# Feature wave 301–400 audit

Baseline: OverHead 0.3.15 at `3578fa7`; the shared encrypted feature-record API is in `6df8a0c`. The components in `src/featureWave301400.jsx` are integrated into Settings, Accounts, Support, and Field & Assist on OverHead 0.3.18. The production build and Electron workspace launch check passed for this release branch.

“Implemented” means a concrete workflow exists in the new component. “Already present” identifies baseline behavior. “Blocked” means a safe implementation depends on native platform signing/permissions, a missing authenticated billing/mail integration, or backend state transitions the product does not currently expose. Rule-based suggestions are local and offline; no AI provider is configured or contacted.

| # | Feature | Status | Code location / audit note |
|---:|---|---|---|
| 301 | Organization profile editor | Already present | `src/App.jsx:1925` `AccountsSection`; business name and profile editor. |
| 302 | Multiple workspaces per account | Blocked | Profiles currently bind to one `workspace_id`; membership model and Firestore rules need a migration before safely switching workspaces. |
| 303 | Workspace ownership transfer | Blocked | Requires verified owner handoff and coordinated Auth/profile/workspace ownership transaction; no such backend operation exists. |
| 304 | Subscription usage dashboard | Already present | `src/App.jsx:2211` `CylinderPlanPanel`; usage versus plan limits. |
| 305 | Seat assignment management | Already present | `src/App.jsx:1925` `AccountsSection`; user roles/status and staff account creation. |
| 306 | Plan change preview | Already present | `src/App.jsx:2240` `DesktopPlansSection`; plan cards show prices/features before checkout. Provider-side proration is not previewed. |
| 307 | Billing contact settings | Already present | `src/App.jsx:2241` and `:2389`; billing profile fields. |
| 308 | Subscription invoice history | Already present | `src/App.jsx:2264` and `:2426`; billing activity and generated receipt. |
| 309 | Trial status dashboard | Already present | `src/App.jsx:2214` and `:2385`; trial state/end date and 90-day policy. |
| 310 | Renewal date reminders | Implemented | `src/featureWave301400.jsx` shows an opt-in in-app reminder in Settings when the active trial end date is within 30 days, using the saved locale. Paid-plan renewal dates without provider fields and background push/email delivery are not included. |
| 311 | Account recovery workflow | Already present | `src/App.jsx:2806` `SecuritySection`; desktop recovery flow; website reset at `website-next/app/sign-in/sign-in-client.jsx`. |
| 312 | Login email change process | Blocked | No reauthentication + verified email-change flow; changing a profile email alone could desynchronize Firebase Auth. |
| 313 | Profile data download | Already present | `src/App.jsx:2492` backend data export invoked from Settings; exports full local workspace data, not a profile-only packet. |
| 314 | Workspace archive export | Already present | `src/App.jsx:2492` and Settings data export workflow. |
| 315 | Account closure checklist | Implemented | `src/featureWave301400.jsx:305` `AccountGovernancePanel`; owner-only checklist in encrypted `account` records. It does not delete or cancel anything. |
| 316 | Workspace transfer tools | Blocked | Same verified membership/ownership migration requirement as 302–303. |
| 317 | Seat utilization reports | Implemented | `src/featureWave301400.jsx:62` `FeatureWavePreferences` and `:305` `AccountGovernancePanel`; active-license/profile counts. |
| 318 | Subscription admin roles | Already present | `src/App.jsx:1358` role-specific section map and `:1925` account role controls. |
| 319 | Account notification settings | Implemented | `src/featureWave301400.jsx:62` stores activity/renewal reminder preferences and sound choice. Delivery is not scheduled; no alert service is configured. |
| 320 | Organization-wide defaults | Already present | `src/App.jsx:2909` `SettingsSection`; owner-controlled operational toggles. |
| 321 | Dark and light themes | Already present | `src/themes.js` and `src/App.jsx:3049` theme picker; includes dark/light and system options. |
| 322 | Adjustable text size | Implemented | `src/featureWave301400.jsx:62` saved text scale; `src/App.css:117` scale variables. |
| 323 | High-contrast mode | Already present | `src/index.css` `html[data-theme="contrast"]`; theme picker in `src/App.jsx:3049`. |
| 324 | Screen-reader labels | Already present | Accessible names and dialog/region semantics in `src/App.jsx`, e.g. `:453`, `:510`, `:678`, `:787`. |
| 325 | Keyboard-only navigation | Already present | Native form/button controls and visible `:focus-visible` styles in `src/index.css`. |
| 326 | Reduced-motion setting | Already present | `src/App.jsx:212` and `:3041`; local preference and document setting. |
| 327 | Language selection | Implemented | `src/featureWave301400.jsx:62` persists language selection; English is currently the only available translation. |
| 328 | Regional date formats | Implemented | `src/featureWave301400.jsx:62` locale preference and formatted date preview. Existing date displays are not yet globally switched to that locale. |
| 329 | Regional number formats | Implemented | `src/featureWave301400.jsx:62` locale-aware currency preview and saved region preference. Existing reports are not yet globally switched. |
| 330 | Customizable notification sounds | Implemented | `src/featureWave301400.jsx` plays the selected optional local tone when a new in-app operation notice appears; users can disable it or preview it. |
| 331 | Compact density setting | Implemented | `src/featureWave301400.jsx:62`; `src/App.css:119` compact spacing rules. |
| 332 | Mobile-friendly task views | Already present | `ios/OverHeadIOS/Sources/WorkspaceViews.swift:26` `TasksView`; desktop layout also has responsive styling. |
| 333 | Offline draft support | Implemented | `src/featureWave301400.jsx:131` field note/checklist capture saved in the encrypted local `mobile` collection. |
| 334 | Form autosave | Already present | `src/App.jsx:1443` saved customer form memory and `:2241` billing form memory. |
| 335 | Undo for common actions | Implemented | `src/featureWave301400.jsx` provides an explicit undo for the last field checklist toggle, restoring the prior saved checklist. Money, access, and security actions remain excluded from undo. |
| 336 | Clear empty-state guidance | Already present | Empty-state guidance across `src/App.jsx` reports, tasks, customer records, and support. |
| 337 | Inline field help | Already present | Privacy and field guidance in `src/App.jsx` forms and `SettingsSection`. |
| 338 | Setup progress checklist | Already present | `src/App.jsx` overview readiness and account profile completion indicators. |
| 339 | Guided feature tours | Implemented | `src/featureWave301400.jsx:62` keyboard-operable five-step guided tour. |
| 340 | Feedback and bug-report form | Already present | `website-next/app/feedback/feedback-form.jsx` and `/feedback` page. |
| 341 | Mobile home screen widgets | Blocked | Requires signed iOS WidgetKit target, extension entitlements, and release packaging; none exists in this Windows build. |
| 342 | Push notifications | Blocked | Requires APNs credentials, user consent flow, signed native app, and notification backend. |
| 343 | Mobile task capture | Already present | `ios/OverHeadIOS/Sources/WorkspaceViews.swift:26` adds tasks from the iPhone view. |
| 344 | Mobile voice notes | Blocked | No audio permission/recording/transcription workflow; avoid collecting recordings without explicit controls and retention policy. |
| 345 | Photo attachment capture | Blocked | No native camera capture/upload flow in the iOS target. |
| 346 | Receipt photo capture | Blocked | No camera-to-receipt extraction/review workflow. |
| 347 | Offline task updates | Already present | `ios/OverHeadIOS/Sources/WorkspaceStore.swift:26` Firestore snapshot listeners and `:51` task writes use Firestore client persistence/queue semantics; local field capture is also supported. |
| 348 | Offline customer lookup | Already present | `ios/OverHeadIOS/Sources/WorkspaceStore.swift:29` customer snapshots; Firestore local cache supports previously synced records. |
| 349 | Location-tagged visit notes | Implemented | `src/featureWave301400.jsx` allows an optional manually entered site location only after an explicit confirmation, limits it to 300 characters, and stores/displays it with the encrypted local field note. No device location permission or GPS lookup is used. |
| 350 | Mobile signature capture | Blocked | No native signature consent, capture, storage, or export flow. |
| 351 | Field visit checklists | Implemented | `src/featureWave301400.jsx:131` encrypted visit checklist records. |
| 352 | Mobile barcode scanning | Blocked | Requires native camera/scan permissions and barcode-to-record resolution. |
| 353 | Mobile contact calling | Implemented | `src/featureWave301400.jsx:131` uses customer phone with a `tel:` handoff. |
| 354 | Directions from customer records | Implemented | `src/featureWave301400.jsx:131` opens directions from the saved service-area value; no device location is read. |
| 355 | Mobile time entry | Implemented | `src/featureWave301400.jsx:131` records manually entered visit minutes. |
| 356 | Worksite safety checklist | Implemented | `src/featureWave301400.jsx:131` adds a reviewable safety checklist template to field notes. |
| 357 | Mobile approval actions | Already present | `ios/OverHeadIOS/Sources/WorkspaceViews.swift:49` approval review and role-gated approve/decline. |
| 358 | Mobile document upload | Blocked | Desktop customer attachment exists, but the iOS target has no document picker/upload workflow. |
| 359 | Mobile calendar agenda | Blocked | iOS target has no calendar/appointment agenda view. |
| 360 | Device sync status page | Implemented | `ios/OverHeadIOS/Sources/WorkspaceStore.swift` exposes Firestore cache/pending-write metadata for tasks, customers, and approvals; `WorkspaceViews.swift` shows current-device status in Account. Other device health is not available. |
| 361 | Support ticket queue | Already present | `src/App.jsx:1749` `SupportSection`; shared support ticket queue. |
| 362 | Ticket priority rules | Implemented | `src/featureWave301400.jsx:214` defines review targets by priority; it flags elapsed targets for review. |
| 363 | Ticket category taxonomy | Implemented | `src/featureWave301400.jsx:214` support category selector persisted in encrypted `support` records. |
| 364 | Service-level target tracking | Implemented | `src/featureWave301400.jsx:214` computes target deadline from ticket priority and creation timestamp. |
| 365 | Ticket escalation paths | Implemented | `src/featureWave301400.jsx:214` assignment rotation and elapsed-target escalation cue; actual customer email is not sent. |
| 366 | Customer self-service knowledge base | Already present | `website-next/app/faq/page.jsx` public FAQ and existing help content in `src/productBlueprint.js`. |
| 367 | Help article feedback | Implemented | `src/featureWave301400.jsx:214` records local topic/helpfulness feedback. |
| 368 | Support macros | Implemented | `src/featureWave301400.jsx:214` reviewable reply macro selector. |
| 369 | Ticket-to-project conversion | Implemented | `src/featureWave301400.jsx:214` creates a local project reference to the ticket for authorized roles. |
| 370 | Ticket assignment round-robin | Implemented | `src/featureWave301400.jsx:214` rotates across active Owner/Support profiles. |
| 371 | Customer support satisfaction ratings | Implemented | `src/featureWave301400.jsx:214` saves a 1–5 rating with ticket metadata. |
| 372 | Support workload dashboard | Implemented | `src/featureWave301400.jsx:214` counts active ticket assignments by support owner. |
| 373 | Ticket response-time reports | Implemented | `src/featureWave301400.jsx` records first-response time and staff identity explicitly, then reports average duration only for tickets with recorded responses. |
| 374 | Internal ticket collaboration | Implemented | `src/featureWave301400.jsx:214` encrypted staff-only handoff notes. |
| 375 | Related ticket suggestions | Implemented | `src/featureWave301400.jsx:214` local subject-keyword matches; suggestions are not semantic AI. |
| 376 | Customer incident timeline | Implemented | `src/featureWave301400.jsx:214` shows ticket creation, metadata updates, and internal note times. |
| 377 | Service outage notices | Implemented | `src/featureWave301400.jsx:214` saves a local draft; external publication requires a configured service channel. |
| 378 | Support email routing | Implemented | `src/featureWave301400.jsx` routes a selected support ticket to the configured local owner path. Automatic mailbox ingestion and email forwarding still require a verified mailbox transport. |
| 379 | Ticket reopen rules | Implemented | `src/featureWave301400.jsx:214` stores an explicit reopen request marker. The upstream shared ticket status is not changed by this adjunct record. |
| 380 | Support closure checklist | Implemented | `src/featureWave301400.jsx:214` per-ticket closure checklist. |
| 381 | Natural-language record search | Implemented | `src/featureWave301400.jsx:1` `localSuggestions('search')` matches terms across loaded local records. |
| 382 | Meeting summary drafts | Implemented | `src/featureWave301400.jsx:1` extractive sentence selection, no provider. |
| 383 | Task description drafts | Implemented | `src/featureWave301400.jsx:1` local next-action/template draft. |
| 384 | Project status summary drafts | Implemented | `src/featureWave301400.jsx:1` summary from locally loaded task/appointment/quote/invoice counts. |
| 385 | Duplicate note detection | Implemented | `src/featureWave301400.jsx:1` local normalized text-containment match; explicitly not semantic. |
| 386 | Suggested next actions | Implemented | `src/featureWave301400.jsx:1` reviewable local workflow prompt. |
| 387 | Report question-to-chart drafts | Implemented | `src/featureWave301400.jsx:1` proposes a record count/chart grouping from local data. |
| 388 | Knowledge base article drafts | Implemented | `src/featureWave301400.jsx:1` assembles an editable template from supplied notes. |
| 389 | Customer email draft suggestions | Implemented | `src/featureWave301400.jsx:1` reviewable local email template; no mail is sent. |
| 390 | Risk signal summaries | Implemented | `src/featureWave301400.jsx:1` offers a review checklist without declaring fraud or compliance results. |
| 391 | Workload imbalance suggestions | Implemented | `src/featureWave301400.jsx:1` task-count comparison by assigned owner; complexity is not modeled. |
| 392 | Missing-field detection | Implemented | `src/featureWave301400.jsx:1` checks a supplied field list for common owner/due date/customer/status/next-action values. |
| 393 | Long-thread summaries | Implemented | `src/featureWave301400.jsx:1` short extractive sentence list from pasted text. |
| 394 | Document key-point extraction | Implemented | `src/featureWave301400.jsx:1` extractive points from pasted text; files are not uploaded. |
| 395 | Suggested task categorization | Implemented | `src/featureWave301400.jsx:1` transparent keyword-based category hint. |
| 396 | Forecast scenario summaries | Implemented | `src/featureWave301400.jsx` calculates a transparent amount × probability scenario and zero-to-full range from user-supplied assumptions; stored invoice/quote counts are context only. |
| 397 | Natural-language automation setup | Implemented | `src/featureWave301400.jsx:1` drafts a trigger/condition/review outline; it does not create or run automation. |
| 398 | AI usage controls for admins | Implemented | `src/featureWave301400.jsx:131` Owner-only control; explicitly local/offline suggestions only. |
| 399 | Per-workspace AI opt-in settings | Implemented | `src/featureWave301400.jsx:131` opt-in defaults off and persists in encrypted `ai_knowledge` collection. |
| 400 | AI suggestion review history | Implemented | `src/featureWave301400.jsx:131` records user-selected reviews; no provider/model is claimed. |

## Integration notes

Exported components for the app shell to mount:

- `FeatureWavePreferences({ session, backendState, setOperationNotice })` in Settings.
- `AccountGovernancePanel({ backendState, session, setOperationNotice })` in Accounts or Settings.
- `SupportOperationsPanel({ tickets, users, session, setOperationNotice })` inside Support.
- `FieldAssistSection({ backendState, session, setOperationNotice })` under a role-appropriate Field & Assist section.

`src/App.css` contains compact/responsive rules for these views. The account/accessibility/mobile/support/AI record paths are encrypted in OverHead’s local store and require an active staff session. Locale choices currently show formatted previews; they are not applied globally to every existing date and number view.
