# Customer management workspace integration

The panel is mounted as the `Customer Management` navigation section in `src/App.jsx`, alongside the existing core `Customers` section:

```jsx
<CustomerManagementWorkspace
  backendState={backendState}
  secureView={secureView}
/>
```

The route is limited to Owners, Front Desk, and Bookkeepers, matching the `customers` feature-collection role policy. The panel uses `window.overheadBackend` through `useFeatureRecords('customers')`, and reads loaded local customer, task, invoice, and staff-profile records from `backendState`.

The feedback inbox accepts validated JSON exported from the website `product_feedback` collection (up to 50 records per import); there is no automatic cloud sync. The panel has no customer email sender. Its follow-up action creates only an internal local task and checks the customer's channel preference first, blocking a “Do not contact” record. Ownership rules are saved and apply only after a staff member chooses the explicit action; existing owners are preserved unless the override checkbox is selected.

The panel does not send messages, automatically remind customers, or merge duplicate records. It includes a staff-entered customer interaction timeline; linking those notes to team @mentions remains outside this implementation.
