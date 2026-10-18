# Local feature record API

Feature packs can persist workspace records through the encrypted OverHead data store without adding new Electron IPC handlers for each screen.

Renderer API (`window.overheadBackend`):

- `listFeatureRecords(collection)` returns the saved records for a collection.
- `upsertFeatureRecord({ collection, record })` creates or updates one record by its `id` and returns the saved record. On create, the backend supplies an ID, `created_at`, and `updated_at` when missing.
- `deleteFeatureRecord({ collection, recordId })` removes a matching record and returns `{ deleted: boolean }`.

Allowed collection names are `dashboard`, `tasks`, `projects`, `customers`, `sales`, `finance`, `people`, `scheduling`, `documents`, `communications`, `reporting`, `automation`, `integrations`, `search`, `security`, `account`, `accessibility`, `mobile`, `support`, and `ai_knowledge`.

Every method requires an active staff session. The backend enforces role access by collection: finance and reporting are Owner/Bookkeeper; people, integrations, security, and account are Owner; support is Owner/Support; ordinary operational collections follow the role map in `electron-backend.cjs`. A collection record is a JSON object with at most 100 fields and 64 KB serialized size. Each collection holds up to 1,000 records. The backend rejects reserved property names, persists through the encrypted local store, and writes an audit event without copying record contents into the audit log.

Use these calls for local workspace data and UI preferences only. Do not put provider secrets, passwords, payment credentials, or cloud tokens in generic feature records. Use the existing validated provider/account flows for external integrations. Each screen remains responsible for validating its domain-specific values before saving.
