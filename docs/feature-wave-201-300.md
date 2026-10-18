# OverHead feature wave 201–300

Audited against OverHead 0.3.15 (`3578fa7`) and the isolated feature modules in this wave. “Implemented” identifies new work in this wave; “Already present” identifies existing behavior or an integration point. “Blocked” means completing the listed behavior needs a service, data model, or identity/network capability the current desktop workspace does not have. Blocked rows name the missing prerequisite.

The new report and rule modules use the encrypted local feature-record API. Reports include filters and metric definitions, while customer, project, billing, and security records remain in their existing stores. PDF output uses the operating system print dialog; delivery schedules are saved as requests only because the desktop runtime has no background report-delivery service.

| # | Feature | Status | Code location and evidence |
|---:|---|---|---|
| 201 | Custom report builder | Implemented | `src/ReportStudio.jsx`, `src/reportStudio.js`: source, period, status, and text filters. |
| 202 | Saved report filters | Implemented | `src/ReportStudio.jsx`: encrypted `reporting` records with Owner/Bookkeeper sharing. |
| 203 | Scheduled report delivery | Blocked | `src/ReportStudio.jsx` saves a delivery request; unattended notification/mail delivery needs a background service and configured provider. |
| 204 | PDF report export | Implemented | `src/ReportStudio.jsx`: print dialog supports Save as PDF. |
| 205 | Spreadsheet report export | Already present | `src/App.jsx` ReportsSection exports CSV; `src/ReportStudio.jsx` exports filtered CSV. |
| 206 | Report sharing permissions | Implemented | `src/ReportStudio.jsx`: saved filters declare permitted Owner/Bookkeeper roles; backend collection enforces role access. |
| 207 | Revenue trend charts | Implemented | `src/reportStudio.js` groups invoices by month; `src/ReportStudio.jsx` renders local trend bars. |
| 208 | Pipeline conversion analysis | Implemented | `src/reportStudio.js`: sent, accepted, and declined quote counts and conversion rate. |
| 209 | Customer retention reports | Implemented | `src/reportStudio.js`: repeat customers and creation-month cohorts from invoice/customer links; it reports repeat activity, not churn. |
| 210 | Task completion reports | Implemented | `src/reportStudio.js`: task completion count and rate. |
| 211 | Project variance reports | Blocked | No project budget/actual data model exists in the audited baseline; needs project cost and budget records. |
| 212 | Team utilization reports | Blocked | No time-entry, work-hour, or capacity records exist in the audited baseline. |
| 213 | Expense trend analysis | Implemented | `src/reportStudio.js` groups local expense amounts by month. |
| 214 | Aging receivables report | Implemented | `src/reportStudio.js` groups unpaid invoices by due-date age. |
| 215 | Cohort analysis | Implemented | `src/reportStudio.js` groups customers by creation month and counts repeat invoice activity. |
| 216 | Forecast accuracy tracking | Blocked | No timestamped forecast snapshots exist to compare with actuals. |
| 217 | Custom metric definitions | Implemented | `src/ReportStudio.jsx`: encrypted definitions for record count, amount sum, and completion rate. |
| 218 | Report annotation notes | Implemented | `src/ReportStudio.jsx`: encrypted, role-scoped notes attached to the selected report type. |
| 219 | Data source transparency panel | Implemented | `src/ReportStudio.jsx`: names local source collections and record counts. |
| 220 | Report access audit history | Implemented | `src/ReportStudio.jsx`: records report opens and exports in the encrypted reporting collection. |
| 221 | No-code workflow builder | Implemented | `src/AutomationStudio.jsx`: event, condition, and task action form; rules persist locally. |
| 222 | Trigger-based task creation | Implemented | `src/AutomationStudio.jsx`: Owner can evaluate matching customer, quote, overdue-invoice, and due-task events; matching records queue local jobs with deduplication. |
| 223 | Status-change automations | Implemented | `src/AutomationStudio.jsx`: quote status audit events can trigger a task, optionally filtered by status. |
| 224 | Deadline escalation rules | Implemented | `src/AutomationStudio.jsx`: due-task rule creates a review task; rule execution is Owner-triggered. |
| 225 | Conditional approval routing | Blocked | Existing approvals are explicit requests, but no rule executor routes them; routing needs a permission-aware approval event model. |
| 226 | Customer assignment automation | Blocked | Customer records have no assignment/territory ownership field to route against. |
| 227 | Scheduled workflow runs | Already present | `electron-backend.cjs` stores `run_at` on workflow jobs and processes due jobs. |
| 228 | Automation error inbox | Already present | `src/App.jsx` AutomationsSection filters Dead Letter jobs and shows their last error. |
| 229 | Automation run history | Implemented | `src/AutomationStudio.jsx` records matched and queued run summaries in encrypted local records. |
| 230 | Reusable automation recipes | Already present | `src/App.jsx` and `src/boilerplates.js` provide reusable customer playbooks and workflow boilerplates. |
| 231 | Webhook-triggered workflows | Blocked | Public, authenticated webhook ingress requires a deployed service and signature verification; not exposed by the local desktop app. |
| 232 | Form submission automations | Already present | `electron-backend.cjs` customer creation queues setup work; appointment creation queues a scheduling task. |
| 233 | Field update rules | Blocked | No generic field-update event pipeline or allowlisted update-rule executor exists. |
| 234 | Duplicate record warnings | Already present | Microsoft import preview and commit detect duplicate email/source records in `electron-backend.cjs`. |
| 235 | Recurring checklist generation | Blocked | Playbooks create a checklist once; recurring checklist scheduling needs a recurrence model and scheduler behavior. |
| 236 | Notification routing rules | Blocked | Desktop notification toggle exists, but no channel/recipient routing model is available. |
| 237 | Automated customer follow-ups | Already present | Customer playbooks and follow-up boilerplates exist; automatic external sending remains disabled. |
| 238 | Automated project status requests | Blocked | No project/status-request domain or project recipients exist. |
| 239 | Workflow pause and resume | Implemented | `src/AutomationStudio.jsx` enables and pauses saved Owner rules. |
| 240 | Automation permission controls | Already present | `src/AutomationStudio.jsx` gates rule writes/runs to Owner; backend feature-record API enforces collection roles. |
| 241 | Google Calendar connection | Blocked | Needs Google OAuth app, consent, and calendar connector setup. |
| 242 | Microsoft 365 calendar connection | Blocked | Microsoft connection currently supports contact/Business Central previews, not calendar scopes or event sync. |
| 243 | Google Drive connection | Blocked | Needs Google Drive OAuth consent and file-access scope review. |
| 244 | OneDrive connection | Blocked | Microsoft OAuth exists, but file sync/scopes are not configured. |
| 245 | Dropbox connection | Blocked | Needs Dropbox OAuth application and account consent. |
| 246 | Slack notifications | Blocked | Needs approved Slack app, scoped consent, and signed delivery service. |
| 247 | Microsoft Teams notifications | Blocked | Needs Graph notification permissions and a delivery service. |
| 248 | QuickBooks export | Blocked | Live accounting sync requires Intuit account authorization and mapping; no authenticated connector is configured. |
| 249 | Xero export | Blocked | Live accounting sync requires Xero account authorization and mapping; no authenticated connector is configured. |
| 250 | Stripe payment events | Already present | `functions/index.js` verifies supported Stripe webhooks and records subscription/payment status events. |
| 251 | Zapier connector | Blocked | Requires a published, authenticated Zapier integration and webhook endpoint. |
| 252 | Make connector | Blocked | Requires a published, authenticated Make integration and webhook endpoint. |
| 253 | REST API access | Blocked | The audited desktop surface is local IPC; a public API needs an authenticated service, scope model, and rate limits. |
| 254 | API key management | Blocked | No public API service exists; generic feature records must not store reusable credentials. |
| 255 | Webhook configuration page | Blocked | No public webhook receiver or signing-secret lifecycle exists. |
| 256 | CSV import wizard | Already present | Root `src/features/ControlCenter.jsx` reads and previews CSV rows; it does not commit imports. |
| 257 | CSV mapping presets | Blocked | The current CSV preview does not define or persist field mappings. |
| 258 | Import validation preview | Already present | `src/features/ControlCenter.jsx` shows a local CSV preview; Microsoft imports also validate previews before commit. |
| 259 | Data export scheduler | Blocked | Needs an unattended scheduler/notification or delivery service; current exports are user initiated. |
| 260 | Integration health dashboard | Already present | `src/features/ControlCenter.jsx` lists connector setup states; Microsoft/Stripe/Square health is available in existing backend state. |
| 261 | Global search across records | Already present | `src/features/ControlCenter.jsx` searches feature records allowed by the current role. |
| 262 | Search by custom fields | Already present | Search serializes accessible feature records, including user-defined fields. |
| 263 | Saved search views | Already present | `src/features/ControlCenter.jsx` persists search views in the encrypted `search` collection. |
| 264 | Advanced search filters | Blocked | The current search accepts terms but has no structured multi-field filter/facet editor. |
| 265 | Recent search history | Already present | `src/features/ControlCenter.jsx` saves recent query records. |
| 266 | Search result grouping | Already present | `src/features/ControlCenter.jsx` groups result counts by source collection. |
| 267 | Search synonyms | Blocked | No synonym dictionary or normalized query expansion is implemented in the integrated search panel. |
| 268 | Smart duplicate suggestions | Already present | Customer import duplicate checks identify matching emails/source IDs; fuzzy suggestions need a reviewed matching model. |
| 269 | Custom tags across modules | Already present | `src/features/ControlCenter.jsx` stores a shared workspace tag list; assigning tags to arbitrary records remains limited. |
| 270 | Tag hierarchy | Blocked | Tag storage currently creates only root-level entries; no parent editor or hierarchical filtering exists. |
| 271 | Shared saved views | Already present | Owner-created views use the shared workspace scope in `src/features/ControlCenter.jsx`. |
| 272 | Personal saved views | Already present | Non-Owner views are saved under the creator scope in `src/features/ControlCenter.jsx`. |
| 273 | Record relationship explorer | Blocked | Search shows records but lacks a navigable relationship graph across modules. |
| 274 | Custom list columns | Blocked | No user-configurable column schema exists for record lists. |
| 275 | Sortable custom lists | Blocked | Search results do not yet offer user-selected sortable table columns. |
| 276 | Bulk actions from search results | Blocked | Search results support individual pinning; multi-select batch actions are not implemented. |
| 277 | Search result export | Already present | `src/features/ControlCenter.jsx` exports the current search result set as CSV. |
| 278 | Record pinning | Already present | `src/features/ControlCenter.jsx` saves pinned record references in the encrypted search collection. |
| 279 | Configurable record IDs | Blocked | Core IDs are generated by backend entity prefixes; no configurable numbering policy exists. |
| 280 | Archived-record search | Blocked | There is no record archive lifecycle or archive query path in the audited baseline. |
| 281 | Multi-factor authentication options | Blocked | Firebase email verification is present, but MFA requires a configured identity-provider factor and recovery flow. |
| 282 | Single sign-on support | Blocked | Microsoft data import OAuth is not app sign-on; enterprise SSO requires identity-provider integration. |
| 283 | Session management controls | Already present | `electron-backend.cjs` tracks sessions and the renderer can lock/sign out the current session. |
| 284 | Device session list | Blocked | Session records do not yet expose trusted device metadata or revocation controls. |
| 285 | Password policy settings | Already present | `electron-backend.cjs` enforces a 12-character minimum for registration and reset. |
| 286 | Role and permission editor | Already present | Accounts UI and backend role checks manage Owner, Front Desk, Bookkeeper, and Support access. |
| 287 | Field-level permissions | Already present | Privacy mode masks customer fields; fine-grained per-role field policies are not yet configurable. |
| 288 | Record-level access rules | Already present | Firebase workspace scope and separate customer/team access lanes constrain record visibility. |
| 289 | Admin activity log | Already present | Backend audit events are available to the Evidence/Security views. |
| 290 | Data access audit trail | Already present | Sensitive exports, settings, account changes, and data deletion are audited; ordinary read access is not logged. |
| 291 | Login history | Already present | Authentication success/failure events are recorded in the backend audit history. |
| 292 | User invitation controls | Already present | Staff and customer invitation flows exist in `electron-backend.cjs` and Accounts/Customers UI. |
| 293 | Scheduled access reviews | Blocked | Security view accepts manual review notes; no scheduled recurring review engine exists. |
| 294 | Automatic inactive-user suspension | Blocked | Users can be suspended manually; no inactivity policy/scheduler is configured. |
| 295 | IP allowlist settings | Blocked | The local app has no trusted-network enforcement service or admin allowlist infrastructure. |
| 296 | Data retention configuration | Already present | Retention policy, compliance summary, and local retention-days setting exist in backend state. |
| 297 | Export permission controls | Already present | `allowDataExport` toggle and Owner/Bookkeeper role enforcement gate exports. |
| 298 | Sensitive-field masking | Already present | Privacy mode masks customer and protected evidence details in renderer views. |
| 299 | Admin recovery codes | Blocked | Recovery phrase support exists, but one-time admin recovery codes and secure rotation do not. |
| 300 | Security event notifications | Blocked | Audit and risk signals are recorded, but routed push/email notifications need an approved delivery service. |

## Verification boundary

The report and automation modules are intentionally isolated for integration by the main OverHead agent. No production build or smoke test was run before the integrated project compiles. Provider-dependent integrations, unattended delivery, public API/webhook infrastructure, and absent project/time-history domains remain setup/data-model work rather than silently simulated behavior.
