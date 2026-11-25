# OverHead Billing module metadata

OverHead invokes the bundled `OverHeadBillingSync` executable after owner sign-in. It sends the current Firebase ID token over the child process's standard input; credentials are not placed in command-line arguments or written to the entitlement snapshot. The module verifies billing through the authenticated billing service and returns a versioned JSON response on standard output.

## Response contract

Top-level fields:

- `metadataVersion`: integer protocol version; currently `1`.
- `product`: `OverHead`.
- `tier`, `status`, `billingType`, `customerID`, `subscriptionID`, `trialEndsAt`, and `checkedAt`: convenient fields for the desktop client.
- `metadata`: stable metadata document containing `schemaVersion`, `product`, `checkedAt`, `plan`, `license`, `subscriber`, and `stripe`.
- `entitlement`, `license`, and `events`: source records returned by the billing service.

The `plan` object contains `tier`, `amountCents`, `currency`, `interval`, `description`, `inclusions`, `limits`, and boolean `features`. The listed USD prices currently come from the OverHead product catalog in the module; they are not fetched from Stripe Price objects and must not be treated as proof of an amount charged. `subscriber` contains account name, email, phone, company, DBA, and postal address fields when present in the account profile. The module permits an owner to complete missing billing contact fields locally. Card numbers, CVCs, secret API keys, and other payment credentials are never stored in this metadata.

## OverHead consumers

OverHead validates `metadataVersion`, `product`, and `metadata.schemaVersion` before applying an entitlement. It stores the metadata document in its encrypted workspace under the `entitlements` collection. `OverHeadStore.billingMetadataLimit(_:fallback:)` reads plan capacity limits, and `billingMetadataFeature(_:fallback:)` reads feature flags. The current consumers apply customer and staff-profile limits and gate workflow automation.

The module's cached entitlement snapshot is AES-GCM authenticated and encrypted with a machine-bound Keychain key. Its `OHENT1` prefix is a storage envelope version; it is separate from the JSON metadata schema version.
