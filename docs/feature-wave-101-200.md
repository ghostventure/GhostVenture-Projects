# Feature wave 101–200

Audit of the original feature inventory against baseline `3578fa7`. Implemented entries describe this wave's local workspace support; they do not imply external provider integrations, automatic actions, or accounting/legal advice. Existing features are identified where the baseline already supplied the core behavior. `Blocked` means the requested capability needs infrastructure outside these local renderer modules.

| # | Feature | Status | Implementation / code location |
|---:|---|---|---|
| 101 | Invoice creation | Already present | Existing `src/App.jsx` LiveOperations and backend `createInvoice`; finance workspace reuses it. |
| 102 | Invoice templates | Implemented | `src/features/CustomerFinanceWorkspace.jsx` templates and create-from-template. |
| 103 | Recurring invoices | Implemented | Finance recurring plans; user-triggered generation advances schedule. |
| 104 | Payment status tracking | Already present | Existing invoice statuses in LiveOperations and operational records. |
| 105 | Late-payment reminders | Implemented | Finance creates local reminder work-queue records; no message is sent. |
| 106 | Payment link support | Blocked | Requires a configured payment processor and customer-safe hosted payment URL flow. |
| 107 | Expense capture | Already present | Existing ExpenseLedger in `src/App.jsx` and encrypted backend. |
| 108 | Expense categories | Already present | Existing ExpenseLedger category field. |
| 109 | Expense approval flow | Already present | Existing expense status and approval controls. |
| 110 | Purchase order tracking | Implemented | Finance purchase order register. |
| 111 | Budget-versus-actual reports | Already present | Existing expense ledger category budget/actual summary. |
| 112 | Cash-flow projections | Implemented | Finance six-month view from invoices, expenses, and plans. |
| 113 | Tax rate configuration | Implemented | Finance local tax setting and tax-calculated invoice workflow. |
| 114 | Multi-currency reporting | Implemented | Finance manual exchange-rate register and currency totals. |
| 115 | Revenue recognition schedules | Implemented | Finance schedule register and monthly planning display. |
| 116 | Refund tracking | Implemented | Local refund register; existing subscription refund is a separate backend flow. |
| 117 | Credit note management | Implemented | Finance credit-note register. |
| 118 | Billing contact management | Already present | Existing billing profile in PlansSection/backend. |
| 119 | Financial period close checklist | Implemented | Month-specific finance close tasks. |
| 120 | Accounting export formats | Implemented | Local invoice-register and general-ledger CSV exports. |
| 121 | Team directory | Already present | Existing AccountsSection team list. |
| 122 | Employee profiles | Implemented | People workspace supplemental employee profile records. |
| 123 | Team availability calendar | Implemented | People availability records and scheduling calendar. |
| 124 | Skills directory | Implemented | People skills register. |
| 125 | Role-based work queues | Already present | Existing role section access and task list filtering. |
| 126 | Team workload dashboard | Implemented | People workspace assigned-work summary. |
| 127 | Capacity forecasts | Implemented | People capacity planner based on local assignments/availability. |
| 128 | Leave request tracking | Implemented | People leave request register. |
| 129 | Onboarding tasks for employees | Implemented | People onboarding checklist. |
| 130 | Offboarding checklist | Implemented | People offboarding checklist. |
| 131 | Organization chart | Implemented | People manager relationships rendered as a hierarchy. |
| 132 | Team goals | Implemented | People goal register and status. |
| 133 | One-on-one notes | Implemented | Private-to-Owner local notes register. |
| 134 | Team announcements | Implemented | People announcement board. |
| 135 | Peer recognition feed | Implemented | People recognition entries. |
| 136 | Internal contact groups | Implemented | People contact group register. |
| 137 | Department access boundaries | Implemented | People department boundary metadata; existing authorization remains enforced by backend roles. |
| 138 | Temporary team access | Implemented | People temporary access register with expiry tracking; does not itself grant/revoke account permissions. |
| 139 | Delegated task ownership | Implemented | People delegated task queue records. |
| 140 | Team activity summary | Implemented | People summary from local profile/work records. |
| 141 | Shared team calendar | Implemented | Scheduling workspace combines appointments and local event records. |
| 142 | Appointment booking pages | Blocked | A public booking page requires a hosted route and publication/deployment integration. |
| 143 | Meeting availability polling | Implemented | Scheduling availability poll and response records. |
| 144 | Time zone-aware scheduling | Implemented | Scheduling stores IANA zone context and displays it; full cross-zone conversion is not included. |
| 145 | Resource booking calendar | Implemented | Scheduling resource booking records and overlap warnings. |
| 146 | Room/equipment reservations | Implemented | Scheduling reservations use named resources. |
| 147 | Calendar conflict warnings | Implemented | Scheduling checks overlapping time/resource/person bookings. |
| 148 | Meeting agenda templates | Implemented | Scheduling agenda template records. |
| 149 | Meeting action-item capture | Implemented | Scheduling meeting action records. |
| 150 | Calendar event links to projects | Implemented | Scheduling event project reference and project selector. |
| 151 | Work-hour configuration | Implemented | Scheduling work-hour settings. |
| 152 | Holiday calendars | Implemented | Scheduling holiday date records. |
| 153 | Shift scheduling | Implemented | Scheduling shift register. |
| 154 | Time entry approval | Implemented | Scheduling time entries with approval statuses. |
| 155 | Timesheet reminders | Implemented | Scheduling local reminder queue records. |
| 156 | Billable-hours reports | Implemented | Scheduling totals from approved billable entries. |
| 157 | Time budget alerts | Implemented | Scheduling budget threshold and alert records. |
| 158 | Calendar sync connectors | Blocked | Provider OAuth/account authorization and sync engine are required; no credentials are stored in feature records. |
| 159 | Focus-time blocks | Implemented | Scheduling focus block records. |
| 160 | Schedule utilization reports | Implemented | Scheduling utilization summary from local shifts/time entries. |
| 161 | Document version history | Implemented | Documents workspace version metadata register. |
| 162 | Document approval workflow | Implemented | Document status/reviewer approval records. |
| 163 | Document templates | Implemented | Document template records. |
| 164 | Inline document comments | Implemented | Document comment records; comments are metadata, not PDF overlays. |
| 165 | File tagging | Implemented | Document index tags. |
| 166 | File access expiration | Implemented | Document access-expiry metadata; does not revoke a hosted link. |
| 167 | Document request checklists | Implemented | Document request checklist records. |
| 168 | Customer-specific file rooms | Already present | Existing customer attachment vault; new document workspace adds per-customer index. |
| 169 | Project document indexing | Implemented | Document index project association and search. |
| 170 | Full-text file search | Blocked | No OCR/content extraction service; current search covers user-entered metadata. |
| 171 | Document activity feed | Implemented | Document workspace displays metadata and backend audit activity. |
| 172 | PDF annotation | Blocked | Requires a PDF viewer/annotation layer and attachment write-back support. |
| 173 | Attachment preview | Already present | Existing local document open action in customer vault. |
| 174 | Bulk file download | Blocked | The current export contains document metadata only; bundling attachment files needs a secure archive flow. |
| 175 | Secure file-sharing links | Blocked | Requires authenticated hosted storage and expiring signed-link service. |
| 176 | File retention rules | Implemented | Retention metadata/rule register; no automatic deletion is performed. |
| 177 | Duplicate file detection | Implemented | Documents detects matching stored filename and byte size. |
| 178 | Document ownership transfer | Implemented | Ownership transfer register. |
| 179 | E-signature integration | Blocked | Requires an authorized e-sign provider integration and signing workflow. |
| 180 | Document export bundles | Implemented | Local JSON document metadata manifest; source attachments are excluded. |
| 181 | Team chat channels | Implemented | Local collaboration channel records. |
| 182 | Direct messages | Implemented | Local direct message records. |
| 183 | Comment threads | Implemented | Collaboration thread records. |
| 184 | @mention notifications | Implemented | Mention parsing and local inbox notifications. |
| 185 | Email conversation linking | Implemented | Local email-thread reference records; no mailbox sync. |
| 186 | Shared team inbox | Implemented | Local shared inbox and assignment/status fields. |
| 187 | Customer message history | Implemented | Collaboration customer-linked message records. |
| 188 | Message templates | Implemented | Collaboration message template records. |
| 189 | Internal-only notes | Implemented | Collaboration internal note records. |
| 190 | Audio note recording | Blocked | Shared feature record API is JSON-limited and does not store audio binaries. |
| 191 | Video meeting links | Implemented | Collaboration stores externally provided meeting URLs. |
| 192 | Conversation assignment | Implemented | Collaboration assignment field and queue. |
| 193 | Conversation status labels | Implemented | Collaboration status labels and filters. |
| 194 | Shared announcement board | Implemented | Collaboration announcement records. |
| 195 | Message search | Implemented | Local collaboration record search. |
| 196 | Read receipts for key notices | Implemented | Per-user read markers for local notices. |
| 197 | Notification quiet hours | Implemented | Collaboration quiet-hours preference records. |
| 198 | Digest notifications | Implemented | Local digest queue; no external push/email. |
| 199 | Collaboration activity stream | Implemented | Activity stream built from local collaboration records. |
| 200 | Cross-team handoff notes | Implemented | Collaboration handoff records with source/destination teams. |

Coverage count: 80 implemented in this wave, 11 already present in the baseline, and 9 blocked on infrastructure or binary/media support. The workspaces use the encrypted feature-record API and are now mounted in the app with role-based navigation. Finance is available to Owners and Bookkeepers; People is Owner-only.
