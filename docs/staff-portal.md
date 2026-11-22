# OverHead Staff portal

The internal Staff portal is available at `/staff/`. It is for verified OverHead company staff and is separate from customer workspace Administrator, Manager, and Staff roles.

## Access control

The browser checks the server-issued Firebase custom claim `overhead_staff`. The `staffPortalApi` callable checks the same claim on every request. A user cannot gain access by changing a profile role, editing browser storage, or calling the API directly.

Grant or revoke the claim from a trusted operator environment with Firebase Admin credentials:

```sh
node functions/scripts/set-overhead-staff-claim.js FIREBASE_UID grant
node functions/scripts/set-overhead-staff-claim.js FIREBASE_UID revoke
```

Only verified accounts should receive the claim. After a change, the staff member must sign out and back in to refresh their ID token. Never add a public endpoint that lets a user grant this claim to themselves or another user.

## Staff capabilities

- Search a workspace by its ID, member email, business name, or owner name.
- Inspect workspace profiles, customers, tasks, approvals, support tickets, licenses, invitations, workspace audit events, billing status, and staff change history.
- Correct approved fields on member profiles, customer records, tasks, approvals, and support tickets. Role/status changes use bounded values. Record deletion, identity reassignment, and direct billing mutations are excluded.
- Override the workspace's supported feature entitlements, with a required reason and optional expiry. `Use plan` removes the override. Firestore rules enforce overrides for shared customer, task, and role writes.
- Review the staff audit trail. Each edit and feature override is written in the same Firestore batch as its audit event.

## Development-team boundary

Escalate code defects, schema migrations, production credential or payment-provider failures, Firebase infrastructure outages, account-authentication repair, and device-local database repair to the development team. Staff must use backup or support-bundle workflows rather than directly replacing a customer's local database. The portal does not expose service credentials, Stripe identifiers, customer passwords, or hard-delete operations.

## Release requirements

The portal is statically rendered by `website-next`; its privileged data operations run in the `functions-staff` Firebase codebase. Deploy that codebase and Firestore rules before using staff controls. Grant staff claims only after the callable is deployed. The functions use the Admin SDK and bypass Firestore client rules, so the callable's claim checks and field allowlists are the authorization boundary for staff writes.

## Staff invitations and account setup

An authorized staff member opens **OverHead Staff** in the desktop sidebar and uses **Invite a staff member**. Invitations are restricted to `@overheadteam.com`, expire after seven days, and replace any older pending invitation for the same address. The invitation code is stored as a hash and the raw code is sent by the desktop email delivery path.

The recipient opens OverHead Desktop, selects **OverHead Team**, then **Accept Staff Invitation**. They enter the invited `@overheadteam.com` alias, their personal email, invitation code, name, and a password of at least 12 characters. The company alias receives the invitation; Firebase sends account verification to the personal sign-in email. After verification, the server binds that company alias into the account's staff claim. The staff member signs in with their personal email. No staff member needs Firebase Console access.

### First staff account bootstrap

The first staff account is created once by the software owner: use **Create Workspace** in OverHead Desktop with the personal mailbox that can receive verification, complete email verification, then sign out. An authorized project operator with Firebase Admin credentials runs `node functions/scripts/set-overhead-staff-claim.js <verified-personal-email> grant <assigned-alias>@overheadteam.com` from the repository root (after installing `functions` dependencies). The staff claim records the company alias without embedding the personal address in source. The owner signs into **OverHead Team** again. This one-time bootstrap does not use an invitation code; the owner can then invite the rest of the staff in the portal. Deploy Functions and Firestore rules before using staff controls or invitations.

Desktop email delivery uses the configured `OVERHEAD_SMTP_*` environment values. If SMTP is not configured, OverHead queues the message in its local email outbox and displays the invitation code so the inviter can share it directly. Firebase Functions and Firestore rules must be deployed before invitation creation and acceptance are available.
