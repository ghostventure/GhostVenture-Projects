# OverHead 0.3.26

This update improves the desktop runtime, startup reliability, session handling, local persistence, and update checks. The visible GUI stays the same.

## Changes

- Upgrade the Windows x64 desktop runtime to Electron 45.2.1 and electron-builder 26.18.1. Update MSAL Node, Nodemailer, Vite, and Zod to current compatible releases.
- Restrict privileged IPC calls to the main renderer frame loaded from the app's canonical local entry point. Block other navigation and keep approved external links in the system browser.
- Validate that a session-lock request refers to the active session, record the actor in the audit trail, and only clear active session state after persistence succeeds.
- Write backend snapshots, update preferences, and recovery state through unique temporary files in the destination directory, then rename into place. Backend snapshots retain the existing backup and migration behavior.
- Open the Desktop window before beginning the startup update check. Coalesce simultaneous GitHub release checks, cache successful metadata briefly, and ignore malformed release version tags.
- Keep the existing Windows x64, edition compatibility gates, Manager-led update handoff, and account self-service flows.
- Preserve existing visible layout and styling. Nonvisual interaction safeguards remain, including duplicate-submit protection, stale username-request suppression, and accessibility semantics.

## Compatibility and verification

- The production dependency audit reports no advisories. The full development dependency tree still has moderate advisories in build-tool dependencies; the available automated fix would require a breaking downgrade, so it was not applied.
- Electron 45 still supports the synchronous `safeStorage` calls used by OverHead, but those calls must be migrated to the asynchronous API before Electron 46.
- Local Windows x64 packaging succeeds. This source/build result does not establish publisher signing or a public release.
