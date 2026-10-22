# OverHead Cylinder deployment

## Purpose

OverHead Desktop is the individual-user capacity and retains the full standard business feature set without Cylinder GPO controls. OverHead Cylinder is the multi-user, department-managed capacity for an organization running an in-house Windows Server or Windows IoT host. It has the same core OverHead business workflows and adds centralized employee Ranks, department scope, device policy, and an optional workstation-client distribution package. The server host and workstation client are separate applications.

## Compatibility gate

The Cylinder Server launcher reads the Windows `ProductName` registry value before starting OverHead. It permits editions whose product name identifies Windows Server or Windows IoT, including Windows IoT Enterprise. It displays an error and exits on standard Windows 10 and Windows 11 editions. The separate Cylinder Client package runs on Windows 10 or Windows 11 workstations and remote-desktop endpoints; it exits on Server and IoT editions.

## Shared application and variant behavior

Desktop, Cylinder Server, and Cylinder Client are built from the same React renderer, Electron main process, preload bridge, and local record backend. Shared UX, keyboard access, workspace tools, and backend performance changes therefore flow into both Cylinder variants on the next package build. Route-level lazy loading and common persistence/record APIs are shared as well. Cylinder is not a reduced feature fork of Desktop.

The Server and Client launchers set Cylinder deployment mode before loading the common application. That mode supplies Cylinder branding, isolated data paths and update feeds, and hides/blocks individual-user Desktop billing. The launchers apply different Windows edition gates; the Client is for managed endpoints, while the Server is the department host. Both use Cylinder membership/device policy where their signed-in user and enrolled device are authorized. Desktop continues to use its individual-user mode and data path. Server-side Rank and device-management controls remain governed by Cylinder authorization; the Client does not gain management authority merely by sharing the UI code.

## Build and verification

For a locally signed package, configure the approved Windows signing certificate and `OVERHEAD_EXPECTED_SIGNER`, then run one of these root scripts:

```powershell
npm run dist:cylinder
npm run dist:cylinder-client
```

Both scripts build the shared renderer before packaging. The Server installer is written under `release/`; the Client installer is written under `release/cylinder-client/`. These individual commands package one variant at a time and do not create a public release. `npm run release:prepare` builds Desktop, Client, and Server into `release/current/` and stages the optional workstation deployment package inside the Server installer; it requires the approved signing credentials. Follow [Windows release signing](windows-release-signing.md) for central preparation and publication.

`npm run build` verifies the shared renderer build only. A completed installer build verifies packaging, not installation or operation on real Server/IoT hardware, Windows workstations, VPNs, or remote PowerShell. `npm run release:verify` checks the published release feeds and artifact hashes after deployment; it does not prove those device/runtime behaviors. Do not describe a local package as published or installed without checking those steps separately.

## 0.3.24 local package record

The 0.3.24 Desktop UX and shared backend updates are included in both locally built Cylinder packages through the shared renderer and Electron backend. The shared work includes lazy-loaded workspaces, keyboard navigation and command search, the work planner and record history, bulk status updates, and batched persistence writes. Cylinder Server additionally retains its department Rank and device-policy integration; Cylinder Client remains an endpoint build and does not gain management authority from the shared UI.

The build outputs currently present in the workspace are:

| Package | Local installer | SHA-256 |
| --- | --- | --- |
| Cylinder Server | `release/OverHead-Cylinder-Setup-0.3.24-win-x64.exe` | `21e07655ff31b98ca14fdd35002ed7cbcc3496261cb68203a55692557204f46c` |
| Cylinder Client | `release/cylinder-client/OverHead-Cylinder-Client-Setup-0.3.24-win-x64.exe` | `f45b0ae8d96257a1d4f5d990ff806cd9e2db357e427468aa3bd20328f50fb584` |

Both local installers report Authenticode status `NotSigned`. Their SHA-256 values are recorded in `release/CYLINDER-SHA256SUMS.txt` and `release/cylinder-client/CYLINDER-CLIENT-SHA256SUMS.txt`, respectively. These are local packaging outputs, not production-signed distribution packages. Installation, real-device behavior, and publication to GitHub or Firebase must be verified separately before describing this version as installed or available to users. The renderer build and static checks passed for this work; no test suite or installation verification is claimed here.

## Cylinder tier

Cylinder Server uses its own application ID, local data root (`%APPDATA%\\OverHead Cylinder`), and updater feed. Cylinder Client has a separate application ID, data root (`%APPDATA%\\OverHead Cylinder Client`), and update channel. Both use the same Firebase-backed Cylinder Rank and device policy. Its current entitlement definition supports up to 50 users and 100,000 customer records. Cylinder is a separate deployment capacity; it is not an option that turns GPO controls on in the individual-user Desktop app.

## Evaluation and commercial activation

Cylinder provides one 30-day, no-card evaluation per server workspace. The evaluation does not create a payment and does not automatically renew. When it ends, the local application falls back to the standard entitlement until a Cylinder entitlement is issued.

Continued Cylinder access at the published $499/month or $4,990/year price requires a separate deployment order or contract, billing confirmation, and an issued entitlement. The standard desktop checkout does not sell Cylinder. Before collecting a payment, provide the customer the final price, billing interval, renewal, cancellation, refund, support, and invoice terms. Have qualified counsel review those final commercial terms before launch.

## Install

1. Use the Cylinder Server download offered at `https://overhead-office.web.app/cylinder/` on a supported Windows Server or Windows IoT host. A locally built version is not necessarily the published version.
2. Verify `CYLINDER-SHA256SUMS.txt` inside the ZIP when the file came from an untrusted transfer path.
3. Extract the ZIP locally and run its versioned Cylinder installer with an administrator account.
4. Launch OverHead Cylinder and create or sign in to the intended workspace.
5. During an interactive Server install, choose whether to include the optional **Cylinder Client Package**. It stages the signed Windows 10/11 client installer, SHA-256 file, and `Deploy-Cylinder-Clients.ps1` under the installed Cylinder directory. Select this on the Server host when it will distribute clients; silent in-app updates do not prompt or copy optional files.
6. Run the deployment script with `-StageTo \\server\share` to prepare a VPN-accessible share, or with `-ComputerName workstation01 -Install` to install over configured PowerShell remoting. Remote installs require the workstation to be reachable over the VPN, WinRM/PowerShell remoting enabled, and an authorized administrator identity. Use `-WhatIf` to preview. The script verifies the installer SHA-256 before staging or running it. Existing GPO, Intune, or software distribution tools can also use the same signed installer from the staged package.

## Updates and central release

Cylinder Server and Client never use the regular desktop update feed. Their channels are `https://overhead-office.web.app/updates/cylinder/latest.yml` and `https://overhead-office.web.app/updates/cylinder-client/latest.yml`. The central release workflow builds Desktop, Cylinder Client, and Cylinder Server under `release/current/`, then publishes their installers, blockmaps, feeds, ZIPs, and checksums in one Firebase Hosting release. The optional workstation package is embedded in the Server installer when the central release is prepared. Never place Cylinder artifacts in `/updates/`, which belongs to the standard desktop app.

## Operational boundaries

- Customer documents are copied into the local Cylinder data directory and indexed in the local record store. They are not automatically stored in Firebase Storage or replicated to other hosts.
- Customer support tickets can be shared through the Firebase workspace record path when the user is signed in with a Firebase-backed account.
- SMTP, Microsoft Entra registration/consent, payment providers, and code-signing credentials remain external configuration requirements.

## Central employee and device management

Cylinder includes a separate Firebase-backed Rank control plane for department membership, employee invitations, device enrollment/approval/blocking, and minimum-version/offline policies. See [Cylinder ranks and centralized management](ranks-and-cylinder-management.md) for authority, rollout, and recovery details. Its four Ranks do not change the standard Desktop app's per-user roles or local data. These controls enforce OverHead Cylinder access; they do not configure native Windows GPO, Active Directory, Entra, or other software.

The Cylinder function is deployed as its own Firebase codebase (`firebase.cylinder.json`), independently from billing secrets; Firestore rules are deployed to `overhead-office`. The backend is live, but employees cannot use it from the currently published 0.3.4 installer. The updated signed Cylinder installer must be built and published before the complete feature reaches users. Workspace data and customer files remain local; the central service manages identity and access policy, not shared record synchronization.

## September 2026 maintenance

See [Cylinder 0.3.13 maintenance notes](cylinder-sweep-0.3.13.md) for the UX and backend changes, local installer location, test commands, and validation boundaries.
