# FoxHub Growth OS 17-Category Install - 2026-04-17

## Summary

Installed all 17 FoxHub enrichment categories as a first-class `Growth OS` workspace.

The goal is to make FoxHub feel loaded without turning the app into static copy. Each category now has:

- registry state
- visible workspace card
- status badge
- `Activate`
- `Run`
- `Open`
- event logging
- generated output records
- Firebase persistence allowances
- relevance grouping

## Relevance Groups

The 17 categories are now grouped so users see related work together instead of one long flat list.

1. Entry And Identity
   - Clear FoxHub Story
   - Role-Based Onboarding Wizard
   - Fox Pass Profile
2. Local Commerce
   - Local Services Marketplace
   - Booking And Request Flows
   - Business Mini-Stores
   - Deals Near Me
3. Community And Creators
   - Neighborhood Rooms
   - Creator And Influencer Tools
4. Trust And Money
   - Trust And Safety Layer
   - Fox Wallet Money Path
5. Operations And Intelligence
   - Operator Dashboard
   - Better Search
   - Smart Recommendations
6. Public Growth And Sales
   - Public Directory And SEO
   - Demo Data Mode
   - Build My Platform Showcase

The Growth OS screen includes group cards, group filter tabs, grouped category sections, and group-level Activate/Run controls.

## Installed Categories

1. Clear FoxHub Story
2. Role-Based Onboarding Wizard
3. Fox Pass Profile
4. Local Services Marketplace
5. Booking And Request Flows
6. Business Mini-Stores
7. Deals Near Me
8. Neighborhood Rooms
9. Trust And Safety Layer
10. Fox Wallet Money Path
11. Creator And Influencer Tools
12. Operator Dashboard
13. Better Search
14. Smart Recommendations
15. Public Directory And SEO
16. Demo Data Mode
17. Build My Platform Showcase

## Payment Friction Guard

The Growth OS workspace includes explicit readiness checks for the money path so users do not hit friction when it is time to pay.

Covered states:

- price shown before checkout
- fee disclosure before checkout
- deposit/hold/release steps
- receipt generation
- refund path
- provider payout setup
- dispute path
- setup warnings before payment

The following categories generate money-readiness records:

- Booking And Request Flows
- Business Mini-Stores
- Deals Near Me
- Fox Wallet Money Path
- Creator And Influencer Tools
- Demo Data Mode

## Important Files

- `src/useFoxHubStore.js`
  - Growth OS registry, state shape, output builders, activation and run handlers
- `src/FoxHubShell.jsx`
  - `Growth OS` nav item, grouped workspace UI, and group-level controls
- `src/data.js`
  - tab/view metadata
- `src/repository-firebase.js`
  - persistence field allowlist
- `firestore.rules`
  - Firestore write allowances for Growth OS state

## Verification

Run before deploy:

```bash
npm test
npm run build
```

Recommended smoke checks after deploy:

- `/` renders landing.
- `/signin` renders sign-in.
- Sign in locally or with a Firebase account.
- Open `Growth OS`.
- Confirm all 17 categories are visible.
- Confirm the 6 relevance groups are visible.
- Click `Activate all 17`.
- Click `Run all 17`.
- Filter to a group and confirm `Activate visible group` and `Run visible group` work.
- Confirm output and event records appear.

## Recovery Notes

- If Growth OS state does not persist in Firebase mode, check `src/repository-firebase.js` and `firestore.rules` for `growthCategories`, `growthEvents`, and `growthOutputs`.
- If the workspace does not appear, check the `growth` nav item in `src/FoxHubShell.jsx` and view metadata in `src/data.js`.
- If money-path copy changes, keep the pre-checkout friction guard visible.
