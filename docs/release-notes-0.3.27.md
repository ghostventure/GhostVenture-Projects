# OverHead Cylinder 0.3.27

This release advances the Cylinder Server and Cylinder Workstation Client runtime while keeping the existing GUI appearance unchanged. Both variants use the shared hardened Electron main process and backend.

## Changes

- Restricts backend IPC to the canonical top-level application renderer and blocks untrusted navigation.
- Validates session IDs before locking a session and records rejected lock attempts.
- Writes local records, updater preferences, and recovery state using unique temporary files and atomic replacement to reduce partial-write and collision risk.
- Uses the shared bounded, fail-closed Windows edition detection for the Server and Client launchers.
- Keeps Server and Client data paths, application identities, update feeds, and edition roles separate. The Server remains for Windows Server/IoT hosts; the optional Client remains for Windows 10/11 workstations.

## Update and compatibility notes

Cylinder keeps its existing standalone `electron-updater` workflow. Its bounded startup check runs before the workspace window opens; it does not use the OverHead Install Manager flow. Server and Client packages must be built and released for these source changes to reach installed users.

The application uses synchronous Electron `safeStorage` APIs that are deprecated in Electron 45 and must be migrated before Electron 46 removes them. This release does not perform that migration.

The source upgrade does not establish signed-release status, publication, installation, or operation on every supported Windows Server, IoT, or workstation configuration. Confirm those separately for each built package and target environment.
