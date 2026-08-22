# Microsoft 365 and Business Central import setup

OverHead imports selected customer records into its local encrypted store. It does not collect Microsoft passwords, write to Microsoft, or overwrite an existing OverHead customer record.

## One-time Microsoft Entra setup

An Entra administrator must register a **public client/native desktop** application. Record its Application (client) ID and the tenant ID. Do not create or enter a client secret in OverHead.

1. In Microsoft Entra admin center, register an application for the organization. Choose the tenant audience that matches the organization; a commercial OverHead publisher app can be made multi-tenant later.
2. In Authentication, enable **Allow public client flows** so the installed desktop app can use Microsoft device-code sign-in.
3. Add delegated Microsoft Graph permissions: `User.Read`, `Contacts.Read`, and `offline_access`. `Contacts.Read` is the least permission used by the Outlook contact import.
4. For Business Central customer import, add the Business Central delegated `user_impersonation` permission. A Business Central administrator must also authorize the signed-in user to access the company and the customer API.
5. Grant consent only when the organization’s policy requires it. The user completes sign-in and consent on Microsoft’s own page.

## In OverHead

1. Open **Import**.
2. Choose **Microsoft 365 contacts** or **Business Central customers**.
3. Enter the Entra client ID and tenant ID. For Business Central, use the Business Central environment name, usually `Production`.
4. Select **Connect With Microsoft**. OverHead opens the default browser; if Microsoft asks for a device code, the code appears in the Import tab.
5. Use **Preview**. Review the records and select only the ones to create locally.

Connection tokens are held in OverHead's encrypted local store and are never exposed to the renderer. Each import checks the provider record ID and email before adding a customer. Existing records are skipped, never changed.

## Commercial release note

For a turnkey distributed release, Black Lion must register and publish its own Entra application, provide privacy-policy/support URLs, choose the supported tenant audience, and complete Microsoft publisher verification/consent review where applicable. Until then, the tenant administrator supplies an approved Entra client ID for their organization.
