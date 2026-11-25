# OverHead Mac Billing module

The native Mac app bundles `OverHeadBilling.app` as a separate companion application. It opens in its own window from the Billing menu or plan screens, runs as a single instance, and refuses to launch unless OverHead is running. The build script bundles the companion and its `OverHeadBillingSync` helper inside `OverHead.app`.

## Responsibilities

The module is the single native Mac entry point for OverHead subscriber plan billing metadata, plan records, subscriber licenses, and billing contact details. Subscriber customer invoices and payments remain in OverHead's normal customer workflows.

The module shows the Silver, Gold, and Black product catalog, price display, inclusions, billing type/status, license identifiers, Stripe customer/subscription identifiers, and subscriber details. Account name, email, and company name prefill when available from the authenticated profile. Phone, DBA, and address fields can be completed in the module and are retained in its encrypted archive.

The plan amounts shown in the Mac module are product-catalog values. They are not fetched from live Stripe Price objects and are not evidence that a charge was created. Paid checkout is not connected in the Mac module. Plan billing records made in the module are explicitly local references and do not create charges. Do not represent these controls as live Stripe processing.

## Startup plan check

After an owner signs in, OverHead invokes the bundled Billing sync helper and sends the short-lived Firebase ID token over standard input. The helper calls the authenticated billing service for entitlement, license, and billing activity data, then returns versioned metadata to OverHead. The token is not placed in process arguments or the saved entitlement snapshot.

OverHead validates the product and schema versions, applies the verified tier, stores the metadata in its encrypted workspace, and uses the tier limits and workflow-automation feature flag. Active, trialing, and past-due states keep the reported tier. An inactive or canceled entitlement falls back to Silver. When the service is unavailable, an existing verified entitlement is retained; without one, the app uses Silver.

The metadata exchange and OverHead consumers are documented in [`macOS/OverHeadNative/BILLING_MODULE_METADATA.md`](../macOS/OverHeadNative/BILLING_MODULE_METADATA.md).

## Local protection and release state

Billing records and the cached entitlement snapshot use AES-GCM authenticated encryption with a machine-bound key stored in macOS Keychain. An authentication failure prevents saved billing records from loading or being overwritten. The local build is ad-hoc signed for code/resource tamper detection; it is not Developer ID signed or notarized.

The native module is present in the local installed Mac app after building with `macOS/OverHeadNative/build-macos-app.sh`. The public Mac ZIP has not been rebuilt or published with this module. The current Mac billing service still depends on the deployed Firebase endpoint and an authenticated owner account.
