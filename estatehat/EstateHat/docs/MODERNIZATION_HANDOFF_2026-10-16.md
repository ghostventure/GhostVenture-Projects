# EstateHat modernization handoff

Updated: 2026-10-16

## Changes included

This update carries the current EstateHat app from the canonical Firebase checkout into the existing `estatehat/EstateHat` project subtree in the GitHub aggregator. The GitHub main revision used as the base did not yet include that subtree; the workspace's ahead commits and unrelated dirty changes were not included.

The application update includes these reliability and UX changes carried forward from the canonical checkout:

- Authentication callbacks use a monotonically increasing version so stale profile bootstrap completions cannot replace newer auth state.
- Profile initialization can rethrow persistence failures, allowing sign-in to show an actionable error instead of silently proceeding with an unsaved fallback profile.
- The authenticated shell offers a retry path after a profile bootstrap failure.
- Featured listing resolution uses explicit listing and submission IDs, avoiding fuzzy address/title matching that could feature the wrong property.
- Interactive shell controls have a visible keyboard focus ring.
- The account shell uses a guarded active-user profile bootstrap and does not render authenticated workspace state until profile initialization succeeds.

The mortgage page includes 26 independent editable estimates, including 13 added in this update: fixed-rate principal and interest, extra-payment payoff savings, discount-point break-even, monthly escrow reserve, down-payment scenarios, appreciation scenarios, gross-rent multiplier, debt service coverage, cash-on-cash return, break-even occupancy, rehab contingency, operating expense ratio, and investor cash required. The original tools cover cash to close, seller net, DTI, LTV, PMI, price per square foot, gross rent yield, cap rate, rental cash flow, refinance break-even, purchase budget, rent-versus-own costs, and equity. These use user-entered inputs and have deterministic formula tests.

The “Hat Data” suite now includes a working personal task board and saved-listing collections. Tasks support creation, full-field editing, buyer/seller/homeowner starter checklists with relative due dates and duplicate skipping, categories, priority, status transitions, combined search and filters, urgency ordering, due/overdue summaries, bulk completion and cleanup, calendar/CSV/JSON exports, and validated restore with overwrite confirmation. Listing collections support create/rename/delete, membership toggles, collection and listing search, price/title sorting, bulk inclusion/removal, CSV export, per-profile browser storage, and validated JSON backup/restore that drops listings no longer on the watchlist. Both local tools state that they do not sync or share user data.

Tour scheduling now rejects past and overlapping appointments using selected durations, preserves cancelled appointment history, supports text and status filtering, lets users reschedule saved appointments, exports non-cancelled visits as correctly timed `.ics` calendar events, and defaults to a future date.

The document upload queue now accepts drag/drop and file-picker input, validates supported image/PDF types, empty files and a 15 MB limit, detects duplicates, and lets users remove or clear queued files. It is explicitly a browser-session preflight: it does not upload or persist document contents.

The Document Vault now labels its file intake accurately: it validates PDF/image type, size, duplicates, and a 12-record cap, stores metadata under the active profile, supports record removal and metadata CSV export, and keeps local intake separate from provider-backed approval/readiness counts. No file bytes are saved or uploaded.

The personal task board now exports open due dates as calendar events, creates formula-safe CSV files for spreadsheets, and asks before replacing an existing task list during backup restore.

The financial tools now let users save, rename, delete, search, filter, and compare up to two calculation scenarios. JSON backup/restore is version checked and prompts before replacing existing scenarios; saved inputs stay in browser storage.

The contingency checklist is now tied to a selected property and scoped to the signed-in profile's browser storage. It includes core checklist items, custom entries, completion progress, open/done filters, and a property-checked JSON backup/restore. It clearly says checklist changes are personal notes and do not update transaction participants or certify legal conditions.

Offer drafts now use field validation for price, earnest money, financing, inspection days, and future closing dates; show earnest and asking-price comparisons; and support per-profile storage, search, status filtering, lifecycle changes, deletion, and validated JSON backup/restore. Saving or marking a draft ready does not transmit an offer. Tour appointments, offer drafts, and their notifications use account-keyed browser storage.

Saved listings now support per-profile target-price watches. The view compares each target with the current listing data available in the page, marks reached/unavailable targets, and supports search, filters, removal, and validated backup/restore limited to listings still on the watchlist. It does not claim background or push notifications.

Property comparison now saves named sets of two to four listing IDs per profile, applies a saved set when listings remain available, supports search/rename/delete, and validates backup/restore against current listing IDs.

The earnest-money tracker now records profile-scoped deposit planning notes by property, with entered amount/date/reference, planned/deposited/refunded labels, overdue and outstanding totals, filters, deletion, and CSV/JSON exports. It explicitly does not send, hold, or verify payments.

The in-app notification center now has account-scoped category preferences, unread counts, mark-all-read, and clear-read actions. Muting a category filters the center without changing its source records.

The Browser Data Manager reports byte estimates by local category, exports only an allowlist of the active profile's browser records, and supports confirmed category-specific deletion. It never exports auth tokens or deletes Firebase account/transaction data.

The feedback surface now prepares a structured report draft with category, severity, page path, details, and reproduction steps. Users can copy or download Markdown and clear the draft; it does not submit reports to a server.

**Incremental implementation count: 201 capabilities** (5 reliability/accessibility behaviors, 26 financial estimate tools, 11 scenario-management/account-scope capabilities, 23 task-board capabilities, 12 saved-listing collection capabilities, 9 comparison-set capabilities, 6 price-watch capabilities, 6 in-app notification capabilities, 9 tour-planning capabilities, 8 document-intake capabilities, 5 upload-queue capabilities, 10 property checklist capabilities, 10 earnest-money planning capabilities, 5 browser-data privacy capabilities, 7 feedback-draft capabilities, 12 offer/account-privacy capabilities, 6 collaborator-invitation draft capabilities, 17 home-maintenance planning capabilities, and 14 home-service log capabilities). The 200-entry inventory is an audit map of existing capabilities in the source being synchronized; it does not count toward the incremental total.

Collaborator invitation tools validate recipient addresses and a bounded role/scope, sanitize and limit message content, generate a copyable draft and email-app link, and make clear that no invitation was sent and no access granted. These are draft-only affordances; no invitation service or permission grant was added.

The home maintenance planner adds profile-scoped browser storage, validated task creation, due dates, category and priority selection, notes, completion and reopen tracking, search, status and category filters, overdue and seven-day summaries, due-date sorting, CSV export with spreadsheet formula protection, JSON backup/restore validation, delete and confirmed clear. No contractor service, alerts, or cloud persistence is implied.

The home service log adds profile-scoped browser storage, provider/date/cost validation, category and notes, text search, type and date-range filtering, newest-first ordering, filtered count/total/average/latest-date summaries, CSV export with spreadsheet formula protection, validated JSON restore, delete and confirmed clear. Provider credentials, invoices, and warranty claims are not verified.

The release also includes a 200-entry source-backed capability inventory at `IMPLEMENTED_FEATURE_INVENTORY_2026-10-16.md`. It maps capabilities in the application source being synchronized. The 201 incremental capabilities listed above are separate from this source inventory.

## Validation evidence

- `npm ci` completed in the isolated project copy. npm reported 43 dependency audit findings (6 moderate, 29 high, 8 critical); no automatic dependency upgrade was applied.
- Final `npm test`: 125 tests passed, 0 failed.
- Final `npm run build`: successful; 19 routes prerendered. Next skipped optimizing Google Fonts because the build could not download the stylesheet; this did not fail the build.
- Windows ZIP hashes match the checked-in checksum manifest: installer `a7c966eda2e34e85828fa88d519b6c7f4c70365f59ad0a5d8a44ef8940997a02`, desktop `e2d61a2470062fa61abc243d9c6c8772bfb033b23f5e013c17f0d0dc5be996fb`. Both ZIPs remain excluded from Git. Release owner should compare these against the current live files before publishing; this agent did not deploy.

## Deployment boundary

The Firebase target is the existing `estatehat` project (project number `1024417395762`) and Hosting site `estatehat.web.app`, under the previously inspected Firebase CLI account `solidartentertainment@gmail.com`. This implementation handoff does not deploy or push. Release owner should target Hosting only; Functions, Firestore rules, and Storage rules were not changed.

## Limits

- Authenticated account and transaction flows were not smoke-tested against a signed-in user.
- No Windows installer launch test was performed in this handoff.
- npm audit findings remain for a separate dependency remediation pass; forced upgrades could break the existing Next/Capacitor/Electron matrix and were not applied here.
- The capability inventory records shipped code paths; it is not a legal/compliance certification or a claim that third-party provider workflows have been live-verified.
