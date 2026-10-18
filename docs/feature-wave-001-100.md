# Feature wave 001–100 audit

Audited against the current main checkout, including `src/features/GrowthWorkspace.jsx` and the existing desktop, finance, people, scheduling, collaboration, and document modules. A field, label, preset, or draft-only automation is marked **Partial** unless the corresponding behavior is present. “Already present” refers to functionality outside the Growth workspace. “Blocked” means no current workflow or safe integration was found.

| # | Feature | Status | Evidence |
|---:|---|---|---|
| 1 | Customizable home dashboard | Implemented | `src/features/GrowthWorkspace.jsx:38-41,139`; dashboard card add/edit/remove UI. |
| 2 | Drag-and-drop dashboard cards | Implemented | `src/features/GrowthWorkspace.jsx:122-123,139`; dashboard cards use HTML drag/drop and save the reordered layout. |
| 3 | Saved dashboard layouts | Implemented | `src/features/GrowthWorkspace.jsx:52-57,98-100`; layouts persist in encrypted `dashboard` records. |
| 4 | Multiple dashboard workspaces | Partial | `src/features/GrowthWorkspace.jsx:42,53,89-95`; named presets switch saved layouts, but do not isolate records into separate workspaces. |
| 5 | Dashboard layout presets | Implemented | `src/features/GrowthWorkspace.jsx:139`; Executive, Sales, Operations, and Blank layout choices. |
| 6 | Per-user dashboard views | Partial | `src/features/GrowthWorkspace.jsx:44,55,98-100` keys Growth layouts by account email; the older `src/App.jsx:1050-1057,1121` overview widget selection is device-local and not account-scoped. |
| 7 | KPI goal markers | Partial | `src/features/GrowthWorkspace.jsx:5,139`; KPI goal is stored and displayed as text, without progress/threshold marker behavior. |
| 8 | Period-over-period comparisons | Partial | `src/features/GrowthWorkspace.jsx:5,24`; comparison period is only a saved KPI field; no period values are computed. |
| 9 | Dashboard filters | Partial | `src/features/GrowthWorkspace.jsx:68-71,140`; status filtering exists on record areas, but dashboard cards do not filter their underlying data. |
| 10 | Dashboard search | Implemented | `src/features/GrowthWorkspace.jsx:45,68-71,139`; query narrows visible cards on the dashboard and searchable record fields in other areas. |
| 11 | Pinned reports | Blocked | `src/features/ControlCenter.jsx:131-138,161` can pin search results/records; no report-pinning workflow found. |
| 12 | Recently viewed items | Blocked | No recent-view tracking found in `src/features/GrowthWorkspace.jsx` or `src/App.jsx`. |
| 13 | Favorite pages | Blocked | `src/features/GrowthWorkspace.jsx:140` favorites records, not navigation pages. |
| 14 | Quick-action menu | Already present | `src/App.jsx:188-218,525-530,690-722`; command-center quick commands and operations drawer. |
| 15 | Keyboard shortcut editor | Blocked | No shortcut configuration or key-binding editor found in `src/App.jsx`. |
| 16 | Command palette | Already present | `src/App.jsx:188-218,525-530,678-722`; searchable command center. |
| 17 | Contextual help panels | Partial | `src/features/GrowthWorkspace.jsx:136` has “How it works”; `src/App.jsx:776-800` feature rail is section-level rather than contextual to individual records. |
| 18 | Collapsible navigation groups | Blocked | `src/App.jsx:39-73,484-507`; navigation is a flat section list, with no group-collapse controls. |
| 19 | Custom navigation labels | Blocked | No per-user or workspace navigation-label setting found in `src/App.jsx`. |
| 20 | Dashboard data freshness indicator | Partial | `src/App.jsx:1110-1188` shows local health and record counts; sync timestamps/status are shown elsewhere, not as a dashboard freshness indicator. |
| 21 | Reusable task templates | Partial | `src/features/GrowthWorkspace.jsx:143` buttons prefill task drafts; templates are not separately managed/versioned records. |
| 22 | Recurring tasks | Partial | `src/features/GrowthWorkspace.jsx:7,23` stores a free-text repeat rule; no recurring-task generation engine found. Recurring invoices are separately supported in `src/features/CustomerFinanceWorkspace.jsx:156-158`. |
| 23 | Task dependencies | Partial | `src/features/GrowthWorkspace.jsx:7,23` stores `depends_on` as a field, without dependency validation or scheduling behavior. |
| 24 | Subtasks | Blocked | No parent/child task model or nested task UI found in `src/features/GrowthWorkspace.jsx` or `src/App.jsx`. |
| 25 | Kanban task board | Implemented | `src/features/GrowthWorkspace.jsx:140-141`; Board view groups tasks into status columns and drag/drop updates status. |
| 26 | Task priority levels | Partial | `src/features/GrowthWorkspace.jsx:7,23,151`; priority is a free-text field/display, not a validated priority scale with behavior. |
| 27 | Custom task statuses | Implemented | `src/features/GrowthWorkspace.jsx:66-71,125-132,140-141`; statuses are collected from records and can be used as board columns. |
| 28 | Task labels | Partial | `src/features/GrowthWorkspace.jsx:7,23`; labels are stored as text without label management or label-based filtering. |
| 29 | Task watchers | Partial | `src/features/GrowthWorkspace.jsx:7,23`; watcher values are text fields, with no notification/subscription behavior. |
| 30 | Task due-date reminders | Partial | `src/features/GrowthWorkspace.jsx:7,23` stores due dates; `src/App.jsx:1896-1916` queues reminders manually, not automatically from each task’s due date. |
| 31 | Bulk task editing | Blocked | Task records expose per-record edit/delete actions in `src/features/GrowthWorkspace.jsx:140-151`; no multi-select/bulk operation exists. |
| 32 | Task assignment rules | Partial | Assignment is a record field (`src/features/GrowthWorkspace.jsx:7,23`); `src/features/ControlCenter.jsx:17-20,127-130` saves automation drafts but explicitly does not execute them. |
| 33 | Task workload estimates | Implemented | `src/features/PeopleOperationsWorkspace.jsx:12-24,38-41` totals delegated task estimates against team capacity. Growth task `estimate` is only a field. |
| 34 | Task time tracking | Already present | `src/features/SchedulingWorkspace.jsx:64-69` records approved hours and billable time; entries are not attached to Growth task records. |
| 35 | Task checklists | Partial | `src/features/GrowthWorkspace.jsx:7,23,145` stores checklist text; no interactive checklist-item completion state. |
| 36 | Task approval steps | Partial | `src/App.jsx:1969-2130` has separate management approvals; no approval-step chain is attached to task records. |
| 37 | Task escalation rules | Partial | `src/features/ControlCenter.jsx:15-20,104-121` includes a deadline-escalation recipe/draft; rules only save/toggle local status and do not execute automatically. |
| 38 | Task history timeline | Blocked | `src/features/GrowthWorkspace.jsx:140` offers a Timeline view option but renders the same list unless Board is selected; no task event timeline found. |
| 39 | Task links to customers | Partial | `src/features/GrowthWorkspace.jsx:7,23` keeps a customer text reference; core backend task records can carry `customer_id` (`electron-backend.cjs:1684,2471-2482`), but Growth links do not resolve to customer records. |
| 40 | Task links to projects | Partial | `src/features/GrowthWorkspace.jsx:7,23` stores a project text reference; no relationship navigation/validation in Growth. |
| 41 | Project templates | Partial | `src/features/GrowthWorkspace.jsx:143` prefills named project drafts; templates are static buttons, not reusable project template records. |
| 42 | Project milestones | Partial | `src/features/GrowthWorkspace.jsx:8,24` stores a free-text milestone value, without milestone records or completion tracking. |
| 43 | Project health scores | Partial | `src/features/GrowthWorkspace.jsx:8,24` accepts a manually entered health value; no computed score. |
| 44 | Project budget tracking | Partial | `src/features/GrowthWorkspace.jsx:8,24` stores a project budget value; finance records are not linked for actual-vs-budget project reporting. |
| 45 | Project capacity planning | Partial | `src/features/GrowthWorkspace.jsx:8,24` has a capacity field; `src/features/PeopleOperationsWorkspace.jsx:12-24,38-41` calculates team workload, but not project/resource capacity. |
| 46 | Project risk register | Partial | `src/features/GrowthWorkspace.jsx:8,24` has a free-text risk field, not a register with owner/severity/review actions. |
| 47 | Project decision log | Partial | `src/features/GrowthWorkspace.jsx:8,24` has a decision text field; `src/features/SchedulingWorkspace.jsx:74-77` captures meeting actions, without a project decision history. |
| 48 | Project status reports | Partial | `src/App.jsx:1060-1107` creates activity reports; no project-specific report generation is present. |
| 49 | Project dependency maps | Partial | `src/features/GrowthWorkspace.jsx:8,24` has a dependency field, but no dependency graph/map. |
| 50 | Project calendar view | Partial | `src/features/SchedulingWorkspace.jsx:8-20,50-55` calendar supports meetings/events with optional project text references; project dates are not rendered as project calendar items. |
| 51 | Project Gantt view | Blocked | No Gantt/timeline bar view found in `src/features/GrowthWorkspace.jsx` or `src/features/SchedulingWorkspace.jsx`. |
| 52 | Project portfolio dashboard | Partial | `src/features/GrowthWorkspace.jsx:14,139` includes a Project health card label/preset; it does not aggregate project health or portfolio risk. |
| 53 | Project intake forms | Partial | `src/features/GrowthWorkspace.jsx:8,145` provides a generic project record form; no distinct intake workflow or review routing. |
| 54 | Project stage gates | Partial | `src/features/GrowthWorkspace.jsx:8,66-71,125-132` supports manual project stage/status changes; no gated checks/approvals. |
| 55 | Project change requests | Blocked | No project change-request record or review flow found in `src/features/GrowthWorkspace.jsx`. |
| 56 | Project retrospectives | Blocked | No retrospective workflow; an “Incident review” button in `src/features/GrowthWorkspace.jsx:143` only pre-fills a project title. |
| 57 | Project resource assignments | Partial | `src/features/GrowthWorkspace.jsx:8,24` stores resource text; `src/features/SchedulingWorkspace.jsx:60-63` separately books resources without project assignment. |
| 58 | Project cost forecasting | Blocked | `src/features/CustomerFinanceWorkspace.jsx:167` forecasts workspace cash flow, not project costs. Project budget is only a field in Growth. |
| 59 | Project document folders | Partial | `src/features/DocumentControlWorkspace.jsx:56-61` indexes customer files with a project reference; no hierarchical project folder structure. |
| 60 | Project archive controls | Partial | `src/features/SchedulingWorkspace.jsx:77` includes an “Archived” project status; it changes a status value only and provides no archive/restore controls. |
| 61 | Custom customer fields | Blocked | `src/features/GrowthWorkspace.jsx:9` has a fixed field list; no administrator-defined field schema. |
| 62 | Customer segments | Partial | `src/features/GrowthWorkspace.jsx:9,25` stores a free-text segment; no segment builder or segment-based actions. |
| 63 | Customer health scoring | Partial | `src/features/GrowthWorkspace.jsx:9,25` stores a manually entered health value; no calculation from customer activity. |
| 64 | Customer interaction timeline | Blocked | `src/App.jsx:1471-1597` shows customer details/documents but no interaction event timeline. |
| 65 | Customer notes with mentions | Blocked | `src/features/GrowthWorkspace.jsx:9` has plain notes; `src/features/CollaborationWorkspace.jsx:6-29` supports mentions only on standalone internal messages. |
| 66 | Customer contact roles | Partial | `src/features/GrowthWorkspace.jsx:9,25` stores contacts as free text; core customer records have a primary owner/email rather than structured contact roles. |
| 67 | Duplicate customer detection | Partial | `electron-backend.cjs:2125-2127` skips previously imported external IDs; `createCustomer` at `:2415-2461` does not detect matching local name/email duplicates. |
| 68 | Customer merge tool | Blocked | No merge/identity reconciliation workflow found in `src/App.jsx` or `electron-backend.cjs`. |
| 69 | Customer onboarding checklist | Partial | `electron-backend.cjs:2415-2485` queues a customer workflow-setup task; `src/features/GrowthWorkspace.jsx:143` has a “New customer” draft preset, not a completion checklist. |
| 70 | Customer renewal tracking | Partial | `src/features/GrowthWorkspace.jsx:9,25` has renewal date/stage fields and a Renewal template; no scheduled reminder or renewal opportunity automation. |
| 71 | Customer satisfaction surveys | Blocked | No survey creation, distribution, or response collection found in the customer workspace. |
| 72 | Customer feedback inbox | Partial | `website-next/app/feedback/feedback-form.jsx` accepts product feedback; no in-app customer feedback inbox or record queue. |
| 73 | Customer relationship map | Blocked | No graph/relationship explorer found; contact roles remain unstructured text. |
| 74 | Customer portal access | Already present | `src/App.jsx:1523-1529` creates customer portal invitations; `electron-backend.cjs:698-735` handles invitation records. |
| 75 | Customer data export | Partial | `electron-backend.cjs:2575` exports workspace data; no per-customer scoped export flow was found. |
| 76 | Customer consent tracking | Partial | `src/features/GrowthWorkspace.jsx:9` has a consent text field; no dedicated consent source/date/version audit workflow. |
| 77 | Customer communication preferences | Partial | `src/App.jsx:1489-1513` stores a preferred contact method, and Growth has a preferences text field; no channel opt-out enforcement. |
| 78 | Customer lifecycle stages | Implemented | `src/features/GrowthWorkspace.jsx:13,66-71,130` offers lifecycle stages and persists manual stage changes through the board. |
| 79 | Customer risk flags | Partial | `src/features/GrowthWorkspace.jsx:9,25` stores a risk note; no customer-linked risk flag lifecycle or severity logic. |
| 80 | Customer account ownership rules | Partial | `src/features/GrowthWorkspace.jsx:9,25` stores an owner name; assignment rules or ownership enforcement are absent. |
| 81 | Opportunity pipeline board | Implemented | `src/features/GrowthWorkspace.jsx:10,18,140-141`; sales records display as stage columns and move between stages. |
| 82 | Custom sales stages | Implemented | `src/features/GrowthWorkspace.jsx:18,66-71,130`; saved opportunity stages become columns and drag/drop changes the stage. |
| 83 | Opportunity probability weighting | Partial | `src/features/GrowthWorkspace.jsx:10,25` stores a probability percentage; no weighted pipeline amount is calculated. |
| 84 | Deal forecasting | Partial | `src/features/GrowthWorkspace.jsx:10` stores deal amount/probability/close date, but no deal forecast; `src/features/CustomerFinanceWorkspace.jsx:167` is invoice/expense cash-flow planning instead. |
| 85 | Quote generation | Already present | `src/App.jsx:1265-1276`; creates quotes; `src/App.jsx:198-202` can generate a quote PDF. |
| 86 | Quote approval workflow | Already present | `src/App.jsx:1969-2130` management approval requests; `electron-backend.cjs:1686-1705,1833-1873` quote and approval operations. |
| 87 | Product and service catalog | Blocked | Square import exposes catalog counts (`src/App.jsx:2771,2836`), but no editable catalog or product/service selection flow. |
| 88 | Discount approval limits | Blocked | Quote approval exists, but no numeric discount thresholds or limit enforcement were found in `src/App.jsx`/`electron-backend.cjs`. |
| 89 | Sales activity logging | Partial | `electron-backend.cjs:1686-1705` audits quote creation, but no opportunity-linked sales activity log/timeline. |
| 90 | Email-to-opportunity capture | Blocked | `src/features/CollaborationWorkspace.jsx:18-29` can save local messages; `:45-50` links email references manually, with no mail provider ingestion or opportunity relation. |
| 91 | Sales territory rules | Partial | `src/features/GrowthWorkspace.jsx:10,25` stores territory text only; no assignment or visibility rules. |
| 92 | Lead scoring | Partial | `src/features/GrowthWorkspace.jsx:10,25` stores a lead-score value; no score calculation. |
| 93 | Lead assignment rules | Partial | `src/features/GrowthWorkspace.jsx:10,25` stores an owner; `src/features/ControlCenter.jsx:17-20,127-130` only saves non-executing automation rules. |
| 94 | Lead conversion tracking | Partial | `src/features/GrowthWorkspace.jsx:18,66-71` stages records through Won/Lost; no conversion event or linked customer creation tracking. |
| 95 | Lost-deal reason reports | Partial | `src/features/GrowthWorkspace.jsx:10,25` stores `lost_reason`; no lost-reason report/aggregation. |
| 96 | Win-rate dashboards | Partial | `src/features/GrowthWorkspace.jsx:139` offers a “Win rate” layout label, but dashboard values are only calculated for Open tasks and Pipeline; other KPI values require manual entry. |
| 97 | Sales commission estimates | Partial | `src/features/GrowthWorkspace.jsx:10,25` stores commission estimate text; no commission formula or report. |
| 98 | Renewal opportunity creation | Partial | `src/features/GrowthWorkspace.jsx:143` has a Renewal lead template and customers have renewal fields; no automatic opportunity creation. |
| 99 | Deal collaboration notes | Partial | `src/features/GrowthWorkspace.jsx:10` stores opportunity notes; `src/features/CollaborationWorkspace.jsx:6-29` stores local team messages but cannot attach them to an opportunity record. |
| 100 | Sales playbook library | Partial | `src/features/GrowthWorkspace.jsx:143` provides generic New lead/Proposal/Renewal presets and `src/boilerplates.js` has workflow boilerplates; no dedicated sales playbook library. |

This is a code audit, not proof that a feature has been exercised with populated workspace data. No source files were changed and no tests, builds, or smoke checks were run for this documentation task.
