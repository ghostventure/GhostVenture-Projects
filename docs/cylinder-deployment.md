# OverHead Cylinder deployment

## Purpose

OverHead Cylinder is the separate OverHead deployment for an organization running an in-house Windows Server or Windows IoT host. It is not the regular Windows desktop application and is not compatible with standard Windows editions.

## Compatibility gate

The Cylinder launcher reads the Windows `ProductName` registry value before starting OverHead. It permits editions whose product name identifies Windows Server or Windows IoT, including Windows IoT Enterprise. It displays an error and exits on standard Windows 10 and Windows 11 editions.

## Cylinder tier

Cylinder is the server deployment tier. It uses its own application ID, local data root (`%APPDATA%\OverHead Cylinder`), and updater feed. Its current entitlement definition supports up to 50 users and 100,000 customer records. Cylinder is not selectable in the standard desktop application.

## Evaluation and commercial activation

Cylinder provides one 30-day, no-card evaluation per server workspace. The evaluation does not create a payment and does not automatically renew. When it ends, the local application falls back to the standard entitlement until a Cylinder entitlement is issued.

Continued Cylinder access at the published $499/month or $4,990/year price requires a separate deployment order or contract, billing confirmation, and an issued entitlement. The standard desktop checkout does not sell Cylinder. Before collecting a payment, provide the customer the final price, billing interval, renewal, cancellation, refund, support, and invoice terms. Have qualified counsel review those final commercial terms before launch.

## Install

1. Download the current `OverHead-Cylinder-0.3.4-win-x64.zip` from `https://overhead-office.web.app/downloads/OverHead-Cylinder-0.3.4-win-x64.zip` on a supported Windows Server or Windows IoT host.
2. Verify `CYLINDER-SHA256SUMS.txt` inside the ZIP when the file came from an untrusted transfer path.
3. Extract the ZIP locally and run `OverHead-Cylinder-Setup-0.3.4-win-x64.exe` with an administrator account.
4. Launch OverHead Cylinder and create or sign in to the intended workspace.

## Updates

Cylinder never uses the regular desktop update feed. Its channel is:

`https://overhead-office.web.app/updates/cylinder/latest.yml`

Publish the Cylinder installer, blockmap, and matching `latest.yml` together under `/updates/cylinder/`. Do not place Cylinder artifacts in `/updates/`, which belongs to the standard desktop app.

## Operational boundaries

- Customer documents are copied into the local Cylinder data directory and indexed in the local record store. They are not automatically stored in Firebase Storage or replicated to other hosts.
- Customer support tickets can be shared through the Firebase workspace record path when the user is signed in with a Firebase-backed account.
- SMTP, Microsoft Entra registration/consent, payment providers, and code-signing credentials remain external configuration requirements.
