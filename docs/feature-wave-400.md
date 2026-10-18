# OverHead 0.3.18 feature wave: 400 requested items

This release branch turns the 400-item inventory into role-aware workspace areas plus additions to the existing dashboard, reports, support, settings, and account screens. Each 100-item audit records whether an item is implemented, already existed in OverHead, partial, or blocked by a concrete product or external prerequisite.

The per-range audit tables are [items 1–100](feature-wave-001-100.md), [101–200](feature-wave-101-200.md), [201–300](feature-wave-201-300.md), and [301–400](feature-wave-301-400.md). A listed item is not described as complete unless its audit row says **Implemented** or **Already present**.

| Range | Implemented | Already present | Partial | Blocked |
|---|---:|---:|---:|---:|
| 1–100 | 92 | 6 | 1 | 0 |
| 101–200 | 84 | 11 | 0 | 5 |
| 201–300 | 37 | 36 | 8 | 19 |
| 301–400 | 58 | 29 | 0 | 13 |
| **Total** | **272** | **82** | **9** | **37** |

## Workspace areas

- **Growth & Work**: per-account dashboard presets, interactive task workflows, project planning and portfolio controls, and customer and opportunity boards backed by the encrypted local feature-record API.
- **Sales Studio and Customer Management**: weighted forecasts, lead scoring and conversion, reusable playbooks, customer segments and health, consent, feedback intake, ownership rules, and scoped export.
- **Finance, People, Scheduling, Documents, Team & Comms**: role-gated local workspaces for finance operations, staff planning, scheduling, document review, and collaboration records.
- **Reports**: local report filters, annotations, metrics, trend summaries, print/PDF and CSV export, and report access history.
- **Rule Builder**: reviewable trigger and action rules with a local execution boundary; external delivery or providers remain separately configured.
- **Integrations**: connection status, validated customer CSV import with duplicate handling, accounting-shaped CSV export, and saved mappings. Provider credentials are never stored in generic feature records.
- **Search**: role-scoped search over encrypted feature collections, personal/shared saved views, recent searches, tags, pinning, and CSV results.
- **Field & Assist**: offline field notes/checklists, consent-based audio recording saved by the user, planned team utilization, and opt-in deterministic suggestions. No hosted AI provider is called.
- **Support, Settings, Accounts, and Admin Security**: support triage, access preferences, seat utilization, local review notes, and closure checklists.

## Storage and access boundaries

The Electron bridge exposes `listFeatureRecords`, `upsertFeatureRecord`, and `deleteFeatureRecord`. The main process checks an active staff session and the per-collection role map, validates record size and shape, persists through OverHead’s encrypted local store, and audits writes without copying record contents into the audit log. Collections are limited to 1,000 records; each record is limited to 100 top-level fields and 64 KB serialized size.

Generic feature records are for local workspace data and preferences. They must not contain provider secrets, passwords, payment credentials, or cloud tokens. Screens which require an external action use the established, validated connection flows or state the missing setup requirement. Items relying on public APIs, webhooks, push notifications, mail delivery, OAuth grants, or native permissions remain blocked until those services and credentials are intentionally configured.

## Developer build and release

From the repository root, use `npm ci`, `npm run build`, then `npm run dist:win` to create the Windows installer. `npm run build` is the compile gate. Run packaged smoke checks only after that build succeeds. Verify the installer and portable ZIP, release checksums, the website installer/download routes, `latest.yml`, and the public guide before claiming a release is complete.

The 400-item inventory now records 272 implemented features, 82 already-present features, 9 partial features, and 37 blocked features. Partial items have working local behavior with a clearly stated limit, such as cross-device identity enforcement or external notification delivery. The remaining blockers are documented with their concrete prerequisites: Firebase membership/identity transactions, hosted payment/calendar/file/signature integrations, authenticated webhook services, or native iOS capabilities and platform build infrastructure. OverHead 0.3.18 compiled and packaged successfully; the packaged executable launched, and the live installer, portable ZIP, update feed, checksums, download redirect, and refreshed user guide were verified on 2026-10-18.
