# OverHead 0.3.18

OverHead 0.3.18 adds local workflow and account controls to the 400-feature wave. Owners can merge local customer duplicates with an encrypted pre-merge backup, schedule local report CSVs and full data exports, create recurring access-review tasks, configure role-based in-app security notices, and apply inactivity suspension to local-only staff accounts. Staff can request a project status change for Owner approval. Owners can also review and end sessions saved by the current local installation.

These controls run through the desktop scheduler while OverHead is open and the scheduling Owner or Bookkeeper is signed in. They do not provide email or push delivery, manage Firebase-linked account suspension, merge shared Firestore customer records, or revoke sessions on other devices. MFA, SSO, IP allowlists, recovery codes for Firebase accounts, and multi-workspace membership and ownership changes remain blocked on identity-provider, network, or Firestore membership work.

The feature audit now records **272 implemented**, **82 already present**, **9 partial**, and **37 blocked** items. See [the 400-item audit](feature-wave-400.md) and its linked range tables for evidence and prerequisites.

Verification: the Vite production build succeeded; Electron opened the compiled app and rendered the OverHead workspace. Oxlint completed with warnings in existing, unrelated files. The Windows installer and live deployment are tracked separately from the source build.
