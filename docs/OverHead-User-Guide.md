# OverHead User Guide

**Windows desktop · Native Mac app · Website account**  
Release guide · November 2026

OverHead brings customer context, everyday work, owner review, and recovery tools into one practical workspace. This guide covers what to do in the Windows release, the native Mac app, and the OverHead website, and calls out where those experiences differ.

---PAGE---

# 1. Choose where to work

## Windows desktop

The Windows desktop release is the full installed office workspace. Use it for customer records, work queues, workflows, Microsoft imports, role management, approvals, reports, and the local recovery tools available in your installed release. Download the current installer or ZIP from the OverHead website and follow the release-specific installation notes.

## Native Mac app

The SwiftUI Mac app is available as a download from the OverHead website. The current release is version 0.1.4; the first Mac release was 0.1.0. It has its own encrypted Mac workspace and can sign in with the shared OverHead account. The current package is an unsigned Intel (x86_64) build for macOS 14 or later. macOS may require you to approve the app in **System Settings → Privacy & Security** the first time you open it. The app checks the OverHead update feed on launch and from **Settings → About**.

## Website

Use the website for product information, downloads, support, your shared account, and the billing controls that are enabled for your account. The website does not turn the local Mac or Windows record archive into a shared cloud database.

> Your OverHead account identity and website entitlement can be shared. Operational records remain in each desktop app’s local workspace unless a specific feature says otherwise. Do not expect Windows and Mac customer/task records to sync automatically.

---PAGE---

# 2. Set up the workspace

## Sign in and create the owner workspace

1. Open OverHead and choose **Team Access** for an owner or staff account. Customer accounts use the separate customer-access path.
2. Create or sign in with the email associated with your OverHead account. Complete email verification and accept the terms when prompted.
3. Enter the business and owner details requested by the app, then review the workspace profile and privacy settings.
4. Create an encrypted backup before importing a large set of records or making significant changes.

Before creating another account, sign in with the existing account or join its workspace so its users and information stay together. Mac 0.1.4 compares entered details with profiles stored on that Mac and checks business names in the shared workspace registry before signup. The shared check compares exact and similar business names, returns only whether a possible match exists, and does not reveal another workspace’s details. The endpoint allows 12 checks per IP address every 15 minutes. A possible match warns that a separate workspace can lead to duplicate subscriptions and asks for confirmation. Creating a separate workspace also requires an explicit acknowledgement. Website signup runs the same shared check and stops before account creation if the check is unavailable. If Firebase reports that the email already exists, the app returns the user to sign-in.

The Mac app uses Firebase Authentication for shared identity and selected account actions. Its operational archive is encrypted with AES-GCM and a key held in macOS Keychain. The Windows release has its own storage and recovery behavior; follow the instructions shown by that installed version.

## Use role-based access

Give each person only the access their work requires. OverHead includes owner, front desk, bookkeeper, support, and customer access paths. Owners manage protected settings and approvals. The Mac app’s staff profiles are local to that Mac workspace; they do not automatically provision Windows or website staff accounts.

Customer access is separate from team access. A customer invitation must match the email and workspace invitation. Customer pages are intended for support requests and account help, not access to staff records, billing controls, or the office work queue.

---PAGE---

# 3. Run daily work

## Dashboard

Start at **Team Dashboard** to review open tasks, overdue work, customers, and owner approvals. Add a task for the next action, log a short update when useful, and keep the responsible person and due date visible.

## Customers

Keep business name, contact details, service area, preferences, and service notes current. Use privacy masking when displaying the workspace around others. Attach customer documents only when they are needed for the work, and review an imported record before contacting that customer.

## Workflows

Use the Workflows area for appointments, approved customer answers, quotes, invoices, and follow-up tasks. Record the customer, timing, amount, notes, and status needed for the handoff. An owner can review protected changes in the approval queue. Create a quote or invoice PDF from its record and inspect it before sending it outside the business.

## Automations

Create a workflow job with a due time, then choose **Process due jobs** to run the local worker. Supported jobs create follow-up tasks; unsupported or repeatedly failing jobs are queued for review or moved to the dead-letter state. Processing a job does not send an email or message to a customer unless a separately configured service explicitly does so.

---PAGE---

# 4. Import and payment references

## Microsoft 365 and Business Central

1. In **Import**, choose Microsoft 365 contacts or Business Central customers.
2. Enter the Microsoft application client ID and tenant, then complete the browser/device-code sign-in.
3. For Business Central, select a company. Preview the records first, select only the customers you want, and import them.
4. Review imported records before outreach. Imports add local customer records and check for duplicates; they do not edit the Microsoft source.

Use only the read permissions shown in OverHead’s setup guidance. Never enter a Microsoft client secret or a provider password into the app.

## Stripe and Square

The Mac app can open provider setup pages and store non-secret configuration or manually imported reference summaries. Square token values are hashed before local storage. Stripe test-mode details and Square/Stripe count summaries do not authorize a live merchant, charge a card, or grant paid access.

The native Mac app does not offer paid checkout, subscription cancellation, or live payment processing. Version 0.1.4 can request a one-time, no-card 30-day Gold trial through the shared account service. A duplicate-workspace warning helps avoid separate workspace trials or future subscriptions, but it is not a billing action. A payment status typed or imported as a reference is not proof of payment.

---PAGE---

# 5. Protect and recover records

## Backups and exports

In **Settings → Reliability** or **Tools**, create an encrypted workspace backup before a restore or major data change. Export data when you need a readable workspace copy for review. Store backup and export files somewhere protected; anyone who obtains an unencrypted export may be able to read its contents.

Mac backups use the Keychain-managed encryption key from that Mac. Keep the Mac and its Keychain available when restoring. A backup is not verified until you have confirmed that the restore can be opened and the expected records are present.

## Privacy, integrity, and access

Use privacy mode to mask sensitive customer fields in summaries, set an inactivity lock, and review staff access regularly. The Evidence and Settings screens can check the hash-linked activity ledger; an integrity check reports changes for review and does not repair or remove records.

## Support requests

Include the app version, macOS or Windows version, the workflow, the last successful step, and the exact error. A sanitized support bundle can include workspace status and counts without customer profile fields or credentials. Never send a password, recovery phrase, card number, tax identifier, or an unredacted customer file.

---PAGE---

# 6. Plans, updates, and important boundaries

## Plans and trials

Review plan capacity and the Free Trial Policy before requesting a change. Mac version 0.1.4 can start one no-card, 30-day Gold trial per workspace through the shared trial service. Paid checkout and cancellation are unavailable in the Mac app. A local plan label or manually entered payment record does not activate a paid subscription. The website account panel is a read-only entitlement view; contact support for questions.

## Updating the Mac app

The Mac app checks `overhead-office.web.app/updates/mac/latest.json` on launch. To check manually, open **Settings → About → Check for updates now**. When a newer published version includes a download package, the app shows its version and link. The app does not silently replace itself; download and install a newer version when one is published.

## Keep the platform boundaries in mind

- Windows, Mac, and website features can differ by release and service configuration.
- The Mac app’s local operational records are separate from Windows records.
- Microsoft and provider integrations require their own configured accounts and permissions.
- Billing references and test-mode setup are not live payment processing.
- OverHead supports organization and follow-through; it does not replace owner review, legal/accounting/security advice, or your required backup and compliance plans.

For current downloads and support, visit [overhead-office.web.app](https://overhead-office.web.app). Review the installed version and current availability before relying on a workflow described here.
