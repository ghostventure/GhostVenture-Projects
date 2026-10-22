# Shared identity and plan entitlements

**Production audit: 2026-10-22.** The website, OverHead Desktop 0.3.24, Cylinder Server 0.3.24, and Cylinder Client 0.3.24 use the `overhead-office` Firebase project. The installed Desktop package and each staged Windows package were inspected and all point to that project.

## Shared records

Firebase Authentication is the identity source. The Firebase UID links the user across the website and all three Windows packages. Firestore stores the shared workspace profile and entitlement records:

| Record | Canonical path | Meaning |
| --- | --- | --- |
| User profile | `profiles/{uid}` | Shared identity, workspace membership, status, and standard OverHead role. |
| Workspace plan | `workspaces/{workspaceId}/billing/current` | Current workspace tier, billing/trial status, and seat summary when present. |
| Member license | `workspaces/{workspaceId}/licenses/{uid}` | Per-user tier and access status derived from the workspace entitlement. |
| Cylinder member | `workspaces/{workspaceId}/cylinder_members/{uid}` | Cylinder Rank, departments, job function, and membership status. |
| Cylinder device and policy | `workspaces/{workspaceId}/cylinder_devices/*`, `cylinder_policies/*` | Cylinder endpoint authorization and workspace app policies. |

The workspace plan is shared; its member licenses are keyed by Firebase UID so access can be shown for each person. Workspace roles and Cylinder Ranks have separate authority. A Cylinder Rank does not change the member's standard OverHead role or Desktop plan.

## How clients refresh

- The signed-in website reads the profile and listens to the workspace billing document and permitted license records through Firestore snapshots. Changes appear in the browser as Firestore sends them.
- Desktop reads the profile from the shared Firestore project and reads the same workspace billing document and its member-license document after shared sign-in. Signed-in standard staff sessions also refresh plan and license data every five minutes; the Payments view can request a manual sync. Desktop keeps an installation-local cache for offline use, so a device without a successful refresh can temporarily display its last-known state.
- Cylinder Server and Client authenticate against the same Firebase project and profile. Cylinder membership, Rank, departments, devices, and app policy are checked through the `cylinderApi` and refreshed by its heartbeat. Cylinder authorization is distinct from Desktop paid-plan licensing.
- Business records and customer files that the application identifies as local remain on the device. Shared identity and licensing do not imply that all operational data is centrally synchronized.

## Live Firebase status

The Firebase Functions inventory was checked in project `overhead-office` on 2026-10-22. It contains `trialApi`, `expireTrials`, and `cylinderApi` in `us-central1`. Unauthenticated requests were rejected by the deployed trial and Cylinder endpoints, confirming that those endpoints are present and require authentication. The `billingApi` endpoint returned HTTP 404 and is not deployed.

The deployed `trialApi` supports the no-card 90-day Gold trial, entitlement reads, expiry, and member-license reconciliation. The `cylinderApi` supports Cylinder membership and device policy. **Paid Desktop checkout, Stripe webhooks, paid plan changes, billed-seat reservations, and paid-license reconciliation are not live through `billingApi`.** The corresponding implementation exists in `functions/`, but source code and client UI do not constitute a deployed service. Client Firestore rules also prevent the website or Desktop from writing billing and license documents directly.

The website's account billing view is read-only for paid plans. Desktop can read and refresh shared entitlement data, but the absent `billingApi` means there is no production paid-subscription writer. The website's staff invitation and billed-seat actions that call `billingApi` cannot complete until that service is deployed.

## Deployment requirements before paid billing is called live

1. Configure the Stripe server secrets in Firebase Secret Manager without placing values in the repository, user guide, or website bundle.
2. Confirm production Stripe Price IDs and the current Firestore rules for seat billing.
3. Deploy `billingApi` to `overhead-office` and verify the deployed function inventory and authenticated endpoint.
4. Run Stripe test-mode checkout, webhook, cancellation, seat invite/removal, idempotency, and license reconciliation checks.
5. Verify that a changed workspace entitlement updates member licenses and appears in the website immediately and in Desktop at its next successful refresh.

Do not advertise or operate paid checkout, paid plan changes, seat charges, cancellations, or refunds as active before these gates pass. The live 90-day Gold trial and 30-day Cylinder evaluation are separate no-card flows.

## Verification boundary

This audit verified client project configuration, packaged app contents, Firestore paths and rules, and the deployed Functions inventory and unauthenticated endpoint responses. It did not read or change private customer records, verify an individual user's current plan, run an authenticated customer session, or perform a payment.
