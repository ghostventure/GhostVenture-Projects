# OverHead 0.3.14 for Linux

- Adds a dedicated dark-mode Billing & Payments window for Linux with a single-window launch path.
- Opens Billing & Payments from the OverHead Payments entry or when a user selects a plan tier, with the chosen tier preselected.
- Connects billing actions to the shared Firebase billing service; Stripe payment details remain in Stripe Checkout.
- After checkout, waits for the signed billing update, saves the confirmed plan and license locally, refreshes the OverHead workspace, and returns focus to the main window.
- Verifies the signed-in workspace plan against the server before OverHead unlocks staff workspace features.
- Locks feature checks until the current session has completed server entitlement verification.
- Requires a fresh sign-in after app restart because Firebase ID tokens are not persisted.
- Publishes x86_64 AppImage and Debian packages. The built-in Linux updater reads the stable GitHub release feed.

The Firebase Functions update must be deployed before installations can pass the server plan gate. Successful package creation does not verify a live Stripe payment.
