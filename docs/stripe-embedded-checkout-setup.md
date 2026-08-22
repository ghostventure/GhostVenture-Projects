# Stripe embedded checkout setup

The Stripe billing server lives in `functions/`. It is deliberately separate from the Electron app and hosted browser workspace: Stripe secret keys and webhook secrets must never be packaged into OverHead or included in the website bundle.

## Where to install it

Use the existing Firebase project: `overhead-office`.

1. In Firebase Console, open **overhead-office** and upgrade to the Blaze plan. Firebase Functions requires a billing-enabled project for this server workload.
2. In Stripe Dashboard, create three recurring monthly Products/Prices: Silver, Gold, and Black.
3. In this repository, install the function dependencies:

   ```powershell
   cd C:\Users\solid\Documents\Codex\OverHead\functions
   npm install
   ```

4. Set the two server-only secrets. Do not put these in the desktop app, website, source code, or a `.env` file committed to git:

   ```powershell
   npx firebase-tools functions:secrets:set STRIPE_SECRET_KEY --project overhead-office
   npx firebase-tools functions:secrets:set STRIPE_WEBHOOK_SECRET --project overhead-office
   ```

5. Create a local `functions/.env.overhead-office` file with the publishable key, three Stripe Price IDs, and a real HTTPS return page. The repository ignores `functions/.env*`; do not commit this file:

   ```text
   STRIPE_PUBLISHABLE_KEY=pk_test_replace_me
   STRIPE_PRICE_SILVER=price_replace_me
   STRIPE_PRICE_GOLD=price_replace_me
   STRIPE_PRICE_BLACK=price_replace_me
   BILLING_RETURN_URL=https://overhead-office.web.app/billing-return
   ```

6. Deploy test mode only. The browser workspace calls this same protected endpoint, so deploy Functions before publishing browser billing controls:

   ```powershell
   cd C:\Users\solid\Documents\Codex\OverHead
   npx firebase-tools deploy --config firebase.overhead.json --only functions --project overhead-office
   ```

7. In Stripe Dashboard, add the deployed `billingApi/webhook` URL as a webhook endpoint. Subscribe at minimum to `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, and `refund.created`. Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.

Only switch the values from `pk_test`/`sk_test`/test Price IDs to live values after an embedded test checkout updates the Firestore billing entitlement correctly.

The billing function refuses to create a second checkout when the workspace already has the requested active tier. It also places a short-lived checkout lock while a payment form is open, so a double-click or a second app window cannot start another subscription attempt.

## Billing workflow

1. An administrator can choose a tier from OverHead Desktop or from the signed-in website account page. Both use the same Firebase Authentication identity and `billingApi` endpoint.
2. A new workspace can instead select **Start Free 30-Day Gold Trial**. It requires no card, creates a one-time Gold-equivalent entitlement, and records an exact 30-day end time.
3. OverHead checks the central billing entitlement.
4. If the same tier is already active, OverHead confirms that no new charge was created.
5. If another checkout is already pending, OverHead blocks the second attempt.
6. Otherwise, OverHead opens embedded Stripe Checkout. Card details are handled by Stripe, not OverHead Desktop or the website.
7. Only Stripe's signed webhook activates, changes, suspends, or cancels a paid entitlement.
8. The scheduled `expireTrials` function and the entitlement check enforce trial expiration. Expired trial access and licenses are suspended; a workspace cannot start a second free trial.
9. After confirmation, OverHead refreshes the entitlement and silently updates each member's tier license.
10. When a customer requests proof of purchase, the owner or bookkeeper chooses **Create Full Receipt PDF** from Plans. OverHead creates a letter-size summary from the confirmed plan, billing record, payment references, and assigned licenses; no new checkout or charge is created.
11. When an owner chooses **Cancel Now & Refund Unused Time**, the server immediately cancels the Stripe subscription, calculates the unused fraction of its current paid billing period, and refunds that amount to the original payment method. The request is administrator-only, idempotent per subscription, and recorded in the central billing record. Access and workspace licenses are suspended immediately. A trial or a fully used period is canceled without a refund because no unused paid amount exists.

When the billing entitlement changes, the function automatically issues or updates a private tier license for every active workspace member. The desktop app remembers the member's assigned license locally after the next entitlement refresh; users do not need to enter or copy license numbers.

## Shared browser and desktop subscription service

The subscription source of truth is shared by the EXE and website:

- Identity and role: `profiles/{userUid}` through Firebase Authentication.
- Workspace entitlement: `workspaces/{workspaceId}/billing/current`.
- Member license: `workspaces/{workspaceId}/licenses/{userUid}`.
- Protected service: `https://us-central1-overhead-office.cloudfunctions.net/billingApi`.

The website `/account/` page reads the entitlement and license in real time. Administrators can start the one-time trial, choose a plan, open the Stripe billing portal, and request cancellation; managers and staff can view their reflected access but cannot change billing. The EXE receives the same entitlement during its next shared sign-in or entitlement refresh.

`billingApi` accepts browser calls only from `https://overhead-office.web.app` and `https://overhead-office.firebaseapp.com`. Do not broaden this allow-list without a reviewed production domain and a corresponding Functions deployment.

After building `website-next`, copy its `out` directory to `website-deploy` and deploy Hosting. Do not publish the browser billing controls as a live payment feature until the Functions deployment and the Stripe test checklist both succeed.
