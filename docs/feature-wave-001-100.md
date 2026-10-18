# Feature wave 001–100 audit

Audited against the current main checkout, including `src/features/GrowthWorkspace.jsx` and the existing desktop, finance, people, scheduling, collaboration, and document modules. A field, label, preset, or draft-only automation is marked **Partial** unless the corresponding behavior is present. “Already present” refers to functionality outside the Growth workspace. “Blocked” means no current workflow or safe integration was found.

| # | Feature | Status | Evidence |
|---:|---|---|---|
| 1 | Customizable home dashboard | Implemented | `src/features/GrowthWorkspace.jsx:38-41,139`; dashboard card add/edit/remove UI. |
| 2 | Drag-and-drop dashboard cards | Implemented | `src/features/GrowthWorkspace.jsx:122-123,139`; dashboard cards use HTML drag/drop and save the reordered layout. |
| 3 | Saved dashboard layouts | Implemented | `src/features/GrowthWorkspace.jsx:52-57,98-100`; layouts persist in encrypted `dashboard` records. |
| 4 | Multiple dashboard workspaces | Implemented | `src/features/GrowthWorkspace.jsx:42,53,98-100,282-287`; named dashboard workspaces have account-scoped, independently saved card layouts. Work records remain shared under their existing permissions. |
| 5 | Dashboard layout presets | Implemented | `src/features/GrowthWorkspace.jsx:139`; Executive, Sales, Operations, and Blank layout choices. |
| 6 | Per-user dashboard views | Implemented | `src/features/GrowthWorkspace.jsx:44,55,98-100`; card order and named workspace presets are keyed by the signed-in account. |
| 7 | KPI goal markers | Implemented | `src/features/GrowthWorkspace.jsx:320`; numeric goals render a clamped progress marker and accessible label when the card value is numeric. |
| 8 | Period-over-period comparisons | Implemented | `src/features/GrowthWorkspace.jsx:5,24,320`; cards accept a current value, prior-period value, and comparison period, then display the signed change. |
| 9 | Dashboard filters | Implemented | `src/features/GrowthWorkspace.jsx:99-107,320`; a card's status filter is applied to the underlying task, project, or opportunity metric rows. |
| 10 | Dashboard search | Implemented | `src/features/GrowthWorkspace.jsx:45,68-71,139`; query narrows visible cards on the dashboard and searchable record fields in other areas. |
| 11 | Pinned reports | Blocked | `src/features/ControlCenter.jsx:131-138,161` can pin search results/records; no report-pinning workflow found. |
| 12 | Recently viewed items | Blocked | No recent-view tracking found in `src/features/GrowthWorkspace.jsx` or `src/App.jsx`. |
| 13 | Favorite pages | Blocked | `src/features/GrowthWorkspace.jsx:140` favorites records, not navigation pages. |
| 14 | Quick-action menu | Already present | `src/App.jsx:188-218,525-530,690-722`; command-center quick commands and operations drawer. |
| 15 | Keyboard shortcut editor | Blocked | No shortcut configuration or key-binding editor found in `src/App.jsx`. |
| 16 | Command palette | Already present | `src/App.jsx:188-218,525-530,678-722`; searchable command center. |
| 17 | Contextual help panels | Implemented | `src/features/GrowthWorkspace.jsx:27-31,316-317`; the help toggle presents area-specific dashboard, task, and project guidance. |
| 18 | Collapsible navigation groups | Blocked | `src/App.jsx:39-73,484-507`; navigation is a flat section list, with no group-collapse controls. |
| 19 | Custom navigation labels | Blocked | No per-user or workspace navigation-label setting found in `src/App.jsx`. |
| 20 | Dashboard data freshness indicator | Implemented | `src/features/GrowthWorkspace.jsx:66-68,321`; successful record load stores and displays the refresh time on the dashboard. |
| 21 | Reusable task templates | Implemented | `src/features/GrowthWorkspace.jsx:151-155,355`; tasks can be saved as reusable encrypted records and applied to a new draft. |
| 22 | Recurring tasks | Implemented | `src/features/GrowthWorkspace.jsx:190-201,333`; a weekly, monthly, quarterly, or yearly rule can generate the next dated task on demand. Generation is user-triggered. |
| 23 | Task dependencies | Implemented | `src/features/GrowthWorkspace.jsx:111-114,329`; task dependencies resolve to an existing task and block completion until it is complete. |
| 24 | Subtasks | Blocked | No parent/child task model or nested task UI found in `src/features/GrowthWorkspace.jsx` or `src/App.jsx`. |
| 25 | Kanban task board | Implemented | `src/features/GrowthWorkspace.jsx:140-141`; Board view groups tasks into status columns and drag/drop updates status. |
| 26 | Task priority levels | Implemented | `src/features/GrowthWorkspace.jsx:7,23,289`; priority uses a validated Low, Normal, High, or Urgent selector. |
| 27 | Custom task statuses | Implemented | `src/features/GrowthWorkspace.jsx:66-71,125-132,140-141`; statuses are collected from records and can be used as board columns. |
| 28 | Task labels | Implemented | `src/features/GrowthWorkspace.jsx:86-90,309`; comma-separated labels can be selected in the task label filter. |
| 29 | Task watchers | Implemented | `src/features/GrowthWorkspace.jsx:164-170,197-202,399`; comma-separated watcher account emails receive persisted local inbox entries, which can be marked read. No external delivery is used. |
| 30 | Task due-date reminders | Implemented | `src/features/GrowthWorkspace.jsx:60-83,286-292,398`; opening Tasks evaluates due tasks, adds a once-per-task/date reminder to the local inbox, and allows dismissal. Evaluation requires OverHead to be open. |
| 31 | Bulk task editing | Blocked | Task records expose per-record edit/delete actions in `src/features/GrowthWorkspace.jsx:140-151`; no multi-select/bulk operation exists. |
| 32 | Task assignment rules | Implemented | `src/features/GrowthWorkspace.jsx:120-124,223-231,324`; saved priority/project/customer rules assign new matching tasks to the first matching assignee. |
| 33 | Task workload estimates | Implemented | `src/features/PeopleOperationsWorkspace.jsx:12-24,38-41` totals delegated task estimates against team capacity. Growth task `estimate` is only a field. |
| 34 | Task time tracking | Already present | `src/features/SchedulingWorkspace.jsx:64-69` records approved hours and billable time; entries are not attached to Growth task records. |
| 35 | Task checklists | Implemented | `src/features/GrowthWorkspace.jsx:118,160-164,333`; checklist lines persist as individually checkable task items. |
| 36 | Task approval steps | Implemented | `src/features/GrowthWorkspace.jsx:119,237-245,333`; newline-separated account emails form an ordered approval chain, and only the current account can approve or reject its step. |
| 37 | Task escalation rules | Implemented | `src/features/GrowthWorkspace.jsx:60-83,285-287`; configured overdue thresholds are evaluated on opening Tasks, matching tasks are escalated and a local inbox notice is created. Evaluation requires OverHead to be open. |
| 38 | Task history timeline | Blocked | `src/features/GrowthWorkspace.jsx:140` offers a Timeline view option but renders the same list unless Board is selected; no task event timeline found. |
| 39 | Task links to customers | Implemented | `src/features/GrowthWorkspace.jsx:288-290`; task customer selector resolves an existing customer and persists its ID and display name. |
| 40 | Task links to projects | Implemented | `src/features/GrowthWorkspace.jsx:291-292`; task project selector stores the project ID/title and task cards display the relationship. |
| 41 | Project templates | Implemented | `src/features/GrowthWorkspace.jsx:151-155,355`; project records can be saved and reused as templates. |
| 42 | Project milestones | Implemented | `src/features/GrowthWorkspace.jsx:117,163-168,333`; project milestone lines become persistent checkable items. |
| 43 | Project health scores | Implemented | `src/features/GrowthWorkspace.jsx:128-130`; save computes health from status, overdue dates, and risk severity. |
| 44 | Project budget tracking | Implemented | `src/features/GrowthWorkspace.jsx:128-130,335`; budget and manually entered actual cost are shown with variance. |
| 45 | Project capacity planning | Implemented | `src/features/GrowthWorkspace.jsx:335`; portfolio view compares project capacity hours with estimates on linked tasks. |
| 46 | Project risk register | Implemented | `src/features/GrowthWorkspace.jsx:96,176-185,333`; risks have owner, severity, open/mitigated status, and project association. |
| 47 | Project decision log | Implemented | `src/features/GrowthWorkspace.jsx:142-145,333`; changes to a project's decision create dated, owner-attributed history records. |
| 48 | Project status reports | Implemented | `src/features/GrowthWorkspace.jsx:97,189-212,335`; users can save local portfolio snapshots with project status, risks, budget, and actual-cost details. |
| 49 | Project dependency maps | Implemented | `src/features/GrowthWorkspace.jsx:294,333`; each project shows its prerequisite and projects that depend on it. |
| 50 | Project calendar view | Implemented | `src/features/GrowthWorkspace.jsx:335`; month view lists projects whose start or due dates fall in the selected month. |
| 51 | Project Gantt view | Blocked | No Gantt/timeline bar view found in `src/features/GrowthWorkspace.jsx` or `src/features/SchedulingWorkspace.jsx`. |
| 52 | Project portfolio dashboard | Implemented | `src/features/GrowthWorkspace.jsx:335`; portfolio summary aggregates project counts, at-risk projects, budget/actual totals, and estimated capacity. |
| 53 | Project intake forms | Implemented | `src/features/GrowthWorkspace.jsx:8,118,129,301`; project intake captures rationale and the Active gate requires it alongside owner and dates. |
| 54 | Project stage gates | Implemented | `src/features/GrowthWorkspace.jsx:111-114,129,278`; activating a project requires owner, dates, rationale, and a completed prerequisite. |
| 55 | Project change requests | Blocked | No project change-request record or review flow found in `src/features/GrowthWorkspace.jsx`. |
| 56 | Project retrospectives | Blocked | No retrospective workflow; an “Incident review” button in `src/features/GrowthWorkspace.jsx:143` only pre-fills a project title. |
| 57 | Project resource assignments | Implemented | `src/features/GrowthWorkspace.jsx:204-215,294`; project-linked resource bookings validate time ranges and reject overlapping bookings for the same resource. |
| 58 | Project cost forecasting | Blocked | `src/features/CustomerFinanceWorkspace.jsx:167` forecasts workspace cash flow, not project costs. Project budget is only a field in Growth. |
| 59 | Project document folders | Implemented | `src/features/GrowthWorkspace.jsx:247-280,422`; create, rename, and delete project folders, file indexed documents into them, and unfile documents when a folder is deleted. Source files remain in the document vault. |
| 60 | Project archive controls | Implemented | `src/features/GrowthWorkspace.jsx:198-202,333`; projects can be archived with a timestamp and restored to Planning; archived projects remain searchable. |
| 61 | Custom customer fields | Blocked | `src/features/GrowthWorkspace.jsx:9` has a fixed field list; no administrator-defined field schema. |
| 62 | Customer segments | Implemented | `src/features/CustomerManagementWorkspace.jsx:51,85-99,207-213` saves encrypted criteria (industry, status, minimum computed health) and shows matching local customers. |
| 63 | Customer health scoring | Implemented | `src/features/CustomerManagementWorkspace.jsx:22-33,85,213` calculates a visible 0–100 heuristic from overdue invoices, open tasks, recent task/invoice activity, and missing email; it is explicitly not predictive. |
| 64 | Customer interaction timeline | Blocked | `src/App.jsx:1471-1597` shows customer details/documents but no interaction event timeline. |
| 65 | Customer notes with mentions | Blocked | `src/features/GrowthWorkspace.jsx:9` has plain notes; `src/features/CollaborationWorkspace.jsx:6-29` supports mentions only on standalone internal messages. |
| 66 | Customer contact roles | Implemented | `src/features/CustomerManagementWorkspace.jsx:101-107,220` stores multiple structured contacts with role, email, and phone in the encrypted customer feature collection. |
| 67 | Duplicate customer detection | Implemented | `src/features/CustomerManagementWorkspace.jsx:73-82,231` groups exact normalized local name/email matches for staff review; no merge or mutation is performed. |
| 68 | Customer merge tool | Blocked | No merge/identity reconciliation workflow found in `src/App.jsx` or `electron-backend.cjs`. |
| 69 | Customer onboarding checklist | Implemented | `src/features/CustomerManagementWorkspace.jsx:6,64-65,221` creates a four-step customer checklist and persists completion state per customer. |
| 70 | Customer renewal tracking | Implemented | `src/features/CustomerManagementWorkspace.jsx:222` persists a customer renewal date and stage for staff review; no automatic reminder is sent. |
| 71 | Customer satisfaction surveys | Blocked | No survey creation, distribution, or response collection found in the customer workspace. |
| 72 | Customer feedback inbox | Implemented | `src/features/CustomerManagementWorkspace.jsx:116-146,232` imports validated product_feedback JSON (max 50 records, 4,000-character message bound, source deduplication) and provides local triage; there is no automatic cloud sync. |
| 73 | Customer relationship map | Blocked | No graph/relationship explorer found; contact roles remain unstructured text. |
| 74 | Customer portal access | Already present | `src/App.jsx:1523-1529` creates customer portal invitations; `electron-backend.cjs:698-735` handles invitation records. |
| 75 | Customer data export | Implemented | `src/features/CustomerManagementWorkspace.jsx:158-162,218` downloads a customer-scoped JSON export with the customer, local profile, linked feedback, tasks, and invoices. |
| 76 | Customer consent tracking | Implemented | `src/features/CustomerManagementWorkspace.jsx:223` records consent purpose, state, source/reference, and timestamp in the encrypted customer profile. |
| 77 | Customer communication preferences | Implemented | `src/features/CustomerManagementWorkspace.jsx:60,164-170,223,227` checks the per-customer channel and consent before creating a follow-up record and blocks prohibited contact; no customer email sender exists. |
| 78 | Customer lifecycle stages | Implemented | `src/features/GrowthWorkspace.jsx:13,66-71,130` offers lifecycle stages and persists manual stage changes through the board. |
| 79 | Customer risk flags | Implemented | `src/features/CustomerManagementWorkspace.jsx:148-156,224` saves customer-linked risk notes with severity and open/resolved state. |
| 80 | Customer account ownership rules | Implemented | `src/features/CustomerManagementWorkspace.jsx:174-197,225-226` saves industry/health rules with active-staff owners and applies them only on explicit action, preserving existing owners unless the override checkbox is selected. |
| 81 | Opportunity pipeline board | Implemented | `src/features/GrowthWorkspace.jsx:10,18,140-141`; sales records display as stage columns and move between stages. |
| 82 | Custom sales stages | Implemented | `src/features/GrowthWorkspace.jsx:18,66-71,130`; saved opportunity stages become columns and drag/drop changes the stage. |
| 83 | Opportunity probability weighting | Implemented | `src/features/SalesWorkspace.jsx:65,251,270` calculates and displays amount multiplied by probability for open deals. |
| 84 | Deal forecasting | Implemented | `src/features/SalesWorkspace.jsx:70-83,249-257` groups open deal amounts and probability-weighted totals by expected close month. |
| 85 | Quote generation | Already present | `src/App.jsx:1265-1276`; creates quotes; `src/App.jsx:198-202` can generate a quote PDF. |
| 86 | Quote approval workflow | Already present | `src/App.jsx:1969-2130` management approval requests; `electron-backend.cjs:1686-1705,1833-1873` quote and approval operations. |
| 87 | Product and service catalog | Blocked | Square import exposes catalog counts (`src/App.jsx:2771,2836`), but no editable catalog or product/service selection flow. |
| 88 | Discount approval limits | Blocked | Quote approval exists, but no numeric discount thresholds or limit enforcement were found in `src/App.jsx`/`electron-backend.cjs`. |
| 89 | Sales activity logging | Implemented | `src/features/SalesWorkspace.jsx:93-99,283` saves dated call, meeting, demo, proposal, follow-up, and internal-note records linked by opportunity ID. |
| 90 | Email-to-opportunity capture | Blocked | `src/features/CollaborationWorkspace.jsx:18-29` can save local messages; `:45-50` links email references manually, with no mail provider ingestion or opportunity relation. |
| 91 | Sales territory rules | Implemented | `src/features/SalesWorkspace.jsx:156-167,277` maps territory labels to default owners and applies rules manually to unassigned open deals; it does not enforce data visibility. |
| 92 | Lead scoring | Implemented | `src/features/SalesWorkspace.jsx:136-147,270` calculates a 0-100 score from explicit fit, need, budget, and timing ratings with documented weights. |
| 93 | Lead assignment rules | Implemented | `src/features/SalesWorkspace.jsx:169-185,278` stores active territory/source/minimum-score rules and applies the first matching rule on user action; permissions are unchanged. |
| 94 | Lead conversion tracking | Implemented | `src/features/SalesWorkspace.jsx:201-219,272,279` offers a reviewed Won-deal conversion, creates or matches a customer profile, links the opportunity, and saves a conversion event. |
| 95 | Lost-deal reason reports | Implemented | `src/features/SalesWorkspace.jsx:85-92,258-261` groups closed Lost opportunities by saved reason, including unspecified reasons. |
| 96 | Win-rate dashboards | Implemented | `src/features/SalesWorkspace.jsx:66-69,253` calculates Won / (Won + Lost) and shows closed deal counts. |
| 97 | Sales commission estimates | Implemented | `src/features/SalesWorkspace.jsx:55-58,149-154,259-270` saves a local 0-100% rate and calculates estimates from deal amount; estimates are labeled as planning values. |
| 98 | Renewal opportunity creation | Implemented | `src/features/SalesWorkspace.jsx:63,187-199,271` reads the customer-profile renewal date, resolves the core customer name when available, prevents duplicate open renewals, and creates a local opportunity. |
| 99 | Deal collaboration notes | Implemented | `src/features/SalesWorkspace.jsx:93-99,283` logs internal notes against an opportunity using its ID, alongside dated sales activities. |
| 100 | Sales playbook library | Implemented | `src/features/SalesWorkspace.jsx:221-239,288` manages editable playbook records and applies selected guidance to deal notes with an activity entry. |

This is a code audit, not proof that a feature has been exercised with populated workspace data. No source files were changed and no tests, builds, or smoke checks were run for this documentation task.
