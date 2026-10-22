# Cylinder ranks and centralized management

**Status: Source, Firebase function, and Firestore rules are deployed; the updated signed Cylinder installer is not published yet.** This four Rank hierarchy belongs to OverHead Cylinder, which is intended to manage a department's employees and installations. It does not change regular OverHead Desktop, which retains its per-user account and role behavior and has no GPO controls.

## Tenant and department scope

The Firebase workspace is the tenant boundary. A workspace contains departments; each Cylinder employee and enrolled installation has one or more department assignments. Management actions and device use are restricted to overlapping assigned departments. Rank 4 is workspace-wide. Department assignments do not currently filter local operational records or customer files, and this feature does not synchronize those files across machines. The current UI supports the job functions Support, Front Desk, and Bookkeeper; they do not grant rank or department authority.

## Ranks

| Rank | Name | Authority in Cylinder |
| --- | --- | --- |
| 1 | Regular User | Use Cylinder as permitted by job function, membership, and enrolled device policy. Cannot manage employees, departments, devices, or workspace policy. |
| 2 | Management | Manage Rank 1 employees assigned to overlapping departments: invite, change job function or department assignment, suspend, reactivate, and remove. Cannot manage Rank 2 or higher, or control devices or workspace policy. |
| 3 | Administrator | Manage lower-ranked employees and devices within assigned departments; approve, block, or retire devices; view audit events for their scope. Cannot manage Rank 3/4 employees, change workspace policy, or affect other departments. |
| 4 | Owner | Workspace-wide control of employee ranks/status, departments, devices, workspace version/offline/pause policy, and audit. Bootstrapped only when the verified account UID matches both workspace ID and trusted `owner_uid`. |

No actor can assign or manage a rank equal to or higher than their own. Rank 4 ownership transfer and recovery are not implemented; protect the verified Owner account and enroll a second Owner installation for recovery. A workspace pause blocks employee Ranks 1–3; the Owner retains access to recover the workspace.

## Enrollment and invitations

The first Owner installation is allowed to bootstrap management. Further Owner installations and all employee installations start Pending until Rank 3 or 4 allows them. The service preserves at least one Allowed device that can reach the Owner account before an administrator can block or retire another installation. Installation credentials are random, stored in the encrypted local store, and revocable through the device record; they are not hardware attestation. The Server release can optionally include a separately signed Windows 10/11 Cylinder Client package. Its included deployment script validates the client installer hash and Authenticode signature before staging it to a VPN share or installing it through explicitly requested PowerShell remoting.

Rank 2 can invite Rank 1 employees in their departments. Rank 3 may invite Rank 1 or 2 within their departments. Rank 4 may invite Rank 1–3 anywhere in the workspace. Invites can use an existing active, same-workspace Firebase account or create a new account. New accounts receive a password setup link in the management result and receive Firebase email verification when first signing in. A pending invite activates after verified sign-in. Removing a user from Cylinder does not delete their Firebase account or affect their separate Desktop identity.

Existing Firebase `Staff`, `Manager`, or `Administrator` roles are not automatically converted into Cylinder Ranks. The Owner is bootstrapped from trusted ownership data; other staff must be invited. There is no mass migration or legacy-role-based privilege promotion.

## Central control plane and enforcement

The `cylinderApi` Firebase HTTPS function uses Firebase Authentication and the Admin SDK. It stores employee memberships, departments, device records, workspace policy, and audit events in dedicated workspace subcollections. Firestore client rules deny direct access to these collections; management changes go through the function and are checked against current membership, Rank, and department scope.

`workspaces/{workspaceId}/cylinder_members/{uid}` is the canonical Cylinder directory, keyed by Firebase UID. The separate top-level `profiles/{uid}` keeps Firebase identity and legacy Desktop role/status; changing Cylinder Rank never changes that Desktop role. The encrypted local `userProfiles` array is a per-installation cache, not a complete staff directory or permission source. Cylinder refreshes cached Rank, job function, and department fields only when a successful heartbeat reports a change. The control-plane bootstrap reads all members only for Rank 4; other ranks query only assigned departments and deduplicate employees assigned to multiple departments. Administrator device and audit reads are likewise department-scoped. Composite indexes for these queries are declared in `firestore.cylinder.indexes.json` and selected by `firebase.cylinder.json`.

The Owner can publish a minimum Cylinder version for employee ranks, pause employee access, and set offline grace from 0 to 24 hours (default four). The Owner is exempt from the minimum-version and pause checks so the account can recover the workspace; disabling or suspending the shared Firebase profile still denies access. Administrators can allow/block/retire devices in their assigned departments and restrict installations to selected employees. Device and account revocations take effect on the next successful online check, normally within two minutes; a previously authorized session can continue offline until the configured grace expires.

Cylinder checks verified identity, active membership, device credential and status, department overlap, device user assignment, and minimum version at sign-in and on periodic heartbeat. Protected app actions require a current local Cylinder authorization. This service manages Cylinder access and does not configure native Windows Group Policy, Active Directory, Entra, or other software.

## Boundaries and production gates

Central management covers employee membership and rank, departments, device enrollment/authorization, a small set of workspace-wide app policies, and audit. It is not a general policy engine: there are no department-specific version/offline policies, configurable permission sets, or owner-transfer workflow. Department scope currently governs control-plane records and device eligibility; it does not filter operational data. Customer files and operational records remain local and are not centrally synchronized by this feature. Customer accounts are not supported as Cylinder employee sessions.

The `cylinderApi` function and Firestore rules are deployed to `overhead-office`; the backend rejects unauthenticated calls. Before employees can use these controls, build/sign/publish and install the updated Cylinder installer, then verify invite/verification/activation, each rank boundary, cross-department denial, device enrollment and revocation, minimum-version policy, offline expiry, and second-Owner-device recovery. Desktop sign-in, Desktop roles, and its per-user scope remain separate.
